import { hashKey } from '../utils';
import type { GlobalStacheCache } from '../stache/cache';
import type { GlobalPagedStacheCache } from '../paged/paged-cache';
import { SvelteDate } from 'svelte/reactivity';
import { hydratable } from 'svelte';
import { browser } from '$app/environment';

// type BaseStacheParams = unknown;

type PageParams = {
	/**
	 * Number of pages to skip.
	 */
	pageOffset: number;
	/**
	 * Number of pages to fetch.
	 */
	pageCount: number;
};

type FetchPageParams = {
	/**
	 * Which page index to fetch.
	 */
	pageIndex: number;
	/**
	 * Number of items per page.
	 */
	pageSize: number;
};

type FetchFn<StacheFnParams, FetchReturnData> = (
	args: StacheFnParams
) => Promise<FetchReturnData> | FetchReturnData;

type PagedFetchFn<StacheFnParams, FetchReturnData> = (
	args: StacheFnParams,
	pageParams: FetchPageParams
) => Promise<FetchReturnData> | FetchReturnData;

type OnSuccessFn<Params, Result> = ({ params, result }: { params: Params; result: Result }) => void;

type StacheConstructorOptions<StacheFnParams, FetchReturnData> = {
	/**
	 * Unique identifier for the stache type.
	 * Used in conjunction with `params` to uniquely identify a stache instance.
	 *
	 * Staches with the same `id` but different `params` are treated as distinct instances.
	 */
	id: string;
	/**
	 * Function to fetch the stache data.
	 */
	fetch: FetchFn<StacheFnParams, FetchReturnData> | PagedFetchFn<StacheFnParams, FetchReturnData>;
	/**
	 * Number of times to retry fetching the stache on failure.
	 * Default is 0 (no retries).
	 */
	retries?: number;
	/**
	 * Optional global cache to use for storing stache instances.
	 * If not provided, the default global stache cache is used.
	 *
	 * You could provide a custom cache and automatically persist it to localStorage or IndexedDB, for example.
	 */
	globalCache?: GlobalStacheCache | GlobalPagedStacheCache;
	/**
	 * Stache will be considered stale after this time (in milliseconds) has passed since it was last fetched.
	 * Default is 5 minutes (300000 ms).
	 */
	staleTime?: number;
	/**
	 * Time in milliseconds to wait before cleaning up the stache from the cache after it has no active references.
	 * Default is 5 minutes (300000 ms).
	 */
	cleanupTime?: number;
	/**
	 * Refetch the stache automatically when it becomes stale.
	 * Default is false.
	 */
	refetchOnStale?: boolean;
	/**
	 * Whether to refetch the stache automatically when the window regains focus if the stache is stale.
	 * Default is true.
	 */
	refetchOnWindowFocus?: boolean;

	/**
	 * Whether your fetch function return type is hydratable.
	 *
	 * If true, will use svelte's `hydratable` function to attempt to cache the result during server-side rendering and reuse it on the client to avoid unnecessary fetches.
	 *
	 * See https://svelte.dev/docs/svelte/hydratable for more details.
	 *
	 * You may want to set this to false if you do not have experimental support for `async` svelte enabled, or if your fetch function return type cannot be parsed with [devalue](https://www.npmjs.com/package/devalue) (which is what `hydratable` uses under the hood for serialization).
	 *
	 * @default false
	 */
	isHydratable?: boolean;

	onSuccess?: OnSuccessFn<StacheFnParams, FetchReturnData>;

	onError?: (error: unknown) => void;
};

type UseStacheOptions<Params> = {
	/**
	 * Parameters used to fetch the stache data.
	 * Changing this will trigger a refetch.
	 */
	params?: Params;
	/**
	 * Whether the stache is enabled. Disabling will stop automatic fetching.
	 * Default is true.
	 */
	enabled?: boolean;
};

type UsePagedStacheOptions<Params, Result> = {
	/**
	 * Parameters used to fetch the stache data.
	 * Changing this will trigger a refetch.
	 */
	params?: Params;
	pageParams?: PageParams;
	/**
	 * Initial data to populate the stache with before fetching.
	 * Useful for server-side rendering or optimistic UI.
	 * Will only be used if there is no cached data for the given parameters.
	 */
	initialData?: Result;
	/**
	 * Whether the stache is enabled. Disabling will stop automatic fetching.
	 * Default is true.
	 */
	enabled?: boolean;
};

const maybeHydratable = <T>(
	key: string,
	fetcher: () => Promise<T> | T,
	isHydratable: boolean
): Promise<T> | T => {
	if (isHydratable) {
		return hydratable(key, () => fetcher());
	} else {
		return fetcher();
	}
};

/**
 * A class representing a stache with its state and behavior.
 * Manages fetching, caching, and state tracking.
 *
 * Queries are cached globally by their `id` and specific `params`.
 *
 * When a stache is created, it checks the global cache for an existing instance
 * with the same `id` and `params`. If found, it reuses that instance.
 *
 * Each stache instance tracks its own state, including:
 * - `isFetching`: whether a fetch is in progress
 * - `data`: the fetched data
 * - `error`: any error encountered during fetching
 * - `isError`, `isLoading`, `isSuccess`: derived states for convenience
 * - `lastFetched`: timestamp of the last successful fetch
 *
 * Queries can be enabled/disabled, and will automatically refetch when parameters change.
 *
 * Queries are automatically cleaned up from the cache after a period of inactivity (no references).
 *
 */
class CoreStache<FetchParams, FetchReturnData> {
	#scheduleCacheStatusCheckTimeout: ReturnType<typeof setTimeout> | null = null;

	/**
	 * Unique identifier for the stache.
	 * Used in conjunction with `params` (and `pageParams` if paged) to uniquely identify a stache instance.
	 *
	 * Queries with the same `id` but different `params` are treated as distinct instances.
	 */
	readonly id: string;

	readonly isHydratable: boolean;

	/**
	 * Function to fetch the stache data.
	 */
	readonly fetch:
		| FetchFn<FetchParams, FetchReturnData>
		| PagedFetchFn<FetchParams, FetchReturnData>;

	/**
	 * Number of times to retry fetching the stache on failure.
	 * Default is 0 (no retries).
	 */
	readonly retries: number = 0;

	/**
	 * Parameters used to fetch the stache data.
	 */
	readonly params: FetchParams;

	readonly cacheKey: string;

	/**
	 * Pagination parameters for the stache, if applicable.
	 */
	readonly fetchPageParams: FetchPageParams | undefined;

	readonly pageCacheKey: string | null = null;

	#enabled = $state(true);
	#fetchStatus: 'idle' | 'loading' | 'error' | 'success' = $state('idle');
	#cacheStatus: 'fresh' | 'stale' | 'empty' = $state('empty');
	#promise: Promise<void>;

	#raw: FetchReturnData | null = $state.raw(null);

	#data = $derived.by(() => this.#raw);

	#error: unknown = $state.raw(null);

	#lastFetched: Date | null = $state.raw(null);

	readonly staleTime = 5 * 60 * 1000;

	/**
	 * Time in milliseconds to wait before cleaning up the stache from the cache after it has no active references.
	 */
	readonly cleanupTime = 5 * 60 * 1000;

	/**
	 * Whether to refetch the stache automatically when the window regains focus if the stache is stale.
	 * Default is true.
	 */
	readonly refetchOnWindowFocus: boolean = true;
	readonly refetchOnStale: boolean = false;

	#onSuccess?: OnSuccessFn<FetchParams, FetchReturnData>;

	#onError?: (error: unknown) => unknown;

	/**
	 * Number of active references to this stache instance.
	 * Used to determine when to clean up the stache from the cache.
	 */
	referenceCount = $state(1);

	cleanupTimeout: ReturnType<typeof setTimeout> | null = null;

	canRun = (params: FetchParams) =>
		(this.fetch.length === 0 || params !== undefined) &&
		this.#enabled &&
		this.referenceCount > 0 &&
		this.#cacheStatus !== 'fresh';

	constructor(
		{
			id,
			fetch: fetchFn,
			retries,
			staleTime,
			cleanupTime,
			refetchOnStale,
			refetchOnWindowFocus,
			isHydratable = false,
			onSuccess,
			onError
		}: StacheConstructorOptions<FetchParams, FetchReturnData>,
		{ params, enabled }: UseStacheOptions<FetchParams>,
		fetchPageParams?: FetchPageParams
	) {
		this.id = id;
		this.fetch = fetchFn;
		this.isHydratable = isHydratable;
		if (retries !== undefined) {
			this.retries = retries;
		}
		this.params = params as FetchParams;
		this.cacheKey = hashKey(this.params);
		this.fetchPageParams = fetchPageParams;
		this.pageCacheKey = fetchPageParams ? hashKey(fetchPageParams) : null;
		if (staleTime !== undefined) {
			if (staleTime < 0) {
				throw new Error('staleTime must be a non-negative number');
			}
			this.staleTime = staleTime;
		}
		if (cleanupTime !== undefined) {
			if (cleanupTime < 0) {
				throw new Error('cleanupTime must be a non-negative number');
			}
			this.cleanupTime = cleanupTime;
		}
		if (refetchOnStale !== undefined) {
			this.refetchOnStale = refetchOnStale;
		}
		if (refetchOnWindowFocus !== undefined) {
			this.refetchOnWindowFocus = refetchOnWindowFocus;
		}

		this.#enabled = enabled ?? true;
		this.#onSuccess = onSuccess;
		this.#onError = onError;

		if (globalThis?.window && this.refetchOnWindowFocus) {
			window.addEventListener('focus', () => {
				this.#promise = this.#run();
			});
		}

		this.#promise = this.#run();
	}

	/**
	 *
	 * @param param0 Options to update on the stache instance.
	 * - `enabled`: Whether the stache is enabled. Disabling will stop automatic fetching.
	 * @param previousQuery Existing data from a previous fetch to be used when fetching new data.
	 *
	 * Updates the stache instance with the provided options and triggers a refetch if necessary.
	 */
	setOptions({ enabled }: Partial<UseStacheOptions<FetchParams>>) {
		if (enabled !== undefined) {
			this.#enabled = enabled;
		}

		this.#promise = this.#run();
	}

	/**
	 * Executes the stache function to fetch data.
	 * Manages the stache state during the fetch process.
	 * If the stache is disabled or already fetching, it will not run.
	 *
	 * @param params Parameters to pass to the stache function.
	 * @param previousQuery Existing data from a previous fetch to be used when fetching new data.
	 */
	#run({
		invalidated = false
	}: {
		invalidated?: boolean;
	} = {}): Promise<void> {
		if ((!invalidated && !this.canRun(this.params)) || this.#fetchStatus === 'loading') {
			return Promise.resolve();
		}
		this.#fetchStatus = 'loading';
		this.#error = null;

		// Don't use Promise.withResolvers, it's too new still
		let resolve: () => void;
		// let reject: (reason?: unknown) => void;
		const promise = new Promise<void>((res) => {
			resolve = res;
			// reject = rej;
		});
		Promise.resolve(
			maybeHydratable(
				`stache:${this.id}:${this.cacheKey}`,
				() =>
					this.fetchPageParams
						? (this.fetch as PagedFetchFn<FetchParams, FetchReturnData>)(
								this.params,
								this.fetchPageParams
							)
						: (this.fetch as FetchFn<FetchParams, FetchReturnData>)(this.params),
				this.isHydratable
			)
		)
			.then((data) => {
				this.#fetchStatus = 'success';
				this.#cacheStatus = 'fresh';
				this.#scheduleCacheStatusUpdate();
				this.#raw = data;
				this.#lastFetched = new SvelteDate();
				resolve();
				this.#onSuccess?.({ params: this.params, result: data });
			})
			.catch((err) => {
				if (err instanceof DOMException && err.name === 'AbortError') {
					this.#fetchStatus = 'idle';
				} else {
					this.#error = err;
					this.#fetchStatus = 'error';
					resolve();
				}
				this.#onError?.(err);
			});
		return promise;
	}

	#scheduleCacheStatusUpdate() {
		if (browser) {
			if (this.#scheduleCacheStatusCheckTimeout) {
				clearTimeout(this.#scheduleCacheStatusCheckTimeout);
			}
			this.#scheduleCacheStatusCheckTimeout = setTimeout(() => {
				this.#cacheStatus = 'stale';
				if (this.refetchOnStale) {
					this.#promise = this.#run();
				}
				this.#scheduleCacheStatusCheckTimeout = null;
			}, this.staleTime);
		}
	}

	/**
	 * Invalidates the stache, forcing it to refetch its data.
	 */
	invalidate() {
		this.#promise = this.#run({
			invalidated: true
		});
	}

	get enabled() {
		return this.#enabled;
	}

	get fetchStatus() {
		return this.#fetchStatus;
	}

	get cacheStatus() {
		return this.#cacheStatus;
	}

	get data() {
		return this.#data;
	}

	get error() {
		return this.#error;
	}

	get lastFetched() {
		return this.#lastFetched;
	}

	get promise() {
		return this.#promise;
	}
}

export { CoreStache };
export type {
	UseStacheOptions,
	UsePagedStacheOptions,
	StacheConstructorOptions,
	FetchFn,
	PagedFetchFn,
	FetchPageParams,
	PageParams
};

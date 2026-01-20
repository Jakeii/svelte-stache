import { untrack } from 'svelte';
import { hashKey } from './utils';
import type { GlobalPagedStacheCache, GlobalStacheCache, StacheCache } from './global/cache.svelte';
import { SvelteDate } from 'svelte/reactivity';

type BaseStacheParams = unknown;

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

type FetchFn<StacheFnParams extends BaseStacheParams, FetchReturnData> = (
	args: StacheFnParams
) => Promise<FetchReturnData> | FetchReturnData;

type PagedFetchFn<StacheFnParams extends BaseStacheParams, FetchReturnData> = (
	args: StacheFnParams,
	pageParams: FetchPageParams
) => Promise<FetchReturnData> | FetchReturnData;

type StacheConstructorOptions<StacheFnParams extends BaseStacheParams, Result, FetchReturnData> = {
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
};

type UseStacheOptions<Params extends BaseStacheParams, Result = unknown> = {
	/**
	 * Parameters used to fetch the stache data.
	 * Changing this will trigger a refetch.
	 */
	params?: Params | null;
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

type UsePagedStacheOptions<Params extends BaseStacheParams, Result> = {
	/**
	 * Parameters used to fetch the stache data.
	 * Changing this will trigger a refetch.
	 */
	params?: Params | null;
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
class Stache<FetchParams extends BaseStacheParams, Result, FetchReturnData> {
	/**
	 * The cache this stache belongs to, used for cleanup.
	 */
	private stacheCache: StacheCache;
	/**
	 * Instance of the cleanup timeout, if scheduled.
	 */
	private cleanupTimeout: ReturnType<typeof setTimeout> | null = null;

	private scheduleCacheStatusCheckTimeout: ReturnType<typeof setTimeout> | null = null;

	/**
	 * Unique identifier for the stache.
	 * Used in conjunction with `params` (and `pageParams` if paged) to uniquely identify a stache instance.
	 *
	 * Queries with the same `id` but different `params` are treated as distinct instances.
	 */
	readonly id: string;

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

	/**
	 * Pagination parameters for the stache, if applicable.
	 */
	readonly fetchPageParams: FetchPageParams | undefined;

	enabled = $state(true);
	fetchStatus: 'idle' | 'loading' | 'error' | 'success' = $state('idle');
	cacheStatus: 'fresh' | 'stale' = $state('fresh');
	data: FetchReturnData | null = $state(null);

	extractData: (data: any) => Result = (data: any) => data;

	/**
	 * Initial data to populate the stache with before fetching.
	 * Useful for server-side rendering or optimistic UI.
	 */
	initialData: Result | null = null;
	error: unknown = $state(null);
	isFetching = $derived(this.fetchStatus === 'loading');
	isError = $derived(this.fetchStatus === 'error');
	isLoading = $derived(this.fetchStatus === 'loading');
	isSuccess = $derived(this.fetchStatus === 'success');
	lastFetched: SvelteDate | null = $state(null);
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

	/**
	 * Number of active references to this stache instance.
	 * Used to determine when to clean up the stache from the cache.
	 */
	referenceCount = $state(1);

	constructor(
		{
			id,
			params,
			fetch: fetchFn,
			retries,
			initialData,
			enabled,
			staleTime,
			cleanupTime,
			refetchOnStale,
			refetchOnWindowFocus
		}: StacheConstructorOptions<FetchParams, Result, FetchReturnData> &
			UseStacheOptions<FetchParams, Result>,
		stacheCache: StacheCache,
		fetchPageParams?: FetchPageParams
	) {
		this.stacheCache = stacheCache;
		this.id = id;
		this.fetch = fetchFn;
		if (retries !== undefined) {
			this.retries = retries;
		}
		this.params = params as FetchParams;
		this.fetchPageParams = fetchPageParams;
		this.initialData = initialData ?? null;
		this.data = null;
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

		// Determine if stache should be enabled
		if (enabled !== undefined) {
			this.enabled = enabled && this.params !== null;
		} else {
			this.enabled = this.params !== null;
		}

		this.run(this.params!, this.fetchPageParams);

		$effect(() => {
			if (this.referenceCount === 0 && !this.cleanupTimeout) {
				this.scheduleCleanup();
			} else if (this.referenceCount > 0 && this.cleanupTimeout) {
				clearTimeout(this.cleanupTimeout);
				this.cleanupTimeout = null;
			}
		});

		$effect(() => {
			if (this.lastFetched && this.cacheStatus === 'fresh') {
				untrack(() => {
					this.scheduleCacheStatusUpdate();
				});
			}
		});

		if (globalThis?.window && this.refetchOnWindowFocus) {
			window.addEventListener('focus', () => {
				if (this.cacheStatus === 'stale') {
					this.run(this.params!, this.fetchPageParams);
				}
			});
		}
	}

	/**
	 *
	 * @param param0 Options to update on the stache instance.
	 * - `params`: New parameters for the stache. Changing this will trigger a refetch.
	 * - `initialData`: New initial data to set. This does not trigger a refetch.
	 * - `enabled`: Whether the stache is enabled. Disabling will stop automatic fetching.
	 * @param previousQuery Existing data from a previous fetch to be used when fetching new data.
	 *
	 * Updates the stache instance with the provided options and triggers a refetch if necessary.
	 */
	setOptions({ initialData, enabled }: Partial<UseStacheOptions<FetchParams, Result>>) {
		if (initialData !== undefined) this.initialData = initialData;

		if (enabled !== undefined) {
			this.enabled = enabled && this.params !== null;
		}

		this.run(this.params!, this.fetchPageParams);
	}

	/**
	 * Executes the stache function to fetch data.
	 * Manages the stache state during the fetch process.
	 * If the stache is disabled or already fetching, it will not run.
	 *
	 * @param params Parameters to pass to the stache function.
	 * @param previousQuery Existing data from a previous fetch to be used when fetching new data.
	 */
	private async run(params: FetchParams, fetchPageParams?: FetchPageParams): Promise<void> {
		if (!this.enabled || this.isFetching) return;
		this.fetchStatus = 'loading';
		this.error = null;
		try {
			const data = fetchPageParams
				? await (this.fetch as PagedFetchFn<FetchParams, FetchReturnData>)(params, fetchPageParams)
				: await (this.fetch as FetchFn<FetchParams, FetchReturnData>)(params);
			this.fetchStatus = 'success';
			this.cacheStatus = 'fresh';
			this.data = data;
			this.lastFetched = new SvelteDate();
		} catch (err) {
			if (err instanceof DOMException && err.name === 'AbortError') {
				// Aborted request, do nothing
				this.fetchStatus = 'idle';
				return;
			}
			this.error = err;
			this.fetchStatus = 'error';
			return;
		}
	}

	/**
	 * Schedules cleanup of the stache from the cache after a period of inactivity.
	 * If the stache gains a reference before the timeout, the cleanup is canceled (see constructor).
	 */
	private scheduleCleanup() {
		this.cleanupTimeout = setTimeout(() => {
			if (this.referenceCount <= 0) {
				this.stacheCache.delete(hashKey(this.params));
			}
			this.cleanupTimeout = null;
		}, this.cleanupTime);
	}

	private scheduleCacheStatusUpdate() {
		if (this.scheduleCacheStatusCheckTimeout) {
			clearTimeout(this.scheduleCacheStatusCheckTimeout);
		}
		this.scheduleCacheStatusCheckTimeout = setTimeout(() => {
			// if (this.lastFetched && Date.now() - this.lastFetched.getTime() > this.staleTime) {
			this.cacheStatus = 'stale';
			if (this.refetchOnStale) {
				this.run(this.params!);
			}
			// }
		}, this.staleTime);
	}

	/**
	 * Invalidates the stache, forcing it to refetch its data.
	 */
	async invalidate() {
		await this.run(this.params!);
	}
}

export { Stache };
export type {
	UseStacheOptions as StacheOptions,
	UsePagedStacheOptions,
	StacheConstructorOptions,
	FetchFn,
	PagedFetchFn,
	BaseStacheParams,
	FetchPageParams
};

import {
	Stache,
	type BaseStacheParams,
	type FetchFn,
	type StacheOptions
} from './stache.class.svelte';
import { getStache, getStacheCache, type GlobalStacheCache } from './global/cache.svelte';
import { hashKey } from './utils';
import { untrack } from 'svelte';

type CreateStacheOptions<StacheFnParams extends BaseStacheParams, FetchReturnData = unknown> = {
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
	fetch: FetchFn<StacheFnParams, FetchReturnData>;
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
	globalCache?: GlobalStacheCache;
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
type PublicStache<
	Params extends BaseStacheParams,
	Result = unknown,
	FetchReturnData = unknown
> = Pick<
	Stache<Params, Result, FetchReturnData>,
	| 'isFetching'
	| 'data'
	| 'error'
	| 'fetchStatus'
	| 'isError'
	| 'isLoading'
	| 'isSuccess'
	| 'lastFetched'
	| 'invalidate'
	| 'cacheStatus'
	| 'referenceCount'
	| 'params'
> & { _stache: Stache<Params, Result, FetchReturnData> | null };

type CreateStacheFn = <StacheParams extends BaseStacheParams, Result = unknown>(
	defineOptions: CreateStacheOptions<StacheParams, Result>
) => {
	useStache: UseStacheFn<StacheParams, Result>;
	/**
	 * Invalidates the stache with the given parameters, if it exists.
	 * @param args The parameters of the stache to invalidate.
	 */
	invalidate: (args: StacheParams) => void;
};

type UseStacheFn<StacheParams extends BaseStacheParams, Result = unknown> = {
	(optionsFn?: () => StacheOptions<StacheParams, Result>): PublicStache<StacheParams, Result>;
};

/**
 * Creates a stache definition with the given options.
 * The returned `useStache` function can be used to create and manage stache instances.
 *
 * Staches are cached globally by their `id` and specific `params`.
 * When `useStache` is called, it checks the cache for an existing instance
 * with the same `id` and `params`. If found, it reuses that instance.
 *
 * Each stache instance tracks its own state, including:
 * - `isFetching`: whether a fetch is in progress
 * - `data`: the fetched data
 * - `error`: any error encountered during fetching
 * - `isError`, `isLoading`, `isSuccess`: derived states for convenience
 * - `lastFetched`: timestamp of the last successful fetch
 *
 * Staches can be enabled/disabled, and will automatically refetch when parameters change.
 *
 * Staches are automatically cleaned up from the cache after a period of inactivity (no references).
 *
 * @param createOptions The options to define the stache.
 * @returns An object containing the `useStache` function and an `invalidate` method.
 */
const createStache = <
	StacheParams extends BaseStacheParams,
	Result = unknown,
	FetchReturnData = unknown
>(
	createOptions: CreateStacheOptions<StacheParams, FetchReturnData>
) => {
	const cache = getStacheCache(createOptions.id, createOptions.globalCache);

	const useStache = (useOptionsFn?: () => StacheOptions<StacheParams, Result>) => {
		const useOptions = useOptionsFn?.() ?? ({} as StacheOptions<StacheParams, Result>);

		const stacheKey = useOptions.params ? hashKey(useOptions.params) : 'no-params';

		let stache = $state(getStache(cache, stacheKey)) as
			| Stache<StacheParams, Result, FetchReturnData>
			| undefined;

		if (!stache) {
			stache = new Stache<StacheParams, Result, FetchReturnData>(createOptions, useOptions, cache);
			cache.set(stacheKey, stache);
		} else {
			stache.referenceCount++;
		}

		$effect(() => {
			const useOptions = useOptionsFn?.() ?? ({} as StacheOptions<StacheParams, Result>);
			untrack(() => {
				if (stache) {
					const newStacheKey = useOptions.params ? hashKey(useOptions.params) : 'no-params';
					if (newStacheKey === stacheKey) {
						// if params didn't change, just update options
						stache.setOptions(useOptions);
						return;
					}
					const matchExisting = getStache<StacheParams, Result, FetchReturnData>(
						cache,
						newStacheKey
					);
					if (matchExisting) {
						// if params changed and existing stache found, switch to it
						stache.referenceCount--;
						stache = matchExisting;
						// stache.setOptions(allOpts); // no need to set options, already set
						stache.referenceCount++;
					} else if (!matchExisting) {
						// if params changed but no existing stache, create new one with existing data
						stache = new Stache<StacheParams, Result, FetchReturnData>(
							createOptions,
							useOptions,
							cache
						);
						cache?.set(newStacheKey, stache);
					}
				}
			});

			return () => {
				if (stache) {
					stache.referenceCount--;
				}
			};
		});

		return {
			// Access the stache instance reactively because it is a $state
			get data() {
				return stache!.data ?? stache!.initialData;
			},
			get isFetching() {
				return stache!.isFetching;
			},
			get error() {
				return stache!.error;
			},
			get fetchStatus() {
				return stache!.fetchStatus;
			},
			get isError() {
				return stache!.isError;
			},
			get isLoading() {
				return stache!.isLoading;
			},
			get isSuccess() {
				return stache!.isSuccess;
			},
			get lastFetched() {
				return stache!.lastFetched;
			},
			get cacheStatus() {
				return stache!.cacheStatus;
			},
			get referenceCount() {
				return stache!.referenceCount;
			},
			get params() {
				return stache!.params;
			},
			invalidate: () => stache!.invalidate(),
			get _stache() {
				return stache!;
			}
		};
	};

	const invalidate = (args: StacheParams) => {
		const stacheKey = hashKey(args);
		cache?.get(stacheKey)?.invalidate();
	};

	return {
		useStache,
		invalidate
	};
};

export { createStache };
export type { CreateStacheFn, UseStacheFn, PublicStache };

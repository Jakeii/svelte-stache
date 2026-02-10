import {
	Stache,
	type FetchFn,
	type StacheConstructorOptions,
	type UseStacheOptions
} from './stache.class.svelte';
import {
	getStache,
	getStacheCache,
	type GlobalStacheCache,
	type StacheCache
} from './cache/stache.svelte';
import { hashKey } from './utils';
import { untrack } from 'svelte';
import type { Exact, Merge } from 'type-fest';

type CreateStacheOptions<StacheFnParams, FetchReturnData = unknown> = Merge<
	StacheConstructorOptions<StacheFnParams, FetchReturnData, FetchReturnData>,
	{
		fetch: FetchFn<StacheFnParams, FetchReturnData>;
		globalCache?: GlobalStacheCache;
	}
>;

type PublicStache<Params, Result = unknown, FetchReturnData = unknown> = Pick<
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

type CreateStacheFn = <StacheParams, Result>(
	defineOptions: CreateStacheOptions<StacheParams, Result>
) => {
	useStache: UseStacheFn<StacheParams, Result>;
	/**
	 * Invalidates the stache with the given parameters, if it exists.
	 * @param args The parameters of the stache to invalidate.
	 */
	invalidate: (args: StacheParams) => void;
};

type UseStacheFn<StacheParams, Result> = {
	(optionsFn?: () => UseStacheOptions<StacheParams, Result>): PublicStache<StacheParams, Result>;
};

/**
 * Retrieves an existing stache from the cache or creates a new one if it doesn't exist.
 *
 * @param cache The stache cache to retrieve from or add to.
 * @param stacheKey The unique key for the stache based on its parameters.
 * @param createOptions The options to create a new stache if needed.
 * @param useOptions The options to use when creating a new stache.
 * @returns The existing or newly created stache instance.
 */
const getOrCreateStache = <StacheParams, Result, FetchReturnData>(
	cache: StacheCache,
	stacheKey: string,
	createOptions: CreateStacheOptions<StacheParams, FetchReturnData>,
	useOptions: UseStacheOptions<StacheParams, Result>
): Stache<StacheParams, Result, FetchReturnData> => {
	let stache = getStache<StacheParams, Result, FetchReturnData>(cache, stacheKey);
	if (!stache) {
		stache = new Stache<StacheParams, Result, FetchReturnData>(createOptions, useOptions, cache);
	} else {
		stache.referenceCount++;
	}
	return stache;
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
const createStache = <StacheParams, Result, FetchReturnData>(
	createOptions: CreateStacheOptions<StacheParams, FetchReturnData>
) => {
	const cache = getStacheCache(createOptions.id, createOptions.globalCache);

	const useStache = <T extends Exact<UseStacheOptions<StacheParams, Result>, T>>(
		useOptionsFn: () => T = () => ({}) as T
	) => {
		const useOptions = useOptionsFn() as UseStacheOptions<StacheParams, Result>;
		const stacheKey = hashKey(useOptions?.params);

		let effectHasRun = $state(false);
		let stache: Stache<StacheParams, Result, FetchReturnData> = $state(
			getOrCreateStache<StacheParams, Result, FetchReturnData>(
				cache,
				stacheKey,
				createOptions,
				useOptions
			)
		);

		// Reactive effect to handle parameter changes and stache lifecycle
		// $effect is used over $derived for deeper reactivity and cleanup control
		$effect.pre(() => {
			const useOptions = useOptionsFn() as UseStacheOptions<StacheParams, Result>;
			const stacheKey = hashKey(useOptions?.params);

			untrack(() => {
				stache = (() => {
					// If this is the first run, we don't need to do anything
					// The stache was already created or retrieved outside the effect
					if (
						!effectHasRun ||
						(useOptions.params === undefined && createOptions.fetch.length > 0)
					) {
						effectHasRun = true;
						return stache;
					}

					// Check if an existing stache is in the cache, used to determine if we need to update options later
					const hasExistingStache = cache.has(stacheKey);

					// Get or create the stache instance based on the updated parameters
					const nextStache = getOrCreateStache<StacheParams, Result, FetchReturnData>(
						cache,
						stacheKey,
						createOptions,
						useOptions
					);

					if (hasExistingStache) {
						// Update the options of the existing stache if it was found in the cache
						nextStache.setOptions(useOptions);

						// Cancel any scheduled cleanup on the new stache since it's being used again
						nextStache.maybeCancelCleanup();
					}

					return nextStache;
				})();
			});

			return () => {
				if (stache) {
					// Decrement the reference count on cleanup
					if (stache.referenceCount > 0) {
						stache.referenceCount--;
					}
					// If reference count reaches zero, schedule cleanup
					if (stache.referenceCount === 0) {
						stache.scheduleCleanup();
					}
				} else {
					console.warn('Stache instance is undefined during cleanup.');
				}
			};
		});

		return {
			// Access the stache instance reactively because it is a $state
			get data() {
				return stache.data ?? (stache.initialData as FetchReturnData);
			},
			get enabled() {
				return stache.enabled;
			},
			get isFetching() {
				return stache.isFetching;
			},
			get error() {
				return stache.error;
			},
			get fetchStatus() {
				return stache.fetchStatus;
			},
			get isError() {
				return stache.isError;
			},
			get isLoading() {
				return stache.isLoading;
			},
			get isSuccess() {
				return stache.isSuccess;
			},
			get lastFetched() {
				return stache.lastFetched;
			},
			get cacheStatus() {
				return stache.cacheStatus;
			},
			get referenceCount() {
				return stache.referenceCount;
			},
			get params() {
				return stache.params;
			},
			invalidate: () => stache.invalidate(),
			get _stache() {
				return stache;
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

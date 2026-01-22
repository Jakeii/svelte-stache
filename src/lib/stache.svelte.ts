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
} from './global/cache.svelte';
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
		cache.set(stacheKey, stache);
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

	type UseStacheOptionsBase<StacheParams, Result> = UseStacheOptions<StacheParams, Result>;
	const useStache = <T extends Exact<UseStacheOptionsBase<StacheParams, Result>, T>>(
		useOptionsFn?: () => T
	) => {
		let initalizing = $state(true);
		const useOptions = (useOptionsFn?.() ?? {}) as UseStacheOptions<StacheParams, Result>;

		const stacheKey = useOptions.params ? hashKey(useOptions.params) : 'no-params';

		const originalStache = getOrCreateStache<StacheParams, Result, FetchReturnData>(
			cache,
			stacheKey,
			createOptions,
			useOptions
		);
		let stache = $state(originalStache);

		$effect.pre(() => {
			const useOptions = (useOptionsFn?.() ?? {}) as UseStacheOptions<StacheParams, Result>;
			const originalKey = stache?.params ? hashKey(stache?.params) : 'no-params';
			untrack(() => {
				if (!stache) {
					throw new Error('Stache instance is undefined in useStache effect.');
				}
				if (initalizing) {
					console.log('not running first effect for useStache with id:', createOptions.id);
					initalizing = false;
					return;
				}

				const newStacheKey = useOptions.params ? hashKey(useOptions.params) : 'no-params';
				const matchExisting = getStache<StacheParams, Result, FetchReturnData>(cache, newStacheKey);

				const isMissingParams = useOptions.params === undefined && createOptions.fetch.length > 0;
				const isKeyChanged = newStacheKey !== originalKey;

				if (isMissingParams) {
					// if params are undefined and fetch requires params, disable stache
					stache.referenceCount++;
					stache.setOptions({ ...useOptions, enabled: false });
				} else if (!isKeyChanged) {
					// if params didn't change, just update options
					stache.referenceCount++;
					stache.setOptions(useOptions);
				} else if (matchExisting) {
					// if params changed and existing stache found, switch to it
					// stache.referenceCount--;
					stache = matchExisting;
					stache.referenceCount++;
				} else {
					// if params changed but no existing stache, create new one with existing data
					stache = new Stache<StacheParams, Result, FetchReturnData>(
						createOptions,
						useOptions,
						cache
					);
					cache?.set(newStacheKey, stache);
				}

				stache.maybeCancelCleanup();
			});

			return () => {
				if (stache) {
					stache.referenceCount--;
					if (stache.referenceCount === 0) {
						console.log('Scheduling cleanup for stache:', stache.id, stache.params);
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
				return stache!.data ?? (stache!.initialData as FetchReturnData);
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

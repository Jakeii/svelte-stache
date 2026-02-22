import {
	CoreStache,
	type FetchFn,
	type StacheConstructorOptions,
	type UseStacheOptions
} from '../core/stache.class.svelte';
import {
	getStache,
	getStacheCache,
	type GlobalStacheCache,
	type StacheCache
} from './cache.svelte';
import { hashKey } from '../utils';
import { tick, untrack } from 'svelte';
import type { Exact, Merge } from 'type-fest';
import { browser } from '$app/environment';

type CreateStacheOptions<StacheFnParams, FetchReturnData = unknown> = Merge<
	StacheConstructorOptions<StacheFnParams, FetchReturnData>,
	{
		fetch: FetchFn<StacheFnParams, FetchReturnData>;
		globalCache?: GlobalStacheCache;
	}
>;

type Stache<Params, FetchReturnData = unknown> = Pick<
	CoreStache<Params, FetchReturnData>,
	| 'data'
	| 'enabled'
	| 'error'
	| 'fetchStatus'
	| 'lastFetched'
	| 'invalidate'
	| 'cacheStatus'
	| 'params'
> & {
	isError: boolean;
	isLoading: boolean;
	isSuccess: boolean;
};

type ThenMethod<Params, FetchReturnData = unknown> = <
	TResult1 = Stache<Params, FetchReturnData>,
	TResult2 = never
>(
	onfulfilled?:
		| ((value: Stache<Params, FetchReturnData>) => TResult1 | PromiseLike<TResult1>)
		| null
		| undefined,
	onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null | undefined
) => PromiseLike<TResult1 | TResult2>;

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
	(optionsFn?: () => UseStacheOptions<StacheParams>): Stache<StacheParams, Result>;
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
const getOrCreateStache = <StacheParams, FetchReturnData>(
	cache: StacheCache,
	stacheKey: string,
	createOptions: CreateStacheOptions<StacheParams, FetchReturnData>,
	useOptions: UseStacheOptions<StacheParams>
): CoreStache<StacheParams, FetchReturnData> => {
	let stache = getStache<StacheParams, FetchReturnData>(cache, stacheKey);
	if (!stache) {
		stache = new CoreStache<StacheParams, FetchReturnData>(createOptions, useOptions);
		cache.set(stacheKey, stache);
	} else {
		stache.referenceCount++;
		if (stache.cleanupTimeout) {
			clearTimeout(stache.cleanupTimeout);
		}
		stache.cleanupTimeout = null;
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
const createStache = <StacheParams, FetchReturnData>(
	createOptions: CreateStacheOptions<StacheParams, FetchReturnData>
) => {
	const cache = getStacheCache(createOptions.id, createOptions.globalCache);

	const useStache = <T extends Exact<UseStacheOptions<StacheParams>, T>>(
		useOptionsFn: () => T = () => ({}) as T
	) => {
		const useOptions = useOptionsFn() as UseStacheOptions<StacheParams>;
		const stacheKey = hashKey(useOptions?.params);

		let effectHasRun = false;
		// why not a derived? because state is mutated in the stache instance which isn't allowed in a derived.
		let stache: CoreStache<StacheParams, FetchReturnData> = $state(
			getOrCreateStache<StacheParams, FetchReturnData>(cache, stacheKey, createOptions, useOptions)
		);

		// Reactive effect to handle parameter changes and stache lifecycle
		// $effect is used over $derived for deeper reactivity and cleanup control
		$effect.pre(() => {
			const useOptions = useOptionsFn() as UseStacheOptions<StacheParams>;
			const stacheKey = hashKey(useOptions?.params);

			untrack(() => {
				// If this is the first run, we don't need to do anything
				// The stache was already created or retrieved outside the effect
				if (!effectHasRun || (useOptions.params === undefined && createOptions.fetch.length > 0)) {
					effectHasRun = true;
					return;
				}

				// Check if an existing stache is in the cache, used to determine if we need to update options later
				const hasExistingStache = cache.has(stacheKey);

				// Get or create the stache instance based on the updated parameters
				const nextStache = getOrCreateStache<StacheParams, FetchReturnData>(
					cache,
					stacheKey,
					createOptions,
					useOptions
				);

				if (hasExistingStache) {
					// Update the options of the existing stache if it was found in the cache
					nextStache.setOptions(useOptions);
				}

				stache = nextStache;
			});

			return () => {
				if (stache) {
					// Decrement the reference count on cleanup
					if (stache.referenceCount > 0) {
						stache.referenceCount--;
					}
					void tick().then(() => {
						// If reference count reaches zero, schedule cleanup
						if (stache.referenceCount === 0 && browser) {
							stache.cleanupTimeout = setTimeout(() => {
								// Double-check reference count before deleting from cache
								if (stache.referenceCount <= 0) {
									cache.delete(hashKey(stache.params));
								}
								stache.cleanupTimeout = null;
							}, stache.cleanupTime);
						}
					});
				} else {
					console.warn('Stache instance is undefined during cleanup.');
				}
			};
		});

		let resolved = false;

		const publicStache = {
			// Access the stache instance reactively because it is a $state
			get data() {
				return stache.data;
			},
			get enabled() {
				return stache.enabled;
			},
			get error() {
				return stache.error;
			},
			get fetchStatus() {
				return stache.fetchStatus;
			},
			get isError() {
				return stache.fetchStatus === 'error';
			},
			get isLoading() {
				return stache.fetchStatus === 'loading';
			},
			get isSuccess() {
				return stache.fetchStatus === 'success';
			},
			get lastFetched() {
				return stache.lastFetched;
			},
			get cacheStatus() {
				return stache.cacheStatus;
			},
			get params() {
				return stache.params;
			},
			invalidate: () => stache.invalidate(),
			get then(): ThenMethod<StacheParams, FetchReturnData> {
				if (!resolved) {
					return (onfulfilled, onrejected) =>
						stache.promise
							.then(() => {
								resolved = true;
								if (stache.fetchStatus === 'error') {
									return Promise.reject(stache.error);
								}
								return publicStache;
							})
							.then(onfulfilled, onrejected);
				}
				// return undefined to indicate that the promise has already resolved and prevent further chaining
				return undefined as unknown as ThenMethod<StacheParams, FetchReturnData>;
			},

			get catch() {
				return (onrejected: (reason: unknown) => void) => stache.promise.catch(onrejected);
			},

			get finally() {
				return stache.promise.finally(() => publicStache);
			}
		};

		return publicStache;
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
export type { CreateStacheFn, UseStacheFn, Stache };

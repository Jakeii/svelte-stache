import {
	CoreStache,
	type FetchFn,
	type StacheConstructorOptions,
	type UseStacheOptions
} from '../core/stache.class.svelte';
import {
	applyInvalidation,
	dispatchInvalidation,
	getStacheCache,
	StacheCache,
	type InvalidateDetail
} from '../cache.svelte';
import { hashKey, SSR_INVALIDATE_WARNING } from '../utils';
import { tick, untrack } from 'svelte';
import type { Exact, Merge } from 'type-fest';

// Extracts the InitialData type from a useStache options object type.
// Falls back to FetchReturnData when initialData is absent or undefined.
type ExtractInitialData<T, FetchReturnData> = T extends { initialData?: infer I }
	? [Exclude<I, undefined>] extends [never]
		? FetchReturnData
		: Exclude<I, undefined>
	: FetchReturnData;

type CreateStacheOptions<StacheFnParams, FetchReturnData = unknown> = Merge<
	StacheConstructorOptions<StacheFnParams, FetchReturnData>,
	{
		fetch: FetchFn<StacheFnParams, FetchReturnData>;
		globalCache?: StacheCache;
	}
>;

type Stache<Params, FetchReturnData = unknown, InitialData = FetchReturnData> = Pick<
	CoreStache<Params, FetchReturnData, InitialData>,
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

type ThenMethod<Params, FetchReturnData = unknown, InitialData = FetchReturnData> = <
	TResult1 = Stache<Params, FetchReturnData, InitialData>,
	TResult2 = never
>(
	onfulfilled?:
		| ((value: Stache<Params, FetchReturnData, InitialData>) => TResult1 | PromiseLike<TResult1>)
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

type UseStacheFn<StacheParams, FetchReturnData> = {
	<InitialData = FetchReturnData>(
		optionsFn?: () => UseStacheOptions<StacheParams, FetchReturnData, InitialData>
	): Stache<StacheParams, FetchReturnData, InitialData>;
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
const getOrCreateStache = <StacheParams, FetchReturnData, InitialData = FetchReturnData>(
	stacheCache: StacheCache,
	id: string,
	stacheKey: string,
	createOptions: CreateStacheOptions<StacheParams, FetchReturnData>,
	useOptions: UseStacheOptions<StacheParams, FetchReturnData, InitialData>
): CoreStache<StacheParams, FetchReturnData, InitialData> => {
	let stache = stacheCache.getStache<StacheParams, FetchReturnData>(id, stacheKey) as
		| CoreStache<StacheParams, FetchReturnData, InitialData>
		| undefined;
	if (!stache) {
		stache = new CoreStache<StacheParams, FetchReturnData, InitialData>(createOptions, useOptions);
		stacheCache.setStache(
			id,
			stacheKey,
			stache as unknown as CoreStache<StacheParams, FetchReturnData>
		);
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
	// Do not store any stateful cache references in the factory itself; it would be shared across requests on the server.
	const useStache = <
		T extends Exact<
			UseStacheOptions<StacheParams, FetchReturnData, ExtractInitialData<T, FetchReturnData>>,
			T
		>
	>(
		useOptionsFn: () => T = () => ({}) as T
	) => {
		type InitialData = ExtractInitialData<T, FetchReturnData>;
		const cache = createOptions.globalCache ?? getStacheCache();
		const useOptions = useOptionsFn() as UseStacheOptions<
			StacheParams,
			FetchReturnData,
			InitialData
		>;
		const stacheKey = hashKey(useOptions?.params);

		let effectHasRun = false;
		// why not a derived? because state is mutated in the stache instance which isn't allowed in a derived.
		let stache: CoreStache<StacheParams, FetchReturnData, InitialData> = $state.raw(
			getOrCreateStache<StacheParams, FetchReturnData, InitialData>(
				cache,
				createOptions.id,
				stacheKey,
				createOptions,
				useOptions
			)
		);

		// Reactive effect to handle parameter changes and stache lifecycle
		// $effect is used over $derived for deeper reactivity and cleanup control
		$effect.pre(() => {
			const useOptions = useOptionsFn() as UseStacheOptions<
				StacheParams,
				FetchReturnData,
				InitialData
			>;
			const stacheKey = hashKey(useOptions?.params);

			untrack(() => {
				// If this is the first run, we don't need to do anything
				// The stache was already created or retrieved outside the effect
				if (!effectHasRun || (useOptions.params === undefined && createOptions.fetch.length > 0)) {
					effectHasRun = true;
					return;
				}

				// Check if an existing stache is in the cache, used to determine if we need to update options later
				const hasExistingStache = cache.hasStache(createOptions.id, stacheKey);

				// Get or create the stache instance based on the updated parameters
				const nextStache = getOrCreateStache<StacheParams, FetchReturnData, InitialData>(
					cache,
					createOptions.id,
					stacheKey,
					createOptions,
					useOptions
				);

				if (hasExistingStache) {
					// Update the options of the existing stache if it was found in the cache
					nextStache.setOptions({ enabled: useOptions.enabled });
				}

				stache = nextStache;
			});

			return () => {
				// create our own reference to the stache instance to ensure we have the correct one during cleanup, since the reactive `stache` variable may have changed after `tick()`
				const stache = cache.getStache<StacheParams, FetchReturnData>(createOptions.id, stacheKey);
				if (stache) {
					// Decrement the reference count on cleanup
					if (stache.referenceCount > 0) {
						stache.referenceCount--;
					}
					void tick().then(() => {
						// If reference count reaches zero, schedule cleanup
						if (stache.referenceCount === 0 && globalThis?.window) {
							stache.cleanupTimeout = setTimeout(() => {
								// Double-check reference count before deleting from cache
								if (stache.referenceCount <= 0) {
									cache.deleteStache(createOptions.id, stacheKey);
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

		// Settles once the current fetch has finished, rejecting with the fetch error if it failed
		const settle = () =>
			stache.promise.then(() => {
				// mark resolved before returning the (thenable) stache so promise adoption doesn't recurse
				resolved = true;
				if (stache.fetchStatus === 'error') {
					return Promise.reject(stache.error);
				}
				return publicStache;
			});

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
			get then(): ThenMethod<StacheParams, FetchReturnData, InitialData> {
				if (!resolved) {
					return (onfulfilled, onrejected) => settle().then(onfulfilled, onrejected);
				}
				// return undefined to indicate that the promise has already resolved and prevent further chaining
				return undefined as unknown as ThenMethod<StacheParams, FetchReturnData, InitialData>;
			},

			get catch() {
				return <TResult = never>(
					onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
				) => settle().catch(onrejected);
			},

			get finally() {
				return (onfinally?: (() => void) | null) => settle().finally(onfinally);
			}
		};

		return publicStache;
	};

	/**
	 * Invalidates the stache with the given parameters, if it exists. If no parameters are provided, it invalidates all staches created with this `createStache` instance.
	 * Does nothing during SSR.
	 *
	 * @param args The parameters of the stache to invalidate. If undefined, all staches in this cache will be invalidated.
	 */
	const invalidate = (args?: StacheParams) => {
		if (!globalThis?.window) {
			console.warn(SSR_INVALIDATE_WARNING);
			return;
		}
		const detail: InvalidateDetail = {
			kind: 'stache',
			id: createOptions.id,
			stacheKey: args === undefined ? undefined : hashKey(args)
		};
		if (createOptions.globalCache) {
			applyInvalidation(createOptions.globalCache, detail);
		} else {
			dispatchInvalidation(detail);
		}
	};

	return {
		useStache,
		invalidate
	};
};

export { createStache };
export type { CreateStacheFn, UseStacheFn, Stache };

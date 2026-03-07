import { SvelteMap } from 'svelte/reactivity';
import type { CoreStache } from '../core/stache.class.svelte';

/**
 * A map of stache variants, where the key is the hashed parameters of the stache and the value is the corresponding CoreStache instance.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StacheVariantMap = SvelteMap<string, CoreStache<any, any>>;

/**
 * A map of stache caches, where the key is the stache ID and the value is a StacheVariants map.
 */
type GlobalStacheCache = SvelteMap<string, StacheVariantMap>;

/**
 * A global cache for stache instances, where the key is the stache ID and the value is a StacheVariants map.
 */
const globalStacheCache: GlobalStacheCache = new SvelteMap();

/**
 * Retrieves the stache variant map for a given stache ID from the global cache. If the stache variant map does not exist, it creates a new one and stores it in the global cache before returning it.
 *
 * @param id The stache ID for which to retrieve the stache variant map.
 * @param globalCache An optional global cache to use instead of the default global stache cache. If not provided, the default global stache cache will be used.
 */
const getStacheVariantMap = <FetchParams, FetchReturnData>(
	id: string,
	globalCache?: GlobalStacheCache
): StacheVariantMap => {
	const stacheCache: GlobalStacheCache = globalCache ?? globalStacheCache;
	let cache = stacheCache.get(id);
	if (!cache) {
		cache = new SvelteMap<string, CoreStache<FetchParams, FetchReturnData>>();
		stacheCache.set(id, cache);
	}
	return cache;
};

/**
 * Retrieves a specific stache instance from the stache variant map using the provided stache key. If the stache instance does not exist, it returns undefined.
 *
 */
const getStache = <FetchParams, FetchReturnData>(
	stacheVariantMap: StacheVariantMap,
	hashedParamsKey: string
): CoreStache<FetchParams, FetchReturnData> | undefined => {
	return stacheVariantMap.get(hashedParamsKey) as
		| CoreStache<FetchParams, FetchReturnData>
		| undefined;
};

/**
 * Retrieves the global stache cache, which is a map of stache caches where the key is the stache ID and the value is a StacheVariants map.
 *
 * @returns The global stache cache.
 */
const getGlobalStacheCache = (): GlobalStacheCache => globalStacheCache;

/**
 * Invalidates all stache instances associated with a specific stache ID by calling the invalidate method on each stache instance in the corresponding stache variant map.
 *
 * @param id The stache ID for which to invalidate the stache instances.
 */
const invalidateStacheById = (id: string): void => {
	const cache = globalStacheCache.get(id);
	if (cache) {
		for (const stache of cache.values()) {
			stache.invalidate();
		}
	}
};

/**
 * Clears the entire global stache cache, removing all stache variants.
 */
const clearGlobalStacheCache = (): void => {
	globalStacheCache.forEach((cache) => cache.clear());
};

export {
	getStacheVariantMap,
	getStache,
	getGlobalStacheCache,
	invalidateStacheById,
	clearGlobalStacheCache
};
export type { GlobalStacheCache, StacheVariantMap };

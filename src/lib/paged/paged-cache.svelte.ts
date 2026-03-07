import { SvelteMap } from 'svelte/reactivity';
import type { CoreStache } from '../core/stache.class.svelte';

/**
 * The page key used in the paged stache cache.
 * will be a stringified page index and page size.
 */
type PageKey = string;
/**
 * The stache parameters key used in the paged stache cache.
 */
type StacheParamsKey = string;
type StacheId = string;

/**
 * The pages of a paged stache stored in a map, where the key is the page key and the value is the corresponding CoreStache instance for that page.
 */
type PagedStache<FetchParams, FetchReturnData> = SvelteMap<
	PageKey,
	CoreStache<FetchParams, FetchReturnData>
>;

/**
 * A map of paged stache variants, where the key is the hashed parameters of the stache and the value is the corresponding PagedStache instance containing the pages for that stache variant.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PagedStacheVariantMap = SvelteMap<StacheParamsKey, PagedStache<any, any>>;

/**
 * A map of paged stache caches, where the key is the stache ID and the value is a PagedStacheVariantMap containing the paged stache variants for that stache ID.
 */
type GlobalPagedStacheCache = SvelteMap<StacheId, PagedStacheVariantMap>;

/**
 * A global cache for paged stache instances.
 */
const pagedGlobalStacheCache: GlobalPagedStacheCache = new SvelteMap();

/**
 * Retrieves the paged stache variant map for a given stache ID from the global paged stache cache. If the paged stache variant map does not exist, it creates a new one and stores it in the global paged stache cache before returning it.
 *
 * @param id The stache ID for which to retrieve the paged stache variant map.
 * @param globalCache An optional global paged stache cache to use instead of the default global paged stache cache. If not provided, the default global paged stache cache will be used.
 */
const getPagedStacheVariantMap = <FetchParams, FetchReturnData>(
	id: string,
	globalCache?: GlobalPagedStacheCache
): PagedStacheVariantMap => {
	const pagedStacheCache: GlobalPagedStacheCache = globalCache ?? pagedGlobalStacheCache;
	let cache = pagedStacheCache.get(id);
	if (!cache) {
		cache = new SvelteMap<string, SvelteMap<PageKey, CoreStache<FetchParams, FetchReturnData>>>();
		pagedStacheCache.set(id, cache);
	}
	return cache;
};

/**
 * Retrieves the page cache for a given stache key from the paged stache variant map. If the page cache does not exist, it creates a new one and stores it in the paged stache variant map before returning it.
 *
 * @param pagedStacheCache The paged stache variant map from which to retrieve the page cache.
 * @param stacheKey The stache key for which to retrieve the page cache.
 * @returns The page cache for the given stache key.
 */
const getPagedStacheVariant = <FetchParams, FetchReturnData>(
	pagedStacheCache: PagedStacheVariantMap,
	stacheKey: string
): PagedStache<FetchParams, FetchReturnData> => {
	let cache = pagedStacheCache.get(stacheKey);
	if (!cache) {
		cache = new SvelteMap<PageKey, CoreStache<FetchParams, FetchReturnData>>();
		pagedStacheCache.set(stacheKey, cache);
	}
	return cache;
};

/**
 * Retrieves a specific stache instance for a given page key from the page cache. If the stache instance does not exist, it returns undefined.
 * @param pageCache
 * @param pageKey
 * @returns
 */
const getPagedStacheVariantPage = <FetchParams, FetchReturnData>(
	pageCache: SvelteMap<string, CoreStache<FetchParams, FetchReturnData>>,
	pageKey: string
): CoreStache<FetchParams, FetchReturnData> | undefined => {
	return pageCache?.get(pageKey) as CoreStache<FetchParams, FetchReturnData> | undefined;
};

/**
 * Retrieves the global paged stache cache, which is a map of paged stache caches where the key is the stache ID and the value is a PagedStacheVariantMap containing the paged stache variants for that stache ID.
 * @returns
 */
const getGlobalPagedStacheCache = (): GlobalPagedStacheCache => pagedGlobalStacheCache;

/**
 * Invalidates all stache instances associated with a specific stache ID by calling the invalidate method on each stache instance in the corresponding paged stache variant map.
 *
 * @param id The stache ID for which to invalidate the stache instances.
 */
const invalidatePagedStacheById = (id: string): void => {
	const cache = pagedGlobalStacheCache.get(id);
	if (cache) {
		for (const pageCache of cache.values()) {
			for (const stache of pageCache.values()) {
				stache.invalidate();
			}
		}
	}
};

/**
 * Clears the global paged stache cache by removing all entries from the cache.
 */
const clearGlobalPagedStacheCache = (): void => {
	pagedGlobalStacheCache.forEach((cache) => cache.clear());
};

export {
	getPagedStacheVariantMap,
	getPagedStacheVariant,
	getPagedStacheVariantPage,
	getGlobalPagedStacheCache,
	invalidatePagedStacheById,
	clearGlobalPagedStacheCache
};
export type { GlobalPagedStacheCache, PagedStacheVariantMap as PagedStacheCache };

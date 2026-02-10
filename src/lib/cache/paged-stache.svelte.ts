import { SvelteMap } from 'svelte/reactivity';
import type { Stache } from '../stache.class.svelte';

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
 * The paged stache cache structure.
 */
type PagedStacheCache = SvelteMap<StacheParamsKey, SvelteMap<PageKey, Stache<any, any, any>>>;

type GlobalPagedStacheCache = SvelteMap<StacheId, PagedStacheCache>;

const pagedGlobalStacheCache: GlobalPagedStacheCache = new SvelteMap();

const getPagedStacheCache = <FetchParams, Result, FetchReturnData>(
	id: string,
	globalCache?: GlobalPagedStacheCache
): PagedStacheCache => {
	const pagedStacheCache: GlobalPagedStacheCache = globalCache ?? pagedGlobalStacheCache;
	let cache = pagedStacheCache.get(id);
	if (!cache) {
		cache = new SvelteMap<
			string,
			SvelteMap<PageKey, Stache<FetchParams, Result, FetchReturnData>>
		>();
		pagedStacheCache.set(id, cache);
	}
	return cache;
};

const getPageCache = <FetchParams, Result, FetchReturnData>(
	pagedStacheCache: PagedStacheCache,
	stacheKey: string
): SvelteMap<PageKey, Stache<FetchParams, Result, FetchReturnData>> => {
	let cache = pagedStacheCache.get(stacheKey);
	if (!cache) {
		cache = new SvelteMap<PageKey, Stache<FetchParams, Result, FetchReturnData>>();
		pagedStacheCache.set(stacheKey, cache);
	}
	return cache;
};

const getPagedStache = <FetchParams, Result, FetchReturnData>(
	pageCache: SvelteMap<string, Stache<FetchParams, Result, FetchReturnData>>,
	pageKey: string
): Stache<FetchParams, Result, FetchReturnData> | undefined => {
	return pageCache?.get(pageKey) as Stache<FetchParams, Result, FetchReturnData> | undefined;
};

const getGlobalPagedStacheCache = (): GlobalPagedStacheCache => pagedGlobalStacheCache;

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

export {
	getPagedStacheCache,
	getPageCache,
	getPagedStache,
	getGlobalPagedStacheCache,
	invalidatePagedStacheById
};
export type { GlobalPagedStacheCache, PagedStacheCache };

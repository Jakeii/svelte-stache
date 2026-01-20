import { SvelteMap } from 'svelte/reactivity';
import type { Stache } from '../stache.class.svelte';

type StacheCache = SvelteMap<string, Stache<any, any, any>>;

type GlobalStacheCache = SvelteMap<string, StacheCache>;

const globalStacheCache: GlobalStacheCache = new SvelteMap();

type PagedStacheCache = SvelteMap<string, SvelteMap<string, Stache<any, any, any>>>;

type GlobalPagedStacheCache = SvelteMap<string, PagedStacheCache>;

const pagedGlobalStacheCache: GlobalPagedStacheCache = new SvelteMap();

const getStacheCache = <FetchParams, Result, FetchReturnData>(
	id: string,
	globalCache?: GlobalStacheCache
): StacheCache => {
	const stacheCache: GlobalStacheCache = globalCache ?? globalStacheCache;
	let cache = stacheCache.get(id);
	if (!cache) {
		cache = new SvelteMap<string, Stache<FetchParams, Result, FetchReturnData>>();
		stacheCache.set(id, cache);
	}
	return cache;
};

const getPagedStacheCache = <FetchParams, Result, FetchReturnData>(
	id: string,
	globalCache?: GlobalPagedStacheCache
): PagedStacheCache => {
	const pagedStacheCache: GlobalPagedStacheCache = globalCache ?? pagedGlobalStacheCache;
	let cache = pagedStacheCache.get(id);
	if (!cache) {
		cache = new SvelteMap<
			string,
			SvelteMap<string, Stache<FetchParams, Result, FetchReturnData>>
		>();
		pagedStacheCache.set(id, cache);
	}
	return cache;
};

const getStache = <FetchParams, Result, FetchReturnData>(
	stacheCache: StacheCache,
	stacheKey: string
): Stache<FetchParams, Result, FetchReturnData> | undefined => {
	return stacheCache.get(stacheKey) as Stache<FetchParams, Result, FetchReturnData> | undefined;
};

const getPagedStache = <FetchParams, Result, FetchReturnData>(
	pagedStacheCache: PagedStacheCache,
	pageKey: string,
	stacheKey: string
): Stache<FetchParams, Result, FetchReturnData> | undefined => {
	const pageCache = pagedStacheCache.get(pageKey);
	return pageCache?.get(stacheKey) as Stache<FetchParams, Result, FetchReturnData> | undefined;
};

export { getStacheCache, getPagedStacheCache, getStache, getPagedStache };
export type { GlobalStacheCache, StacheCache, GlobalPagedStacheCache, PagedStacheCache };

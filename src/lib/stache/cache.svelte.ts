import { SvelteMap } from 'svelte/reactivity';
import type { CoreStache } from '../core/stache.class.svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StacheCache = SvelteMap<string, CoreStache<any, any>>;

type GlobalStacheCache = SvelteMap<string, StacheCache>;

const globalStacheCache: GlobalStacheCache = new SvelteMap();

const getStacheCache = <FetchParams, FetchReturnData>(
	id: string,
	globalCache?: GlobalStacheCache
): StacheCache => {
	const stacheCache: GlobalStacheCache = globalCache ?? globalStacheCache;
	let cache = stacheCache.get(id);
	if (!cache) {
		cache = new SvelteMap<string, CoreStache<FetchParams, FetchReturnData>>();
		stacheCache.set(id, cache);
	}
	return cache;
};

const getStache = <FetchParams, FetchReturnData>(
	stacheCache: StacheCache,
	stacheKey: string
): CoreStache<FetchParams, FetchReturnData> | undefined => {
	return stacheCache.get(stacheKey) as CoreStache<FetchParams, FetchReturnData> | undefined;
};

const getGlobalStacheCache = (): GlobalStacheCache => globalStacheCache;

const invalidateStacheById = (id: string): void => {
	const cache = globalStacheCache.get(id);
	if (cache) {
		for (const stache of cache.values()) {
			stache.invalidate();
		}
	}
};

export { getStacheCache, getStache, getGlobalStacheCache, invalidateStacheById };
export type { GlobalStacheCache, StacheCache };

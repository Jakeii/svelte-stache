import { SvelteMap } from 'svelte/reactivity';
import type { Stache } from '../stache.class.svelte';

type StacheCache = SvelteMap<string, Stache<any, any, any>>;

type GlobalStacheCache = SvelteMap<string, StacheCache>;

const stacheCache: GlobalStacheCache = new SvelteMap();

type PagedStacheCache = SvelteMap<string, SvelteMap<string, Stache<any, any, any>>>;

type GlobalPagedStacheCache = SvelteMap<string, PagedStacheCache>;

const pagedStacheCache: GlobalPagedStacheCache = new SvelteMap();

export { stacheCache, pagedStacheCache };
export type { GlobalStacheCache, StacheCache, GlobalPagedStacheCache, PagedStacheCache };

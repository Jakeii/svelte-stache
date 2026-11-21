import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync } from 'svelte';
import { createPagedStache } from '../paged.svelte';
import { StacheCache } from '../../cache.svelte';

function withEffectRoot(fn: () => void | Promise<void>) {
	return async () => {
		let promise: void | Promise<void> = Promise.resolve();
		const cleanup = $effect.root(() => {
			promise = fn();
		});
		await promise;
		cleanup();
	};
}

vi.mock('svelte', async () => {
	const svelte = await vi.importActual('svelte');
	return {
		...svelte,
		hydratable: <T>(key: string, fetcher: () => Promise<T>) => Promise.resolve(fetcher()),
		createContext: <T>() => {
			let context: T;
			const getContext = (): T => context;
			const setContext = (value: T): void => {
				context = value;
			};
			return [getContext, setContext] as const;
		}
	};
});

type Item = { id: number; value: string };
type PageResponse = { data: Item[]; totalCount: number };

function makePageResponse(pageIndex: number, pageSize: number, totalCount: number): PageResponse {
	const start = pageIndex * pageSize;
	const end = Math.min(start + pageSize, totalCount);
	return {
		data: Array.from({ length: end - start }, (_, i) => ({
			id: start + i,
			value: `item-${start + i}`
		})),
		totalCount
	};
}

describe('createPagedStache initialData', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it(
		'should populate each page from its initialData slice without fetching',
		withEffectRoot(async () => {
			const globalCache = new StacheCache();
			const fetchFn = vi.fn();

			const { useStache } = createPagedStache({
				id: 'paged-initial-data-slices',
				fetch: fetchFn,
				pageSize: 10,
				getData: (r: PageResponse) => r.data,
				getTotalCount: (r: PageResponse) => r.totalCount,
				globalCache
			});

			const page0 = makePageResponse(0, 10, 20);
			const page1 = makePageResponse(1, 10, 20);

			const params = $state(null);
			const stache = useStache(() => ({
				params,
				pageParams: { pageOffset: 0, pageCount: 2 },
				initialData: [page0, page1],
				initialDataFetchedAt: new Date()
			}));

			flushSync();

			expect(stache.pages[0]).toEqual(page0.data);
			expect(stache.pages[1]).toEqual(page1.data);
			expect(stache.cacheStatus).toBe('fresh');
			expect(fetchFn).not.toHaveBeenCalled();
		})
	);

	it(
		'should treat all pages as fresh when initialDataFetchedAt is recent',
		withEffectRoot(async () => {
			const globalCache = new StacheCache();
			const fetchFn = vi.fn();

			const { useStache } = createPagedStache({
				id: 'paged-initial-data-fresh',
				fetch: fetchFn,
				pageSize: 10,
				getData: (r: PageResponse) => r.data,
				getTotalCount: (r: PageResponse) => r.totalCount,
				staleTime: 60_000,
				globalCache
			});

			const page0 = makePageResponse(0, 10, 20);
			const page1 = makePageResponse(1, 10, 20);

			const params = $state(null);
			const stache = useStache(() => ({
				params,
				pageParams: { pageOffset: 0, pageCount: 2 },
				initialData: [page0, page1],
				initialDataFetchedAt: new Date()
			}));

			flushSync();

			expect(stache.cacheStatus).toBe('fresh');
			expect(fetchFn).not.toHaveBeenCalled();
		})
	);

	it(
		'should trigger fetch for all pages when initialDataFetchedAt is stale',
		withEffectRoot(async () => {
			const globalCache = new StacheCache();
			const fetchFn = vi
				.fn()
				.mockImplementation((_, { pageIndex, pageSize }) =>
					Promise.resolve(makePageResponse(pageIndex, pageSize, 20))
				);

			const { useStache } = createPagedStache({
				id: 'paged-initial-data-stale',
				fetch: fetchFn,
				pageSize: 10,
				getData: (r: PageResponse) => r.data,
				getTotalCount: (r: PageResponse) => r.totalCount,
				staleTime: 60_000,
				globalCache
			});

			const staleDate = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
			const page0 = makePageResponse(0, 10, 20);
			const page1 = makePageResponse(1, 10, 20);

			const params = $state(null);
			const stache = useStache(() => ({
				params,
				pageParams: { pageOffset: 0, pageCount: 2 },
				initialData: [page0, page1],
				initialDataFetchedAt: staleDate
			}));

			flushSync();

			expect(stache.cacheStatus).toBe('stale');

			await vi.waitUntil(() => fetchFn.mock.calls.length >= 2);
			expect(fetchFn).toHaveBeenCalledTimes(2);
		})
	);

	it(
		'should fetch normally for pages beyond the initialData array length',
		withEffectRoot(async () => {
			const globalCache = new StacheCache();
			const fetchFn = vi
				.fn()
				.mockImplementation((_, { pageIndex, pageSize }) =>
					Promise.resolve(makePageResponse(pageIndex, pageSize, 30))
				);

			const { useStache } = createPagedStache({
				id: 'paged-initial-data-partial',
				fetch: fetchFn,
				pageSize: 10,
				getData: (r: PageResponse) => r.data,
				getTotalCount: (r: PageResponse) => r.totalCount,
				staleTime: 60_000,
				globalCache
			});

			// Only provide initialData for the first page; pageCount is 3
			const page0 = makePageResponse(0, 10, 30);

			const params = $state(null);
			const stache = useStache(() => ({
				params,
				pageParams: { pageOffset: 0, pageCount: 3 },
				initialData: [page0],
				initialDataFetchedAt: new Date()
			}));

			flushSync();

			// Page 0 has initial data, no fetch needed
			expect(stache.pages[0]).toEqual(page0.data);

			// Pages 1 and 2 had no initialData — they should fetch
			await vi.waitUntil(() => fetchFn.mock.calls.length >= 2);
			expect(fetchFn).toHaveBeenCalledTimes(2);
			expect(fetchFn).toHaveBeenCalledWith(null, { pageIndex: 1, pageSize: 10 });
			expect(fetchFn).toHaveBeenCalledWith(null, { pageIndex: 2, pageSize: 10 });
		})
	);

	it(
		'should fetch all pages normally when no initialData is provided',
		withEffectRoot(async () => {
			const globalCache = new StacheCache();
			const fetchFn = vi
				.fn()
				.mockImplementation((_, { pageIndex, pageSize }) =>
					Promise.resolve(makePageResponse(pageIndex, pageSize, 20))
				);

			const { useStache } = createPagedStache({
				id: 'paged-no-initial-data',
				fetch: fetchFn,
				pageSize: 10,
				getData: (r: PageResponse) => r.data,
				getTotalCount: (r: PageResponse) => r.totalCount,
				globalCache
			});

			const params = $state(null);
			const stache = useStache(() => ({
				params,
				pageParams: { pageOffset: 0, pageCount: 2 }
			}));

			flushSync();

			await vi.waitUntil(() => stache.data?.length === 20);

			expect(fetchFn).toHaveBeenCalledTimes(2);
			expect(stache.pages[0]).toBeDefined();
			expect(stache.pages[1]).toBeDefined();
		})
	);

	it(
		'should support initialData of a different type than the fetch return type',
		withEffectRoot(async () => {
			const globalCache = new StacheCache();
			const fetchFn = vi.fn();

			const { useStache } = createPagedStache({
				id: 'paged-initial-data-type-test',
				fetch: fetchFn,
				pageSize: 10,
				getData: (r: PageResponse) => r.data,
				getTotalCount: (r: PageResponse) => r.totalCount,
				globalCache
			});

			type InitialPage = { preloaded: Item[] };
			const page0: InitialPage = { preloaded: [{ id: 0, value: 'item-0' }] };

			const params = $state(null);
			const stache = useStache(() => ({
				params,
				pageParams: { pageOffset: 0, pageCount: 1 },
				initialData: [page0]
			}));

			flushSync();

			expect(stache.cacheStatus).toBe('stale');
			expect(fetchFn).to.toHaveBeenCalled();
		})
	);
});

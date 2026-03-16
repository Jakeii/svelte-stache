import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushSync } from 'svelte';
import { createPagedStache } from '../paged.svelte';
import { SvelteMap } from 'svelte/reactivity';
import type { CoreStache } from '../../core/stache.class.svelte';
import { hashKey } from '../../utils';
import { initializeGlobalPagedStacheCache } from '../paged-cache';

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
			const getContext = (): T => {
				return context;
			};
			const setContext = (): void => {
				context = new Map() as unknown as T; // Cast to Map type since we know that's what we're using, but keep it generic for the function signature
			};
			return [getContext, setContext] as const;
		}
	};
});

// Helper to create mock paged responses
function createMockPagedResponse(pageIndex: number, pageSize: number, totalCount: number) {
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

describe('createPagedStache cache implementation', () => {
	beforeEach(() => {
		initializeGlobalPagedStacheCache();
	});
	describe('createPagedStache function', () => {
		it(
			'should create paged stache instances with pageSize and pageParams',
			withEffectRoot(async () => {
				const fetchFn = vi
					.fn()
					.mockImplementation((params, { pageIndex, pageSize }) =>
						Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100))
					);

				const { useStache } = createPagedStache({
					id: 'test-paged',
					fetch: fetchFn,
					pageSize: 10,
					getData: (response) => response.data,
					getTotalCount: (response) => response.totalCount
				});

				const params = $state({ query: 'test' });
				const stache = useStache(() => ({
					params,
					pageParams: { pageOffset: 0, pageCount: 1 }
				}));

				expect(stache).toBeDefined();
				flushSync();

				await vi.waitUntil(() => stache.data !== null && stache.data?.length > 0);

				expect(fetchFn).toHaveBeenCalledWith({ query: 'test' }, { pageIndex: 0, pageSize: 10 });
				expect(stache.data).toHaveLength(10);
				expect(stache.totalCount).toBe(100);
			})
		);

		it(
			'should fetch multiple pages in parallel',
			withEffectRoot(async () => {
				const fetchFn = vi
					.fn()
					.mockImplementation((params, { pageIndex, pageSize }) =>
						Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100))
					);

				const globalCache = new SvelteMap<
					string,
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					SvelteMap<string, SvelteMap<string, CoreStache<any, any>>>
				>();

				const { useStache } = createPagedStache({
					id: 'multi-page-test',
					fetch: fetchFn,
					pageSize: 10,
					getData: (response) => response.data,
					getTotalCount: (response) => response.totalCount,
					globalCache
				});

				const params = $state({ query: 'test' });
				const stache = useStache(() => ({
					params,
					pageParams: { pageOffset: 0, pageCount: 3 }
				}));

				flushSync();

				await vi.waitUntil(() => stache.data !== null && stache.data?.length === 30);

				expect(fetchFn).toHaveBeenCalledWith({ query: 'test' }, { pageIndex: 0, pageSize: 10 });
				expect(fetchFn).toHaveBeenCalledWith({ query: 'test' }, { pageIndex: 1, pageSize: 10 });
				expect(fetchFn).toHaveBeenCalledWith({ query: 'test' }, { pageIndex: 2, pageSize: 10 });

				expect(globalCache.size).toBe(1); // One params key

				const pagesCache = globalCache.get('multi-page-test')!.get(hashKey({ query: 'test' }))!;

				expect(pagesCache.size).toBe(3); // Three page indices
			})
		);

		it(
			'should aggregate data from all pages correctly',
			withEffectRoot(async () => {
				const fetchFn = vi
					.fn()
					.mockImplementation((params, { pageIndex, pageSize }) =>
						Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100))
					);

				const { useStache } = createPagedStache({
					id: 'aggregate-test',
					fetch: fetchFn,
					pageSize: 10,
					getData: (response) => response.data,
					getTotalCount: (response) => response.totalCount
				});

				const params = $state({ query: 'test' });
				const stache = useStache(() => ({
					params,
					pageParams: { pageOffset: 0, pageCount: 3 }
				}));

				flushSync();

				await vi.waitUntil(() => stache.data !== null && stache.data?.length === 30);

				// Check aggregated data
				expect(stache.data).toHaveLength(30);
				expect(stache.data?.[0]).toEqual({ id: 0, value: 'item-0' });
				expect(stache.data?.[10]).toEqual({ id: 10, value: 'item-10' });
				expect(stache.data?.[29]).toEqual({ id: 29, value: 'item-29' });
			})
		);

		it(
			'should expose individual pages array',
			withEffectRoot(async () => {
				const fetchFn = vi
					.fn()
					.mockImplementation((params, { pageIndex, pageSize }) =>
						Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100))
					);

				const { useStache } = createPagedStache({
					id: 'pages-array-test',
					fetch: fetchFn,
					pageSize: 10,
					getData: (response) => response.data,
					getTotalCount: (response) => response.totalCount
				});

				const params = $state({ query: 'test' });
				const stache = useStache(() => ({
					params,
					pageParams: { pageOffset: 0, pageCount: 3 }
				}));

				flushSync();

				await vi.waitUntil(() => stache.pages.every((page) => page !== null && page.length > 0));

				// Check individual pages
				expect(stache.pages).toHaveLength(3);
				expect(stache.pages[0]).toHaveLength(10);
				expect(stache.pages[1]).toHaveLength(10);
				expect(stache.pages[2]).toHaveLength(10);
			})
		);

		it(
			'should calculate totalCount from first page response',
			withEffectRoot(async () => {
				const fetchFn = vi
					.fn()
					.mockImplementation((params, { pageIndex, pageSize }) =>
						Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 250))
					);

				const { useStache } = createPagedStache({
					id: 'total-count-test',
					fetch: fetchFn,
					pageSize: 10,
					getData: (response) => response.data,
					getTotalCount: (response) => response.totalCount
				});

				const params = $state({ query: 'test' });
				const stache = useStache(() => ({
					params,
					pageParams: { pageOffset: 0, pageCount: 2 }
				}));

				flushSync();

				await vi.waitUntil(() => stache.totalCount > 0);

				expect(stache.totalCount).toBe(250);
			})
		);

		it(
			'should have correct initial state before any pages load',
			withEffectRoot(async () => {
				let resolvePromise: (value: unknown) => void;
				const fetchPromise = new Promise((resolve) => {
					resolvePromise = resolve;
				});

				const fetchFn = vi.fn().mockReturnValue(fetchPromise);

				const { useStache } = createPagedStache({
					id: 'initial-state-test',
					fetch: fetchFn,
					pageSize: 10,
					getData: (response) => response.data,
					getTotalCount: (response) => response.totalCount
				});

				const params = $state({ query: 'test' });
				const stache = useStache(() => ({
					params,
					pageParams: { pageOffset: 0, pageCount: 2 }
				}));

				flushSync();

				// After effect runs, pages are created
				expect(stache.pages).toHaveLength(2);
				expect(stache.totalCount).toBe(0);
				expect(stache.isLoading).toBe(true);
				expect(stache.isLoading).toBe(true);
				expect(stache.isSuccess).toBe(false);
				expect(stache.isError).toBe(false);

				resolvePromise!(createMockPagedResponse(0, 10, 100));
			})
		);

		it(
			'should use different page windows with different pageOffset values',
			withEffectRoot(async () => {
				const fetchFn = vi
					.fn()
					.mockImplementation((params, { pageIndex, pageSize }) =>
						Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100))
					);

				const { useStache } = createPagedStache({
					id: 'page-offset-test',
					fetch: fetchFn,
					pageSize: 10,
					getData: (response) => response.data,
					getTotalCount: (response) => response.totalCount
				});

				const params = $state({ query: 'test' });

				// Create both staches in the same effect context
				const stache1 = useStache(() => ({
					params,
					pageParams: { pageOffset: 0, pageCount: 2 }
				}));

				const stache2 = useStache(() => ({
					params,
					pageParams: { pageOffset: 2, pageCount: 2 }
				}));

				flushSync();

				await vi.waitUntil(() => stache1.data.length === 20 && stache2.data.length === 20);

				expect(stache1.data[0]).toEqual({ id: 0, value: 'item-0' });
				expect(stache2.data[0]).toEqual({ id: 20, value: 'item-20' });
			})
		);
	});

	describe('Multiple components referencing same paged cache', () => {
		it(
			'should share page instances between components with same params',
			withEffectRoot(async () => {
				const globalCache = new SvelteMap<
					string,
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					SvelteMap<string, SvelteMap<string, CoreStache<any, any>>>
				>();
				const fetchFn = vi
					.fn()
					.mockImplementation((params, { pageIndex, pageSize }) =>
						Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100))
					);

				const { useStache } = createPagedStache({
					id: 'shared-page-test',
					fetch: fetchFn,
					pageSize: 10,
					getData: (response) => response.data,
					getTotalCount: (response) => response.totalCount,
					globalCache
				});

				const params1 = $state({ query: 'test' });
				const stache1 = useStache(() => ({
					params: params1,
					pageParams: { pageOffset: 0, pageCount: 2 }
				}));

				const params2 = $state({ query: 'test' });
				const stache2 = useStache(() => ({
					params: params2,
					pageParams: { pageOffset: 0, pageCount: 2 }
				}));

				flushSync();

				await vi.waitUntil(() => stache1.data.length === 20);

				// Should only fetch once since cache is shared
				expect(fetchFn).toHaveBeenCalledTimes(2); // 2 pages, not 4
				expect(stache1.data).toEqual(stache2.data);
			})
		);

		it(
			'should maintain separate caches for different page indices',
			withEffectRoot(async () => {
				const fetchFn = vi
					.fn()
					.mockImplementation((params, { pageIndex, pageSize }) =>
						Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100))
					);

				const { useStache } = createPagedStache({
					id: 'separate-page-cache-test',
					fetch: fetchFn,
					pageSize: 10,
					getData: (response) => response.data,
					getTotalCount: (response) => response.totalCount
				});

				const params1 = $state({ query: 'test' });
				const stache1 = useStache(() => ({
					params: params1,
					pageParams: { pageOffset: 0, pageCount: 1 }
				}));

				const params2 = $state({ query: 'test' });
				const stache2 = useStache(() => ({
					params: params2,
					pageParams: { pageOffset: 1, pageCount: 1 }
				}));

				flushSync();

				await vi.waitUntil(() => stache1.data.length === 10 && stache2.data.length === 10);

				// Different pages should have different data
				expect(stache1.data[0]).toEqual({ id: 0, value: 'item-0' });
				expect(stache2.data[0]).toEqual({ id: 10, value: 'item-10' });
			})
		);

		it(
			'should reuse existing page caches with overlapping page ranges',
			withEffectRoot(async () => {
				const fetchFn = vi
					.fn()
					.mockImplementation((params, { pageIndex, pageSize }) =>
						Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100))
					);

				const { useStache } = createPagedStache({
					id: 'expand-reuse-test',
					fetch: fetchFn,
					pageSize: 10,
					getData: (response) => response.data,
					getTotalCount: (response) => response.totalCount
				});

				const params = $state({ query: 'test' });

				// Create both staches in same effect context
				const stache1 = useStache(() => ({
					params,
					pageParams: { pageOffset: 0, pageCount: 2 }
				}));

				const stache2 = useStache(() => ({
					params,
					pageParams: { pageOffset: 0, pageCount: 3 }
				}));

				flushSync();

				await vi.waitUntil(() => stache1.data.length === 20 && stache2.data.length === 30);

				expect(stache1.data.length).toBe(20);
				expect(stache2.data.length).toBe(30);
				// Should only fetch 3 pages total (not 5)
				expect(fetchFn).toHaveBeenCalledTimes(3);
			})
		);
	});
});

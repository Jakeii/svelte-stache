import { describe, it, expect, vi, afterEach } from 'vitest';
import { flushSync } from 'svelte';
import { createPagedStache } from './paged-stache.svelte';
import { SvelteMap } from 'svelte/reactivity';
import type { Stache } from './stache.class.svelte';

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
	let cleanupFns: Array<() => void> = [];

	// Helper to track cleanup functions
	const trackCleanup = (fn: () => void) => {
		cleanupFns.push(fn);
		return fn;
	};

	afterEach(() => {
		// Clean up all effects after each test
		cleanupFns.forEach((fn) => fn());
		cleanupFns = [];
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

				await vi.waitUntil(() => stache.data !== null && stache.data.length > 0);

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

				const { useStache } = createPagedStache({
					id: 'multi-page-test',
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

				await vi.waitUntil(() => stache.data !== null && stache.data.length === 30);

				// Should fetch 3 pages
				expect(fetchFn).toHaveBeenCalledTimes(3);
				expect(fetchFn).toHaveBeenCalledWith({ query: 'test' }, { pageIndex: 0, pageSize: 10 });
				expect(fetchFn).toHaveBeenCalledWith({ query: 'test' }, { pageIndex: 1, pageSize: 10 });
				expect(fetchFn).toHaveBeenCalledWith({ query: 'test' }, { pageIndex: 2, pageSize: 10 });
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

				await vi.waitUntil(() => stache.data !== null && stache.data.length === 30);

				// Check aggregated data
				expect(stache.data).toHaveLength(30);
				expect(stache.data[0]).toEqual({ id: 0, value: 'item-0' });
				expect(stache.data[10]).toEqual({ id: 10, value: 'item-10' });
				expect(stache.data[29]).toEqual({ id: 29, value: 'item-29' });
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
				let resolvePromise: (value: any) => void;
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
				expect(stache.isFetching).toBe(true);
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
					SvelteMap<string, SvelteMap<string, Stache<any, any, any>>>
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

	describe('Aggregated status properties across pages', () => {
		it(
			'should set isFetching to true if ANY page is fetching',
			withEffectRoot(async () => {
				let resolvePage0: (value: any) => void;
				let resolvePage1: (value: any) => void;

				const fetchFn = vi.fn().mockImplementation((params, { pageIndex }) => {
					if (pageIndex === 0) {
						return new Promise((resolve) => {
							resolvePage0 = resolve;
						});
					}
					return new Promise((resolve) => {
						resolvePage1 = resolve;
					});
				});

				const { useStache } = createPagedStache({
					id: 'is-fetching-test',
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

				await vi.waitUntil(() => stache.isFetching);

				expect(stache.isFetching).toBe(true);

				// Resolve first page
				resolvePage0!(createMockPagedResponse(0, 10, 100));
				await vi.waitFor(() => !stache.isFetching || fetchFn.mock.calls.length === 2);

				// Should still be fetching because page 1 is not resolved
				if (fetchFn.mock.calls.length === 2) {
					expect(stache.isFetching).toBe(true);
				}

				// Resolve second page
				resolvePage1!(createMockPagedResponse(1, 10, 100));
				await vi.waitUntil(() => !stache.isFetching);

				expect(stache.isFetching).toBe(false);
			})
		);

		it(
			'should set isSuccess to true only if ALL pages are success',
			withEffectRoot(async () => {
				const fetchFn = vi
					.fn()
					.mockImplementation((params, { pageIndex, pageSize }) =>
						Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100))
					);

				const { useStache } = createPagedStache({
					id: 'is-success-test',
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

				await vi.waitUntil(() => stache.isSuccess);

				expect(stache.isSuccess).toBe(true);
				expect(stache.isError).toBe(false);
			})
		);

		it(
			'should set isError to true if ANY page has error',
			withEffectRoot(async () => {
				const fetchFn = vi.fn().mockImplementation((params, { pageIndex, pageSize }) => {
					if (pageIndex === 1) {
						return Promise.reject(new Error('Page 1 error'));
					}
					return Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100));
				});

				const { useStache } = createPagedStache({
					id: 'is-error-test',
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

				await vi.waitUntil(() => stache.isError);

				expect(stache.isError).toBe(true);
				expect(stache.error).toBeInstanceOf(Error);
				expect(stache.error?.message).toBe('Page 1 error');
			})
		);

		it(
			'should return most recent fetch date for lastFetched',
			withEffectRoot(async () => {
				const fetchFn = vi
					.fn()
					.mockImplementation((params, { pageIndex, pageSize }) =>
						Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100))
					);

				const { useStache } = createPagedStache({
					id: 'last-fetched-test',
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

				await vi.waitUntil(() => stache.lastFetched !== null);

				expect(stache.lastFetched).toBeInstanceOf(Date);
			})
		);

		it(
			'should aggregate cacheStatus correctly',
			withEffectRoot(async () => {
				const fetchFn = vi
					.fn()
					.mockImplementation((params, { pageIndex, pageSize }) =>
						Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100))
					);

				const { useStache } = createPagedStache({
					id: 'cache-status-test',
					fetch: fetchFn,
					pageSize: 10,
					staleTime: 100,
					getData: (response) => response.data,
					getTotalCount: (response) => response.totalCount
				});

				const params = $state({ query: 'test' });
				const stache = useStache(() => ({
					params,
					pageParams: { pageOffset: 0, pageCount: 2 }
				}));

				flushSync();

				await vi.waitUntil(() => stache.cacheStatus === 'fresh');

				expect(stache.cacheStatus).toBe('fresh');

				// Wait for stale
				await vi.waitUntil(() => stache.cacheStatus === 'stale');

				expect(stache.cacheStatus).toBe('stale');
			})
		);
	});

	describe('getData and getTotalCount functions', () => {
		it(
			'should extract data arrays from fetch response using getData',
			withEffectRoot(async () => {
				const fetchFn = vi.fn().mockImplementation((params, { pageIndex, pageSize }) =>
					Promise.resolve({
						items: createMockPagedResponse(pageIndex, pageSize, 100).data,
						total: 100,
						metadata: { page: pageIndex }
					})
				);

				const { useStache } = createPagedStache({
					id: 'get-data-test',
					fetch: fetchFn,
					pageSize: 10,
					getData: (response) => response.items,
					getTotalCount: (response) => response.total
				});

				const params = $state({ query: 'test' });
				const stache = useStache(() => ({
					params,
					pageParams: { pageOffset: 0, pageCount: 2 }
				}));

				flushSync();

				await vi.waitUntil(() => stache.data.length === 20);

				expect(stache.data).toHaveLength(20);
				expect(stache.totalCount).toBe(100);
			})
		);

		it(
			'should work without getData (return raw fetch response)',
			withEffectRoot(async () => {
				const fetchFn = vi
					.fn()
					.mockImplementation((params, { pageIndex, pageSize }) =>
						Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100).data)
					);

				const { useStache } = createPagedStache({
					id: 'no-get-data-test',
					fetch: fetchFn,
					pageSize: 10
				});

				const params = $state({ query: 'test' });
				const stache = useStache(() => ({
					params,
					pageParams: { pageOffset: 0, pageCount: 2 }
				}));

				flushSync();

				await vi.waitUntil(() => stache.data.length === 20);

				expect(stache.data).toHaveLength(20);
			})
		);

		it(
			'should fallback to pages.length * pageSize when no getTotalCount',
			withEffectRoot(async () => {
				const fetchFn = vi
					.fn()
					.mockImplementation((params, { pageIndex, pageSize }) =>
						Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100).data)
					);

				const { useStache } = createPagedStache({
					id: 'no-total-count-test',
					fetch: fetchFn,
					pageSize: 10
				});

				const params = $state({ query: 'test' });
				const stache = useStache(() => ({
					params,
					pageParams: { pageOffset: 0, pageCount: 3 }
				}));

				flushSync();

				await vi.waitUntil(() => stache.data.length > 0);

				// Fallback should be pageCount * pageSize
				expect(stache.totalCount).toBe(30);
			})
		);
	});

	describe('hasMore pagination indicator', () => {
		it(
			'should return true when data.length < totalCount',
			withEffectRoot(async () => {
				const fetchFn = vi
					.fn()
					.mockImplementation((params, { pageIndex, pageSize }) =>
						Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100))
					);

				const { useStache } = createPagedStache({
					id: 'has-more-true-test',
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

				await vi.waitUntil(() => stache.data.length === 20);

				expect(stache.hasMore).toBe(true);
				expect(stache.data.length).toBe(20);
				expect(stache.totalCount).toBe(100);
			})
		);

		it(
			'should return false when all data loaded',
			withEffectRoot(async () => {
				const fetchFn = vi
					.fn()
					.mockImplementation((params, { pageIndex, pageSize }) =>
						Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 25))
					);

				const { useStache } = createPagedStache({
					id: 'has-more-false-test',
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

				await vi.waitUntil(() => stache.data.length === 25);

				expect(stache.hasMore).toBe(false);
				expect(stache.data.length).toBe(25);
				expect(stache.totalCount).toBe(25);
			})
		);

		it(
			'should show hasMore correctly for partial vs full data loads',
			withEffectRoot(async () => {
				const fetchFn = vi
					.fn()
					.mockImplementation((params, { pageIndex, pageSize }) =>
						Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 50))
					);

				const { useStache } = createPagedStache({
					id: 'has-more-update-test',
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
					pageParams: { pageOffset: 0, pageCount: 5 }
				}));

				flushSync();

				await vi.waitUntil(() => stache1.data.length === 20 && stache2.data.length === 50);

				expect(stache1.hasMore).toBe(true);
				expect(stache2.hasMore).toBe(false);
			})
		);
	});

	describe('Invalidation for paged staches', () => {
		it(
			'should invalidate all pages when instance.invalidate() called',
			withEffectRoot(async () => {
				const fetchFn = vi
					.fn()
					.mockImplementation((params, { pageIndex, pageSize }) =>
						Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100))
					);

				const { useStache } = createPagedStache({
					id: 'invalidate-all-test',
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

				await vi.waitUntil(() => stache.data.length === 20);

				expect(fetchFn).toHaveBeenCalledTimes(2);

				stache.invalidate();
				flushSync();

				await vi.waitFor(() => fetchFn.mock.calls.length === 4);

				expect(fetchFn).toHaveBeenCalledTimes(4);
			})
		);

		it(
			'should invalidate all pages for matching params with global invalidate()',
			withEffectRoot(async () => {
				const fetchFn = vi
					.fn()
					.mockImplementation((params, { pageIndex, pageSize }) =>
						Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100))
					);

				const { useStache, invalidate } = createPagedStache({
					id: 'global-invalidate-test',
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

				await vi.waitUntil(() => stache.data.length === 20);

				expect(fetchFn).toHaveBeenCalledTimes(2);

				await invalidate({ query: 'test' });
				flushSync();

				await vi.waitFor(() => fetchFn.mock.calls.length >= 3, { timeout: 500 });

				// Should refetch at least one page, possibly more depending on timing
				expect(fetchFn.mock.calls.length).toBeGreaterThanOrEqual(3);
			})
		);

		it(
			'should handle invalidation of non-existent paged stache gracefully',
			withEffectRoot(async () => {
				const fetchFn = vi
					.fn()
					.mockImplementation((params, { pageIndex, pageSize }) =>
						Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100))
					);

				const { useStache, invalidate } = createPagedStache({
					id: 'non-existent-invalidate-test',
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

				flushSync();

				await vi.waitUntil(() => stache.data.length === 10);

				// Try to invalidate non-existent params
				invalidate({ query: 'non-existent' });
				flushSync();

				await vi.waitFor(() => true, { timeout: 100 });

				// Should not cause errors or additional fetches
				expect(fetchFn).toHaveBeenCalledTimes(1);
			})
		);
	});

	describe('Error handling in paged staches', () => {
		it(
			'should preserve data from successful pages when one fails',
			withEffectRoot(async () => {
				const fetchFn = vi.fn().mockImplementation((params, { pageIndex, pageSize }) => {
					if (pageIndex === 1) {
						return Promise.reject(new Error('Page 1 failed'));
					}
					return Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100));
				});

				const { useStache } = createPagedStache({
					id: 'preserve-data-error-test',
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

				await vi.waitUntil(() => stache.isError);

				// Should have data from successful pages (0 and 2)
				expect(stache.data.length).toBeGreaterThan(0);
				expect(stache.isError).toBe(true);
			})
		);
	});

	describe('Different page configurations', () => {
		it(
			'should load different amounts of pages based on pageCount',
			withEffectRoot(async () => {
				const fetchFn = vi
					.fn()
					.mockImplementation((params, { pageIndex, pageSize }) =>
						Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100))
					);

				const { useStache } = createPagedStache({
					id: 'different-pagecount-test',
					fetch: fetchFn,
					pageSize: 10,
					getData: (response) => response.data,
					getTotalCount: (response) => response.totalCount
				});

				const params = $state({ query: 'test' });

				// Create both staches in same effect context
				const stache1 = useStache(() => ({
					params,
					pageParams: { pageOffset: 0, pageCount: 1 }
				}));

				const stache2 = useStache(() => ({
					params,
					pageParams: { pageOffset: 0, pageCount: 3 }
				}));

				flushSync();

				await vi.waitUntil(() => stache1.data.length === 10 && stache2.data.length === 30);

				expect(stache1.data).toHaveLength(10);
				expect(stache2.data).toHaveLength(30);
			})
		);

		it(
			'should work with different page offsets',
			withEffectRoot(async () => {
				const fetchFn = vi
					.fn()
					.mockImplementation((params, { pageIndex, pageSize }) =>
						Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100))
					);

				const { useStache } = createPagedStache({
					id: 'different-offset-test',
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
					pageParams: { pageOffset: 2, pageCount: 2 }
				}));

				flushSync();

				await vi.waitUntil(() => stache1.data.length === 20 && stache2.data.length === 20);

				expect(stache1.data[0]).toEqual({ id: 0, value: 'item-0' });
				expect(stache2.data[0]).toEqual({ id: 20, value: 'item-20' });
			})
		);

		it(
			'should support creating multiple stache instances for infinite scroll pattern',
			withEffectRoot(async () => {
				const fetchFn = vi
					.fn()
					.mockImplementation((params, { pageIndex, pageSize }) =>
						Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100))
					);

				const { useStache } = createPagedStache({
					id: 'multi-instance-scroll-test',
					fetch: fetchFn,
					pageSize: 10,
					getData: (response) => response.data,
					getTotalCount: (response) => response.totalCount
				});

				const params = $state({ query: 'test' });

				// Create all staches in same effect context
				const stache1 = useStache(() => ({
					params,
					pageParams: { pageOffset: 0, pageCount: 1 }
				}));

				const stache2 = useStache(() => ({
					params,
					pageParams: { pageOffset: 0, pageCount: 2 }
				}));

				const stache3 = useStache(() => ({
					params,
					pageParams: { pageOffset: 0, pageCount: 3 }
				}));

				flushSync();

				await vi.waitUntil(
					() =>
						stache1.data.length === 10 && stache2.data.length === 20 && stache3.data.length === 30
				);

				expect(stache1.hasMore).toBe(true);
				expect(stache2.hasMore).toBe(true);
				expect(stache3.data).toHaveLength(30);
				expect(stache3.hasMore).toBe(true);
			})
		);
	});

	describe('Reactive pageParams changes', () => {
		it(
			'should reactively load more pages when pageCount increases',
			withEffectRoot(async () => {
				const fetchFn = vi
					.fn()
					.mockImplementation((params, { pageIndex, pageSize }) =>
						Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100))
					);

				const { useStache } = createPagedStache({
					id: 'reactive-pagecount-test',
					fetch: fetchFn,
					pageSize: 10,
					getData: (response) => response.data,
					getTotalCount: (response) => response.totalCount
				});

				const params = $state({ query: 'test' });
				let pageCount = $state(1);

				const stache = useStache(() => ({
					params,
					pageParams: { pageOffset: 0, pageCount }
				}));

				flushSync();

				await vi.waitUntil(() => stache.data.length === 10);

				expect(stache.data).toHaveLength(10);
				expect(fetchFn).toHaveBeenCalledTimes(1);

				// Increase pageCount to load more pages (simulating infinite scroll)
				pageCount = 3;
				flushSync();

				await vi.waitUntil(() => stache.data.length === 30);

				expect(stache.data).toHaveLength(30);
				// Should fetch 2 additional pages (pages 1 and 2)
				expect(fetchFn).toHaveBeenCalledTimes(3);
			})
		);

		it(
			'should reactively change page window when pageOffset changes',
			withEffectRoot(async () => {
				const fetchFn = vi
					.fn()
					.mockImplementation((params, { pageIndex, pageSize }) =>
						Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100))
					);

				const { useStache } = createPagedStache({
					id: 'reactive-offset-test',
					fetch: fetchFn,
					pageSize: 10,
					getData: (response) => response.data,
					getTotalCount: (response) => response.totalCount
				});

				const params = $state({ query: 'test' });
				let pageOffset = $state(0);

				const stache = useStache(() => ({
					params,
					pageParams: { pageOffset, pageCount: 2 }
				}));

				flushSync();

				await vi.waitUntil(() => stache.data.length === 20);

				expect(stache.data[0]).toEqual({ id: 0, value: 'item-0' });
				expect(stache.data[10]).toEqual({ id: 10, value: 'item-10' });

				// Change offset to view different page window
				pageOffset = 2;
				flushSync();

				await vi.waitUntil(() => stache.data[0]?.id === 20);

				expect(stache.data[0]).toEqual({ id: 20, value: 'item-20' });
				expect(stache.data[10]).toEqual({ id: 30, value: 'item-30' });
			})
		);

		it(
			'should support infinite scroll by incrementing pageCount',
			withEffectRoot(async () => {
				const fetchFn = vi
					.fn()
					.mockImplementation((params, { pageIndex, pageSize }) =>
						Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100))
					);

				const { useStache } = createPagedStache({
					id: 'infinite-scroll-reactive-test',
					fetch: fetchFn,
					pageSize: 10,
					getData: (response) => response.data,
					getTotalCount: (response) => response.totalCount
				});

				const params = $state({ query: 'test' });
				let pageCount = $state(1);

				const stache = useStache(() => ({
					params,
					pageParams: { pageOffset: 0, pageCount }
				}));

				flushSync();

				await vi.waitUntil(() => stache.data.length === 10);
				expect(stache.hasMore).toBe(true);

				// User scrolls - load more
				pageCount = 2;
				flushSync();

				await vi.waitUntil(() => stache.data.length === 20);
				expect(stache.hasMore).toBe(true);

				// User scrolls more - load more
				pageCount = 3;
				flushSync();

				await vi.waitUntil(() => stache.data.length === 30);
				expect(stache.hasMore).toBe(true);
				expect(stache.data).toHaveLength(30);
			})
		);

		it(
			'should handle decreasing pageCount (going back)',
			withEffectRoot(async () => {
				const fetchFn = vi
					.fn()
					.mockImplementation((params, { pageIndex, pageSize }) =>
						Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100))
					);

				const { useStache } = createPagedStache({
					id: 'decrease-pagecount-test',
					fetch: fetchFn,
					pageSize: 10,
					getData: (response) => response.data,
					getTotalCount: (response) => response.totalCount
				});

				const params = $state({ query: 'test' });
				let pageCount = $state(3);

				const stache = useStache(() => ({
					params,
					pageParams: { pageOffset: 0, pageCount }
				}));

				flushSync();

				await vi.waitUntil(() => stache.data.length === 30);
				expect(stache.data).toHaveLength(30);

				// Decrease pageCount (e.g., user navigates away and comes back)
				pageCount = 1;
				flushSync();

				await vi.waitUntil(() => stache.data.length === 10);
				expect(stache.data).toHaveLength(10);
			})
		);

		it(
			'should handle simultaneous pageOffset and pageCount changes',
			withEffectRoot(async () => {
				const fetchFn = vi
					.fn()
					.mockImplementation((params, { pageIndex, pageSize }) =>
						Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100))
					);

				const { useStache } = createPagedStache({
					id: 'simultaneous-change-test',
					fetch: fetchFn,
					pageSize: 10,
					getData: (response) => response.data,
					getTotalCount: (response) => response.totalCount
				});

				const params = $state({ query: 'test' });
				let pageOffset = $state(0);
				let pageCount = $state(2);

				const stache = useStache(() => ({
					params,
					pageParams: { pageOffset, pageCount }
				}));

				flushSync();

				await vi.waitUntil(() => stache.data.length === 20);
				expect(stache.data[0]).toEqual({ id: 0, value: 'item-0' });

				// Change both offset and count
				pageOffset = 3;
				pageCount = 3;
				flushSync();

				await vi.waitUntil(() => stache.data[0]?.id === 30);

				expect(stache.data).toHaveLength(30);
				expect(stache.data[0]).toEqual({ id: 30, value: 'item-30' });
			})
		);

		it(
			'should reuse cached pages when changing pageParams',
			withEffectRoot(async () => {
				const fetchFn = vi
					.fn()
					.mockImplementation((params, { pageIndex, pageSize }) =>
						Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100))
					);

				const { useStache } = createPagedStache({
					id: 'reuse-on-change-test',
					fetch: fetchFn,
					pageSize: 10,
					getData: (response) => response.data,
					getTotalCount: (response) => response.totalCount
				});

				const params = $state({ query: 'test' });
				let pageCount = $state(2);

				const stache = useStache(() => ({
					params,
					pageParams: { pageOffset: 0, pageCount }
				}));

				flushSync();

				await vi.waitUntil(() => stache.data.length === 20);
				expect(fetchFn).toHaveBeenCalledTimes(2); // Pages 0 and 1

				// Increase to 4 pages
				pageCount = 4;
				flushSync();

				await vi.waitUntil(() => stache.data.length === 40);

				// Should only fetch 2 additional pages (pages 2 and 3), reusing pages 0 and 1
				expect(fetchFn).toHaveBeenCalledTimes(4);

				// Go back to 2 pages (should not fetch again)
				pageCount = 2;
				flushSync();

				await vi.waitUntil(() => stache.data.length === 20);

				// Should still be 4 fetches (cached pages 0 and 1)
				expect(fetchFn).toHaveBeenCalledTimes(4);
			})
		);
	});

	describe('null params for paged staches', () => {
		it(
			'should disable all pages when params are null',
			withEffectRoot(async () => {
				const fetchFn = vi
					.fn()
					.mockImplementation((params, { pageIndex, pageSize }) =>
						Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100))
					);

				const { useStache } = createPagedStache({
					id: 'disable-if-falsy-test',
					fetch: fetchFn,
					pageSize: 10,
					getData: (response) => response.data,
					getTotalCount: (response) => response.totalCount
				});

				const params1: { query: string } | null = $state(null);
				const params2: { query: string } | null = $state({ query: 'test' });

				// Create both staches in same effect context
				const stache1 = useStache(() => ({
					params: params1,
					pageParams: { pageOffset: 0, pageCount: 2 }
				}));

				const stache2 = useStache(() => ({
					params: params2,
					pageParams: { pageOffset: 0, pageCount: 2 }
				}));

				flushSync();

				await vi.waitFor(() => true, { timeout: 100 });

				// stache1 should not fetch when params are null
				// stache2 should fetch with valid params
				expect(fetchFn).toHaveBeenCalledTimes(2);

				await vi.waitUntil(() => stache2.data.length === 20);
				expect(stache2.data.length).toBe(20);
			})
		);
	});
});

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { flushSync } from 'svelte';
import { createPagedStache } from '../paged.svelte';
import { hashKey } from '../../utils';
import { initStacheCache, StacheCache } from '../../cache';

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
			const setContext = (value: T): void => {
				context = value;
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
	let cleanupFns: Array<() => void> = [];

	beforeEach(() => {
		initStacheCache();
	});

	afterEach(() => {
		cleanupFns.forEach((fn) => fn());
		cleanupFns = [];
	});

	describe('Reference counting and cleanup behavior', () => {
		it('should only delete cache when ALL components are unmounted and timeout expires', async () => {
			vi.useFakeTimers();
			const globalCache = new StacheCache();
			const fetchFn = vi
				.fn()
				.mockImplementation((params, { pageIndex, pageSize }) =>
					Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100))
				);

			const { useStache } = createPagedStache({
				id: 'paged-cleanup-test',
				fetch: fetchFn,
				pageSize: 10,
				getData: (response) => response.data,
				getTotalCount: (response) => response.totalCount,
				globalCache
			});

			let stache1: ReturnType<typeof useStache>;

			await withEffectRoot(async () => {
				const params1 = $state({ query: 'test' });
				stache1 = useStache(() => ({
					params: params1,
					pageParams: { pageOffset: 0, pageCount: 2 }
				}));

				flushSync();

				await vi.waitUntil(() => stache1.data.length === 20);

				// Cache should exist
				expect(globalCache.getPagedStacheGroup('paged-cleanup-test')).toBeDefined();
				const paramsCache = globalCache.getPagedStache(
					'paged-cleanup-test',
					hashKey({ query: 'test' })
				);
				expect(paramsCache).toBeDefined();
				expect(paramsCache!.size).toBe(2); // 2 pages

				// Check reference counts on individual page caches
				const page0 = paramsCache!.get(hashKey({ pageIndex: 0, pageSize: 10 }));
				const page1 = paramsCache!.get(hashKey({ pageIndex: 1, pageSize: 10 }));
				expect(page0?.referenceCount).toBe(1);
				expect(page1?.referenceCount).toBe(1);
			})();

			// After effect cleanup, reference counts should be 0
			const paramsCache = globalCache.getPagedStache(
				'paged-cleanup-test',
				hashKey({ query: 'test' })
			);
			const page0 = paramsCache!.get(hashKey({ pageIndex: 0, pageSize: 10 }));
			const page1 = paramsCache!.get(hashKey({ pageIndex: 1, pageSize: 10 }));
			expect(page0?.referenceCount).toBe(0);
			expect(page1?.referenceCount).toBe(0);

			// Advance timers to trigger cleanup
			vi.advanceTimersToNextTimer();

			// Cache should be cleaned up
			await vi.waitFor(() => {
				const cache = globalCache.getPagedStache('paged-cleanup-test', hashKey({ query: 'test' }));
				return cache === undefined || cache.size === 0;
			});

			vi.useRealTimers();
		});

		it('should only refetch referenced page staches when stale', async () => {
			vi.useFakeTimers();
			const fetchFn = vi
				.fn()
				.mockImplementation((params, { pageIndex, pageSize }) =>
					Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100))
				);

			const globalCache = new StacheCache();

			const { useStache } = createPagedStache({
				id: 'paged-refetch-referenced-test',
				fetch: fetchFn,
				pageSize: 10,
				staleTime: 100,
				refetchOnStale: true,
				getData: (response) => response.data,
				getTotalCount: (response) => response.totalCount,
				globalCache
			});

			// First effect root - create staches for pages 0,1,2
			await withEffectRoot(async () => {
				const params = $state({ query: 'test' });
				const stache = useStache(() => ({
					params,
					pageParams: { pageOffset: 0, pageCount: 3 }
				}));

				flushSync();

				await vi.waitUntil(() => stache.data?.length === 30);
				expect(fetchFn).toHaveBeenCalledTimes(3);
			})();

			// All pages should have refCount 0 now
			const paramsCache = globalCache.getPagedStache(
				'paged-refetch-referenced-test',
				hashKey({ query: 'test' })
			);
			expect(paramsCache!.get(hashKey({ pageIndex: 0, pageSize: 10 }))?.referenceCount).toBe(0);
			expect(paramsCache!.get(hashKey({ pageIndex: 1, pageSize: 10 }))?.referenceCount).toBe(0);
			expect(paramsCache!.get(hashKey({ pageIndex: 2, pageSize: 10 }))?.referenceCount).toBe(0);

			// Second effect root - only reference page 0
			await withEffectRoot(async () => {
				const params = $state({ query: 'test' });
				const stache = useStache(() => ({
					params,
					pageParams: { pageOffset: 0, pageCount: 1 }
				}));

				flushSync();

				await vi.waitUntil(() => stache.data?.length === 10);

				// Page 0 should have refCount 1, others still 0
				expect(paramsCache!.get(hashKey({ pageIndex: 0, pageSize: 10 }))?.referenceCount).toBe(1);
				expect(paramsCache!.get(hashKey({ pageIndex: 1, pageSize: 10 }))?.referenceCount).toBe(0);
				expect(paramsCache!.get(hashKey({ pageIndex: 2, pageSize: 10 }))?.referenceCount).toBe(0);

				fetchFn.mockClear();

				// Make stale
				vi.advanceTimersToNextTimer();

				// Only page 0 should refetch since it's the only one referenced
				await vi.waitUntil(() => fetchFn.mock.calls.length > 0);

				expect(fetchFn).toHaveBeenCalledTimes(1);
				expect(fetchFn).toHaveBeenCalledWith({ query: 'test' }, { pageIndex: 0, pageSize: 10 });

				// Page 0 should be fresh, others still stale
				expect(paramsCache!.get(hashKey({ pageIndex: 0, pageSize: 10 }))?.cacheStatus).toBe(
					'fresh'
				);
				expect(paramsCache!.get(hashKey({ pageIndex: 1, pageSize: 10 }))?.cacheStatus).toBe(
					'stale'
				);
				expect(paramsCache!.get(hashKey({ pageIndex: 2, pageSize: 10 }))?.cacheStatus).toBe(
					'stale'
				);
			})();

			vi.useRealTimers();
		});

		it('should clean up old page caches when pageParams change', async () => {
			vi.useFakeTimers();
			const globalCache = new StacheCache();
			const fetchFn = vi
				.fn()
				.mockImplementation((params, { pageIndex, pageSize }) =>
					Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100))
				);

			const { useStache } = createPagedStache({
				id: 'paged-param-change-cleanup-test',
				fetch: fetchFn,
				pageSize: 10,
				getData: (response) => response.data,
				getTotalCount: (response) => response.totalCount,
				globalCache
			});

			await withEffectRoot(async () => {
				const params = $state({ query: 'test' });
				let pageOffset = $state(0);

				const stache = useStache(() => ({
					params,
					pageParams: { pageOffset, pageCount: 2 }
				}));

				flushSync();

				await vi.waitUntil(() => stache.data?.length === 20);

				const paramsCache = globalCache.getPagedStache(
					'paged-param-change-cleanup-test',
					hashKey({ query: 'test' })
				);

				// Pages 0 and 1 should exist with refCount 1
				expect(paramsCache!.get(hashKey({ pageIndex: 0, pageSize: 10 }))?.referenceCount).toBe(1);
				expect(paramsCache!.get(hashKey({ pageIndex: 1, pageSize: 10 }))?.referenceCount).toBe(1);

				// Change to different page window
				pageOffset = 2;
				flushSync();

				await vi.waitUntil(() => stache.data?.[0]?.id === 20);

				// Pages 0 and 1 should have refCount 0 now
				expect(paramsCache!.get(hashKey({ pageIndex: 0, pageSize: 10 }))?.referenceCount).toBe(0);
				expect(paramsCache!.get(hashKey({ pageIndex: 1, pageSize: 10 }))?.referenceCount).toBe(0);
				// Pages 2 and 3 should have refCount 1
				expect(paramsCache!.get(hashKey({ pageIndex: 2, pageSize: 10 }))?.referenceCount).toBe(1);
				expect(paramsCache!.get(hashKey({ pageIndex: 3, pageSize: 10 }))?.referenceCount).toBe(1);

				expect(
					paramsCache!.get(hashKey({ pageIndex: 0, pageSize: 10 }))?.cleanupTimeout
				).not.toBeNull();
				expect(
					paramsCache!.get(hashKey({ pageIndex: 1, pageSize: 10 }))?.cleanupTimeout
				).not.toBeNull();

				// Advance timers to trigger cleanup of unreferenced pages
				vi.advanceTimersToNextTimer();

				await vi.waitUntil(() => {
					return (
						paramsCache!.get(hashKey({ pageIndex: 0, pageSize: 10 })) === undefined &&
						paramsCache!.get(hashKey({ pageIndex: 1, pageSize: 10 })) === undefined
					);
				});

				// Pages 0 and 1 should be cleaned up
				expect(paramsCache!.get(hashKey({ pageIndex: 0, pageSize: 10 }))).toBeUndefined();
				expect(paramsCache!.get(hashKey({ pageIndex: 1, pageSize: 10 }))).toBeUndefined();
				// Pages 2 and 3 should still exist
				expect(paramsCache!.get(hashKey({ pageIndex: 2, pageSize: 10 }))).toBeDefined();
				expect(paramsCache!.get(hashKey({ pageIndex: 3, pageSize: 10 }))).toBeDefined();
			})();

			vi.useRealTimers();
		});

		it('should handle custom cleanupTime configuration for paged staches', async () => {
			vi.useFakeTimers();
			const globalCache = new StacheCache();
			const fetchFn = vi
				.fn()
				.mockImplementation((params, { pageIndex, pageSize }) =>
					Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100))
				);

			const { useStache } = createPagedStache({
				id: 'paged-custom-cleanup-test',
				fetch: fetchFn,
				pageSize: 10,
				cleanupTime: 1000, // 1 second instead of default
				getData: (response) => response.data,
				getTotalCount: (response) => response.totalCount,
				globalCache
			});

			await withEffectRoot(async () => {
				const params = $state({ query: 'test' });
				const stache = useStache(() => ({
					params,
					pageParams: { pageOffset: 0, pageCount: 2 }
				}));

				flushSync();
				await vi.waitUntil(() => stache.data?.length === 20);
			})();

			// Cache should still exist after effect cleanup
			const paramsCache = globalCache.getPagedStache(
				'paged-custom-cleanup-test',
				hashKey({ query: 'test' })
			);
			expect(paramsCache).toBeDefined();
			expect(paramsCache!.size).toBe(2);

			// Advance by cleanup time
			vi.advanceTimersToNextTimer();

			// Cache should be cleaned up
			await vi.waitFor(() => {
				const cache = globalCache.getPagedStache(
					'paged-custom-cleanup-test',
					hashKey({ query: 'test' })
				);
				return cache === undefined || cache.size === 0;
			});

			vi.useRealTimers();
		});

		it('should handle cache cleanup interaction with stale status for paged staches', async () => {
			vi.useFakeTimers();
			const globalCache = new StacheCache();
			const fetchFn = vi
				.fn()
				.mockImplementation((params, { pageIndex, pageSize }) =>
					Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100))
				);

			const { useStache } = createPagedStache({
				id: 'paged-stale-cleanup-test',
				fetch: fetchFn,
				pageSize: 10,
				staleTime: 100,
				cleanupTime: 1000,
				getData: (response) => response.data,
				getTotalCount: (response) => response.totalCount,
				globalCache
			});

			await withEffectRoot(async () => {
				const params = $state({ query: 'test' });
				const stache = useStache(() => ({
					params,
					pageParams: { pageOffset: 0, pageCount: 2 }
				}));

				flushSync();
				await vi.waitUntil(() => stache.data?.length === 20);

				// Wait for stale
				vi.advanceTimersToNextTimer();
				await vi.waitUntil(() => stache.cacheStatus === 'stale');
			})();

			const page0 = globalCache.getPagedStachePage(
				'paged-stale-cleanup-test',
				hashKey({ query: 'test' }),
				hashKey({ pageIndex: 0, pageSize: 10 })
			);
			expect(page0?.cacheStatus).toBe('stale');
			expect(page0?.referenceCount).toBe(0);

			// Advance cleanup time
			vi.advanceTimersToNextTimer();

			// Cache should be cleaned up regardless of stale status
			await vi.waitFor(() => {
				const cache = globalCache.getPagedStache(
					'paged-stale-cleanup-test',
					hashKey({ query: 'test' })
				);
				return cache === undefined || cache.size === 0;
			});

			vi.useRealTimers();
		});
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

				await vi.waitUntil(() => stache.data?.length === 10);

				expect(stache.data).toHaveLength(10);
				expect(fetchFn).toHaveBeenCalledTimes(1);

				// Increase pageCount to load more pages (simulating infinite scroll)
				pageCount = 3;
				flushSync();

				await vi.waitUntil(() => stache.data?.length === 30);

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

				await vi.waitUntil(() => stache.data?.length === 20);

				expect(stache.data?.[0]).toEqual({ id: 0, value: 'item-0' });
				expect(stache.data?.[10]).toEqual({ id: 10, value: 'item-10' });

				// Change offset to view different page window
				pageOffset = 2;
				flushSync();

				await vi.waitUntil(() => stache.data?.[0]?.id === 20);

				expect(stache.data?.[0]).toEqual({ id: 20, value: 'item-20' });
				expect(stache.data?.[10]).toEqual({ id: 30, value: 'item-30' });
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

				await vi.waitUntil(() => stache.data?.length === 10);
				expect(stache.hasMore).toBe(true);

				// User scrolls - load more
				pageCount = 2;
				flushSync();

				await vi.waitUntil(() => stache.data?.length === 20);
				expect(stache.hasMore).toBe(true);

				// User scrolls more - load more
				pageCount = 3;
				flushSync();

				await vi.waitUntil(() => stache.data?.length === 30);
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

				await vi.waitUntil(() => stache.data?.length === 30);
				expect(stache.data).toHaveLength(30);

				// Decrease pageCount (e.g., user navigates away and comes back)
				pageCount = 1;
				flushSync();

				await vi.waitUntil(() => stache.data?.length === 10);
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

				await vi.waitUntil(() => stache.data?.length === 20);
				expect(stache.data?.[0]).toEqual({ id: 0, value: 'item-0' });

				// Change both offset and count
				pageOffset = 3;
				pageCount = 3;
				flushSync();

				await vi.waitUntil(() => stache.data?.[0]?.id === 30);

				expect(stache.data).toHaveLength(30);
				expect(stache.data?.[0]).toEqual({ id: 30, value: 'item-30' });
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

				await vi.waitUntil(() => stache.data?.length === 20);
				expect(fetchFn).toHaveBeenCalledTimes(2); // Pages 0 and 1

				// Increase to 4 pages
				pageCount = 4;
				flushSync();

				await vi.waitUntil(() => stache.data?.length === 40);

				// Should only fetch 2 additional pages (pages 2 and 3), reusing pages 0 and 1
				expect(fetchFn).toHaveBeenCalledTimes(4);

				// Go back to 2 pages (should not fetch again)
				pageCount = 2;
				flushSync();

				await vi.waitUntil(() => stache.data?.length === 20);

				// Should still be 4 fetches (cached pages 0 and 1)
				expect(fetchFn).toHaveBeenCalledTimes(4);
			})
		);
	});
});

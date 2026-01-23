import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { flushSync } from 'svelte';
import { createStache, type PublicStache } from './stache.svelte';
import { SvelteMap } from 'svelte/reactivity';
import type { Stache } from './stache.class.svelte';
import { hashKey } from './utils';

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

describe('createStache cache implementation', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('createStache function', () => {
		it(
			'should return a function that creates Stache instances',
			withEffectRoot(async () => {
				const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
				const { useStache } = createStache({
					id: 'test-stache',
					fetch: fetchFn
				});

				const params: number | string = $state(1);

				const stache = useStache(() => ({ params }));

				expect(stache).toBeDefined();

				flushSync();

				await vi.waitUntil(() => stache.data !== null);

				flushSync();

				expect(fetchFn).toHaveBeenCalledWith(1);
				expect(stache.data).toEqual({ data: 'test' });
				expect(stache.isError).toBe(false);
				expect(stache.isLoading).toBe(false);
				expect(stache.isSuccess).toBe(true);
				expect(stache.referenceCount).toBe(1);
			})
		);

		it(
			'should have the correct initial state',
			withEffectRoot(async () => {
				let resolveStache: (value: any) => void;
				const stachePromise = new Promise((resolve) => {
					resolveStache = resolve;
				});

				const fetchFn = vi.fn().mockReturnValue(stachePromise);
				const { useStache } = createStache({
					id: 'initial-state-test',
					fetch: fetchFn
				});

				const params = $state('param');
				let enabled = $state(false);
				const stache = useStache(() => ({ params, enabled }));

				expect(stache.data).toBe(null);
				expect(stache.error).toBe(null);
				expect(stache.isError).toBe(false);
				expect(stache.isLoading).toBe(false);
				expect(stache.isFetching).toBe(false);
				expect(stache.isSuccess).toBe(false);
				expect(stache.lastFetched).toBe(null);
				expect(stache.referenceCount).toBe(1);

				flushSync();

				// Enable the stache
				enabled = true;

				flushSync();

				// await vi.waitUntil(() => stache.isFetching);

				expect(stache.isLoading).toBe(true);
				expect(stache.isFetching).toBe(true);
				expect(stache.referenceCount).toBe(1);

				// Resolve the stache
				resolveStache!({ data: 'initial' });

				await vi.waitUntil(() => stache.data !== null);

				expect(stache.data).toEqual({ data: 'initial' });
				expect(stache.isError).toBe(false);
				expect(stache.isLoading).toBe(false);
				expect(stache.isSuccess).toBe(true);
				expect(stache.referenceCount).toBe(1);
			})
		);

		it(
			'should handle parameter changes',
			withEffectRoot(async () => {
				let callCount = 0;
				const fetchFn = vi.fn().mockImplementation((params) => {
					callCount++;
					return Promise.resolve({ data: `result-${params}` });
				});

				const { useStache } = createStache({
					id: 'param-change-test',
					fetch: fetchFn
				});

				let params = $state('param1');
				const stache = useStache(() => ({ params }));

				flushSync();

				await vi.waitUntil(() => stache.data !== null);

				expect(stache.data).toEqual({ data: 'result-param1' });

				// Change parameters
				params = 'param2';

				flushSync();

				expect(stache.params).toBe('param2');

				await vi.waitUntil(() => stache.data?.data === 'result-param2');

				expect(stache.data).toEqual({ data: 'result-param2' });
				expect(fetchFn).toHaveBeenCalledTimes(2);
			})
		);
	});

	describe('Multiple components referencing same cached stache', () => {
		it(
			'should share the same Stache instance between components',
			withEffectRoot(async () => {
				const queryCache = new SvelteMap<string, SvelteMap<string, Stache<any, any, any>>>();
				const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
				const { useStache } = createStache({
					id: 'shared-stache',
					fetch: fetchFn,
					globalCache: queryCache
				});

				// Simulate three components mounting
				const params1 = $state({ id: 1 });
				const stache1 = useStache(() => ({ params: params1 }));

				const params2 = $state({ id: 1 });
				const stache2 = useStache(() => ({ params: params2 }));

				const params3 = $state({ id: 1 });
				const stache3 = useStache(() => ({ params: params3 }));

				flushSync();

				expect(stache1).toBeDefined();

				expect(Array.from(queryCache.get('shared-stache')?.keys() ?? [])).toHaveLength(1);

				flushSync();

				await vi.waitUntil(() => stache1.data !== null);

				expect(stache1.data).toEqual({ data: 'test' });
				// Stache function should only be called once even when triggered from shared instance
				expect(fetchFn).toHaveBeenCalledTimes(1);
				expect(fetchFn).toHaveBeenCalledWith({ id: 1 });
			})
		);

		it(
			'should share data state across all components sharing the cache',
			withEffectRoot(async () => {
				let resolveStache: (value: any) => void;
				const stachePromise = new Promise((resolve) => {
					resolveStache = resolve;
				});

				const fetchFn = vi.fn().mockReturnValue(stachePromise);
				const { useStache } = createStache({
					id: 'update-test',
					fetch: fetchFn
				});

				// Create three stache instances
				const params1 = $state('test');
				const stache1 = useStache(() => ({ params: params1 }));

				const params2 = $state('test');
				const stache2 = useStache(() => ({ params: params2 }));

				const params3 = $state('test');
				const stache3 = useStache(() => ({ params: params3 }));

				flushSync();

				// All should have the same initial state
				expect(stache1.data).toBe(null);
				expect(stache1._stache).toBe(stache2._stache);
				expect(stache2._stache).toBe(stache3._stache);

				// Stache should trigger automatically
				flushSync();

				// All should be fetching
				expect(stache1.isFetching).toBe(true);
				expect(stache2.isFetching).toBe(true);
				expect(stache3.isFetching).toBe(true);

				// Resolve the stache
				resolveStache!({ result: 'success' });

				// Wait for promise resolution
				await stachePromise;
				flushSync();

				// All instances should have the updated data
				await vi.waitUntil(() => stache1.data !== null);
				expect(stache1.isFetching).toBe(false);
				expect(stache1.data).toEqual({ result: 'success' });
				expect(stache2.data).toEqual({ result: 'success' });
				expect(stache3.data).toEqual({ result: 'success' });
			})
		);
	});

	describe('Reference counting and cleanup behavior', () => {
		it('should only delete cache when ALL components are unmounted and timeout expires', async () => {
			const globalCache = new SvelteMap<string, SvelteMap<string, any>>();
			const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
			const { useStache } = createStache({
				id: 'cleanup-test',
				fetch: fetchFn,
				globalCache
			});
			let stache1: PublicStache<any, any, any>;

			await withEffectRoot(async () => {
				expect(globalCache.has('cleanup-test')).toBe(true);

				// Create three stache instances with same params
				const params1 = $state('param1');
				stache1 = useStache(() => ({ params: params1 }));

				flushSync();

				expect(stache1.referenceCount).toBe(1);

				const params2 = $state('param1');
				const stache2 = useStache(() => ({ params: params2 }));

				flushSync();
				expect(stache1.referenceCount).toBe(2);

				const params3 = $state('param1');
				const stache3 = useStache(() => ({ params: params3 }));

				flushSync();

				expect(stache1.referenceCount).toBe(3);

				expect(globalCache.get('cleanup-test')?.get(hashKey('param1'))).toBeDefined();

				// All should be the same instance (cache hit)
				expect(stache1._stache).toBe(stache2._stache);
				expect(stache2._stache).toBe(stache3._stache);

				await vi.waitUntil(() => stache1.referenceCount === 3);

				// Wait for automatic stache execution
				await vi.waitUntil(() => stache1.data !== null);
				expect(fetchFn).toHaveBeenCalledTimes(1);
			})();

			await withEffectRoot(async () => {
				const cachedStache = globalCache.get('cleanup-test')?.get(hashKey('param1'));
				expect(cachedStache).toBeDefined();
				expect(cachedStache.referenceCount).toBe(0);

				// Fast-forward time to trigger cleanup
				vi.advanceTimersToNextTimer();

				// Now cache should be cleaned up
				await vi.waitFor(
					() => globalCache.get('cleanup-test')?.get(hashKey('param1')) === undefined
				);

				expect(globalCache.get('cleanup-test')?.get(hashKey('param1'))).toBeUndefined();
			})();
		});
	});

	it('should only refetch referenced staches', async () => {
		const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
		const globalCache = new SvelteMap<string, SvelteMap<string, Stache<any, any, any>>>();
		const { useStache } = createStache({
			id: 'invalidate-test',
			fetch: fetchFn,
			refetchOnStale: true,
			staleTime: 100,
			globalCache
		});

		await withEffectRoot(async () => {
			// Create two stache instances with same params
			const params1 = $state('param1');
			const stache1 = useStache(() => ({ params: params1 }));

			const params2 = $state('param2');
			const stache2 = useStache(() => ({ params: params2 }));

			flushSync();
			await vi.waitUntil(() => stache1.data !== null && stache2.data !== null);
			expect(fetchFn).toHaveBeenCalledTimes(2);

			expect(globalCache.get('invalidate-test')?.get(hashKey('param1'))?.referenceCount).toBe(1);
			expect(globalCache.get('invalidate-test')?.get(hashKey('param2'))?.referenceCount).toBe(1);
		})();

		await withEffectRoot(async () => {
			expect(globalCache.get('invalidate-test')?.get(hashKey('param1'))?.referenceCount).toBe(0);
			expect(globalCache.get('invalidate-test')?.get(hashKey('param2'))?.referenceCount).toBe(0);

			// Reference stache1 again
			const params1copy = $state('param1');
			const stache1copy = useStache(() => ({ params: params1copy }));
			flushSync();
			await vi.waitUntil(() => stache1copy.data !== null);

			expect(globalCache.get('invalidate-test')?.get(hashKey('param1'))?.referenceCount).toBe(1);
			expect(globalCache.get('invalidate-test')?.get(hashKey('param2'))?.referenceCount).toBe(0);

			fetchFn.mockClear();

			// make stale
			vi.advanceTimersToNextTimer();

			await vi.waitUntil(() => fetchFn.mock.calls.length > 0);

			expect(globalCache.get('invalidate-test')?.get(hashKey('param1'))?.cacheStatus).toBe('fresh');
			expect(globalCache.get('invalidate-test')?.get(hashKey('param2'))?.cacheStatus).toBe('stale');
		})();
	});

	describe('Cache isolation between different ids', () => {
		it(
			'should maintain separate caches for different ids',
			withEffectRoot(async () => {
				const fetch1 = vi.fn().mockResolvedValue({ data: 'stache1' });
				const fetch2 = vi.fn().mockResolvedValue({ data: 'stache2' });

				const { useStache: useStache1 } = createStache({
					id: 'stache-1',
					fetch: fetch1
				});

				const { useStache: useStache2 } = createStache({
					id: 'stache-2',
					fetch: fetch2
				});

				// Create queries with same params but different ids
				const params1 = $state({ id: 1 });
				const stache1 = useStache1(() => ({ params: params1 }));

				const params2 = $state({ id: 1 });
				const stache2 = useStache2(() => ({ params: params2 }));

				flushSync();

				// Queries should be different instances
				expect(stache1).not.toBe(stache2);

				// Wait for automatic stache execution
				await vi.waitUntil(() => stache1.data !== null && stache2.data !== null);

				// Both stache functions should be called
				expect(fetch1).toHaveBeenCalledTimes(1);
				expect(fetch2).toHaveBeenCalledTimes(1);
			})
		);

		it(
			'should maintain separate caches for different params',
			withEffectRoot(async () => {
				const fetchFn = vi.fn().mockImplementation((params) => {
					return Promise.resolve({ data: `result-${params.id}` });
				});

				const { useStache } = createStache({
					id: 'param-test',
					fetch: fetchFn
				});

				// Create queries with different params
				const params1 = $state({ id: 1 });
				const stache1 = useStache(() => ({ params: params1 }));

				const params2 = $state({ id: 2 });
				const stache2 = useStache(() => ({ params: params2 }));

				const params3 = $state({ id: 1 });
				const stache3 = useStache(() => ({ params: params3 }));

				flushSync();

				// stache1 and stache3 should be the same instance (same params)
				expect(stache1._stache).toBe(stache3._stache);
				// stache2 should be different (different params)
				expect(stache1._stache).not.toBe(stache2._stache);

				// Wait for automatic stache execution
				await vi.waitUntil(() => stache1.data !== null && stache2.data !== null);

				// Stache function should be called for each unique param set
				expect(fetchFn).toHaveBeenCalledTimes(2);
				expect(fetchFn).toHaveBeenCalledWith({ id: 1 });
				expect(fetchFn).toHaveBeenCalledWith({ id: 2 });
			})
		);

		it(
			'old cache entries from previous params should be cleaned up after timeout',
			withEffectRoot(async () => {
				const globalCache = new SvelteMap<string, SvelteMap<string, Stache<any, any, any>>>();
				const fetchFn = vi.fn().mockImplementation((params) => {
					return Promise.resolve({ data: `result-${params}` });
				});
				const { useStache } = createStache({
					id: 'timeout-test',
					fetch: fetchFn,
					globalCache
				});

				let params = $state('param1');
				const stache = useStache(() => ({ params: params }));

				flushSync();

				expect(globalCache.get('timeout-test')?.get(hashKey('param1'))).toBeDefined();

				// Change params to create new cache entry
				params = 'param2';
				flushSync();

				await vi.waitFor(() => stache.data === 'result-param2');

				const cache1 = globalCache.get('timeout-test')?.get(hashKey('param1'));
				const cache2 = globalCache.get('timeout-test')?.get(hashKey('param2'));
				expect(cache1).toBeDefined();
				expect(cache2).toBeDefined();

				flushSync();

				expect(cache1?.referenceCount).toBe(0);
				expect(cache2?.referenceCount).toBe(1);

				// Fast-forward time to trigger cleanup of old param cache
				vi.advanceTimersToNextTimer();
				flushSync();

				// Old cache entry should be cleaned up
				await vi.waitFor(
					() => globalCache.get('timeout-test')?.get(hashKey('param1')) === undefined
				);
				expect(globalCache.get('timeout-test')?.get(hashKey('param2'))).toBeDefined();

				vi.useRealTimers();
			})
		);
	});

	describe('Cache status (fresh/stale) behavior', () => {
		it(
			'should start with fresh cache status',
			withEffectRoot(async () => {
				const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
				const { useStache } = createStache({
					id: 'fresh-status-test',
					fetch: fetchFn
				});

				const params = $state('param');
				const stache = useStache(() => ({ params }));

				flushSync();

				// Wait for fetch to complete
				await vi.waitUntil(() => stache.data !== null);

				expect(stache.cacheStatus).toBe('fresh');
				expect(stache.lastFetched).toBeInstanceOf(Date);
			})
		);

		it(
			'should transition from fresh to stale after staleTime',
			withEffectRoot(async () => {
				const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
				const { useStache } = createStache({
					id: 'stale-transition-test',
					fetch: fetchFn,
					staleTime: 100 // 100ms stale time for faster testing
				});

				const params = $state('param');
				const stache = useStache(() => ({ params }));

				flushSync();

				// Wait for fetch to complete
				await vi.waitUntil(() => stache.data !== null);
				expect(stache.cacheStatus).toBe('fresh');

				vi.advanceTimersToNextTimer();

				// Should now be stale
				await vi.waitUntil(() => stache.cacheStatus === 'stale');
				expect(stache.cacheStatus).toBe('stale');
			})
		);

		it(
			'should support custom staleTime configurations',
			withEffectRoot(async () => {
				const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
				const { useStache } = createStache({
					id: 'custom-stale-time-test',
					fetch: fetchFn,
					staleTime: 1000, // Very short stale time
					globalCache: new SvelteMap()
				});

				const params = $state('param');
				const stache = useStache(() => ({ params }));

				flushSync();

				// Wait for fetch to complete
				await vi.waitUntil(() => stache.data !== null);
				expect(stache.cacheStatus).toBe('fresh');

				vi.advanceTimersToNextTimer();

				// Should become stale quickly
				await vi.waitUntil(() => stache.cacheStatus === 'stale');

				expect(stache.cacheStatus).toBe('stale');
			})
		);

		it(
			'should reset to fresh when re-fetched',
			withEffectRoot(async () => {
				const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
				const { useStache } = createStache({
					id: 'refetch-fresh-test',
					fetch: fetchFn,
					staleTime: 100
				});

				const params = $state('param');
				const stache = useStache(() => ({ params }));

				flushSync();

				// Wait for initial fetch
				await vi.waitUntil(() => stache.data !== null);
				expect(stache.cacheStatus).toBe('fresh');

				vi.advanceTimersToNextTimer();

				// Wait for it to become stale
				await vi.waitUntil(() => stache.cacheStatus === 'stale');

				// Trigger refetch by calling invalidate
				stache.invalidate();
				flushSync();

				// Should be fresh again after refetch completes
				await vi.waitUntil(() => stache.cacheStatus === 'fresh');
				expect(stache.cacheStatus).toBe('fresh');
			})
		);
	});

	describe('Automatic refetch on stale behavior', () => {
		it(
			'should automatically refetch when data becomes stale if refetchOnStale is true',
			withEffectRoot(async () => {
				let callCount = 0;
				const fetchFn = vi.fn().mockImplementation(() => {
					callCount++;
					return Promise.resolve({ data: `test-${callCount}` });
				});
				const { useStache } = createStache({
					id: 'auto-refetch-test',
					fetch: fetchFn,
					staleTime: 100,
					refetchOnStale: true
				});

				const params = $state('param');
				const stache = useStache(() => ({ params }));

				flushSync();

				// Wait for initial fetch
				await vi.waitUntil(() => stache.data !== null);
				expect(fetchFn).toHaveBeenCalledTimes(1);
				expect(stache.cacheStatus).toBe('fresh');

				vi.advanceTimersToNextTimer();

				// Wait for data to become stale, which should trigger automatic refetch
				await vi.waitUntil(() => stache.data?.data === 'test-2');

				// Should have triggered another fetch
				expect(fetchFn).toHaveBeenCalledTimes(2);
			})
		);

		it(
			'should NOT automatically refetch when data becomes stale if refetchOnStale is false',
			withEffectRoot(async () => {
				const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
				const { useStache } = createStache({
					id: 'no-auto-refetch-test',
					fetch: fetchFn,
					staleTime: 100,
					refetchOnStale: false // Explicitly disabled
				});

				const params = $state('param');
				const stache = useStache(() => ({ params }));

				flushSync();

				// Wait for initial fetch
				await vi.waitUntil(() => stache.data !== null);
				expect(fetchFn).toHaveBeenCalledTimes(1);
				expect(stache.cacheStatus).toBe('fresh');

				vi.advanceTimersToNextTimer();

				// Wait for data to become stale
				await vi.waitUntil(() => stache.cacheStatus === 'stale');

				vi.advanceTimersToNextTimer();

				// Should still only have been called once
				expect(fetchFn).toHaveBeenCalledTimes(1);
				expect(stache.cacheStatus).toBe('stale');
			})
		);

		it(
			'should use default refetchOnStale behavior (false)',
			withEffectRoot(async () => {
				const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
				const { useStache } = createStache({
					id: 'default-refetch-test',
					fetch: fetchFn,
					staleTime: 100
					// refetchOnStale not specified, should default to false
				});

				const params = $state('param');
				const stache = useStache(() => ({ params }));

				flushSync();

				// Wait for initial fetch
				await vi.waitUntil(() => stache.data !== null);
				expect(fetchFn).toHaveBeenCalledTimes(1);

				// Wait for data to become stale
				await vi.waitUntil(() => stache.cacheStatus === 'stale');

				vi.advanceTimersToNextTimer();

				// Should still only have been called once (default behavior)
				expect(fetchFn).toHaveBeenCalledTimes(1);
			})
		);
	});

	describe('Invalidation method behavior', () => {
		it(
			'should force immediate refetch when invalidate is called',
			withEffectRoot(async () => {
				const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
				const { useStache, invalidate } = createStache({
					id: 'invalidate-test',
					fetch: fetchFn
				});

				const params = $state('param');
				const stache = useStache(() => ({ params }));

				flushSync();

				// Wait for initial fetch
				await vi.waitUntil(() => stache.data !== null);
				expect(fetchFn).toHaveBeenCalledTimes(1);

				// Call invalidate
				invalidate('param');
				flushSync();

				vi.advanceTimersToNextTimer();

				// Should trigger another fetch
				expect(fetchFn).toHaveBeenCalledTimes(2);
			})
		);

		it(
			'should only invalidate stache with matching parameters',
			withEffectRoot(async () => {
				const fetchFn = vi
					.fn()
					.mockImplementation((params) => Promise.resolve({ data: `result-${params}` }));
				const { useStache, invalidate } = createStache({
					id: 'selective-invalidate-test',
					fetch: fetchFn
				});

				// Create two staches with different params
				const params1 = $state('param1');
				const stache1 = useStache(() => ({ params: params1 }));

				const params2 = $state('param2');
				const stache2 = useStache(() => ({ params: params2 }));

				flushSync();

				// Wait for both to fetch
				await vi.waitUntil(() => stache1.data !== null && stache2.data !== null);
				expect(fetchFn).toHaveBeenCalledTimes(2);

				// Reset call count
				fetchFn.mockClear();

				// Invalidate only param1
				invalidate('param1');
				flushSync();

				vi.advanceTimersToNextTimer();

				// Should only refetch param1
				expect(fetchFn).toHaveBeenCalledTimes(1);
				expect(fetchFn).toHaveBeenCalledWith('param1');
			})
		);

		it(
			'should handle invalidation of non-existent stache gracefully',
			withEffectRoot(async () => {
				const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
				const { useStache, invalidate } = createStache({
					id: 'non-existent-invalidate-test',
					fetch: fetchFn
				});

				const params = $state('param');
				const stache = useStache(() => ({ params }));

				flushSync();

				// Wait for initial fetch
				await vi.waitUntil(() => stache.data !== null);
				expect(fetchFn).toHaveBeenCalledTimes(1);

				// Try to invalidate a non-existent stache
				invalidate('non-existent-param');
				flushSync();

				vi.advanceTimersToNextTimer();

				// Should not trigger any additional fetches
				expect(fetchFn).toHaveBeenCalledTimes(1);
			})
		);

		it(
			'should work with stache.invalidate() method as well',
			withEffectRoot(async () => {
				const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
				const { useStache } = createStache({
					id: 'instance-invalidate-test',
					fetch: fetchFn
				});

				const params = $state('param');
				const stache = useStache(() => ({ params }));

				flushSync();

				// Wait for initial fetch
				await vi.waitUntil(() => stache.data !== null);
				expect(fetchFn).toHaveBeenCalledTimes(1);

				// Call invalidate on the stache instance
				stache.invalidate();
				flushSync();

				vi.advanceTimersToNextTimer();

				// Should trigger another fetch
				expect(fetchFn).toHaveBeenCalledTimes(2);
			})
		);

		it(
			'should reset cache status to fresh after invalidation refetch',
			withEffectRoot(async () => {
				const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
				const { useStache, invalidate } = createStache({
					id: 'invalidate-fresh-test',
					fetch: fetchFn,
					staleTime: 100
				});

				const params = $state('param');
				const stache = useStache(() => ({ params }));

				flushSync();

				// Wait for initial fetch
				await vi.waitUntil(() => stache.data !== null);
				expect(stache.cacheStatus).toBe('fresh');

				vi.advanceTimersToNextTimer();

				// Wait for it to become stale
				await vi.waitUntil(() => stache.cacheStatus === 'stale');

				// Invalidate to trigger refetch
				invalidate('param');
				flushSync();

				// Should be fresh again after refetch
				await vi.waitUntil(() => stache.cacheStatus === 'fresh');
				expect(stache.cacheStatus).toBe('fresh');
			})
		);

		it(
			'should not trigger refetch if stache is already fetching',
			withEffectRoot(async () => {
				let resolvePromise: (value: any) => void;
				const fetchPromise = new Promise((resolve) => {
					resolvePromise = resolve;
				});

				const fetchFn = vi.fn().mockReturnValue(fetchPromise);
				const { useStache, invalidate } = createStache({
					id: 'already-fetching-test',
					fetch: fetchFn
				});

				const params = $state('param');
				const stache = useStache(() => ({ params }));

				flushSync();

				// Wait for fetch to start
				await vi.waitUntil(() => stache.isFetching);
				expect(fetchFn).toHaveBeenCalledTimes(1);

				// Try to invalidate while already fetching
				invalidate('param');
				stache.invalidate(); // Try both methods
				flushSync();

				vi.advanceTimersToNextTimer();

				// Should not trigger additional fetches
				expect(fetchFn).toHaveBeenCalledTimes(1);

				// Resolve the original fetch
				resolvePromise!({ data: 'resolved' });
				await vi.waitUntil(() => stache.data !== null);
				expect(stache.data).toEqual({ data: 'resolved' });
			})
		);
	});

	describe('Initial data handling', () => {
		it(
			'should populate stache with initial data before fetching',
			withEffectRoot(async () => {
				const fetchFn = vi.fn().mockResolvedValue({ data: 'fetched-data' });
				const { useStache } = createStache({
					id: 'initial-data-test',
					fetch: fetchFn
				});

				const params = $state('param');
				const stache = useStache(() => ({
					params,
					initialData: { data: 'initial-data' }
				}));

				// Should immediately have initial data before fetch completes
				expect(stache.data).toEqual({ data: 'initial-data' });
				expect(stache.isLoading).toBe(true);
				expect(stache.isSuccess).toBe(false);

				flushSync();

				// Wait for fetch to complete
				await vi.waitUntil(() => stache.data?.data === 'fetched-data');

				// Should now have fetched data
				expect(stache.data).toEqual({ data: 'fetched-data' });
				expect(stache.isLoading).toBe(false);
				expect(stache.isSuccess).toBe(true);
			})
		);

		it(
			'should work without initial data (default null)',
			withEffectRoot(async () => {
				const fetchFn = vi.fn().mockResolvedValue({ data: 'fetched-data' });
				const { useStache } = createStache({
					id: 'no-initial-data-test',
					fetch: fetchFn
				});

				const params = $state('param');
				const stache = useStache(() => ({ params }));

				// Should start with null data
				expect(stache.data).toBe(null);
				expect(stache.isLoading).toBe(true);

				flushSync();

				// Wait for fetch to complete
				await vi.waitUntil(() => stache.data !== null);

				// Should now have fetched data
				expect(stache.data).toEqual({ data: 'fetched-data' });
			})
		);

		it(
			'should not trigger unnecessary fetches when initial data is provided',
			withEffectRoot(async () => {
				const fetchFn = vi.fn().mockResolvedValue({ data: 'fetched-data' });
				const { useStache } = createStache({
					id: 'initial-data-fetch-test',
					fetch: fetchFn
				});

				const params = $state('param');
				const stache = useStache(() => ({
					params,
					initialData: { data: 'initial-data' }
				}));

				// Should have initial data immediately
				expect(stache.data).toEqual({ data: 'initial-data' });

				flushSync();

				// Wait for fetch to complete
				await vi.waitUntil(() => stache.data?.data === 'fetched-data');

				// Fetch should still be called once
				expect(fetchFn).toHaveBeenCalledTimes(1);
			})
		);
	});

	describe('Enhanced error handling', () => {
		// it(
		// 	'should handle AbortError by setting status to idle',
		// 	withEffectRoot(async () => {
		// 		const abortError = new DOMException('Operation aborted', 'AbortError');
		// 		const fetchFn = vi.fn().mockRejectedValue(abortError);
		// 		const { useStache } = createStache({
		// 			id: 'abort-error-test',
		// 			fetch: fetchFn
		// 		});

		// 		let params = $state('param');
		// 		const stache = useStache(() => ({ params }));

		// 		flushSync();

		// 		// Wait for fetch to complete
		// 		await new Promise((resolve) => setTimeout(resolve, 100));

		// 		// Should be idle, not error
		// 		expect(stache.fetchStatus).toBe('idle');
		// 		expect(stache.isError).toBe(false);
		// 		expect(stache.error).toBe(null);
		// 		expect(stache.data).toBe(null);
		// 	})
		// );

		it(
			'should handle regular errors by setting error state',
			withEffectRoot(async () => {
				const regularError = new Error('Network error');
				const fetchFn = vi.fn().mockRejectedValue(regularError);
				const { useStache } = createStache({
					id: 'regular-error-test',
					fetch: fetchFn
				});

				const params = $state('param');
				const stache = useStache(() => ({ params }));

				flushSync();

				// Wait for fetch to complete
				await vi.waitUntil(() => stache.isError);

				// Should be in error state
				expect(stache.fetchStatus).toBe('error');
				expect(stache.isError).toBe(true);
				expect(stache.error).toBe(regularError);
				expect(stache.data).toBe(null);
			})
		);

		it(
			'should recover from error state on successful retry',
			withEffectRoot(async () => {
				let shouldFail = true;
				const fetchFn = vi.fn().mockImplementation(() => {
					if (shouldFail) {
						return Promise.reject(new Error('Network error'));
					}
					return Promise.resolve({ data: 'success' });
				});

				const { useStache } = createStache({
					id: 'error-recovery-test',
					fetch: fetchFn
				});

				const params = $state('param');
				const stache = useStache(() => ({ params }));

				flushSync();

				// Wait for initial error
				await vi.waitUntil(() => stache.isError);
				expect(stache.fetchStatus).toBe('error');
				expect(stache.error).toBeInstanceOf(Error);

				// Fix the error and retry
				shouldFail = false;
				stache.invalidate();
				flushSync();

				// Wait for recovery
				await vi.waitUntil(() => stache.isSuccess);

				// Should recover successfully
				expect(stache.fetchStatus).toBe('success');
				expect(stache.isError).toBe(false);
				expect(stache.error).toBe(null);
				expect(stache.data).toEqual({ data: 'success' });
			})
		);

		it(
			'should clear error state when starting new fetch',
			withEffectRoot(async () => {
				let callCount = 0;
				const fetchFn = vi.fn().mockImplementation(() => {
					callCount++;
					if (callCount === 1) {
						return Promise.reject(new Error('First error'));
					}
					return Promise.resolve({ data: 'success' });
				});

				const { useStache } = createStache({
					id: 'clear-error-test',
					fetch: fetchFn
				});

				const params = $state('param');
				const stache = useStache(() => ({ params }));

				flushSync();

				// Wait for initial error
				await vi.waitUntil(() => stache.isError);
				expect(stache.error).toBeInstanceOf(Error);

				// Trigger retry
				stache.invalidate();
				flushSync();

				// Error should be cleared when new fetch starts
				expect(stache.error).toBe(null);
				expect(stache.isFetching).toBe(true);

				// Wait for success
				await vi.waitUntil(() => stache.isSuccess);
				expect(stache.data).toEqual({ data: 'success' });
			})
		);

		it(
			'should handle different error types correctly',
			withEffectRoot(async () => {
				const customError = { code: 'CUSTOM_ERROR', message: 'Custom error' };
				const fetchFn = vi.fn().mockRejectedValue(customError);
				const { useStache } = createStache({
					id: 'custom-error-test',
					fetch: fetchFn
				});

				const params = $state('param');
				const stache = useStache(() => ({ params }));

				flushSync();

				// Wait for error
				await vi.waitUntil(() => stache.isError);

				// Should preserve the custom error object
				expect(stache.error).toEqual(customError);
				expect(stache.fetchStatus).toBe('error');
			})
		);

		it(
			'should handle string errors',
			withEffectRoot(async () => {
				const stringError = 'String error message';
				const fetchFn = vi.fn().mockRejectedValue(stringError);
				const { useStache } = createStache({
					id: 'string-error-test',
					fetch: fetchFn
				});

				const params = $state('param');
				const stache = useStache(() => ({ params }));

				flushSync();

				// Wait for error
				await vi.waitUntil(() => stache.isError);

				// Should preserve the string error
				expect(stache.error).toBe(stringError);
				expect(stache.fetchStatus).toBe('error');
			})
		);

		it(
			'should preserve data from previous successful fetch when error occurs',
			withEffectRoot(async () => {
				let shouldFail = false;
				const fetchFn = vi.fn().mockImplementation(() => {
					if (shouldFail) {
						return Promise.reject(new Error('Network error'));
					}
					return Promise.resolve({ data: 'success' });
				});

				const { useStache } = createStache({
					id: 'preserve-data-error-test',
					fetch: fetchFn
				});

				const params = $state('param');
				const stache = useStache(() => ({ params }));

				flushSync();

				// Wait for initial success
				await vi.waitUntil(() => stache.isSuccess);
				expect(stache.data).toEqual({ data: 'success' });

				// Cause next fetch to fail
				shouldFail = true;
				stache.invalidate();
				flushSync();

				// Wait for error
				await vi.waitUntil(() => stache.isError);

				// Data should be preserved from previous successful fetch
				expect(stache.data).toEqual({ data: 'success' });
				expect(stache.error).toBeInstanceOf(Error);
			})
		);

		it(
			'should handle errors in enabled/disabled stache correctly',
			withEffectRoot(async () => {
				const fetchFn = vi.fn().mockRejectedValue(new Error('Network error'));
				const { useStache } = createStache({
					id: 'disabled-error-test',
					fetch: fetchFn
				});

				let enabled = $state(false);
				const params = $state('param');
				const stache = useStache(() => ({ params, enabled }));

				flushSync();

				vi.advanceTimersToNextTimer();

				// Should not fetch when disabled
				expect(fetchFn).not.toHaveBeenCalled();
				expect(stache.isError).toBe(false);

				// Enable and should get error
				enabled = true;
				flushSync();

				await vi.waitUntil(() => stache.isError);
				expect(stache.error).toBeInstanceOf(Error);
			})
		);
	});

	describe('Advanced configuration combinations', () => {
		it('should handle custom cleanupTime configuration', async () => {
			const globalCache = new SvelteMap<string, SvelteMap<string, any>>();
			const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
			const { useStache } = createStache({
				id: 'custom-cleanup-test',
				fetch: fetchFn,
				staleTime: 500,
				cleanupTime: 1000, // 1 second instead of default 5 minutes
				globalCache
			});

			let stache: any;
			await withEffectRoot(async () => {
				const params = $state('param');
				stache = useStache(() => ({ params }));

				flushSync();
				await vi.waitUntil(() => stache.data !== null);
			})();

			vi.advanceTimersToNextTimer();

			// Cache should exist and have 0 references after effect cleanup
			expect(globalCache.get('custom-cleanup-test')?.get(hashKey('param'))).toBeDefined();
			expect(stache.referenceCount).toBe(0);

			// Advance time by custom cleanup time
			vi.advanceTimersToNextTimer();
			flushSync();

			// Cache should be cleaned up
			await vi.waitFor(
				() => globalCache.get('custom-cleanup-test')?.get(hashKey('param')) === undefined
			);
		});

		it(
			'should handle setOptions with different configurations',
			withEffectRoot(async () => {
				let resolvePromise: (value: any) => void;
				const fetchPromise = new Promise((resolve) => {
					resolvePromise = resolve;
				});

				const fetchFn = vi.fn().mockReturnValue(fetchPromise);
				const { useStache } = createStache({
					id: 'set-options-config-test',
					fetch: fetchFn,
					refetchOnStale: true
				});

				let enabled = $state(true);
				const initialData = $state({ data: 'initial' });
				const params = $state('param');
				const stache = useStache(() => ({
					params,
					enabled,
					initialData
				}));

				// await vi.waitFor(() => stache.data !== null);

				// Should start with initial data
				expect(stache.data).toEqual({ data: 'initial' });

				resolvePromise!({ data: 'test' });
				flushSync();

				// Wait for fetch to complete
				await vi.waitUntil(() => stache.data?.data === 'test');
				expect(fetchFn).toHaveBeenCalledTimes(1);

				// Change enabled and initial data
				enabled = false;
				flushSync();

				vi.advanceTimersToNextTimer();

				// Wait to ensure no additional fetch
				expect(fetchFn).toHaveBeenCalledTimes(1);

				// Re-enable
				enabled = true;
				flushSync();

				vi.advanceTimersToNextTimer();

				await vi.waitUntil(() => fetchFn.mock.calls.length === 2);

				// Should trigger fetch when re-enabled
				expect(fetchFn).toHaveBeenCalledTimes(2);
			})
		);

		it(
			'should handle zero staleTime (immediately stale)',
			withEffectRoot(async () => {
				const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
				const { useStache } = createStache({
					id: 'zero-stale-test',
					fetch: fetchFn,
					staleTime: 0
				});

				const params = $state('param');
				const stache = useStache(() => ({ params }));

				flushSync();

				// Wait for initial fetch
				await vi.waitUntil(() => stache.data !== null);
				expect(fetchFn).toHaveBeenCalledTimes(1);
				expect(stache.cacheStatus).toBe('stale');
			})
		);

		it(
			'should handle configuration edge cases gracefully',
			withEffectRoot(async () => {
				const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
				const { useStache } = createStache({
					id: 'edge-case-config-test',
					fetch: fetchFn,
					staleTime: -1, // Negative stale time
					cleanupTime: -1, // Negative cleanup time
					refetchOnStale: true,
					refetchOnWindowFocus: true
				});

				const params = $state('param');
				expect(() => {
					const stache = useStache(() => ({ params }));
				}).toThrow();
			})
		);
	});
	describe('Integration scenarios', () => {
		it(
			'should handle stale data with multiple components sharing same stache',
			withEffectRoot(async () => {
				const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
				const { useStache } = createStache({
					id: 'shared-stale-test',
					fetch: fetchFn,
					staleTime: 100
				});

				// Create multiple components sharing the same stache
				const params1 = $state('shared-param');
				const stache1 = useStache(() => ({ params: params1 }));

				const params2 = $state('shared-param');
				const stache2 = useStache(() => ({ params: params2 }));

				const params3 = $state('shared-param');
				const stache3 = useStache(() => ({ params: params3 }));

				flushSync();

				// All should be the same instance
				expect(stache1._stache).toBe(stache2._stache);
				expect(stache2._stache).toBe(stache3._stache);

				// Wait for fetch
				await vi.waitUntil(() => stache1.data !== null);
				expect(fetchFn).toHaveBeenCalledTimes(1);
				expect(stache1.cacheStatus).toBe('fresh');

				// Wait for all to become stale
				await vi.waitUntil(() => stache1.cacheStatus === 'stale');

				// All should be stale
				expect(stache1.cacheStatus).toBe('stale');
				expect(stache2.cacheStatus).toBe('stale');
				expect(stache3.cacheStatus).toBe('stale');

				// Invalidate from one component
				stache1.invalidate();
				flushSync();

				// All should become fresh again
				await vi.waitUntil(() => stache1.cacheStatus === 'fresh');
				expect(stache2.cacheStatus).toBe('fresh');
				expect(stache3.cacheStatus).toBe('fresh');
				expect(fetchFn).toHaveBeenCalledTimes(2);
			})
		);

		it('should handle cache cleanup interaction with stale status', async () => {
			const globalCache = new SvelteMap<string, SvelteMap<string, any>>();
			const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
			const { useStache } = createStache({
				id: 'cleanup-stale-test',
				fetch: fetchFn,
				staleTime: 100,
				cleanupTime: 1000,
				globalCache
			});

			let stache: any;
			await withEffectRoot(async () => {
				const params = $state('param');
				stache = useStache(() => ({ params }));

				flushSync();
				await vi.waitUntil(() => stache.data !== null);

				vi.advanceTimersToNextTimer();
				await vi.waitUntil(() => stache.cacheStatus === 'stale');
			})();

			// Should be stale with 0 references
			expect(stache.cacheStatus).toBe('stale');
			expect(stache.referenceCount).toBe(0);

			// Advance cleanup time
			vi.advanceTimersToNextTimer();

			// Cache should be cleaned up regardless of stale status
			await vi.waitFor(
				() => globalCache.get('cleanup-stale-test')?.get(hashKey('param')) === undefined
			);

			vi.useRealTimers();
		});

		it(
			'should handle parameter changes with stale data correctly',
			withEffectRoot(async () => {
				const fetchFn = vi
					.fn()
					.mockImplementation((params) => Promise.resolve({ data: `result-${params}` }));
				const { useStache } = createStache({
					id: 'param-change-stale-test',
					fetch: fetchFn,
					staleTime: 100
				});

				let params = $state('param1');
				const stache = useStache(() => ({ params }));

				flushSync();

				// Wait for initial fetch
				await vi.waitUntil(() => stache.data !== null);
				expect(stache.data).toEqual({ data: 'result-param1' });
				expect(fetchFn).toHaveBeenCalledWith('param1');

				// Wait for it to become stale
				await vi.waitUntil(() => stache.cacheStatus === 'stale');

				// Change parameters while stale
				params = 'param2';
				flushSync();

				// Should fetch new data and be fresh
				await vi.waitUntil(() => stache.data?.data === 'result-param2');
				expect(stache.cacheStatus).toBe('fresh');
				expect(fetchFn).toHaveBeenCalledWith('param2');
			})
		);

		it(
			'should handle complex scenario with errors, stale data, and recovery',
			withEffectRoot(async () => {
				let shouldFail = false;
				const fetchFn = vi.fn().mockImplementation((params) => {
					if (shouldFail) {
						return Promise.reject(new Error(`Error for ${params}`));
					}
					return Promise.resolve({ data: `result-${params}` });
				});

				const { useStache } = createStache({
					id: 'complex-scenario-test',
					fetch: fetchFn,
					staleTime: 100,
					refetchOnStale: true
				});

				const params = $state('param');
				const stache = useStache(() => ({ params }));

				flushSync();

				// Initial successful fetch
				await vi.waitUntil(() => stache.data !== null);
				expect(stache.data).toEqual({ data: 'result-param' });
				expect(stache.cacheStatus).toBe('fresh');

				// Wait for it to become stale (should auto-refetch)
				await vi.waitUntil(() => fetchFn.mock.calls.length >= 2);
				expect(stache.cacheStatus).toBe('fresh'); // Fresh again after auto-refetch

				// Make subsequent fetches fail
				shouldFail = true;

				// Wait for another stale cycle (should fail)
				await vi.waitUntil(() => stache.isError);
				expect(stache.error).toBeInstanceOf(Error);
				expect(stache.data).toEqual({ data: 'result-param' }); // Previous data preserved

				// Fix the error
				shouldFail = false;

				// Manually invalidate to retry
				stache.invalidate();
				flushSync();

				// Should recover
				await vi.waitUntil(() => stache.isSuccess && !stache.isError);
				expect(stache.data).toEqual({ data: 'result-param' });
				expect(stache.error).toBe(null);
			})
		);

		it(
			'should handle window focus during various stache states',
			withEffectRoot(async () => {
				let callCount = 0;
				const fetchFn = vi.fn().mockImplementation(() => {
					callCount++;
					if (callCount === 2) {
						// Second call fails
						return Promise.reject(new Error('Second call error'));
					}
					return Promise.resolve({ data: `result-${callCount}` });
				});

				const { useStache } = createStache({
					id: 'window-focus-states-test',
					fetch: fetchFn,
					staleTime: 100,
					refetchOnWindowFocus: true
				});

				const params = $state('param');
				const stache = useStache(() => ({ params }));

				flushSync();

				// Initial fetch
				await vi.waitUntil(() => stache.data !== null);
				expect(stache.data).toEqual({ data: 'result-1' });

				// Wait for stale
				await vi.waitUntil(() => stache.cacheStatus === 'stale');

				// Focus should trigger refetch (which will fail)
				window.dispatchEvent(new Event('focus'));
				flushSync();

				// Should be in error state but data preserved
				await vi.waitUntil(() => stache.isError);
				expect(stache.data).toEqual({ data: 'result-1' });

				// Focus again while in error state and stale
				window.dispatchEvent(new Event('focus'));
				flushSync();

				// Should try again and succeed (third call)
				await vi.waitUntil(() => stache.isSuccess && stache.data?.data === 'result-3');
				expect(stache.error).toBe(null);
			})
		);

		it(
			'should refetch correctly when transitioning enabled state with stale data if refetchOnStale is enabled',
			withEffectRoot(async () => {
				let callCount = 0;
				const fetchFn = vi.fn().mockImplementation(() => {
					callCount++;
					return Promise.resolve(`result-${callCount}`);
				});
				const { useStache } = createStache({
					id: 'enabled-state-stale-refetch-test',
					fetch: fetchFn,
					refetchOnStale: true
				});

				let enabled = $state(true);
				const params = $state('param');
				const stache = useStache(() => ({ params, enabled }));

				// Initial fetch while enabled
				await vi.waitUntil(() => stache.data === 'result-1');
				expect(fetchFn).toHaveBeenCalledTimes(1);

				// Disable before it becomes stale
				enabled = false;

				flushSync();

				vi.advanceTimersToNextTimer();

				// Should not have re-fetched while disabled
				expect(fetchFn).toHaveBeenCalledTimes(1);

				// Re-enable after stale time has passed
				enabled = true;
				flushSync();

				vi.advanceTimersToNextTimer();

				// Should trigger refetch when re-enabled
				expect(fetchFn).toHaveBeenCalledTimes(2);

				enabled = false;
			})
		);

		it(
			'should not refetch when transitioning enabled state with stale data if refetchOnStale is disabled',
			withEffectRoot(async () => {
				let callCount = 0;
				const fetchFn = vi.fn().mockImplementation(() => {
					callCount++;
					return Promise.resolve(`result-${callCount}`);
				});
				const { useStache } = createStache({
					id: 'disabled-state-stale-refetch-test',
					fetch: fetchFn,
					refetchOnStale: false
				});

				let enabled = $state(true);
				const params = $state('param');
				const stache = useStache(() => ({ params, enabled }));

				// Initial fetch while enabled
				await vi.waitUntil(() => stache.data === 'result-1');
				expect(fetchFn).toHaveBeenCalledTimes(1);

				// Disable before it becomes stale
				enabled = false;

				vi.advanceTimersToNextTimer();

				// Should not have re-fetched while disabled
				expect(fetchFn).toHaveBeenCalledTimes(1);

				// Re-enable after stale time has passed
				enabled = true;
				flushSync();

				vi.advanceTimersToNextTimer();

				// Should trigger refetch when re-enabled
				expect(fetchFn).toHaveBeenCalledTimes(1);

				enabled = false;
			})
		);
	});

	describe('undefined params behavior', () => {
		it(
			'should allow undefined and fetch normally if the fetch function has no params',
			withEffectRoot(async () => {
				const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
				const { useStache } = createStache({
					id: 'no-disable-if-falsy-test',
					fetch: fetchFn
				});

				const params = $state(undefined);
				const stache = useStache(() => ({ params }));

				flushSync();

				await vi.waitUntil(() => stache.data !== null);
				expect(fetchFn).toHaveBeenCalledTimes(1);
				expect(fetchFn).toHaveBeenCalledWith(undefined);
			})
		);

		it(
			'should not fetch when params undefined if the fetch function requires params',
			withEffectRoot(async () => {
				const track = vi.fn();
				const fetchFn = (params: number) => {
					track(params);
					return Promise.resolve({ data: `result-${params}` });
				};

				const { useStache } = createStache({
					id: 'undefined-params-disable-test',
					fetch: fetchFn
				});

				const stache = useStache();

				flushSync();

				// Should not fetch since params is undefined
				expect(track).not.toHaveBeenCalled();
				expect(stache.data).toBe(null);
			})
		);

		it(
			'should fetch when params change from undefined to valid value',
			withEffectRoot(async () => {
				const track = vi.fn();
				const fetchFn = (params: number) => {
					track(params);
					return Promise.resolve({ data: `result-${params}` });
				};
				const { useStache } = createStache({
					id: 'null-to-valid-params-test',
					fetch: fetchFn
				});

				let params: number | undefined = $state(undefined);
				const stache = useStache(() => ({ params }));

				flushSync();

				// Should not fetch initially
				expect(track).not.toHaveBeenCalled();
				expect(stache.data).toBe(null);

				// Change to valid value
				params = 5;
				flushSync();

				// Should fetch now
				await vi.waitUntil(() => stache.data !== null);
				expect(track).toHaveBeenCalledWith(5);
				expect(stache.data).toEqual({ data: 'result-5' });
			})
		);

		it(
			'should not fetch when params change from valid to undefined',
			withEffectRoot(async () => {
				const track = vi.fn();
				const fetchFn = (params: number) => {
					track(params);
					return Promise.resolve({ data: `result-${params}` });
				};
				const { useStache } = createStache({
					id: 'valid-to-null-params-test',
					fetch: fetchFn
				});

				let params: number | undefined = $state(10);
				const stache = useStache(() => ({ params }));

				flushSync();

				// Wait for initial fetch
				await vi.waitUntil(() => stache.data !== null);
				expect(track).toHaveBeenCalledWith(10);
				expect(stache.data).toEqual({ data: 'result-10' });

				// Change to undefined
				params = undefined;
				flushSync();

				vi.advanceTimersToNextTimer();

				// Should not fetch again
				expect(track).toHaveBeenCalledTimes(1);
				expect(stache.data).toEqual({ data: 'result-10' }); // Data remains unchanged
			})
		);
	});
});

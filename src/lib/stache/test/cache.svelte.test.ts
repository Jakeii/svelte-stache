import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { flushSync } from 'svelte';
import { createStache, type Stache } from '../stache.svelte';
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

describe('createStache cache implementation', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		initStacheCache();
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Reference counting and cleanup behavior', () => {
		it('should only delete cache when ALL components are unmounted and timeout expires', async () => {
			const globalCache = new StacheCache();
			const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
			const { useStache } = createStache({
				id: 'cleanup-test',
				fetch: fetchFn,
				globalCache
			});
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			let stache1: Stache<unknown, unknown>;

			await withEffectRoot(async () => {
				// Create three stache instances with same params — all synchronously
				// to stay within the $effect.root context
				const params1 = $state('param1');
				const stache1Thenable = useStache(() => ({ params: params1 }));

				const params2 = $state('param1');
				useStache(() => ({ params: params2 }));

				const params3 = $state('param1');
				useStache(() => ({ params: params3 }));

				flushSync();

				// Now await after all staches are created
				stache1 = await stache1Thenable;

				expect(globalCache.getStache('cleanup-test', hashKey('param1'))?.referenceCount).toBe(3);

				expect(globalCache.getStacheGroup('cleanup-test')?.size).toBe(1);

				expect(fetchFn).toHaveBeenCalledTimes(1);
			})();

			await withEffectRoot(async () => {
				const cachedStache = globalCache.getStache('cleanup-test', hashKey('param1'));
				expect(cachedStache).toBeDefined();
				expect(cachedStache?.referenceCount).toBe(0);

				expect(cachedStache?.cleanupTimeout).not.toBeNull();

				// Fast-forward time to trigger cleanup
				vi.advanceTimersToNextTimer();

				// Now cache should be cleaned up
				await vi.waitUntil(
					() => globalCache.getStache('cleanup-test', hashKey('param1')) === undefined
				);

				flushSync();

				expect(globalCache.getStache('cleanup-test', hashKey('param1'))).toBeUndefined();
			})();
		});
	});

	it('should not delete cache if a new reference is added before cleanup timeout expires', async () => {
		const globalCache = new StacheCache();
		const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
		const { useStache } = createStache({
			id: 'ref-count-test',
			fetch: fetchFn,
			cleanupTime: 1000,
			globalCache
		});

		await withEffectRoot(async () => {
			// Create stache instance
			const params1 = $state('param1');
			const stache1 = await useStache(() => ({ params: params1 }));
			flushSync();
			await vi.waitUntil(() => stache1.data !== null);
			expect(fetchFn).toHaveBeenCalledTimes(1);
			expect(globalCache.getStache('ref-count-test', hashKey('param1'))?.referenceCount).toBe(1);
		})();

		await withEffectRoot(async () => {
			const cachedStache = globalCache.getStache('ref-count-test', hashKey('param1'));
			expect(cachedStache).toBeDefined();
			expect(cachedStache?.referenceCount).toBe(0);
			expect(cachedStache?.cleanupTimeout).not.toBeNull();

			vi.advanceTimersByTime(500);

			// Reference stache again before cleanup timeout expires
			const params1copy = $state('param1');
			const stache1copy = await useStache(() => ({ params: params1copy }));
			flushSync();
			expect(stache1copy.data).toEqual({ data: 'test' });
			expect(cachedStache?.referenceCount).toBe(1);

			vi.advanceTimersByTime(1200);

			expect(cachedStache?.cleanupTimeout).toBeNull();

			// Cache should NOT be deleted since reference was added before timeout
			expect(globalCache.getStache('ref-count-test', hashKey('param1'))).toBeDefined();
			expect(globalCache.getStache('ref-count-test', hashKey('param1'))?.referenceCount).toBe(1);
		})();
	});

	it('should only refetch referenced staches', async () => {
		const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
		const globalCache = new StacheCache();
		const { useStache } = createStache({
			id: 'invalidate-test',
			fetch: fetchFn,
			refetchOnStale: true,
			staleTime: 100,
			globalCache
		});

		await withEffectRoot(async () => {
			// Create two stache instances synchronously to stay in $effect.root context
			const params1 = $state('param1');
			const stache1Thenable = useStache(() => ({ params: params1 }));

			const params2 = $state('param2');
			const stache2Thenable = useStache(() => ({ params: params2 }));

			flushSync();

			const stache1 = await stache1Thenable;
			const stache2 = await stache2Thenable;

			await vi.waitUntil(() => stache1.data !== null && stache2.data !== null);
			expect(fetchFn).toHaveBeenCalledTimes(2);

			expect(globalCache.getStache('invalidate-test', hashKey('param1'))?.referenceCount).toBe(1);
			expect(globalCache.getStache('invalidate-test', hashKey('param2'))?.referenceCount).toBe(1);
		})();

		await withEffectRoot(async () => {
			expect(globalCache.getStache('invalidate-test', hashKey('param1'))?.referenceCount).toBe(0);
			expect(globalCache.getStache('invalidate-test', hashKey('param2'))?.referenceCount).toBe(0);

			// Reference stache1 again
			const params1copy = $state('param1');
			const stache1copy = await useStache(() => ({ params: params1copy }));
			flushSync();
			await vi.waitUntil(() => stache1copy.data !== null);

			expect(globalCache.getStache('invalidate-test', hashKey('param1'))?.referenceCount).toBe(1);
			expect(globalCache.getStache('invalidate-test', hashKey('param2'))?.referenceCount).toBe(0);

			fetchFn.mockClear();

			// make stale
			vi.advanceTimersToNextTimer();

			await vi.waitUntil(() => fetchFn.mock.calls.length > 0);

			expect(globalCache.getStache('invalidate-test', hashKey('param1'))?.cacheStatus).toBe(
				'fresh'
			);
			expect(globalCache.getStache('invalidate-test', hashKey('param2'))?.cacheStatus).toBe(
				'stale'
			);
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

				// Create queries with same params but different ids — synchronously
				const params1 = $state({ id: 1 });
				const stache1Thenable = useStache1(() => ({ params: params1 }));

				const params2 = $state({ id: 1 });
				const stache2Thenable = useStache2(() => ({ params: params2 }));

				flushSync();

				const stache1 = await stache1Thenable;
				const stache2 = await stache2Thenable;

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
				const globalCache = new StacheCache();

				const fetchFn = vi.fn().mockImplementation((params) => {
					return Promise.resolve({ data: `result-${params.id}` });
				});

				const { useStache } = createStache({
					id: 'param-test',
					fetch: fetchFn,
					globalCache
				});

				// Create queries with different params — synchronously
				const params1 = $state({ id: 1 });
				const stache1Thenable = useStache(() => ({ params: params1 }));

				const params2 = $state({ id: 2 });
				const stache2Thenable = useStache(() => ({ params: params2 }));

				const params3 = $state({ id: 1 });
				const stache3Thenable = useStache(() => ({ params: params3 }));

				flushSync();

				const stache1 = await stache1Thenable;
				const stache2 = await stache2Thenable;
				await stache3Thenable;

				expect(globalCache.getStacheGroup('param-test')?.size).toBe(2);

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
				const globalCache = new StacheCache();

				const fetchFn = vi.fn().mockImplementation((params) => {
					return Promise.resolve(`result-${params}`);
				});
				const { useStache } = createStache({
					id: 'timeout-test',
					fetch: fetchFn,
					globalCache
				});

				let params = $state('param1');
				const stache = useStache(() => ({ params: params }));

				flushSync();

				expect(globalCache.getStache('timeout-test', hashKey('param1'))).toBeDefined();

				// Change params to create new cache entry
				params = 'param2';
				flushSync();

				expect(globalCache.getStache('timeout-test', hashKey('param2'))).toBeDefined();

				await vi.waitUntil(() => stache.data === 'result-param2');

				const cache1 = globalCache.getStache('timeout-test', hashKey('param1'));
				const cache2 = globalCache.getStache('timeout-test', hashKey('param2'));
				expect(cache1).toBeDefined();
				expect(cache2).toBeDefined();

				flushSync();

				expect(cache1?.referenceCount).toBe(0);
				expect(cache2?.referenceCount).toBe(1);

				// Fast-forward time to trigger cleanup of old param cache
				vi.advanceTimersToNextTimer();
				flushSync();

				// Old cache entry should be cleaned up
				expect(globalCache.getStache('timeout-test', hashKey('param1'))?.cacheStatus === 'stale');
				expect(globalCache.getStache('timeout-test', hashKey('param2'))).toBeDefined();

				await vi.waitUntil(
					() => globalCache.getStache('timeout-test', hashKey('param1')) === undefined
				);

				expect(globalCache.getStache('timeout-test', hashKey('param1'))).toBeUndefined();
				expect(globalCache.getStache('timeout-test', hashKey('param2'))).toBeDefined();

				vi.useRealTimers();
			})
		);
	});

	describe('Invalidate all staches', () => {
		it(
			'should invalidate all param variants when invalidate() called with no args',
			withEffectRoot(async () => {
				const globalCache = new StacheCache();

				const fetchFn = vi
					.fn()
					.mockImplementation((params: { id: number }) =>
						Promise.resolve({ data: `result-${params.id}` })
					);

				const { useStache, invalidate } = createStache({
					id: 'invalidate-all-variants',
					fetch: fetchFn,
					globalCache
				});

				const params1 = $state({ id: 1 });
				const stache1 = useStache(() => ({ params: params1 }));

				const params2 = $state({ id: 2 });
				const stache2 = useStache(() => ({ params: params2 }));

				flushSync();

				await vi.waitUntil(() => stache1.data !== null && stache2.data !== null);
				expect(fetchFn).toHaveBeenCalledTimes(2);

				fetchFn.mockClear();

				expect(fetchFn).toHaveBeenCalledTimes(0);

				invalidate();
				flushSync();

				await vi.waitUntil(() => fetchFn.mock.calls.length === 2);
				expect(fetchFn).toHaveBeenCalledTimes(2);
			})
		);

		it(
			'should only invalidate the matching param variant when invalidate(args) is called',
			withEffectRoot(async () => {
				const globalCache = new StacheCache();

				const fetchFn = vi
					.fn()
					.mockImplementation((params: { id: number }) =>
						Promise.resolve({ data: `result-${params.id}` })
					);

				const { useStache, invalidate } = createStache({
					id: 'invalidate-specific-param',
					fetch: fetchFn,
					globalCache
				});

				const params1 = $state({ id: 1 });
				const stache1 = useStache(() => ({ params: params1 }));

				const params2 = $state({ id: 2 });
				const stache2 = useStache(() => ({ params: params2 }));

				flushSync();

				await vi.waitUntil(() => stache1.data !== null && stache2.data !== null);
				expect(fetchFn).toHaveBeenCalledTimes(2);

				fetchFn.mockClear();

				invalidate({ id: 1 });
				flushSync();

				await vi.waitUntil(() => fetchFn.mock.calls.length === 1);
				expect(fetchFn).toHaveBeenCalledTimes(1);
				expect(fetchFn).toHaveBeenCalledWith({ id: 1 });
			})
		);

		it(
			'should handle invalidate() with no args for a no-param fetch',
			withEffectRoot(async () => {
				const fetchFn = vi.fn().mockResolvedValue({ data: 'no-params' });

				const { useStache, invalidate } = createStache({
					id: 'invalidate-no-params',
					fetch: fetchFn
				});

				const stache = useStache();
				flushSync();

				await vi.waitUntil(() => stache.data !== null);
				expect(fetchFn).toHaveBeenCalledTimes(1);

				invalidate();
				flushSync();

				await vi.waitUntil(() => fetchFn.mock.calls.length === 2);
				expect(fetchFn).toHaveBeenCalledTimes(2);
			})
		);

		it(
			'should not affect staches with different ids when invalidate() is called',
			withEffectRoot(async () => {
				const fetchFn1 = vi.fn().mockResolvedValue('data-1');
				const fetchFn2 = vi.fn().mockResolvedValue('data-2');

				const { useStache: useStache1, invalidate: invalidate1 } = createStache({
					id: 'invalidate-all-isolation-1',
					fetch: fetchFn1
				});

				const { useStache: useStache2 } = createStache({
					id: 'invalidate-all-isolation-2',
					fetch: fetchFn2
				});

				const stache1 = useStache1();
				const stache2 = useStache2();
				flushSync();

				await vi.waitUntil(() => stache1.data !== null && stache2.data !== null);
				expect(fetchFn1).toHaveBeenCalledTimes(1);
				expect(fetchFn2).toHaveBeenCalledTimes(1);

				fetchFn1.mockClear();
				fetchFn2.mockClear();

				invalidate1();
				flushSync();

				await vi.waitUntil(() => fetchFn1.mock.calls.length === 1);

				// stache2 should not have been refetched
				expect(fetchFn1).toHaveBeenCalledTimes(1);
				expect(fetchFn2).toHaveBeenCalledTimes(0);
			})
		);
	});

	describe('clear()', () => {
		it(
			'should remove all stache entries from the cache',
			withEffectRoot(async () => {
				const globalCache = new StacheCache();
				const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });

				const { useStache } = createStache({
					id: 'clear-stache-test',
					fetch: fetchFn,
					globalCache
				});

				const params = $state('param1');
				const stache = useStache(() => ({ params }));
				flushSync();

				await vi.waitUntil(() => stache.data !== null);
				expect(globalCache.stacheCache.size).toBe(1);

				globalCache.clear();

				expect(globalCache.stacheCache.size).toBe(0);
				expect(globalCache.getStache('clear-stache-test', hashKey('param1'))).toBeUndefined();
			})
		);

		it('should fetch fresh data on next use after clear', async () => {
			const globalCache = new StacheCache();
			const fetchFn = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');

			const { useStache } = createStache({
				id: 'clear-refetch-test',
				fetch: fetchFn,
				globalCache
			});

			// First use — fetches data and caches it
			await withEffectRoot(async () => {
				const stache = useStache(() => ({ params: 'p' }));
				flushSync();
				await vi.waitUntil(() => stache.data !== null);
				expect(stache.data).toBe('first');
			})();

			expect(fetchFn).toHaveBeenCalledTimes(1);
			globalCache.clear();

			// Second use — cache is gone so it must re-fetch
			await withEffectRoot(async () => {
				const stache2 = useStache(() => ({ params: 'p' }));
				flushSync();
				await vi.waitUntil(() => stache2.data !== null);

				expect(fetchFn).toHaveBeenCalledTimes(2);
				expect(stache2.data).toBe('second');
			})();
		});
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
				const stache = await useStache(() => ({ params }));

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
				const stache = await useStache(() => ({ params }));

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
				const globalCache = new StacheCache();
				const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
				const { useStache } = createStache({
					id: 'custom-stale-time-test',
					fetch: fetchFn,
					staleTime: 1000, // Very short stale time
					globalCache
				});

				const params = $state('param');
				const stache = await useStache(() => ({ params }));

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
				const stache = await useStache(() => ({ params }));

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
});

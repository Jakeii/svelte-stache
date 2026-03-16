import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { flushSync } from 'svelte';
import { createStache } from '../stache.svelte';
import { hashKey } from '../../utils';
import { createStacheCache, StacheCache } from '../../cache';

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
		createStacheCache();
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Advanced configuration combinations', () => {
		it('should handle custom cleanupTime configuration', async () => {
			const globalCache = new StacheCache();
			const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
			const { useStache } = createStache({
				id: 'custom-cleanup-test',
				fetch: fetchFn,
				staleTime: 500,
				cleanupTime: 1000, // 1 second instead of default 5 minutes
				globalCache
			});

			await withEffectRoot(async () => {
				const params = $state('param');
				const stache = await useStache(() => ({ params }));

				flushSync();
				await vi.waitUntil(() => stache.data !== null);
			})();

			vi.advanceTimersToNextTimer();

			// Cache should exist and have 0 references after effect cleanup
			expect(globalCache.getStache('custom-cleanup-test', hashKey('param'))).toBeDefined();
			expect(globalCache.getStache('custom-cleanup-test', hashKey('param'))?.referenceCount).toBe(
				0
			);

			// Advance time by custom cleanup time
			vi.advanceTimersToNextTimer();
			flushSync();

			// Cache should be cleaned up
			await vi.waitFor(
				() => globalCache.getStache('custom-cleanup-test', hashKey('param')) === undefined
			);
		});

		it(
			'should handle setOptions with different configurations',
			withEffectRoot(async () => {
				const fetchPromise = new Promise((resolve) => {
					resolve({ data: 'test' });
				});

				const fetchFn = vi.fn().mockReturnValue(fetchPromise);
				const { useStache } = createStache({
					id: 'set-options-config-test',
					fetch: fetchFn,
					refetchOnStale: true
				});

				let enabled = $state(true);
				const params = $state('param');
				const stache = await useStache(() => ({
					params,
					enabled
				}));

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
				const stache = await useStache(() => ({ params }));

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
					useStache(() => ({ params }));
				}).toThrow();
			})
		);
	});

	describe('Integration scenarios', () => {
		it(
			'should handle stale data with multiple components sharing same stache',
			withEffectRoot(async () => {
				const globalCache = new StacheCache();
				const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
				const { useStache } = createStache({
					id: 'shared-stale-test',
					fetch: fetchFn,
					staleTime: 100,
					globalCache
				});

				// Create multiple components sharing the same stache — synchronously
				const params1 = $state('shared-param');
				const stache1Thenable = useStache(() => ({ params: params1 }));

				const params2 = $state('shared-param');
				const stache2Thenable = useStache(() => ({ params: params2 }));

				const params3 = $state('shared-param');
				const stache3Thenable = useStache(() => ({ params: params3 }));

				flushSync();

				const stache1 = await stache1Thenable;
				const stache2 = await stache2Thenable;
				const stache3 = await stache3Thenable;

				expect(globalCache.getStache('shared-stale-test', hashKey('shared-param'))).toBeDefined();
				expect(globalCache.getStacheGroup('shared-stale-test')?.size).toBe(1);

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
			const globalCache = new StacheCache();
			const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
			const { useStache } = createStache({
				id: 'cleanup-stale-test',
				fetch: fetchFn,
				staleTime: 100,
				cleanupTime: 1000,
				globalCache
			});

			await withEffectRoot(async () => {
				const params = $state('param');
				const stache = await useStache(() => ({ params }));

				flushSync();
				await vi.waitUntil(() => stache.data !== null);

				vi.advanceTimersToNextTimer();
				await vi.waitUntil(() => stache.cacheStatus === 'stale');
			})();

			// Should be stale with 0 references
			expect(globalCache.getStache('cleanup-stale-test', hashKey('param'))?.cacheStatus).toBe(
				'stale'
			);
			expect(globalCache.getStache('cleanup-stale-test', hashKey('param'))?.referenceCount).toBe(0);

			// Advance cleanup time
			vi.advanceTimersToNextTimer();

			// Cache should be cleaned up regardless of stale status
			await vi.waitFor(
				() => globalCache.getStache('cleanup-stale-test', hashKey('param')) === undefined
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
				const stache = await useStache(() => ({ params }));

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
				const stache = await useStache(() => ({ params }));

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
				const stache = await useStache(() => ({ params, enabled }));

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
				const stache = await useStache(() => ({ params, enabled }));

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
				const stache = await useStache(() => ({ params }));

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

				const stache = await useStache();

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
				const stache = await useStache(() => ({ params }));

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
				const stache = await useStache(() => ({ params }));

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

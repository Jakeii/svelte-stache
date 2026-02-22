import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { flushSync } from 'svelte';
import { createStache } from '../stache.svelte';

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
		hydratable: <T>(key: string, fetcher: () => Promise<T>) => Promise.resolve(fetcher())
	};
});

describe('createStache cache implementation', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.restoreAllMocks();
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
				const stache = await useStache(() => ({ params }));

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
				const stache = await useStache(() => ({ params }));

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
				const stache = await useStache(() => ({ params }));

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
				const stache = await useStache(() => ({ params }));

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

				// Create two staches with different params — synchronously
				const params1 = $state('param1');
				const stache1Thenable = useStache(() => ({ params: params1 }));

				const params2 = $state('param2');
				const stache2Thenable = useStache(() => ({ params: params2 }));

				flushSync();

				const stache1 = await stache1Thenable;
				const stache2 = await stache2Thenable;

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
				const stache = await useStache(() => ({ params }));

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
				const stache = await useStache(() => ({ params }));

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
				const stache = await useStache(() => ({ params }));

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
			'should not trigger refetch if stache is already loading',
			withEffectRoot(async () => {
				let resolvePromise: (value: unknown) => void;
				const fetchPromise = new Promise((resolve) => {
					resolvePromise = resolve;
				});

				const fetchFn = vi.fn().mockReturnValue(fetchPromise);
				const { useStache, invalidate } = createStache({
					id: 'already-loading-test',
					fetch: fetchFn
				});

				const params = $state('param');
				const stache = useStache(() => ({ params }));

				flushSync();

				// Wait for fetch to start
				await vi.waitUntil(() => stache.isLoading);
				expect(fetchFn).toHaveBeenCalledTimes(1);

				// Try to invalidate while already loading
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
});

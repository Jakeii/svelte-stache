import { describe, it, expect, expectTypeOf, vi, afterEach, beforeEach } from 'vitest';
import { flushSync } from 'svelte';
import { createStache } from '../stache.svelte';
import { StacheCache } from '../../cache';

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

describe('createStache initialData', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it(
		'should populate data immediately without fetching when initialDataFetchedAt is recent',
		withEffectRoot(async () => {
			const globalCache = new StacheCache();
			const fetchFn = vi.fn().mockResolvedValue({ data: 'fetched' });
			const { useStache } = createStache({
				id: 'initial-data-no-fetch',
				fetch: fetchFn,
				globalCache
			});

			const params = $state('param1');
			const stache = useStache(() => ({
				params,
				initialData: { data: 'initial' },
				initialDataFetchedAt: new Date()
			}));

			flushSync();

			expect(stache.data).toEqual({ data: 'initial' });
			expect(fetchFn).not.toHaveBeenCalled();
		})
	);

	it(
		'should be fresh when initialDataFetchedAt is recent',
		withEffectRoot(async () => {
			const globalCache = new StacheCache();
			const fetchFn = vi.fn().mockResolvedValue({ data: 'fetched' });
			const { useStache } = createStache({
				id: 'initial-data-fresh',
				fetch: fetchFn,
				staleTime: 60_000, // 1 minute
				globalCache
			});

			const params = $state('param1');
			const stache = useStache(() => ({
				params,
				initialData: { data: 'initial' },
				initialDataFetchedAt: new Date() // just now
			}));

			flushSync();

			expect(stache.cacheStatus).toBe('fresh');
			expect(fetchFn).not.toHaveBeenCalled();
		})
	);

	it(
		'should be stale and trigger fetch when initialDataFetchedAt is older than staleTime',
		withEffectRoot(async () => {
			const globalCache = new StacheCache();
			const fetchFn = vi.fn().mockResolvedValue({ data: 'fetched' });
			const { useStache } = createStache({
				id: 'initial-data-stale',
				fetch: fetchFn,
				staleTime: 60_000, // 1 minute
				globalCache
			});

			const staleDate = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
			const params = $state('param1');
			const stache = useStache(() => ({
				params,
				initialData: { data: 'initial' },
				initialDataFetchedAt: staleDate
			}));

			flushSync();

			expect(stache.cacheStatus).toBe('stale');
			expect(stache.data).toEqual({ data: 'initial' });

			await vi.waitUntil(() => fetchFn.mock.calls.length > 0);
			expect(fetchFn).toHaveBeenCalledTimes(1);
		})
	);

	it(
		'should default to stale and trigger fetch when initialDataFetchedAt is not provided',
		withEffectRoot(async () => {
			const globalCache = new StacheCache();
			const fetchFn = vi.fn().mockResolvedValue({ data: 'fetched' });
			const { useStache } = createStache({
				id: 'initial-data-default-date',
				fetch: fetchFn,
				staleTime: 60_000,
				globalCache
			});

			const params = $state('param1');
			const stache = useStache(() => ({
				params,
				initialData: { data: 'initial' }
				// no initialDataFetchedAt — treated as age unknown, so stale
			}));

			flushSync();

			expect(stache.cacheStatus).toBe('stale');
			expect(stache.data).toEqual({ data: 'initial' });

			await vi.waitUntil(() => fetchFn.mock.calls.length > 0);
			expect(fetchFn).toHaveBeenCalledTimes(1);
		})
	);

	it(
		'should transition to stale after staleTime when initialData is fresh',
		withEffectRoot(async () => {
			const globalCache = new StacheCache();
			const fetchFn = vi.fn().mockResolvedValue({ data: 'fetched' });
			const { useStache } = createStache({
				id: 'initial-data-stale-transition',
				fetch: fetchFn,
				staleTime: 100,
				globalCache
			});

			const params = $state('param1');
			const stache = useStache(() => ({
				params,
				initialData: { data: 'initial' },
				initialDataFetchedAt: new Date(),
				initialDataRefetchOnStale: false
			}));

			flushSync();

			expect(stache.cacheStatus).toBe('fresh');
			expect(fetchFn).not.toHaveBeenCalled();

			vi.advanceTimersToNextTimer();

			await vi.waitUntil(() => stache.cacheStatus === 'stale');
			expect(stache.cacheStatus).toBe('stale');
		})
	);

	it(
		'should automatically refetch when initialData goes stale if initialDataRefetchOnStale is true',
		withEffectRoot(async () => {
			const globalCache = new StacheCache();
			let callCount = 0;
			const fetchFn = vi.fn().mockImplementation(() => {
				callCount++;
				return Promise.resolve({ data: `fetched-${callCount}` });
			});
			const { useStache } = createStache({
				id: 'initial-data-refetch-on-stale',
				fetch: fetchFn,
				staleTime: 100,
				globalCache
			});

			const params = $state('param1');
			const stache = useStache(() => ({
				params,
				initialData: { data: 'initial' },
				initialDataFetchedAt: new Date(),
				initialDataRefetchOnStale: true
			}));

			flushSync();

			expect(stache.data).toEqual({ data: 'initial' });
			expect(stache.cacheStatus).toBe('fresh');
			expect(fetchFn).not.toHaveBeenCalled();

			vi.advanceTimersToNextTimer();

			await vi.waitUntil(() => fetchFn.mock.calls.length > 0);
			expect(fetchFn).toHaveBeenCalledTimes(1);
			await vi.waitUntil(() => stache.data?.data === 'fetched-1');
		})
	);

	it(
		'should NOT automatically refetch when initialData goes stale if initialDataRefetchOnStale is false',
		withEffectRoot(async () => {
			const globalCache = new StacheCache();
			const fetchFn = vi.fn().mockResolvedValue({ data: 'fetched' });
			const { useStache } = createStache({
				id: 'initial-data-no-refetch-on-stale',
				fetch: fetchFn,
				staleTime: 100,
				globalCache
			});

			const params = $state('param1');
			const stache = useStache(() => ({
				params,
				initialData: { data: 'initial' },
				initialDataFetchedAt: new Date(),
				initialDataRefetchOnStale: false
			}));

			flushSync();

			expect(stache.data).toEqual({ data: 'initial' });
			expect(stache.cacheStatus).toBe('fresh');

			vi.advanceTimersToNextTimer();

			await vi.waitUntil(() => stache.cacheStatus === 'stale');
			vi.advanceTimersToNextTimer();

			expect(fetchFn).not.toHaveBeenCalled();
			expect(stache.data).toEqual({ data: 'initial' });
		})
	);

	it('should ignore initialData when cache already has an entry', async () => {
		const globalCache = new StacheCache();
		const fetchFn = vi.fn().mockResolvedValue({ data: 'fetched' });
		const { useStache } = createStache({
			id: 'initial-data-cache-wins',
			fetch: fetchFn,
			globalCache
		});

		// First mount — populates cache via fetch, then unmounts
		await withEffectRoot(async () => {
			const params = $state('param1');
			const stache = useStache(() => ({ params }));
			flushSync();
			await vi.waitUntil(() => stache.data !== null);
			expect(stache.data).toEqual({ data: 'fetched' });
		})();

		// Second mount — cache entry already populated, initialData should be ignored
		await withEffectRoot(async () => {
			const params = $state('param1');
			const stache = useStache(() => ({
				params,
				initialData: { data: 'should-be-ignored' }
			}));
			flushSync();
			// Data comes from the cache, not initialData
			expect(stache.data).toEqual({ data: 'fetched' });
		})();
	});

	it(
		'should type data as FetchReturnData | InitialData | null when initialData is a different type',
		withEffectRoot(async () => {
			const globalCache = new StacheCache();
			const { useStache } = createStache({
				id: 'initial-data-type-test',
				fetch: () => Promise.resolve({ fetched: true }),
				globalCache
			});

			const params = $state('param1');
			const stache = useStache(() => ({
				params,
				initialData: { initial: true } // different shape to fetch return type
			}));

			// Before flushing effects: initialData is applied synchronously at construction
			expect(stache.data).toEqual({ initial: true });

			// Compile-time assertion: data must be the union type, not just FetchReturnData | null
			expectTypeOf(stache.data).toEqualTypeOf<{ fetched: boolean } | { initial: boolean } | null>();
		})
	);
});

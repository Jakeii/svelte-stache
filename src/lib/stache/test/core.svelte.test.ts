import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { flushSync } from 'svelte';
import { createStache } from '../stache.svelte';
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

	describe('createStache function', () => {
		it(
			'should return a function that creates Stache instances',
			withEffectRoot(async () => {
				const globalCache = new StacheCache();
				const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
				const { useStache } = createStache({
					id: 'test-stache',
					fetch: fetchFn,
					globalCache
				});

				const params: number | string = $state(1);

				const stache = await useStache(() => ({ params }));

				expect(stache).toBeDefined();

				flushSync();

				await vi.waitUntil(() => stache.data !== null);

				flushSync();

				expect(fetchFn).toHaveBeenCalledWith(1);
				expect(stache.data).toEqual({ data: 'test' });
				expect(stache.isError).toBe(false);
				expect(stache.isLoading).toBe(false);
				expect(stache.isSuccess).toBe(true);
				expect(globalCache.getStache('test-stache', hashKey(1))?.referenceCount).toBe(1);
			})
		);

		it(
			'should have the correct initial state',
			withEffectRoot(async () => {
				const globalCache = new StacheCache();
				let resolveStache: (value: unknown) => void;
				const stachePromise = new Promise((resolve) => {
					resolveStache = resolve;
				});

				const fetchFn = vi.fn().mockReturnValue(stachePromise);
				const { useStache } = createStache({
					id: 'initial-state-test',
					fetch: fetchFn,
					globalCache
				});

				const params = $state('param');
				let enabled = $state(false);
				const stache = await useStache(() => ({ params, enabled }));

				expect(stache.data).toBe(null);
				expect(stache.error).toBe(null);
				expect(stache.isError).toBe(false);
				expect(stache.isLoading).toBe(false);
				expect(stache.isLoading).toBe(false);
				expect(stache.isSuccess).toBe(false);
				expect(stache.lastFetched).toBe(null);
				expect(globalCache.getStache('initial-state-test', hashKey('param'))?.referenceCount).toBe(
					1
				);

				flushSync();

				// Enable the stache
				enabled = true;

				flushSync();

				expect(stache.isLoading).toBe(true);
				expect(stache.isLoading).toBe(true);
				expect(globalCache.getStache('initial-state-test', hashKey('param'))?.referenceCount).toBe(
					1
				);

				// Resolve the stache
				resolveStache!({ data: 'initial' });

				await vi.waitUntil(() => stache.data !== null);

				expect(stache.data).toEqual({ data: 'initial' });
				expect(stache.isError).toBe(false);
				expect(stache.isLoading).toBe(false);
				expect(stache.isSuccess).toBe(true);
				expect(globalCache.getStache('initial-state-test', hashKey('param'))?.referenceCount).toBe(
					1
				);
			})
		);

		it(
			'should handle parameter changes',
			withEffectRoot(async () => {
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
				const stache = await useStache(() => ({ params }));

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
				const queryCache = new StacheCache();
				const fetchFn = vi.fn().mockResolvedValue({ data: 'test' });
				const { useStache } = createStache({
					id: 'shared-stache',
					fetch: fetchFn,
					globalCache: queryCache
				});

				// Simulate three components mounting — all useStache calls must happen
				// synchronously within the $effect.root to avoid effect_orphan errors.
				// Awaiting a thenable suspends into a microtask, which exits the root context.
				const params1 = $state({ id: 1 });
				const stache1 = useStache(() => ({ params: params1 }));

				const params2 = $state({ id: 1 });
				useStache(() => ({ params: params2 }));

				const params3 = $state({ id: 1 });
				useStache(() => ({ params: params3 }));

				flushSync();

				// Await the fetch resolution after all staches are created
				await stache1;

				expect(stache1).toBeDefined();

				expect(Array.from(queryCache.getStacheGroup('shared-stache') ?? [])).toHaveLength(1);

				flushSync();

				// Stache function should only be called once even when triggered from shared instance
				expect(fetchFn).toHaveBeenCalledTimes(1);
				expect(fetchFn).toHaveBeenCalledWith({ id: 1 });
			})
		);

		it(
			'should share data state across all components sharing the cache',
			withEffectRoot(async () => {
				let resolveStache: (value: unknown) => void;
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
				const stache1Promise = useStache(() => ({ params: params1 }));

				const params2 = $state('test');
				const stache2Promise = useStache(() => ({ params: params2 }));

				const params3 = $state('test');
				const stache3Promise = useStache(() => ({ params: params3 }));

				flushSync();

				// Resolve the stache
				resolveStache!({ result: 'success' });

				// // Wait for promise resolution
				const [stache1, stache2, stache3] = await Promise.all([
					stache1Promise,
					stache2Promise,
					stache3Promise
				]);
				flushSync();

				// All instances should have the updated data
				await vi.waitUntil(() => stache1.data !== null);
				expect(stache1.isLoading).toBe(false);
				expect(stache1.data).toEqual({ result: 'success' });
				expect(stache2.data).toEqual({ result: 'success' });
				expect(stache3.data).toEqual({ result: 'success' });

				expect(stache1.data).toBe(stache2.data);
				expect(stache2.data).toBe(stache3.data);

				expect(fetchFn).toHaveBeenCalledTimes(1);
			})
		);
	});
});

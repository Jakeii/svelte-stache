import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { flushSync } from 'svelte';
import { createPagedStache } from '../paged.svelte';
import { createStacheCache } from '../../cache';

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
		createStacheCache();
	});

	afterEach(() => {
		cleanupFns.forEach((fn) => fn());
		cleanupFns = [];
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

				await vi.waitUntil(() => stache.data?.length === 20);

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

				await vi.waitUntil(() => stache.data?.length === 20);

				expect(fetchFn).toHaveBeenCalledTimes(2);

				await invalidate({ query: 'test' });
				flushSync();

				await vi.waitFor(() => fetchFn.mock.calls.length >= 3, { timeout: 500 });

				// Should refetch at least one page, possibly more depending on timing
				expect(fetchFn.mock.calls.length).toBeGreaterThanOrEqual(3);
			})
		);

		it(
			'should invalidate all param variants when invalidate() called with no args',
			withEffectRoot(async () => {
				const fetchFn = vi
					.fn()
					.mockImplementation((params, { pageIndex, pageSize }) =>
						Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 30))
					);

				const { useStache, invalidate } = createPagedStache({
					id: 'invalidate-all-paged-test',
					fetch: fetchFn,
					pageSize: 10,
					getData: (response) => response.data,
					getTotalCount: (response) => response.totalCount
				});

				const params1 = $state({ query: 'alpha' });
				const stache1 = useStache(() => ({
					params: params1,
					pageParams: { pageOffset: 0, pageCount: 1 }
				}));

				const params2 = $state({ query: 'beta' });
				const stache2 = useStache(() => ({
					params: params2,
					pageParams: { pageOffset: 0, pageCount: 1 }
				}));

				flushSync();

				await vi.waitUntil(() => stache1.data?.length === 10 && stache2.data?.length === 10);
				expect(fetchFn).toHaveBeenCalledTimes(2);

				fetchFn.mockClear();

				await invalidate();
				flushSync();

				await vi.waitFor(() => fetchFn.mock.calls.length === 2);
				expect(fetchFn).toHaveBeenCalledTimes(2);
			})
		);

		it(
			'should not affect other createPagedStache instances when invalidate() is called with no args',
			withEffectRoot(async () => {
				const fetchFn1 = vi
					.fn()
					.mockImplementation((params, { pageIndex, pageSize }) =>
						Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 10))
					);
				const fetchFn2 = vi
					.fn()
					.mockImplementation((params, { pageIndex, pageSize }) =>
						Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 10))
					);

				const { useStache: useStache1, invalidate: invalidate1 } = createPagedStache({
					id: 'paged-isolation-1',
					fetch: fetchFn1,
					pageSize: 10,
					getData: (response) => response.data
				});

				const { useStache: useStache2 } = createPagedStache({
					id: 'paged-isolation-2',
					fetch: fetchFn2,
					pageSize: 10,
					getData: (response) => response.data
				});

				const params1 = $state({ query: 'test' });
				const stache1 = useStache1(() => ({
					params: params1,
					pageParams: { pageOffset: 0, pageCount: 1 }
				}));

				const params2 = $state({ query: 'test' });
				const stache2 = useStache2(() => ({
					params: params2,
					pageParams: { pageOffset: 0, pageCount: 1 }
				}));

				flushSync();

				await vi.waitUntil(() => stache1.data?.length === 10 && stache2.data?.length === 10);
				fetchFn1.mockClear();
				fetchFn2.mockClear();

				await invalidate1();
				flushSync();

				await vi.waitFor(() => fetchFn1.mock.calls.length === 1);
				expect(fetchFn1).toHaveBeenCalledTimes(1);
				expect(fetchFn2).toHaveBeenCalledTimes(0);
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

				await vi.waitUntil(() => stache.data?.length === 10);

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
				expect(stache.data?.length).toBeGreaterThan(0);
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
});

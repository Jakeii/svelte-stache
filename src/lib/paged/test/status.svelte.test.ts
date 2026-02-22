import { describe, it, expect, vi, afterEach } from 'vitest';
import { flushSync } from 'svelte';
import { createPagedStache } from '../paged.svelte';

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

	afterEach(() => {
		cleanupFns.forEach((fn) => fn());
		cleanupFns = [];
	});

	describe('Aggregated status properties across pages', () => {
		it(
			'should set isLoading to true if ANY page is fetching',
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

				await vi.waitUntil(() => stache.isLoading);

				expect(stache.isLoading).toBe(true);

				// Resolve first page
				resolvePage0!(createMockPagedResponse(0, 10, 100));
				await vi.waitFor(() => !stache.isLoading || fetchFn.mock.calls.length === 2);

				// Should still be fetching because page 1 is not resolved
				if (fetchFn.mock.calls.length === 2) {
					expect(stache.isLoading).toBe(true);
				}

				// Resolve second page
				resolvePage1!(createMockPagedResponse(1, 10, 100));
				await vi.waitUntil(() => !stache.isLoading);

				expect(stache.isLoading).toBe(false);
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
				// @ts-expect-error - error type is unknown due to aggregation
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

				await vi.waitUntil(() => stache.data?.length === 20);

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

				await vi.waitUntil(() => stache.data?.length === 20);

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

				await vi.waitUntil(() => stache.data?.length || 0 > 0);

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

				await vi.waitUntil(() => stache.data?.length === 20);

				expect(stache.hasMore).toBe(true);
				expect(stache.data?.length).toBe(20);
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

				await vi.waitUntil(() => stache.data?.length === 25);

				expect(stache.hasMore).toBe(false);
				expect(stache.data?.length).toBe(25);
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
});

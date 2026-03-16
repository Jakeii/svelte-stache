import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('createPagedStache callbacks', () => {
	beforeEach(() => {
		createStacheCache();
	});
	describe('onSuccess', () => {
		it(
			'should call onSuccess for each page that successfully fetches',
			withEffectRoot(async () => {
				const onSuccess = vi.fn();
				const fetchFn = vi
					.fn()
					.mockImplementation((params, { pageIndex, pageSize }) =>
						Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100))
					);

				const { useStache } = createPagedStache({
					id: 'on-success-test',
					fetch: fetchFn,
					pageSize: 10,
					getData: (response) => response.data,
					getTotalCount: (response) => response.totalCount,
					onSuccess
				});

				const params = $state({ query: 'test' });
				const stache = useStache(() => ({
					params,
					pageParams: { pageOffset: 0, pageCount: 2 }
				}));

				flushSync();

				await vi.waitUntil(() => stache.isSuccess);

				expect(onSuccess).toHaveBeenCalledTimes(2);
				expect(onSuccess).toHaveBeenCalledWith({
					params: { query: 'test' },
					result: createMockPagedResponse(0, 10, 100)
				});
				expect(onSuccess).toHaveBeenCalledWith({
					params: { query: 'test' },
					result: createMockPagedResponse(1, 10, 100)
				});
			})
		);

		it(
			'should call onSuccess with correct params and result',
			withEffectRoot(async () => {
				const onSuccess = vi.fn();
				const fetchFn = vi
					.fn()
					.mockImplementation((params, { pageIndex, pageSize }) =>
						Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 50))
					);

				const { useStache } = createPagedStache({
					id: 'on-success-params-test',
					fetch: fetchFn,
					pageSize: 10,
					getData: (response) => response.data,
					getTotalCount: (response) => response.totalCount,
					onSuccess
				});

				const params = $state({ userId: 42 });
				const stache = useStache(() => ({
					params,
					pageParams: { pageOffset: 0, pageCount: 1 }
				}));

				flushSync();

				await vi.waitUntil(() => stache.isSuccess);

				expect(onSuccess).toHaveBeenCalledTimes(1);
				const call = onSuccess.mock.calls[0][0];
				expect(call.params).toEqual({ userId: 42 });
				expect(call.result.data).toHaveLength(10);
				expect(call.result.totalCount).toBe(50);
			})
		);
	});

	describe('onError', () => {
		it(
			'should call onError when a page fetch fails',
			withEffectRoot(async () => {
				const onError = vi.fn();
				const error = new Error('Network error');
				const fetchFn = vi.fn().mockRejectedValue(error);

				const { useStache } = createPagedStache({
					id: 'on-error-test',
					fetch: fetchFn,
					pageSize: 10,
					getData: (response) => response.data,
					getTotalCount: (response) => response.totalCount,
					onError
				});

				const params = $state({ query: 'test' });
				const stache = useStache(() => ({
					params,
					pageParams: { pageOffset: 0, pageCount: 1 }
				}));

				flushSync();

				await vi.waitUntil(() => stache.isError);

				expect(onError).toHaveBeenCalledTimes(1);
				expect(onError).toHaveBeenCalledWith(error);
			})
		);

		it(
			'should call onError for each page that fails',
			withEffectRoot(async () => {
				const onError = vi.fn();
				const error = new Error('Network error');
				const fetchFn = vi.fn().mockRejectedValue(error);

				const { useStache } = createPagedStache({
					id: 'on-error-multi-test',
					fetch: fetchFn,
					pageSize: 10,
					getData: (response) => response.data,
					getTotalCount: (response) => response.totalCount,
					onError
				});

				const params = $state({ query: 'test' });
				const stache = useStache(() => ({
					params,
					pageParams: { pageOffset: 0, pageCount: 3 }
				}));

				flushSync();

				await vi.waitUntil(() => stache.isError);

				expect(onError).toHaveBeenCalledTimes(3);
			})
		);

		it(
			'should call onError only for failed pages when some succeed',
			withEffectRoot(async () => {
				const onSuccess = vi.fn();
				const onError = vi.fn();
				const error = new Error('Page 1 failed');

				const fetchFn = vi.fn().mockImplementation((_params, { pageIndex, pageSize }) => {
					if (pageIndex === 1) {
						return Promise.reject(error);
					}
					return Promise.resolve(createMockPagedResponse(pageIndex, pageSize, 100));
				});

				const { useStache } = createPagedStache({
					id: 'on-error-partial-test',
					fetch: fetchFn,
					pageSize: 10,
					getData: (response) => response.data,
					getTotalCount: (response) => response.totalCount,
					onSuccess,
					onError
				});

				const params = $state({ query: 'test' });
				const stache = useStache(() => ({
					params,
					pageParams: { pageOffset: 0, pageCount: 3 }
				}));

				flushSync();

				await vi.waitUntil(() => stache.isError);

				expect(onError).toHaveBeenCalledTimes(1);
				expect(onError).toHaveBeenCalledWith(error);
				expect(onSuccess).toHaveBeenCalledTimes(2);
			})
		);
	});
});

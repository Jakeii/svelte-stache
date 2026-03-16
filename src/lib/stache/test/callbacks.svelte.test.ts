import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushSync } from 'svelte';
import { createStache } from '../stache.svelte';
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

describe('createStache callbacks', () => {
	beforeEach(() => {
		createStacheCache();
	});
	describe('onSuccess', () => {
		it(
			'should call onSuccess after a successful fetch',
			withEffectRoot(async () => {
				const onSuccess = vi.fn();
				const fetchFn = vi.fn().mockResolvedValue({ name: 'test' });

				const { useStache } = createStache({
					id: 'on-success-test',
					fetch: fetchFn,
					onSuccess
				});

				const params = $state('param1');
				const stache = useStache(() => ({ params }));

				flushSync();

				await vi.waitUntil(() => stache.isSuccess);

				expect(onSuccess).toHaveBeenCalledTimes(1);
				expect(onSuccess).toHaveBeenCalledWith({
					params: 'param1',
					result: { name: 'test' }
				});
			})
		);

		it(
			'should call onSuccess again on invalidation',
			withEffectRoot(async () => {
				const onSuccess = vi.fn();
				const fetchFn = vi.fn().mockResolvedValue('data');

				const { useStache } = createStache({
					id: 'on-success-invalidate-test',
					fetch: fetchFn,
					onSuccess
				});

				const params = $state('p');
				const stache = useStache(() => ({ params }));

				flushSync();

				await vi.waitUntil(() => stache.isSuccess);
				expect(onSuccess).toHaveBeenCalledTimes(1);

				stache.invalidate();
				flushSync();

				await vi.waitUntil(() => onSuccess.mock.calls.length === 2);

				expect(onSuccess).toHaveBeenCalledTimes(2);
			})
		);

		it(
			'should not call onSuccess when fetch fails',
			withEffectRoot(async () => {
				const onSuccess = vi.fn();
				const fetchFn = vi.fn().mockRejectedValue(new Error('fail'));

				const { useStache } = createStache({
					id: 'on-success-no-call-on-error-test',
					fetch: fetchFn,
					onSuccess
				});

				const params = $state('p');
				const stache = useStache(() => ({ params }));

				flushSync();

				await vi.waitUntil(() => stache.isError);

				expect(onSuccess).not.toHaveBeenCalled();
			})
		);
	});

	describe('onError', () => {
		it(
			'should call onError when fetch fails',
			withEffectRoot(async () => {
				const onError = vi.fn();
				const error = new Error('Network error');
				const fetchFn = vi.fn().mockRejectedValue(error);

				const { useStache } = createStache({
					id: 'on-error-test',
					fetch: fetchFn,
					onError
				});

				const params = $state('p');
				const stache = useStache(() => ({ params }));

				flushSync();

				await vi.waitUntil(() => stache.isError);

				expect(onError).toHaveBeenCalledTimes(1);
				expect(onError).toHaveBeenCalledWith(error);
			})
		);

		it(
			'should not call onError when fetch succeeds',
			withEffectRoot(async () => {
				const onError = vi.fn();
				const fetchFn = vi.fn().mockResolvedValue('data');

				const { useStache } = createStache({
					id: 'on-error-no-call-on-success-test',
					fetch: fetchFn,
					onError
				});

				const params = $state('p');
				const stache = useStache(() => ({ params }));

				flushSync();

				await vi.waitUntil(() => stache.isSuccess);

				expect(onError).not.toHaveBeenCalled();
			})
		);

		it(
			'should call onError with non-Error objects',
			withEffectRoot(async () => {
				const onError = vi.fn();
				const errorObj = { code: 'NOT_FOUND', status: 404 };
				const fetchFn = vi.fn().mockRejectedValue(errorObj);

				const { useStache } = createStache({
					id: 'on-error-custom-object-test',
					fetch: fetchFn,
					onError
				});

				const params = $state('p');
				const stache = useStache(() => ({ params }));

				flushSync();

				await vi.waitUntil(() => stache.isError);

				expect(onError).toHaveBeenCalledWith(errorObj);
			})
		);
	});
});

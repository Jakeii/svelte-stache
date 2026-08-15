import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync } from 'svelte';
import { createMutation } from './mutation.svelte';

const withEffectRoot = (fn: () => void | Promise<void>) => {
	return async () => {
		let promise: void | Promise<void> = Promise.resolve();
		const cleanup = $effect.root(() => {
			promise = fn();
		});
		await promise;
		cleanup();
	};
};

describe('createMutation', () => {
	describe('createMutation function', () => {
		it(
			'should return a function that creates Mutation instances',
			withEffectRoot(async () => {
				const mutationFn = vi.fn().mockResolvedValue({ success: true });
				const useMutation = createMutation({
					mutationFn
				});

				const mutation = useMutation();

				expect(mutation).toBeDefined();
				expect(mutation.status).toBe('idle');
				expect(mutation.isLoading).toBe(false);
				expect(mutation.isError).toBe(false);
				expect(mutation.isSuccess).toBe(false);
				expect(mutation.data).toBe(null);
				expect(mutation.error).toBe(null);
			})
		);

		it(
			'should have the correct initial state',
			withEffectRoot(async () => {
				const mutationFn = vi.fn().mockResolvedValue({ data: 'result' });
				const useMutation = createMutation({
					mutationFn
				});

				const mutation = useMutation();

				expect(mutation.status).toBe('idle');
				expect(mutation.data).toBe(null);
				expect(mutation.error).toBe(null);
				expect(mutation.isError).toBe(false);
				expect(mutation.isLoading).toBe(false);
				expect(mutation.isSuccess).toBe(false);
			})
		);

		it(
			'should execute mutation and update state correctly',
			withEffectRoot(async () => {
				const mutationFn = vi.fn().mockResolvedValue({ data: 'success' });
				const useMutation = createMutation({
					mutationFn
				});

				const mutation = useMutation();

				const result = mutation.mutate({ id: 1 });
				flushSync();

				expect(mutation.isLoading).toBe(true);
				expect(mutation.status).toBe('loading');

				await result;
				flushSync();

				expect(mutationFn).toHaveBeenCalledWith({ id: 1 });
				expect(mutation.data).toEqual({ data: 'success' });
				expect(mutation.isSuccess).toBe(true);
				expect(mutation.status).toBe('success');
				expect(mutation.isLoading).toBe(false);
			})
		);
	});

	describe('Mutation execution', () => {
		it(
			'should handle successful mutations',
			withEffectRoot(async () => {
				const mutationFn = vi.fn().mockResolvedValue({ id: 123, name: 'Test' });
				const useMutation = createMutation({
					mutationFn
				});

				const mutation = useMutation();
				const result = await mutation.mutate({ name: 'Test' });

				expect(result).toEqual({ id: 123, name: 'Test' });
				expect(mutation.data).toEqual({ id: 123, name: 'Test' });
				expect(mutation.isSuccess).toBe(true);
				expect(mutation.error).toBe(null);
			})
		);

		it(
			'should handle failed mutations',
			withEffectRoot(async () => {
				const error = new Error('Mutation failed');
				const mutationFn = vi.fn().mockRejectedValue(error);
				const useMutation = createMutation({
					mutationFn
				});

				const mutation = useMutation();
				const result = await mutation.mutate({ id: 1 });

				expect(result).toBe(null);
				expect(mutation.isError).toBe(true);
				expect(mutation.error).toBe(error);
				expect(mutation.data).toBe(null);
			})
		);

		it(
			'should clear error state on new mutation',
			withEffectRoot(async () => {
				let shouldFail = true;
				const mutationFn = vi.fn().mockImplementation(() => {
					if (shouldFail) {
						return Promise.reject(new Error('First error'));
					}
					return Promise.resolve({ success: true });
				});

				const useMutation = createMutation({
					mutationFn
				});

				const mutation = useMutation();

				// First mutation fails
				await mutation.mutate({ id: 1 });
				expect(mutation.isError).toBe(true);
				expect(mutation.error).toBeInstanceOf(Error);

				// Second mutation succeeds
				shouldFail = false;
				mutation.mutate({ id: 2 });
				flushSync();

				expect(mutation.error).toBe(null);
				expect(mutation.isLoading).toBe(true);

				await vi.waitUntil(() => mutation.isSuccess);
				expect(mutation.data).toEqual({ success: true });
			})
		);

		it(
			'should handle synchronous mutation functions',
			withEffectRoot(async () => {
				const mutationFn = vi.fn().mockReturnValue({ data: 'sync-result' });
				const useMutation = createMutation({
					mutationFn
				});

				const mutation = useMutation();
				const result = await mutation.mutate({ id: 1 });

				expect(result).toEqual({ data: 'sync-result' });
				expect(mutation.data).toEqual({ data: 'sync-result' });
				expect(mutation.isSuccess).toBe(true);
			})
		);
	});

	describe('beforeMutate hook', () => {
		it(
			'should call beforeMutate before executing mutation',
			withEffectRoot(async () => {
				const beforeMutate = vi.fn();
				const mutationFn = vi.fn().mockResolvedValue({ success: true });

				const useMutation = createMutation({
					mutationFn,
					beforeMutate
				});

				const mutation = useMutation();
				await mutation.mutate({ id: 1 });

				expect(beforeMutate).toHaveBeenCalledWith({ id: 1 });
				expect(beforeMutate).toHaveBeenCalledBefore(mutationFn);
			})
		);

		it(
			'should support multiple beforeMutate hooks',
			withEffectRoot(async () => {
				const definedBeforeMutate = vi.fn();
				const usedBeforeMutate = vi.fn();
				const mutationFn = vi.fn().mockResolvedValue({ success: true });

				const useMutation = createMutation({
					mutationFn,
					beforeMutate: definedBeforeMutate
				});

				const mutation = useMutation({ beforeMutate: usedBeforeMutate });
				await mutation.mutate({ id: 1 });

				expect(definedBeforeMutate).toHaveBeenCalledWith({ id: 1 });
				expect(usedBeforeMutate).toHaveBeenCalledWith({ id: 1 });
			})
		);

		it(
			'should handle async beforeMutate',
			withEffectRoot(async () => {
				const beforeMutate = vi.fn().mockResolvedValue(undefined);
				const mutationFn = vi.fn().mockResolvedValue({ success: true });

				const useMutation = createMutation({
					mutationFn,
					beforeMutate
				});

				const mutation = useMutation();
				await mutation.mutate({ id: 1 });

				expect(beforeMutate).toHaveBeenCalled();
				expect(mutationFn).toHaveBeenCalled();
			})
		);
	});

	describe('afterMutate hook', () => {
		it(
			'should call afterMutate after mutation completes',
			withEffectRoot(async () => {
				const afterMutate = vi.fn();
				const mutationFn = vi.fn().mockResolvedValue({ success: true });

				const useMutation = createMutation({
					mutationFn,
					afterMutate
				});

				const mutation = useMutation();
				await mutation.mutate({ id: 1 });

				expect(afterMutate).toHaveBeenCalledWith({ id: 1 });
			})
		);

		it(
			'should call afterMutate even if mutation fails',
			withEffectRoot(async () => {
				const afterMutate = vi.fn();
				const mutationFn = vi.fn().mockRejectedValue(new Error('Failed'));

				const useMutation = createMutation({
					mutationFn,
					afterMutate
				});

				const mutation = useMutation();
				await mutation.mutate({ id: 1 });

				expect(afterMutate).toHaveBeenCalledWith({ id: 1 });
				expect(mutation.isError).toBe(true);
			})
		);

		it(
			'should support multiple afterMutate hooks',
			withEffectRoot(async () => {
				const definedAfterMutate = vi.fn();
				const usedAfterMutate = vi.fn();
				const mutationFn = vi.fn().mockResolvedValue({ success: true });

				const useMutation = createMutation({
					mutationFn,
					afterMutate: definedAfterMutate
				});

				const mutation = useMutation({ afterMutate: usedAfterMutate });
				await mutation.mutate({ id: 1 });

				expect(definedAfterMutate).toHaveBeenCalledWith({ id: 1 });
				expect(usedAfterMutate).toHaveBeenCalledWith({ id: 1 });
			})
		);
	});

	describe('onSuccess callback', () => {
		it(
			'should call onSuccess with params and result on successful mutation',
			withEffectRoot(async () => {
				const onSuccess = vi.fn();
				const mutationFn = vi.fn().mockResolvedValue({ id: 123 });

				const useMutation = createMutation({
					mutationFn,
					onSuccess
				});

				const mutation = useMutation();
				await mutation.mutate({ name: 'Test' });

				expect(onSuccess).toHaveBeenCalledWith({
					params: { name: 'Test' },
					result: { id: 123 }
				});
			})
		);

		it(
			'should not call onSuccess on failed mutation',
			withEffectRoot(async () => {
				const onSuccess = vi.fn();
				const mutationFn = vi.fn().mockRejectedValue(new Error('Failed'));

				const useMutation = createMutation({
					mutationFn,
					onSuccess
				});

				const mutation = useMutation();
				await mutation.mutate({ id: 1 });

				expect(onSuccess).not.toHaveBeenCalled();
			})
		);

		it(
			'should support multiple onSuccess callbacks',
			withEffectRoot(async () => {
				const definedOnSuccess = vi.fn();
				const usedOnSuccess = vi.fn();
				const mutationFn = vi.fn().mockResolvedValue({ success: true });

				const useMutation = createMutation({
					mutationFn,
					onSuccess: definedOnSuccess
				});

				const mutation = useMutation({ onSuccess: usedOnSuccess });
				await mutation.mutate({ id: 1 });

				expect(definedOnSuccess).toHaveBeenCalledWith({
					params: { id: 1 },
					result: { success: true }
				});
				expect(usedOnSuccess).toHaveBeenCalledWith({
					params: { id: 1 },
					result: { success: true }
				});
			})
		);
	});

	describe('onError callback', () => {
		it(
			'should call onError with error on failed mutation',
			withEffectRoot(async () => {
				const onError = vi.fn();
				const error = new Error('Mutation failed');
				const mutationFn = vi.fn().mockRejectedValue(error);

				const useMutation = createMutation({
					mutationFn,
					onError
				});

				const mutation = useMutation();
				await mutation.mutate({ id: 1 });

				expect(onError).toHaveBeenCalledWith(error);
			})
		);

		it(
			'should not call onError on successful mutation',
			withEffectRoot(async () => {
				const onError = vi.fn();
				const mutationFn = vi.fn().mockResolvedValue({ success: true });

				const useMutation = createMutation({
					mutationFn,
					onError
				});

				const mutation = useMutation();
				await mutation.mutate({ id: 1 });

				expect(onError).not.toHaveBeenCalled();
			})
		);

		it(
			'should support multiple onError callbacks',
			withEffectRoot(async () => {
				const definedOnError = vi.fn();
				const usedOnError = vi.fn();
				const error = new Error('Failed');
				const mutationFn = vi.fn().mockRejectedValue(error);

				const useMutation = createMutation({
					mutationFn,
					onError: definedOnError
				});

				const mutation = useMutation({ onError: usedOnError });
				await mutation.mutate({ id: 1 });

				expect(definedOnError).toHaveBeenCalledWith(error);
				expect(usedOnError).toHaveBeenCalledWith(error);
			})
		);

		it(
			'should handle different error types correctly',
			withEffectRoot(async () => {
				const onError = vi.fn();
				const customError = { code: 'CUSTOM_ERROR', message: 'Custom error' };
				const mutationFn = vi.fn().mockRejectedValue(customError);

				const useMutation = createMutation({
					mutationFn,
					onError
				});

				const mutation = useMutation();
				await mutation.mutate({ id: 1 });

				expect(onError).toHaveBeenCalledWith(customError);
				expect(mutation.error).toEqual(customError);
			})
		);

		it(
			'should handle string errors',
			withEffectRoot(async () => {
				const onError = vi.fn();
				const stringError = 'String error message';
				const mutationFn = vi.fn().mockRejectedValue(stringError);

				const useMutation = createMutation({
					mutationFn,
					onError
				});

				const mutation = useMutation();
				await mutation.mutate({ id: 1 });

				expect(onError).toHaveBeenCalledWith(stringError);
				expect(mutation.error).toBe(stringError);
			})
		);
	});

	describe('Hook execution order', () => {
		it(
			'should execute hooks in correct order on success',
			withEffectRoot(async () => {
				const executionOrder: string[] = [];

				const beforeMutate = vi.fn(() => executionOrder.push('beforeMutate'));
				const mutationFn = vi.fn(() => {
					executionOrder.push('mutationFn');
					return Promise.resolve({ success: true });
				});
				const onSuccess = vi.fn(() => executionOrder.push('onSuccess'));
				const afterMutate = vi.fn(() => executionOrder.push('afterMutate'));

				const useMutation = createMutation({
					mutationFn,
					beforeMutate,
					afterMutate,
					onSuccess
				});

				const mutation = useMutation();
				await mutation.mutate({ id: 1 });

				expect(executionOrder).toEqual(['beforeMutate', 'mutationFn', 'onSuccess', 'afterMutate']);
			})
		);

		it(
			'should execute hooks in correct order on failure',
			withEffectRoot(async () => {
				const executionOrder: string[] = [];

				const beforeMutate = vi.fn(() => executionOrder.push('beforeMutate'));
				const mutationFn = vi.fn(() => {
					executionOrder.push('mutationFn');
					return Promise.reject(new Error('Failed'));
				});
				const onError = vi.fn(() => executionOrder.push('onError'));
				const afterMutate = vi.fn(() => executionOrder.push('afterMutate'));

				const useMutation = createMutation({
					mutationFn,
					beforeMutate,
					afterMutate,
					onError
				});

				const mutation = useMutation();
				await mutation.mutate({ id: 1 });

				expect(executionOrder).toEqual(['beforeMutate', 'mutationFn', 'onError', 'afterMutate']);
			})
		);
	});

	describe('Multiple mutation instances', () => {
		it(
			'should allow multiple independent mutation instances',
			withEffectRoot(async () => {
				const mutationFn = vi.fn().mockResolvedValue({ success: true });
				const useMutation = createMutation({
					mutationFn
				});

				const mutation1 = useMutation();
				const mutation2 = useMutation();

				expect(mutation1).not.toBe(mutation2);

				await mutation1.mutate({ id: 1 });
				expect(mutation1.isSuccess).toBe(true);
				expect(mutation2.isSuccess).toBe(false);

				await mutation2.mutate({ id: 2 });
				expect(mutation2.isSuccess).toBe(true);
			})
		);

		it(
			'should maintain separate state for multiple instances',
			withEffectRoot(async () => {
				let shouldFail = false;
				const mutationFn = vi.fn().mockImplementation(() => {
					if (shouldFail) {
						return Promise.reject(new Error('Failed'));
					}
					return Promise.resolve({ success: true });
				});

				const useMutation = createMutation({
					mutationFn
				});

				const mutation1 = useMutation();
				const mutation2 = useMutation();

				await mutation1.mutate({ id: 1 });
				expect(mutation1.isSuccess).toBe(true);

				shouldFail = true;
				await mutation2.mutate({ id: 2 });
				expect(mutation2.isError).toBe(true);

				// mutation1 should still be in success state
				expect(mutation1.isSuccess).toBe(true);
				expect(mutation1.isError).toBe(false);
			})
		);
	});

	describe('Complex parameter types', () => {
		it(
			'should handle array parameters',
			withEffectRoot(async () => {
				const mutationFn = vi.fn().mockResolvedValue({ count: 3 });
				const useMutation = createMutation<number[], { count: number }>({
					mutationFn
				});

				const mutation = useMutation();
				await mutation.mutate([1, 2, 3]);

				expect(mutationFn).toHaveBeenCalledWith([1, 2, 3]);
				expect(mutation.data).toEqual({ count: 3 });
			})
		);

		it(
			'should handle object parameters',
			withEffectRoot(async () => {
				const mutationFn = vi.fn().mockResolvedValue({ id: 123, updated: true });
				const useMutation = createMutation<
					{ id: number; name: string },
					{ id: number; updated: boolean }
				>({
					mutationFn
				});

				const mutation = useMutation();
				await mutation.mutate({ id: 123, name: 'Test' });

				expect(mutationFn).toHaveBeenCalledWith({ id: 123, name: 'Test' });
				expect(mutation.data).toEqual({ id: 123, updated: true });
			})
		);

		it(
			'should handle primitive parameters',
			withEffectRoot(async () => {
				const mutationFn = vi.fn().mockResolvedValue({ deleted: true });
				const useMutation = createMutation<number, { deleted: boolean }>({
					mutationFn
				});

				const mutation = useMutation();
				await mutation.mutate(42);

				expect(mutationFn).toHaveBeenCalledWith(42);
				expect(mutation.data).toEqual({ deleted: true });
			})
		);
	});

	describe('Edge cases', () => {
		it(
			'should handle rapid successive mutations',
			withEffectRoot(async () => {
				let callCount = 0;
				const mutationFn = vi.fn().mockImplementation(() => {
					callCount++;
					return Promise.resolve({ count: callCount });
				});

				const useMutation = createMutation({
					mutationFn
				});

				const mutation = useMutation();

				const results = await Promise.all([
					mutation.mutate({ id: 1 }),
					mutation.mutate({ id: 2 }),
					mutation.mutate({ id: 3 })
				]);

				expect(mutationFn).toHaveBeenCalledTimes(3);
				expect(results[2]).toEqual({ count: 3 });
				expect(mutation.data).toEqual({ count: 3 });
			})
		);

		it(
			'should handle mutations with no parameters',
			withEffectRoot(async () => {
				const mutationFn = vi.fn().mockResolvedValue({ success: true });
				const useMutation = createMutation<void, { success: boolean }>({
					mutationFn
				});

				const mutation = useMutation();
				await mutation.mutate(undefined);

				expect(mutationFn).toHaveBeenCalledWith(undefined);
				expect(mutation.data).toEqual({ success: true });
			})
		);

		it(
			'should handle mutations with null result',
			withEffectRoot(async () => {
				const mutationFn = vi.fn().mockResolvedValue(null);
				const useMutation = createMutation<{ id: number }, null>({
					mutationFn
				});

				const mutation = useMutation();
				const result = await mutation.mutate({ id: 1 });

				expect(result).toBe(null);
				expect(mutation.data).toBe(null);
				expect(mutation.isSuccess).toBe(true);
			})
		);

		it(
			'should preserve data from previous successful mutation when error occurs',
			withEffectRoot(async () => {
				let shouldFail = false;
				const mutationFn = vi.fn().mockImplementation(() => {
					if (shouldFail) {
						return Promise.reject(new Error('Failed'));
					}
					return Promise.resolve({ success: true });
				});

				const useMutation = createMutation({
					mutationFn
				});

				const mutation = useMutation();

				// First successful mutation
				await mutation.mutate({ id: 1 });
				expect(mutation.data).toEqual({ success: true });

				// Second mutation fails
				shouldFail = true;
				await mutation.mutate({ id: 2 });

				// Data is not preserved (it's set to null in mutation.class.svelte)
				// This is different from stache behavior where data is preserved
				expect(mutation.data).toEqual({ success: true });
				expect(mutation.isError).toBe(true);
			})
		);
	});

	describe('Callback flexibility', () => {
		it(
			'should allow overriding callbacks at use time',
			withEffectRoot(async () => {
				const defineOnSuccess = vi.fn();
				const useOnSuccess = vi.fn();
				const mutationFn = vi.fn().mockResolvedValue({ success: true });

				const useMutation = createMutation({
					mutationFn,
					onSuccess: defineOnSuccess
				});

				const mutation = useMutation({
					onSuccess: useOnSuccess
				});

				await mutation.mutate({ id: 1 });

				expect(defineOnSuccess).toHaveBeenCalled();
				expect(useOnSuccess).toHaveBeenCalled();
			})
		);

		it(
			'should allow adding callbacks at use time when none defined',
			withEffectRoot(async () => {
				const useOnSuccess = vi.fn();
				const mutationFn = vi.fn().mockResolvedValue({ success: true });

				const useMutation = createMutation({
					mutationFn
				});

				const mutation = useMutation({
					onSuccess: useOnSuccess
				});

				await mutation.mutate({ id: 1 });

				expect(useOnSuccess).toHaveBeenCalled();
			})
		);

		it(
			'should work with only define-time callbacks',
			withEffectRoot(async () => {
				const defineOnSuccess = vi.fn();
				const mutationFn = vi.fn().mockResolvedValue({ success: true });

				const useMutation = createMutation({
					mutationFn,
					onSuccess: defineOnSuccess
				});

				const mutation = useMutation();

				await mutation.mutate({ id: 1 });

				expect(defineOnSuccess).toHaveBeenCalled();
			})
		);
	});

	describe('retries', () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it(
			'should not retry by default (retries: 0)',
			withEffectRoot(async () => {
				const error = new Error('Mutation failed');
				const mutationFn = vi.fn().mockRejectedValue(error);

				const useMutation = createMutation({
					mutationFn
				});

				const mutation = useMutation();
				await mutation.mutate({ id: 1 });

				expect(mutationFn).toHaveBeenCalledTimes(1);
				expect(mutation.isError).toBe(true);
				expect(mutation.error).toBe(error);
			})
		);

		it(
			'should retry and succeed on the second attempt',
			withEffectRoot(async () => {
				const statusHistory: string[] = [];
				let callCount = 0;
				const mutationFn = vi.fn().mockImplementation(() => {
					callCount++;
					if (callCount === 1) {
						return Promise.reject(new Error('First attempt failed'));
					}
					return Promise.resolve({ success: true });
				});

				const useMutation = createMutation({
					mutationFn,
					retries: 3,
					retryDelay: 10
				});

				const mutation = useMutation();
				const resultPromise = mutation.mutate({ id: 1 });
				flushSync();
				statusHistory.push(mutation.status);

				await vi.waitUntil(() => mutation.status === 'retrying');
				statusHistory.push(mutation.status);

				await vi.advanceTimersByTimeAsync(10);
				const result = await resultPromise;
				flushSync();

				expect(mutationFn).toHaveBeenCalledTimes(2);
				expect(result).toEqual({ success: true });
				expect(mutation.status).toBe('success');
				expect(statusHistory).toEqual(['loading', 'retrying']);
			})
		);

		it(
			'should exhaust all retries and end in error',
			withEffectRoot(async () => {
				const error = new Error('Always fails');
				const mutationFn = vi.fn().mockRejectedValue(error);

				const useMutation = createMutation({
					mutationFn,
					retries: 2,
					retryDelay: 10
				});

				const mutation = useMutation();
				const resultPromise = mutation.mutate({ id: 1 });
				await vi.advanceTimersByTimeAsync(20);
				const result = await resultPromise;

				expect(mutationFn).toHaveBeenCalledTimes(3);
				expect(result).toBe(null);
				expect(mutation.status).toBe('error');
				expect(mutation.error).toBe(error);
			})
		);

		it(
			'should stop retrying early when shouldRetry returns false',
			withEffectRoot(async () => {
				const error = new Error('Not retryable');
				const mutationFn = vi.fn().mockRejectedValue(error);
				const shouldRetry = vi.fn().mockReturnValue(false);

				const useMutation = createMutation({
					mutationFn,
					retries: 3,
					retryDelay: 10,
					shouldRetry
				});

				const mutation = useMutation();
				await mutation.mutate({ id: 1 });

				expect(mutationFn).toHaveBeenCalledTimes(1);
				expect(shouldRetry).toHaveBeenCalledWith({ error, attempt: 0, params: { id: 1 } });
				expect(mutation.status).toBe('error');
			})
		);

		it(
			'should call shouldRetry with the 0-indexed attempt number of the failed attempt',
			withEffectRoot(async () => {
				const error = new Error('fails');
				const mutationFn = vi.fn().mockRejectedValue(error);
				const shouldRetry = vi.fn().mockReturnValue(true);

				const useMutation = createMutation({
					mutationFn,
					retries: 2,
					retryDelay: 10,
					shouldRetry
				});

				const mutation = useMutation();
				const resultPromise = mutation.mutate({ id: 1 });
				await vi.advanceTimersByTimeAsync(20);
				await resultPromise;

				expect(shouldRetry.mock.calls[0][0]).toEqual({ error, attempt: 0, params: { id: 1 } });
				expect(shouldRetry.mock.calls[1][0]).toEqual({ error, attempt: 1, params: { id: 1 } });
			})
		);

		it(
			'isRetrying should be true only while status is retrying',
			withEffectRoot(async () => {
				let callCount = 0;
				const mutationFn = vi.fn().mockImplementation(() => {
					callCount++;
					if (callCount === 1) {
						return Promise.reject(new Error('First attempt failed'));
					}
					return Promise.resolve({ success: true });
				});

				const useMutation = createMutation({
					mutationFn,
					retries: 3,
					retryDelay: 10
				});

				const mutation = useMutation();
				expect(mutation.isRetrying).toBe(false);

				const resultPromise = mutation.mutate({ id: 1 });
				flushSync();
				expect(mutation.isRetrying).toBe(false);

				await vi.waitUntil(() => mutation.isRetrying);
				expect(mutation.isRetrying).toBe(true);

				await vi.advanceTimersByTimeAsync(10);
				await resultPromise;
				flushSync();
				expect(mutation.isRetrying).toBe(false);
			})
		);

		it(
			'should set error to the failed attempt while retrying',
			withEffectRoot(async () => {
				const error = new Error('First attempt failed');
				let callCount = 0;
				const mutationFn = vi.fn().mockImplementation(() => {
					callCount++;
					if (callCount === 1) {
						return Promise.reject(error);
					}
					return Promise.resolve({ success: true });
				});

				const useMutation = createMutation({
					mutationFn,
					retries: 3,
					retryDelay: 10
				});

				const mutation = useMutation();
				const resultPromise = mutation.mutate({ id: 1 });

				await vi.waitUntil(() => mutation.status === 'retrying');
				expect(mutation.error).toBe(error);

				await vi.advanceTimersByTimeAsync(10);
				await resultPromise;
				flushSync();

				expect(mutation.status).toBe('success');
			})
		);

		it(
			'beforeMutate should be called exactly once across all attempts',
			withEffectRoot(async () => {
				const beforeMutate = vi.fn();
				const mutationFn = vi.fn().mockRejectedValue(new Error('fails'));

				const useMutation = createMutation({
					mutationFn,
					retries: 2,
					retryDelay: 10,
					beforeMutate
				});

				const mutation = useMutation();
				const resultPromise = mutation.mutate({ id: 1 });
				await vi.advanceTimersByTimeAsync(20);
				await resultPromise;

				expect(beforeMutate).toHaveBeenCalledTimes(1);
			})
		);

		it(
			'afterMutate should be called exactly once after all attempts complete',
			withEffectRoot(async () => {
				const afterMutate = vi.fn();
				const mutationFn = vi.fn().mockRejectedValue(new Error('fails'));

				const useMutation = createMutation({
					mutationFn,
					retries: 2,
					retryDelay: 10,
					afterMutate
				});

				const mutation = useMutation();
				const resultPromise = mutation.mutate({ id: 1 });
				await vi.advanceTimersByTimeAsync(20);
				await resultPromise;

				expect(afterMutate).toHaveBeenCalledTimes(1);
			})
		);
	});

	describe('retryDelay', () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it(
			'should default to a 300ms delay between attempts when retryDelay is not specified',
			withEffectRoot(async () => {
				let callCount = 0;
				const mutationFn = vi.fn().mockImplementation(() => {
					callCount++;
					if (callCount === 1) {
						return Promise.reject(new Error('First attempt failed'));
					}
					return Promise.resolve({ success: true });
				});

				const useMutation = createMutation({
					mutationFn,
					retries: 1
				});

				const mutation = useMutation();
				const resultPromise = mutation.mutate({ id: 1 });
				await vi.advanceTimersByTimeAsync(0);
				flushSync();
				expect(mutation.status).toBe('retrying');
				expect(mutationFn).toHaveBeenCalledTimes(1);

				await vi.advanceTimersByTimeAsync(299);
				expect(mutationFn).toHaveBeenCalledTimes(1);

				await vi.advanceTimersByTimeAsync(1);
				const result = await resultPromise;

				expect(mutationFn).toHaveBeenCalledTimes(2);
				expect(result).toEqual({ success: true });
			})
		);

		it(
			'should wait for a fixed numeric retryDelay before each retry',
			withEffectRoot(async () => {
				let callCount = 0;
				const mutationFn = vi.fn().mockImplementation(() => {
					callCount++;
					if (callCount === 1) {
						return Promise.reject(new Error('First attempt failed'));
					}
					return Promise.resolve({ success: true });
				});

				const useMutation = createMutation({
					mutationFn,
					retries: 1,
					retryDelay: 1000
				});

				const mutation = useMutation();
				const resultPromise = mutation.mutate({ id: 1 });
				await vi.advanceTimersByTimeAsync(0);
				flushSync();
				expect(mutation.status).toBe('retrying');
				expect(mutationFn).toHaveBeenCalledTimes(1);

				await vi.advanceTimersByTimeAsync(999);
				expect(mutationFn).toHaveBeenCalledTimes(1);

				await vi.advanceTimersByTimeAsync(1);
				const result = await resultPromise;

				expect(mutationFn).toHaveBeenCalledTimes(2);
				expect(result).toEqual({ success: true });
			})
		);

		it(
			'should call a RetryDelayFn with error, attempt, and params, and use its return value as the wait',
			withEffectRoot(async () => {
				const error = new Error('First attempt failed');
				let callCount = 0;
				const mutationFn = vi.fn().mockImplementation(() => {
					callCount++;
					if (callCount === 1) {
						return Promise.reject(error);
					}
					return Promise.resolve({ success: true });
				});
				const retryDelay = vi.fn().mockReturnValue(500);

				const useMutation = createMutation({
					mutationFn,
					retries: 1,
					retryDelay
				});

				const mutation = useMutation();
				const resultPromise = mutation.mutate({ id: 1 });
				await vi.advanceTimersByTimeAsync(0);
				flushSync();
				expect(retryDelay).toHaveBeenCalledTimes(1);
				expect(retryDelay).toHaveBeenCalledWith({ error, attempt: 0, params: { id: 1 } });

				await vi.advanceTimersByTimeAsync(500);
				await resultPromise;

				expect(mutationFn).toHaveBeenCalledTimes(2);
			})
		);

		it(
			'should not evaluate retryDelay on the final failed attempt',
			withEffectRoot(async () => {
				const mutationFn = vi.fn().mockRejectedValue(new Error('always fails'));
				const retryDelay = vi.fn().mockReturnValue(100);

				const useMutation = createMutation({
					mutationFn,
					retries: 1,
					retryDelay
				});

				const mutation = useMutation();
				const resultPromise = mutation.mutate({ id: 1 });
				await vi.advanceTimersByTimeAsync(0);
				flushSync();
				expect(retryDelay).toHaveBeenCalledTimes(1);

				await vi.advanceTimersByTimeAsync(100);
				await resultPromise;

				expect(mutationFn).toHaveBeenCalledTimes(2);
				expect(retryDelay).toHaveBeenCalledTimes(1);
				expect(mutation.status).toBe('error');
			})
		);
	});
});

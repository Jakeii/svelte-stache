import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { flushSync } from 'svelte';
import { createStache } from '../stache.svelte';
import { initializeGlobalStacheCache } from '../cache';

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
			const setContext = (): void => {
				context = new Map() as unknown as T; // Cast to Map type since we know that's what we're using, but keep it generic for the function signature
			};
			return [getContext, setContext] as const;
		}
	};
});

describe('createStache cache implementation', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		initializeGlobalStacheCache();
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Enhanced error handling', () => {
		it(
			'should handle regular errors by setting error state (sync)',
			withEffectRoot(async () => {
				const regularError = new Error('Network error');
				const fetchFn = vi.fn().mockRejectedValue(regularError);
				const { useStache } = createStache({
					id: 'regular-error-test',
					fetch: fetchFn
				});

				const params = $state('param');
				const stache = useStache(() => ({ params }));

				flushSync();

				// Wait for fetch to complete
				await vi.waitUntil(() => stache.isError);

				// Should be in error state
				expect(stache.fetchStatus).toBe('error');
				expect(stache.isError).toBe(true);
				expect(stache.error).toBe(regularError);
				expect(stache.data).toBe(null);
			})
		);

		it(
			'should handle regular errors by setting error state (async)',
			withEffectRoot(async () => {
				const regularError = new Error('Network error');
				const fetchFn = vi.fn().mockRejectedValue(regularError);
				const { useStache } = createStache({
					id: 'regular-error-test',
					fetch: fetchFn
				});

				const params = $state('param');
				const stache = useStache(() => ({ params }));
				try {
					await useStache(() => ({ params }));
				} catch (error) {
					// Should be in error state
					expect(stache.fetchStatus).toBe('error');
					expect(stache.isError).toBe(true);
					expect(stache.data).toBe(null);
					expect(error).toStrictEqual(regularError);
				}
			})
		);

		it(
			'should recover from error state on successful retry',
			withEffectRoot(async () => {
				let shouldFail = true;
				const fetchFn = vi.fn().mockImplementation(() => {
					if (shouldFail) {
						return Promise.reject(new Error('Network error'));
					}
					return Promise.resolve({ data: 'success' });
				});

				const { useStache } = createStache({
					id: 'error-recovery-test',
					fetch: fetchFn
				});

				const params = $state('param');
				const stache = useStache(() => ({ params }));

				flushSync();

				// Wait for initial error
				await vi.waitUntil(() => stache.isError);
				expect(stache.fetchStatus).toBe('error');
				expect(stache.error).toBeInstanceOf(Error);

				// Fix the error and retry
				shouldFail = false;
				stache.invalidate();
				flushSync();

				// Wait for recovery
				await vi.waitUntil(() => stache.isSuccess);

				// Should recover successfully
				expect(stache.fetchStatus).toBe('success');
				expect(stache.isError).toBe(false);
				expect(stache.error).toBe(null);
				expect(stache.data).toEqual({ data: 'success' });
			})
		);

		it(
			'should clear error state when starting new fetch',
			withEffectRoot(async () => {
				let callCount = 0;
				const fetchFn = vi.fn().mockImplementation(() => {
					callCount++;
					if (callCount === 1) {
						return Promise.reject(new Error('First error'));
					}
					return Promise.resolve({ data: 'success' });
				});

				const { useStache } = createStache({
					id: 'clear-error-test',
					fetch: fetchFn
				});

				const params = $state('param');
				const stache = useStache(() => ({ params }));

				flushSync();

				// Wait for initial error
				await vi.waitUntil(() => stache.isError);
				expect(stache.error).toBeInstanceOf(Error);

				// Trigger retry
				stache.invalidate();
				flushSync();

				// Error should be cleared when new fetch starts
				expect(stache.error).toBe(null);
				expect(stache.isLoading).toBe(true);

				// Wait for success
				await vi.waitUntil(() => stache.isSuccess);
				expect(stache.data).toEqual({ data: 'success' });
			})
		);

		it(
			'should handle different error types correctly',
			withEffectRoot(async () => {
				const customError = { code: 'CUSTOM_ERROR', message: 'Custom error' };
				const fetchFn = vi.fn().mockRejectedValue(customError);
				const { useStache } = createStache({
					id: 'custom-error-test',
					fetch: fetchFn
				});

				const params = $state('param');
				const stache = useStache(() => ({ params }));

				flushSync();

				// Wait for error
				await vi.waitUntil(() => stache.isError);

				// Should preserve the custom error object
				expect(stache.error).toEqual(customError);
				expect(stache.fetchStatus).toBe('error');
			})
		);

		it(
			'should handle string errors',
			withEffectRoot(async () => {
				const stringError = 'String error message';
				const fetchFn = vi.fn().mockRejectedValue(stringError);
				const { useStache } = createStache({
					id: 'string-error-test',
					fetch: fetchFn
				});

				const params = $state('param');
				const stache = useStache(() => ({ params }));

				flushSync();

				// Wait for error
				await vi.waitUntil(() => stache.isError);

				// Should preserve the string error
				expect(stache.error).toBe(stringError);
				expect(stache.fetchStatus).toBe('error');
			})
		);

		it(
			'should preserve data from previous successful fetch when error occurs',
			withEffectRoot(async () => {
				let shouldFail = false;
				const fetchFn = vi.fn().mockImplementation(() => {
					if (shouldFail) {
						return Promise.reject(new Error('Network error'));
					}
					return Promise.resolve({ data: 'success' });
				});

				const { useStache } = createStache({
					id: 'preserve-data-error-test',
					fetch: fetchFn
				});

				const params = $state('param');
				const stache = await useStache(() => ({ params }));

				flushSync();

				// Wait for initial success
				await vi.waitUntil(() => stache.isSuccess);
				expect(stache.data).toEqual({ data: 'success' });

				// Cause next fetch to fail
				shouldFail = true;
				stache.invalidate();
				flushSync();

				// Wait for error
				await vi.waitUntil(() => stache.isError);

				// Data should be preserved from previous successful fetch
				expect(stache.data).toEqual({ data: 'success' });
				expect(stache.error).toBeInstanceOf(Error);
			})
		);

		it(
			'should handle errors in enabled/disabled stache correctly',
			withEffectRoot(async () => {
				const fetchFn = vi.fn().mockRejectedValue(new Error('Network error'));
				const { useStache } = createStache({
					id: 'disabled-error-test',
					fetch: fetchFn
				});

				let enabled = $state(false);
				const params = $state('param');
				const stache = useStache(() => ({ params, enabled }));

				flushSync();

				vi.advanceTimersToNextTimer();

				// Should not fetch when disabled
				expect(fetchFn).not.toHaveBeenCalled();
				expect(stache.isError).toBe(false);

				// Enable and should get error
				enabled = true;
				flushSync();

				await vi.waitUntil(() => stache.isError);
				expect(stache.error).toBeInstanceOf(Error);
			})
		);
	});
});

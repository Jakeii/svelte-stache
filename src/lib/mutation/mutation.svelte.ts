import {
	Mutation,
	type BaseMutationParams,
	type MutationFn,
	type OnSuccessFn,
	type ShouldRetryFn,
	type RetryDelayFn
} from './mutation.class.svelte';

const createMutation =
	<Params extends BaseMutationParams, Result = unknown>({
		mutationFn,
		beforeMutate: defineBeforeMutate,
		afterMutate: defineAfterMutate,
		onSuccess: defineOnSuccess,
		onError: defineOnError,
		retries,
		shouldRetry,
		retryDelay
	}: {
		mutationFn: MutationFn<Params, Result>;
		beforeMutate?: (args: Params) => unknown | Promise<unknown>;
		afterMutate?: (args: Params) => unknown | Promise<unknown>;
		onSuccess?: OnSuccessFn<Params, Result>;
		onError?: (error: unknown) => unknown;
		retries?: number;
		shouldRetry?: ShouldRetryFn<Params>;
		retryDelay?: number | RetryDelayFn<Params>;
	}) =>
	({
		onSuccess: useOnSuccess,
		beforeMutate: useBeforeMutate,
		afterMutate: useAfterMutate,
		onError: useOnError
	}: {
		onSuccess?: OnSuccessFn<Params, Result>;
		beforeMutate?: (args: Params) => unknown | Promise<unknown>;
		afterMutate?: (args: Params) => unknown | Promise<unknown>;
		onError?: (error: unknown) => unknown;
	} = {}) => {
		const onSuccess = [defineOnSuccess, useOnSuccess].filter(
			(fn): fn is OnSuccessFn<Params, Result> => typeof fn === 'function'
		);
		const onError = [defineOnError, useOnError].filter((fn) => typeof fn === 'function');
		const beforeMutate = [defineBeforeMutate, useBeforeMutate].filter(
			(fn): fn is (args: Params) => unknown | Promise<unknown> => typeof fn === 'function'
		);
		const afterMutate = [defineAfterMutate, useAfterMutate].filter(
			(fn): fn is (args: Params) => unknown | Promise<unknown> => typeof fn === 'function'
		);
		return new Mutation<Params, Result>({
			mutationFn,
			beforeMutate,
			afterMutate,
			onSuccess,
			onError,
			retries,
			shouldRetry,
			retryDelay
		});
	};

export { createMutation };
export type { Mutation, BaseMutationParams, MutationFn, OnSuccessFn, ShouldRetryFn, RetryDelayFn };

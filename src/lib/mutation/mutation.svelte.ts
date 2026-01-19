import {
	Mutation,
	type BaseMutationParams,
	type MutationFn,
	type OnSuccessFn
} from './mutation.class.svelte';

const createMutation =
	<Params extends BaseMutationParams, Result = unknown>({
		mutationFn,
		beforeMutate: defineBeforeMutate,
		afterMutate: defineAfterMutate,
		onSuccess: defineOnSuccess,
		onError: defineOnError
	}: {
		mutationFn: MutationFn<Params, Result>;
		beforeMutate?: (args: Params) => void | Promise<void>;
		afterMutate?: (args: Params) => void | Promise<void>;
		onSuccess?: OnSuccessFn<Params, Result>;
		onError?: (error: unknown) => void;
	}) =>
	({
		onSuccess: useOnSuccess,
		beforeMutate: useBeforeMutate,
		afterMutate: useAfterMutate,
		onError: useOnError
	}: {
		onSuccess?: OnSuccessFn<Params, Result>;
		beforeMutate?: (args: Params) => void | Promise<void>;
		afterMutate?: (args: Params) => void | Promise<void>;
		onError?: (error: unknown) => void;
	} = {}) => {
		const onSuccess = [defineOnSuccess, useOnSuccess].filter(
			(fn): fn is OnSuccessFn<Params, Result> => typeof fn === 'function'
		);
		const onError = [defineOnError, useOnError].filter((fn) => typeof fn === 'function');
		const beforeMutate = [defineBeforeMutate, useBeforeMutate].filter(
			(fn): fn is (args: Params) => void | Promise<void> => typeof fn === 'function'
		);
		const afterMutate = [defineAfterMutate, useAfterMutate].filter(
			(fn): fn is (args: Params) => void | Promise<void> => typeof fn === 'function'
		);
		return new Mutation<Params, Result>({
			mutationFn,
			beforeMutate,
			afterMutate,
			onSuccess,
			onError
		});
	};

export { createMutation };
export type { Mutation, BaseMutationParams, MutationFn, OnSuccessFn };

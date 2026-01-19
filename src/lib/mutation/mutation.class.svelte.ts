import type { UseStacheFn } from '../stache.svelte';

type BaseMutationParams = unknown[] | unknown;

type ExtractParams<T> = T extends UseStacheFn<infer P, any> ? P : never;

type InvalidateStache<Q extends UseStacheFn<any, any>> = {
	stache: Q;
	params: ExtractParams<Q>;
};

type InvalidatesQueriesObj = InvalidateStache<UseStacheFn<any, any>>[];

type InvalidatesQueries<Params = BaseMutationParams, Result = unknown> =
	| InvalidatesQueriesObj
	| (({ params, result }: { params: Params; result: Result }) => InvalidatesQueriesObj);

type MutationFn<StacheFnParams extends BaseMutationParams, Result = unknown> = (
	args: StacheFnParams
) => Promise<Result> | Result;

type OnSuccessFn<Params, Result> = ({ params, result }: { params: Params; result: Result }) => void;

class Mutation<Params extends BaseMutationParams, Result = unknown> {
	mutationFn: MutationFn<Params, Result>;
	beforeMutate?: ((args: Params) => void | Promise<void>)[];
	afterMutate?: ((args: Params) => void | Promise<void>)[];
	invalidatesQueries: InvalidatesQueries<Params, Result> = [];
	status = $state<'idle' | 'loading' | 'error' | 'success'>('idle');
	isLoading = $derived(this.status === 'loading');
	isError = $derived(this.status === 'error');
	isSuccess = $derived(this.status === 'success');
	data: Result | null = $state(null);
	error: unknown = $state(null);
	onSuccess?: OnSuccessFn<Params, Result>[];
	onError?: ((error: unknown) => void)[];

	constructor({
		mutationFn,
		beforeMutate,
		afterMutate,
		invalidatesQueries,
		onSuccess,
		onError
	}: {
		mutationFn: MutationFn<Params, Result>;
		beforeMutate?: ((args: Params) => void | Promise<void>)[];
		afterMutate?: ((args: Params) => void | Promise<void>)[];
		invalidatesQueries?: InvalidatesQueries<Params, Result>;
		onSuccess?: OnSuccessFn<Params, Result>[];
		onError?: ((error: unknown) => void)[];
	}) {
		this.mutationFn = mutationFn;
		this.beforeMutate = beforeMutate;
		this.afterMutate = afterMutate;
		this.onSuccess = onSuccess;
		this.onError = onError;
		if (invalidatesQueries) {
			this.invalidatesQueries = invalidatesQueries;
		}
	}

	async mutate(params: Params) {
		this.status = 'loading';
		this.error = null;
		try {
			this._beforeMutate(params);
			const result = await this.mutationFn(params);
			this.data = result;
			this._onSuccess({ params: params, result: result });
			return result;
		} catch (err) {
			this.error = err;
			this._onError(err);
			return null;
		} finally {
			this._afterMutate(params);
		}
	}

	private _beforeMutate(args: Params) {
		if (this.beforeMutate) {
			this.beforeMutate.forEach((fn) => fn(args));
		}
	}

	private _afterMutate(args: Params) {
		if (this.afterMutate) {
			this.afterMutate.forEach((fn) => fn(args));
		}
	}

	private _onSuccess({ params, result }: { params: Params; result: Result }) {
		this.status = 'success';
		if (this.onSuccess) {
			this.onSuccess.forEach((fn) => fn({ params, result }));
		}
	}

	private _onError(error: unknown) {
		this.status = 'error';
		if (this.onError) {
			this.onError.forEach((fn) => fn(error));
		}
	}
}

export { Mutation };
export type { MutationFn, InvalidatesQueries, InvalidateStache, OnSuccessFn, BaseMutationParams };

import type { UseStacheFn } from '../stache/stache.svelte';

type BaseMutationParams = unknown[] | unknown;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExtractParams<T> = T extends UseStacheFn<infer P, any> ? P : never;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InvalidateStache<Q extends UseStacheFn<any, any>> = {
	stache: Q;
	params: ExtractParams<Q>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InvalidatesQueriesObj = InvalidateStache<UseStacheFn<any, any>>[];

type InvalidatesQueries<Params = BaseMutationParams, Result = unknown> =
	| InvalidatesQueriesObj
	| (({ params, result }: { params: Params; result: Result }) => InvalidatesQueriesObj);

type MutationFn<StacheFnParams extends BaseMutationParams, Result = unknown> = (
	args: StacheFnParams
) => Promise<Result> | Result;

type OnSuccessFn<Params, Result> = ({ params, result }: { params: Params; result: Result }) => void;

type ShouldRetryFn<Params> = (context: {
	error: unknown;
	attempt: number;
	params: Params;
}) => boolean;

type RetryDelayFn<Params> = (context: {
	error: unknown;
	attempt: number;
	params: Params;
}) => number;

const DEFAULT_RETRY_DELAY_MS = 300;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class Mutation<Params extends BaseMutationParams, Result = unknown> {
	mutationFn: MutationFn<Params, Result>;
	beforeMutate?: ((args: Params) => unknown | Promise<unknown>)[];
	afterMutate?: ((args: Params) => unknown | Promise<unknown>)[];
	invalidatesQueries: InvalidatesQueries<Params, Result> = [];
	status = $state<'idle' | 'loading' | 'retrying' | 'error' | 'success'>('idle');
	isLoading = $derived(this.status === 'loading');
	isRetrying = $derived(this.status === 'retrying');
	isError = $derived(this.status === 'error');
	isSuccess = $derived(this.status === 'success');
	data: Result | null = $state(null);
	error: unknown = $state(null);
	onSuccess?: OnSuccessFn<Params, Result>[];
	onError?: ((error: unknown) => unknown)[];
	retries: number;
	shouldRetry?: ShouldRetryFn<Params>;
	retryDelay: number | RetryDelayFn<Params>;

	constructor({
		mutationFn,
		beforeMutate,
		afterMutate,
		invalidatesQueries,
		onSuccess,
		onError,
		retries,
		shouldRetry,
		retryDelay
	}: {
		mutationFn: MutationFn<Params, Result>;
		beforeMutate?: ((args: Params) => unknown | Promise<unknown>)[];
		afterMutate?: ((args: Params) => unknown | Promise<unknown>)[];
		invalidatesQueries?: InvalidatesQueries<Params, Result>;
		onSuccess?: OnSuccessFn<Params, Result>[];
		onError?: ((error: unknown) => void)[];
		retries?: number;
		shouldRetry?: ShouldRetryFn<Params>;
		retryDelay?: number | RetryDelayFn<Params>;
	}) {
		this.mutationFn = mutationFn;
		this.beforeMutate = beforeMutate;
		this.afterMutate = afterMutate;
		this.onSuccess = onSuccess;
		this.onError = onError;
		this.retries = retries ?? 0;
		this.shouldRetry = shouldRetry;
		this.retryDelay = retryDelay ?? DEFAULT_RETRY_DELAY_MS;
		if (invalidatesQueries) {
			this.invalidatesQueries = invalidatesQueries;
		}
	}

	async mutate(params: Params) {
		this.status = 'loading';
		this.error = null;
		try {
			this._beforeMutate(params);
			let attempt = 0;
			for (;;) {
				try {
					const result = await this.mutationFn(params);
					this.data = result;
					this._onSuccess({ params: params, result: result });
					return result;
				} catch (err) {
					const canRetry =
						attempt < this.retries &&
						(this.shouldRetry ? this.shouldRetry({ error: err, attempt, params }) !== false : true);
					if (!canRetry) {
						this.error = err;
						this._onError(err);
						return null;
					}
					this.error = err;
					this.status = 'retrying';
					const delay = this._resolveRetryDelay({ error: err, attempt, params });
					await sleep(delay);
					attempt++;
				}
			}
		} finally {
			this._afterMutate(params);
		}
	}

	private _resolveRetryDelay(context: { error: unknown; attempt: number; params: Params }) {
		return typeof this.retryDelay === 'function' ? this.retryDelay(context) : this.retryDelay;
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
export type {
	MutationFn,
	InvalidatesQueries,
	InvalidateStache,
	OnSuccessFn,
	BaseMutationParams,
	ShouldRetryFn,
	RetryDelayFn
};

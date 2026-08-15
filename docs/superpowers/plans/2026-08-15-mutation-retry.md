# Mutation Retry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add configurable retry (with delay/backoff) to the `Mutation` class, set at define time via `createMutation`.

**Architecture:** Extend `Mutation.mutate()`'s single try/catch into a retry loop bounded by a `retries` count and gated by an optional `shouldRetry` predicate. Between a retryable failure and the next attempt, await a delay resolved from `retryDelay` (a fixed number or a function). Add a `'retrying'` status and `isRetrying` derived flag. All new options are define-time only, passed through `createMutation` to the `Mutation` constructor, matching how `mutationFn` already works.

**Tech Stack:** Svelte 5 runes, TypeScript, Vitest (`@vitest/browser`, real browser environment via Playwright), fake timers (`vi.useFakeTimers()`) for delay assertions.

**Spec:** [docs/superpowers/specs/2026-05-19-mutation-retry-design.md](../specs/2026-05-19-mutation-retry-design.md)

## Global Constraints

- `retries` defaults to `0` (no retries), matching the existing stache `retries` option.
- `retryDelay` defaults to `300` (ms) when omitted; accepts a fixed `number` or a `RetryDelayFn<Params>`.
- `retryDelay` is only evaluated/awaited when a retry will actually happen (i.e. `shouldRetry` allowed it and `attempt < retries`) — never on the final failed attempt.
- No built-in cap on `retryDelay`'s returned value.
- `status` is `'retrying'` for the whole wait+next-attempt period; no separate "waiting" status.
- `shouldRetry` and `retryDelay` are both called with the 0-indexed attempt number of the attempt that just failed: `{ error, attempt, params }`.
- `_beforeMutate` runs exactly once before the first attempt; `_afterMutate` runs exactly once after all attempts complete (via `finally`).
- Indentation in this codebase is tabs (match `mutation.class.svelte.ts` / `mutation.svelte.ts` / `mutation.svelte.test.ts` exactly).

---

### Task 1: Add retry loop, delay, and `retrying` status to `Mutation` class

**Files:**

- Modify: `src/lib/mutation/mutation.class.svelte.ts`
- Test: `src/lib/mutation/mutation.svelte.test.ts`

**Interfaces:**

- Produces (for Task 2 to consume):
  - `type ShouldRetryFn<Params> = (context: { error: unknown; attempt: number; params: Params }) => boolean;`
  - `type RetryDelayFn<Params> = (context: { error: unknown; attempt: number; params: Params }) => number;`
  - `Mutation` constructor accepts additional options: `retries?: number` (default `0`), `shouldRetry?: ShouldRetryFn<Params>`, `retryDelay?: number | RetryDelayFn<Params>` (default `300`).
  - `Mutation.status` type becomes `'idle' | 'loading' | 'retrying' | 'error' | 'success'`.
  - `Mutation.isRetrying = $derived(this.status === 'retrying')`.

This task touches only `mutation.class.svelte.ts` and adds tests directly against `Mutation` via `createMutation` (there is no separate class-level test file in this codebase — all mutation tests live in `mutation.svelte.test.ts`, so append new `describe` blocks there).

- [ ] **Step 1: Write failing tests for retry behavior**

Append these `describe` blocks to `src/lib/mutation/mutation.svelte.test.ts`, after the existing `describe('Callback flexibility', ...)` block and before the final closing `});` of the outer `describe('createMutation', ...)`:

```ts
describe('retries', () => {
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
				retryDelay: 0
			});

			const mutation = useMutation();
			const resultPromise = mutation.mutate({ id: 1 });
			flushSync();
			statusHistory.push(mutation.status);

			await vi.waitUntil(() => mutation.status === 'retrying');
			statusHistory.push(mutation.status);

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
				retryDelay: 0
			});

			const mutation = useMutation();
			const result = await mutation.mutate({ id: 1 });

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
				retryDelay: 0,
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
				retryDelay: 0,
				shouldRetry
			});

			const mutation = useMutation();
			await mutation.mutate({ id: 1 });

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
				retryDelay: 0
			});

			const mutation = useMutation();
			expect(mutation.isRetrying).toBe(false);

			const resultPromise = mutation.mutate({ id: 1 });
			flushSync();
			expect(mutation.isRetrying).toBe(false);

			await vi.waitUntil(() => mutation.isRetrying);
			expect(mutation.isRetrying).toBe(true);

			await resultPromise;
			flushSync();
			expect(mutation.isRetrying).toBe(false);
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
				retryDelay: 0,
				beforeMutate
			});

			const mutation = useMutation();
			await mutation.mutate({ id: 1 });

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
				retryDelay: 0,
				afterMutate
			});

			const mutation = useMutation();
			await mutation.mutate({ id: 1 });

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

			await vi.waitUntil(() => mutation.status === 'retrying');
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

			await vi.waitUntil(() => mutation.status === 'retrying');
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

			await vi.waitUntil(() => mutation.status === 'retrying');
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

			await vi.waitUntil(() => mutation.status === 'retrying');
			expect(retryDelay).toHaveBeenCalledTimes(1);

			await vi.advanceTimersByTimeAsync(100);
			await resultPromise;

			expect(mutationFn).toHaveBeenCalledTimes(2);
			expect(retryDelay).toHaveBeenCalledTimes(1);
			expect(mutation.status).toBe('error');
		})
	);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `NO_COLOR=true pnpm test --reporter=agent -- mutation.svelte.test.ts`
Expected: FAIL — `retries`, `retryDelay`, `shouldRetry` are not recognized options / `isRetrying` is undefined / `'retrying'` status never occurs.

- [ ] **Step 3: Implement retry loop, delay, and status in `Mutation` class**

Replace the full contents of `src/lib/mutation/mutation.class.svelte.ts` with:

```ts
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
```

Note: `createMutation` (in `mutation.svelte.ts`, updated in Task 2) does not yet pass `retries`/`shouldRetry`/`retryDelay` through to the `Mutation` constructor — until Task 2 lands, all retry-related tests from Step 1 will still fail because `createMutation` silently drops these options. This is expected; Task 2 completes the wiring.

- [ ] **Step 4: Run tests — expect retry/status/delay tests to still fail on option pass-through, not on class internals**

Run: `NO_COLOR=true pnpm test --reporter=agent -- mutation.svelte.test.ts`
Expected: Tests that don't rely on `retries`/`shouldRetry`/`retryDelay` being passed through `createMutation` (there are none isolated to the class alone in this suite) will still fail with retries not happening — this confirms Task 2 is required next. Do not proceed to commit yet; Task 2 must land first for a green suite.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mutation/mutation.class.svelte.ts src/lib/mutation/mutation.svelte.test.ts
git commit -m "add retry loop, delay, and retrying status to Mutation class"
```

---

### Task 2: Wire `retries`, `shouldRetry`, `retryDelay` through `createMutation`

**Files:**

- Modify: `src/lib/mutation/mutation.svelte.ts`

**Interfaces:**

- Consumes: `Mutation` constructor options `retries?: number`, `shouldRetry?: ShouldRetryFn<Params>`, `retryDelay?: number | RetryDelayFn<Params>` from Task 1's `mutation.class.svelte.ts`.
- Produces: `createMutation({ mutationFn, retries, shouldRetry, retryDelay, ... })` — all three are define-time-only options (not accepted by the returned `useMutation()` function, consistent with `mutationFn`).

- [ ] **Step 1: Update `createMutation` to accept and pass through `retries`, `shouldRetry`, `retryDelay`**

Replace the full contents of `src/lib/mutation/mutation.svelte.ts` with:

```ts
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
```

- [ ] **Step 2: Run the full mutation test suite**

Run: `NO_COLOR=true pnpm test --reporter=agent -- mutation.svelte.test.ts`
Expected: PASS — all tests in `mutation.svelte.test.ts`, including the new `retries` and `retryDelay` describe blocks from Task 1, pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/mutation/mutation.svelte.ts
git commit -m "wire retries, shouldRetry, retryDelay through createMutation"
```

---

### Task 3: Export `ShouldRetryFn` and `RetryDelayFn` from the library entrypoint

**Files:**

- Modify: `src/lib/index.ts`

**Interfaces:**

- Consumes: `ShouldRetryFn`, `RetryDelayFn` types from `src/lib/mutation/mutation.class.svelte.ts` (Task 1).
- Produces: Public API — consumers can `import type { ShouldRetryFn, RetryDelayFn } from 'svelte-stache'`.

- [ ] **Step 1: Add the type exports**

In `src/lib/index.ts`, find this line:

```ts
export type { MutationFn } from './mutation/mutation.class.svelte';
```

Replace it with:

```ts
export type { MutationFn, ShouldRetryFn, RetryDelayFn } from './mutation/mutation.class.svelte';
```

- [ ] **Step 2: Verify the project still typechecks**

Run: `pnpm check`
Expected: No new type errors.

- [ ] **Step 3: Run the full test suite**

Run: `NO_COLOR=true pnpm test --reporter=agent`
Expected: PASS — no regressions across the whole suite.

- [ ] **Step 4: Commit**

```bash
git add src/lib/index.ts
git commit -m "export ShouldRetryFn and RetryDelayFn from the library entrypoint"
```

---

## Post-Plan Verification

After Task 3, run once more as a final sanity check:

```bash
NO_COLOR=true pnpm test --reporter=agent
pnpm check
pnpm lint
```

All three must pass before considering this plan complete.

# Mutation Retry Design

**Date:** 2026-05-19

## Overview

Add retry support to the `Mutation` class, configurable at define time via `createMutation`. Retries are controlled by a count (`retries`), an optional predicate (`shouldRetry`) for fine-grained control over when retries should occur (e.g. network errors only, specific HTTP status codes), and a configurable delay (`retryDelay`) between attempts, either fixed or computed (e.g. exponential backoff).

## API

Options are define-time only (passed to `createMutation`, not to `useMutation()`), consistent with how `mutationFn` is configured.

```ts
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

createMutation({
	mutationFn,
	retries: 3, // max retry attempts, default 0
	shouldRetry: ({ error, attempt, params }) => error instanceof NetworkError,
	retryDelay: 500 // fixed ms delay, or a RetryDelayFn for custom/backoff logic
});
```

- `retries` — maximum number of retry attempts after the initial failure. Defaults to `0` (no retries), matching the existing stache `retries` option.
- `shouldRetry` — optional predicate called before each retry. Return `false` to abort retrying early. If omitted, always retries up to the `retries` count.
- `attempt` in the predicate is 0-indexed: `0` on first failure, `1` on second failure, etc.
- `retryDelay` — delay in ms before each retry attempt. Accepts either a fixed `number` or a `RetryDelayFn<Params>` for custom logic (e.g. exponential/linear backoff). Defaults to `300` (ms) when omitted. Only consulted when a retry is actually going to happen (i.e. after `shouldRetry` allows it and `attempt < retries`). No built-in cap on the returned value — callers writing exponential backoff are responsible for capping it themselves.

## Status Changes

The `status` type expands to include `'retrying'`:

```ts
type MutationStatus = 'idle' | 'loading' | 'retrying' | 'error' | 'success';
```

A new derived property `isRetrying` is added to the `Mutation` class:

```ts
isRetrying = $derived(this.status === 'retrying');
```

## Retry Execution Flow

```
mutate(params) called
  → _beforeMutate(params)       [once, before first attempt]
  → status = 'loading'
  → attempt = 0

loop:
  → call mutationFn(params)
  → success:
      → _onSuccess({ params, result })
      → status = 'success'
      → break
  → failure:
      → if attempt < retries && shouldRetry({ error, attempt, params }) !== false:
          → status = 'retrying'
          → delay = resolveRetryDelay({ error, attempt, params })
          → await sleep(delay)
          → attempt++
          → continue loop
      → else:
          → _onError(error)
          → status = 'error'
          → break

finally:
  → _afterMutate(params)        [once, after all attempts]
```

Key invariants:

- `_beforeMutate` runs exactly once before the first attempt.
- `_afterMutate` runs exactly once after all attempts complete (via `finally`), regardless of outcome.
- `status` is set to `'retrying'` as soon as a retry is decided, and stays `'retrying'` through the delay wait and the next attempt — there is no separate "waiting" status.
- `retryDelay` is only evaluated when a retry will actually happen (after `shouldRetry` passes), not on the final failed attempt.
- `shouldRetry` and `retryDelay` are both called with the 0-indexed attempt number of the attempt that just failed.

## Changes Required

### `src/lib/mutation/mutation.class.svelte.ts`

- Add `ShouldRetryFn<Params>` and `RetryDelayFn<Params>` types.
- Add `retries: number`, `shouldRetry?: ShouldRetryFn<Params>`, and `retryDelay: number | RetryDelayFn<Params>` fields to `Mutation` class.
- Expand `status` type to include `'retrying'`.
- Add `isRetrying = $derived(this.status === 'retrying')`.
- Replace single `await this.mutationFn(params)` in `mutate()` with a retry loop that, on a retryable failure, resolves the delay (fixed number or calls `retryDelay({ error, attempt, params })`) and awaits it before the next attempt.
- Update constructor to accept and store `retries`, `shouldRetry`, and `retryDelay` (defaulting `retryDelay` to `300`).

### `src/lib/mutation/mutation.svelte.ts`

- Add `retries`, `shouldRetry`, and `retryDelay` to the `createMutation` define-time options type.
- Pass them through to the `Mutation` constructor.

### `src/lib/mutation/mutation.svelte.test.ts`

New test cases:

- `retries: 0` (default) — fails immediately, no retry attempted, `mutationFn` called once.
- Retries succeed on 2nd attempt — `mutationFn` fails once then resolves; status transitions `loading → retrying → success`; `mutationFn` called twice.
- All retries exhausted — `mutationFn` always rejects; called `retries + 1` times total; final status is `error`.
- `shouldRetry` returning `false` — stops early even with attempts remaining; ends in `error`.
- Default `retryDelay` (300ms) is awaited between attempts when `retryDelay` is not specified.
- Fixed numeric `retryDelay` is awaited between attempts (use fake timers to assert the wait without slowing the test).
- `RetryDelayFn` form — called with `{ error, attempt, params }`, its return value used as the wait duration; verify it's called once per retry with the correct 0-indexed attempt.
- `retryDelay` is not evaluated on the final failed attempt (when no retry will occur).
- `isRetrying` derived state — `true` during retries, `false` otherwise.
- `afterMutate` called once — not per-attempt.
- `beforeMutate` called once — not per-attempt.

## Types to Export

`ShouldRetryFn` and `RetryDelayFn` should be exported from `mutation.svelte.ts` and re-exported from `src/lib/index.ts` alongside the existing mutation types.

# Mutation Retry Design

**Date:** 2026-05-19

## Overview

Add retry support to the `Mutation` class, configurable at define time via `createMutation`. Retries are controlled by a count (`retries`) and an optional predicate (`shouldRetry`) for fine-grained control over when retries should occur (e.g. network errors only, specific HTTP status codes).

## API

Options are define-time only (passed to `createMutation`, not to `useMutation()`), consistent with how `mutationFn` is configured.

```ts
type ShouldRetryFn<Params> = (context: {
	error: unknown;
	attempt: number;
	params: Params;
}) => boolean;

createMutation({
	mutationFn,
	retries: 3, // max retry attempts, default 0
	shouldRetry: ({ error, attempt, params }) => error instanceof NetworkError
});
```

- `retries` — maximum number of retry attempts after the initial failure. Defaults to `0` (no retries), matching the existing stache `retries` option.
- `shouldRetry` — optional predicate called before each retry. Return `false` to abort retrying early. If omitted, always retries up to the `retries` count.
- `attempt` in the predicate is 0-indexed: `0` on first failure, `1` on second failure, etc.

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
- No delay between retry attempts (no backoff); this can be added as a follow-up.
- `shouldRetry` is called with the 0-indexed attempt number of the attempt that just failed.

## Changes Required

### `src/lib/mutation/mutation.class.svelte.ts`

- Add `ShouldRetryFn<Params>` type.
- Add `retries: number` and `shouldRetry?: ShouldRetryFn<Params>` fields to `Mutation` class.
- Expand `status` type to include `'retrying'`.
- Add `isRetrying = $derived(this.status === 'retrying')`.
- Replace single `await this.mutationFn(params)` in `mutate()` with a retry loop.
- Update constructor to accept and store `retries` and `shouldRetry`.

### `src/lib/mutation/mutation.svelte.ts`

- Add `retries` and `shouldRetry` to the `createMutation` define-time options type.
- Pass them through to the `Mutation` constructor.

### `src/lib/mutation/mutation.svelte.test.ts`

New test cases:

- `retries: 0` (default) — fails immediately, no retry attempted, `mutationFn` called once.
- Retries succeed on 2nd attempt — `mutationFn` fails once then resolves; status transitions `loading → retrying → success`; `mutationFn` called twice.
- All retries exhausted — `mutationFn` always rejects; called `retries + 1` times total; final status is `error`.
- `shouldRetry` returning `false` — stops early even with attempts remaining; ends in `error`.
- `isRetrying` derived state — `true` during retries, `false` otherwise.
- `afterMutate` called once — not per-attempt.
- `beforeMutate` called once — not per-attempt.

## Types to Export

`ShouldRetryFn` should be exported from `mutation.svelte.ts` and re-exported from `src/lib/index.ts` alongside the existing mutation types.

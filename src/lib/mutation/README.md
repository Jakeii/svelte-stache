# mutation/

Implements the `createMutation` factory for data mutations (create, update, delete operations). Mutations are stateful and support lifecycle callbacks at both definition time and use time.

## Files

- `mutation.svelte.ts` — `createMutation` factory (curried)
- `mutation.class.svelte.ts` — `Mutation` class with reactive state
- `mutation.svelte.test.ts` — unit tests

## createMutation

`createMutation` is a curried factory. The first call defines the mutation; the second call (at use time) merges additional callbacks and returns a `Mutation` instance.

```ts
// Define (e.g. in a separate file or module)
const useCreateUser = createMutation({
  mutationFn: async (params: CreateUserParams) => { ... },
  onSuccess: ({ params, result }) => { ... },
  beforeMutate: (args) => { ... },
  afterMutate: (args) => { ... },
  onError: (error) => { ... }
})

// Use (inside a component)
const mutation = useCreateUser({
  onSuccess: ({ result }) => { invalidate(result.id) },
  onError: (err) => console.error(err)
})
```

### Callback Merging

Both definition-time and use-time callbacks are merged into arrays and all called in order:
- `onSuccess`: `[defineOnSuccess, useOnSuccess]` (filtered for undefined)
- `onError`: `[defineOnError, useOnError]`
- `beforeMutate`: `[defineBeforeMutate, useBeforeMutate]`
- `afterMutate`: `[defineAfterMutate, useAfterMutate]`

## Mutation Class

### Reactive State (`$state` / `$derived`)

| Property | Type | Description |
|---|---|---|
| `status` | `'idle' \| 'loading' \| 'error' \| 'success'` | Current mutation state |
| `isLoading` | `boolean` | `$derived` from status |
| `isError` | `boolean` | `$derived` from status |
| `isSuccess` | `boolean` | `$derived` from status |
| `data` | `Result \| null` | Last successful mutation result |
| `error` | `unknown` | Last error |

### mutate(params)

```ts
await mutation.mutate(params)
```

Execution order:
1. `status = 'loading'`, clears `error`
2. Calls all `beforeMutate` callbacks (in order)
3. Awaits `mutationFn(params)`
4. On success: stores `data`, calls `_onSuccess` (sets `status = 'success'`, runs `onSuccess` callbacks)
5. On error: stores `error`, calls `_onError` (sets `status = 'error'`, runs `onError` callbacks)
6. Finally: calls all `afterMutate` callbacks (always runs)
7. Returns `result` on success, `null` on error

### Stache Invalidation

The `Mutation` class supports an `invalidatesQueries` field (not exposed via `createMutation` factory, can be set on the instance):

```ts
type InvalidatesQueries<Params, Result> =
  | InvalidateStache<UseStacheFn<any, any>>[]
  | (({ params, result }) => InvalidateStache<UseStacheFn<any, any>>[])
```

This allows linking mutations to staches for automatic invalidation on success.

## Exported Types

```ts
type MutationFn<Params, Result> = (args: Params) => Promise<Result> | Result
type OnSuccessFn<Params, Result> = ({ params, result }: { params: Params; result: Result }) => void
type BaseMutationParams = unknown[] | unknown
type InvalidateStache<Q extends UseStacheFn<any, any>>
type InvalidatesQueries<Params, Result>
```

# stache/

Implements the public `createStache` factory and the global stache cache.

## Files

- `stache.svelte.ts` — `createStache` factory, `useStache` hook, public `Stache` type
- `cache.svelte.ts` — global cache (`SvelteMap`) and cache helpers
- `test/` — unit tests

## createStache

```ts
const { useStache, invalidate } = createStache<StacheParams, Result>(options);
```

**Options** (`CreateStacheOptions`):

- All `StacheConstructorOptions` fields from `core/` (id, fetch, staleTime, cleanupTime, retries, refetchOnStale, refetchOnWindowFocus, isHydratable)
- `fetch: FetchFn<StacheParams, Result>` — must be a non-paged fetch function
- `globalCache?: GlobalStacheCache` — inject a custom cache (e.g. for persistence)

**Returns:**

- `useStache(optionsFn?)` — call inside a component to get a reactive `Stache` instance
- `invalidate(params)` — imperatively invalidate a specific cached instance

## useStache

```ts
const stache = useStache(() => ({ params, enabled }));
```

- Must be called inside a Svelte component (uses `$effect.pre`)
- `optionsFn` is reactive — returning different `params` swaps to a different cached instance
- When params change, the old stache's `referenceCount` is decremented and a new one is retrieved/created
- On component unmount, `referenceCount` is decremented; if it reaches 0, cleanup is scheduled via `setTimeout(cleanupTime)`
- Uses `tick()` before scheduling cleanup so re-mounting the same component can cancel the cleanup

## Public Stache Object

| Property                     | Type                                          | Description                      |
| ---------------------------- | --------------------------------------------- | -------------------------------- |
| `data`                       | `Result \| null`                              | Fetched data                     |
| `error`                      | `unknown`                                     | Last error                       |
| `fetchStatus`                | `'idle' \| 'loading' \| 'error' \| 'success'` | Fetch state                      |
| `isLoading`                  | `boolean`                                     | Derived from fetchStatus         |
| `isError`                    | `boolean`                                     | Derived from fetchStatus         |
| `isSuccess`                  | `boolean`                                     | Derived from fetchStatus         |
| `cacheStatus`                | `'fresh' \| 'stale' \| 'empty'`               | Cache freshness                  |
| `lastFetched`                | `Date \| null`                                | Timestamp of last success        |
| `params`                     | `StacheParams`                                | Current params                   |
| `enabled`                    | `boolean`                                     | Whether stache is active         |
| `invalidate()`               | `() => void`                                  | Force refetch                    |
| `then` / `catch` / `finally` | Promise interface                             | For `{#await}` and `await` usage |

### Promise Interface

The public stache object is thenable. On first `await`/`{#await}`, it waits for the in-flight fetch to settle, then returns itself. Subsequent awaits return `undefined` (preventing double-resolution).

```svelte
{#await stache}
	<p>Loading...</p>
{:then result}
	<p>{result.data}</p>
{/await}
```

## Cache (cache.svelte.ts)

Structure: `GlobalStacheCache = SvelteMap<stacheId, SvelteMap<paramsKey, CoreStache>>`

### Functions

| Function                           | Description                                         |
| ---------------------------------- | --------------------------------------------------- |
| `getStacheCache(id, globalCache?)` | Get or create the inner cache for a given stache id |
| `getStache(cache, key)`            | Retrieve a specific stache instance                 |
| `getGlobalStacheCache()`           | Access the module-level global cache                |
| `invalidateStacheById(id)`         | Invalidate all instances with a given id            |

### Key Behavior

- Cache is keyed by `hashKey(params)` — objects with same keys/values in any order produce the same key
- `getOrCreateStache()` increments `referenceCount` and cancels pending cleanup if a cached instance is found
- `cache.delete()` is called from within the cleanup timeout, not immediately on unmount

## Test Files

- `test/core.svelte.test.ts` — basic fetch, data, status
- `test/cache.svelte.test.ts` — cache hit/miss, reference counting, cleanup
- `test/refetch.svelte.test.ts` — stale refetch, window focus, invalidation
- `test/errors.svelte.test.ts` — error handling, retries
- `test/integration.svelte.test.ts` — multi-component scenarios

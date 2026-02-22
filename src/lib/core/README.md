# core/

The foundational engine for all stache instances. Contains the `CoreStache` class which handles fetching, caching, and reactive state.

## Files

- `stache.class.svelte.ts` — `CoreStache<FetchParams, FetchReturnData>` class and shared types

## CoreStache Class

`CoreStache` is never used directly by consumers. It is instantiated by `createStache` and `createPagedStache`, and shared across component instances via the global cache.

### Constructor

```ts
new CoreStache(constructorOptions, useOptions, fetchPageParams?)
```

- `constructorOptions: StacheConstructorOptions` — id, fetch fn, staleTime, cleanupTime, etc.
- `useOptions: UseStacheOptions` — params, enabled
- `fetchPageParams?: FetchPageParams` — optional `{ pageIndex, pageSize }` for paged queries

### Private State (Svelte runes)

| Field          | Type                                          | Description                              |
| -------------- | --------------------------------------------- | ---------------------------------------- |
| `#enabled`     | `boolean`                                     | Whether the stache is active             |
| `#fetchStatus` | `'idle' \| 'loading' \| 'error' \| 'success'` | Current fetch state                      |
| `#cacheStatus` | `'fresh' \| 'stale' \| 'empty'`               | Cache freshness                          |
| `#raw`         | `FetchReturnData \| null`                     | Raw fetched data (`$state.raw`)          |
| `#error`       | `unknown`                                     | Last fetch error (`$state.raw`)          |
| `#lastFetched` | `Date \| null`                                | Timestamp of last success (`$state.raw`) |
| `#promise`     | `Promise<void>`                               | In-flight fetch promise                  |

### Public Properties

| Property               | Description                                            |
| ---------------------- | ------------------------------------------------------ |
| `id`                   | Unique stache type identifier                          |
| `params`               | Parameters used for this instance                      |
| `cacheKey`             | `hashKey(params)` — used as cache map key              |
| `fetchPageParams`      | Pagination params if paged                             |
| `pageCacheKey`         | `hashKey(fetchPageParams)` or `null`                   |
| `referenceCount`       | `$state` — number of active users; drives cleanup      |
| `cleanupTimeout`       | Timeout handle for deferred cache deletion             |
| `staleTime`            | ms until data goes stale (default: 300000)             |
| `cleanupTime`          | ms before unused instance is deleted (default: 300000) |
| `refetchOnWindowFocus` | Refetch on window focus when stale (default: true)     |
| `refetchOnStale`       | Auto-refetch when stale (default: false)               |
| `isHydratable`         | Use Svelte `hydratable()` for SSR (default: false)     |

### Getters

`enabled`, `fetchStatus`, `cacheStatus`, `data`, `error`, `lastFetched`, `promise`

### Methods

- `setOptions({ enabled })` — update enabled state and trigger a run
- `invalidate()` — force refetch regardless of cache status
- `canRun(params)` — returns true if fetch should proceed

### Fetch Logic (`#run`)

1. Guards: skips if already loading, or `canRun()` returns false (unless `invalidated: true`)
2. Sets `fetchStatus = 'loading'`
3. Calls `maybeHydratable()` which wraps the fetch in Svelte's `hydratable()` if `isHydratable`
4. On success: sets `fetchStatus = 'success'`, `cacheStatus = 'fresh'`, schedules staleness timeout
5. On `AbortError`: sets `fetchStatus = 'idle'`
6. On other errors: sets `fetchStatus = 'error'`, stores error, resolves (does not reject)

### Cache Staleness Scheduling

`#scheduleCacheStatusUpdate()` sets a `setTimeout` for `staleTime` ms that transitions `cacheStatus` from `'fresh'` to `'stale'`. If `refetchOnStale` is true, triggers another `#run()`. Only runs in browser environment.

## Exported Types

```ts
type StacheConstructorOptions<StacheFnParams, FetchReturnData>
type UseStacheOptions<Params>
type UsePagedStacheOptions<Params, Result>
type FetchFn<StacheFnParams, FetchReturnData>
type PagedFetchFn<StacheFnParams, FetchReturnData>
type FetchPageParams  // { pageIndex: number; pageSize: number }
type PageParams       // { pageOffset: number; pageCount: number }
```

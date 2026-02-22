# paged/

Implements the `createPagedStache` factory for paginated data fetching. Each page is a separate `CoreStache` instance, enabling per-page caching and independent status tracking.

## Files

- `paged.svelte.ts` — `createPagedStache` factory and `useStache` hook
- `paged-cache.svelte.ts` — 3-level global cache for paged staches
- `test/` — unit tests

## createPagedStache

```ts
const { useStache, invalidate } = createPagedStache<StacheParams, PageResult, PageFetchReturnData>(
	options
);
```

**Options** (`CreatePagedStacheOptions`):

- All `StacheConstructorOptions` fields from `core/`
- `fetch: PagedFetchFn<StacheParams, PageFetchReturnData>` — receives `(params, { pageIndex, pageSize })`
- `pageSize: number` — items per page
- `getData?: (data: PageFetchReturnData) => PageResult` — extract the page array from the raw response
- `getTotalCount?: (data: PageFetchReturnData) => number` — extract total item count from the raw response
- `globalCache?: GlobalPagedStacheCache` — inject a custom cache

**Returns:**

- `useStache(optionsFn?)` — call inside a component to get a reactive `PublicPagedStache`
- `invalidate(params)` — invalidate all pages for a given params key

## useStache (paged)

```ts
const stache = useStache(() => ({
	params,
	enabled,
	pageParams: { pageOffset: 0, pageCount: 2 }
}));
```

- `pageParams.pageOffset` — first page index to fetch (default: 0)
- `pageParams.pageCount` — how many consecutive pages to fetch (default: 1)
- Changing `pageParams` reactively swaps the active set of page staches
- Each page stache is a `CoreStache` with `fetchPageParams = { pageIndex, pageSize }`
- Cleanup decrements `referenceCount` per page stache individually

## PublicPagedStache

| Property       | Type                                          | Description                                                       |
| -------------- | --------------------------------------------- | ----------------------------------------------------------------- |
| `data`         | `Result \| null`                              | All pages flattened/aggregated (via `.flat()`)                    |
| `pages`        | `Array<PageResult \| null>`                   | Per-page data (null if not yet loaded), after `getData()`         |
| `totalCount`   | `number`                                      | From `getTotalCount(firstPage.data)` or `pages.length * pageSize` |
| `hasMore`      | `boolean`                                     | `data.length < totalCount`                                        |
| `fetchStatus`  | `'idle' \| 'loading' \| 'error' \| 'success'` | Aggregated across all pages                                       |
| `isLoading`    | `boolean`                                     | Any page is loading                                               |
| `isError`      | `boolean`                                     | Any page has errored                                              |
| `isSuccess`    | `boolean`                                     | All pages are successful                                          |
| `error`        | `unknown`                                     | First error found across pages                                    |
| `cacheStatus`  | `'fresh' \| 'stale' \| 'empty'`               | Aggregated: fresh if all fresh, stale if any stale                |
| `lastFetched`  | `Date \| null`                                | Most recent timestamp across all pages                            |
| `params`       | `StacheParams`                                | Current params                                                    |
| `enabled`      | `boolean`                                     | True if any page is enabled                                       |
| `invalidate()` | `() => void`                                  | Invalidates all page staches                                      |

### fetchStatus Aggregation Logic

- `'loading'` if any page is loading
- `'success'` if all pages are successful
- `'error'` if all pages are idle (used as error fallback)
- `'idle'` otherwise

## Cache (paged-cache.svelte.ts)

Three-level `SvelteMap` structure:

```
GlobalPagedStacheCache
  └── stacheId (string)
        └── PagedStacheCache
              └── paramsKey (hashKey(params))
                    └── SvelteMap<pageKey, CoreStache>
                          └── pageKey (hashKey({ pageIndex, pageSize }))
```

### Functions

| Function                                    | Description                                               |
| ------------------------------------------- | --------------------------------------------------------- |
| `getPagedStacheCache(id, globalCache?)`     | Get or create the `PagedStacheCache` for a stache id      |
| `getPageCache(pagedStacheCache, paramsKey)` | Get or create the page-level `SvelteMap` for given params |
| `getPagedStache(pageCache, pageKey)`        | Retrieve a specific page's `CoreStache`                   |
| `getGlobalPagedStacheCache()`               | Access the module-level global cache                      |
| `invalidatePagedStacheById(id)`             | Invalidate all pages for all param variants of a given id |

## Test Files

- `test/core.svelte.test.ts` — basic paged fetching, data aggregation
- `test/cache.svelte.test.ts` — cache hit/miss, page-level reference counting
- `test/status.svelte.test.ts` — status aggregation across pages
- `test/invalidation.svelte.test.ts` — page and batch invalidation

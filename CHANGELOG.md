# svelte-stache

## 1.3.0

### Minor Changes

- 9750254: Add retry logic and options to mutations

## 1.2.0

### Minor Changes

- a820f7b: Add a new prop `initialData` for `useStache` and `usePagedStache` that allows specifying the stache data before calling the fetch function, a companion `initialDataFetchedAt` can be provided and will be used to calculate if the `initialData` is `stale` or `fresh`, to delay fetching.

  The type of `initialData` can be different to the expected fetched data, but the stache `data` prop will be a union of both.

## 1.1.0

### Minor Changes

- a0e4f7e: Fix bug where invalidate bypasses certain run checks that it shouldn't

## 1.0.0

### Major Changes

- 5174fd4: Store global cache state in Svelte context for safer server-side usage.

  ### BREAKING CHANGES
  - **Context provider required**: Apps must wrap their root layout with `<StacheProvider>` to initialize the cache. This uses Svelte's `createContext` to store cache state per-request instead of in module-level globals.
  - **Removed exports**: `clearAllCaches` and `invalidateStache` are no longer exported from the main entrypoint. Use `getStacheCache()` to access the `StacheCache` instance and call its methods directly (e.g. `getStacheCache().invalidateStache(id)`, `getStacheCache().clear()`).

  ### Other changes
  - **Unified `StacheCache` class**: The separate `cache.svelte.ts` (stache) and `paged-cache.svelte.ts` (paged) modules have been replaced by a single `StacheCache` class in `src/lib/cache.ts`. All cache operations (get, set, delete, invalidate) for both stache and paged stache are now methods on this class.
  - **`createPagedStache` invalidate signature**: The `invalidate` function now accepts an optional second `pageArgs` parameter to target a specific page within a variant.
  - **New exports**: `getStacheCache` (retrieve cache from context) and `initStacheCache` (create cache in context) are now exported.

  ### Migration

  ```svelte
  <!-- +layout.svelte -->
  <script>
  	import StacheProvider from 'svelte-stache/StacheProvider.svelte';
  </script>

  <StacheProvider>
  	{@render children()}
  </StacheProvider>
  ```

  ```ts
  // Before
  import { clearAllCaches, invalidateStache } from 'svelte-stache';
  clearAllCaches();
  invalidateStache('my-stache');

  // After
  import { getStacheCache } from 'svelte-stache';
  getStacheCache().clear();
  getStacheCache().invalidateStache('my-stache');
  ```

### Patch Changes

- 8369030: Remove reference to $app/environment so that svelte-stache works without sveltekit

## 0.2.0

### Minor Changes

- a683dce: Add onSuccess and onError callbacks to stache and paged stache
- ffe5fc1: Provide clearAllCaches, invalidateStache.

## 0.1.0

### Minor Changes

- d5ab319: invalidate all variants of a stache if no args passed to invalidate

### Patch Changes

- d5ab319: fix bug with cache cleanup

## 0.0.2

### Patch Changes

- 33decd7: Fix reactivity when params are updated

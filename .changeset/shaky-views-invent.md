---
'svelte-stache': major
---

Store global cache state in Svelte context for safer server-side usage.

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

# Stache

A state management library for Svelte 5, using Svelte runes for reactive data fetching and caching.

## Project Structure

```
src/lib/
├── index.ts                    # Main exports
├── utils.ts                    # Utilities (hashKey)
├── cache.svelte.ts                    # StacheCache class + Svelte context (unified cache)
├── StacheProvider.svelte         # Context provider component (wraps app)
├── core/
│   └── stache.class.svelte.ts  # CoreStache class (base fetch/cache engine)
├── stache/
│   ├── stache.svelte.ts        # Query factory (createStache)
│   └── test/                   # Stache unit tests
├── paged/
│   ├── paged.svelte.ts         # Pagination factory (createPagedStache)
│   └── test/                   # Paged stache unit tests
├── mutation/
│   ├── mutation.svelte.ts      # Mutation factory (createMutation)
│   ├── mutation.class.svelte.ts # Mutation class
│   └── mutation.svelte.test.ts # Mutation tests
├── devtools/
│   ├── index.ts                # Devtools exports
│   ├── StacheDevtools.svelte   # Main devtools component
│   ├── StacheDevtoolsPanel.svelte
│   ├── StacheItem.svelte
│   ├── PagedStacheItem.svelte
│   ├── JsonViewer.svelte
│   └── StatusBadge.svelte
└── docs/                       # Documentation utilities and examples
```

## Main Exports

From `src/lib/index.ts`:

- `createStache` - Create cacheable query definitions
- `createPagedStache` - Create paginated query definitions
- `createMutation` - Create mutation handlers
- `getStacheCache` - Get the `StacheCache` instance from Svelte context
- `initStacheCache` - Create and set a `StacheCache` in Svelte context (used by `StacheProvider`)

Both `createStache` and `createPagedStache` return an `invalidate` function:

- `invalidate(params)` — invalidates the cache entry for those params
- `invalidate()` — invalidates **all** cached entries for that factory instance (all param variants)

`createPagedStache`'s `invalidate` also accepts an optional second `pageArgs` parameter to target a specific page.

Factories hold no reference to a cache. The factory `invalidate` dispatches a `stache:invalidate` event on `window` (`dispatchInvalidation` in `cache.ts`), and each `StacheProvider` listens in a browser-only `$effect` (`listenForInvalidation`) and applies it to its own cache. With a `globalCache` option, `invalidate` applies to that cache directly. During SSR it warns and does nothing. Tests that call `initStacheCache()` without a provider must attach `listenForInvalidation` themselves for the factory `invalidate` to work.

Types exported: `Mutation`, `UseStacheFn`, `CreateStacheFn`, `CreatePagedStacheFn`, `MutationFn`, `Stache`

Library also exports a `./devtools` entrypoint: `StacheDevtools`, `StacheDevtoolsPanel`, `JsonViewer`, `StatusBadge`

## Keeping Docs in Sync

When changing the public API of `createStache`, `createPagedStache`, or `createMutation` (new options, changed defaults, new return properties/status values), update all three doc surfaces in the same change:

- `README.md` — quick reference API blocks (options + return value)
- `src/content/api/*.md` — full docs site pages (e.g. `create-mutation.md`), including the Options sections, Properties table, and an example if the change is significant
- `src/lib/docs/examples/*.svelte` — interactive demo components, if the change affects visible state (e.g. a new status value should get its own `class:` binding, matching the existing pattern for `idle`/`loading`/`error`/`success`)

## Key Concepts

### Context Provider

The library stores cache state in Svelte context for SSR safety. Apps must wrap their root layout with `StacheProvider`:

```svelte
<script>
	import StacheProvider from 'svelte-stache/StacheProvider.svelte';
</script>

<StacheProvider>
	{@render children()}
</StacheProvider>
```

This calls `initStacheCache()` which uses Svelte's `createContext` to provide a `StacheCache` instance to all descendants. Factories (`createStache`, `createPagedStache`) retrieve it via `getStacheCache()`.

A custom `StacheCache` can still be injected per-factory via the `globalCache` option (e.g. for testing).

### Caching

- Cache managed by the `StacheCache` class (`src/lib/cache.svelte.ts`), stored in Svelte context
- `StacheCache` unifies both stache and paged stache caches (previously separate modules)
- Keyed by stache `id` + hashed params (`hashKey`)
- Reference counting for automatic cleanup after `cleanupTime`
- Cache status: `'fresh'` (within staleTime), `'stale'`, or `'empty'`
- `StacheCache` provides methods: `getStache`, `setStache`, `deleteStache`, `invalidateStache`, and paged equivalents

### Stache States

- `fetchStatus`: `'idle' | 'loading' | 'error' | 'success'`
- Derived booleans: `isLoading`, `isError`, `isSuccess`
- `cacheStatus`: `'fresh' | 'stale' | 'empty'`

### Configuration Options

- `staleTime` - Time until data is stale (default: 5 min = 300000 ms)
- `cleanupTime` - Time to keep unused cache entries (default: 5 min)
- `refetchOnStale` - Auto-refetch when stale (default: false)
- `refetchOnWindowFocus` - Refetch on window focus if stale (default: true)
- `retries` - Number of retry attempts on failure (default: 0)
- `isHydratable` - Use Svelte's `hydratable()` for SSR hydration (default: false)

### Promise Interface

`useStache()` returns an object with a thenable interface (`then`, `catch`, `finally`) for use with Svelte's `{#await}` blocks or `await` in async contexts.

## Commands

```bash
pnpm dev                                    # Start dev server
NO_COLOR=true pnpm test --reporter=agent    # Run all tests
pnpm check                                  # Type checking (svelte-check)
pnpm lint                                   # Lint and format check
pnpm build                                  # Build library
```

## Development Notes

- Uses Svelte 5 runes (`$state`, `$state.raw`, `$derived`, `$effect`, `$effect.pre`)
- Uses Svelte's `createContext` for SSR-safe cache storage (no module-level global state)
- Uses `SvelteDate` for reactive timestamp tracking
- Tests use `@vitest/browser` and run in a real browser environment
- Tests provide a `StacheCache` instance via the `globalCache` option (bypasses context requirement)
- Params are hashed with sorted object keys via `hashKey()` for consistent cache lookup
- `$effect.pre()` is used (not `$effect`) for stache lifecycle to run before DOM updates
- `untrack()` wraps mutations inside effects to avoid reactive loops
- `tick()` is used before scheduling cache cleanup to allow re-mounting to cancel it

---

## Svelte MCP Tools

You have access to the Svelte MCP server with comprehensive Svelte 5 and SvelteKit documentation.

### 1. list-sections

Use FIRST to discover available documentation sections. Returns titles, use_cases, and paths.

### 2. get-documentation

Retrieves full documentation for specific sections. Analyze use_cases from list-sections, then fetch ALL relevant sections.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues/suggestions. MUST use when writing Svelte code. Keep calling until no issues remain.

### 4. playground-link

Generates a Svelte Playground link. Ask user first. Never use if code was written to project files.

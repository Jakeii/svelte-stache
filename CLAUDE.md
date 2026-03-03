# Stache

A state management library for Svelte 5 inspired by TanStack Query, using Svelte runes for reactive data fetching and caching.

## Project Structure

```
src/lib/
├── index.ts                    # Main exports
├── utils.ts                    # Utilities (hashKey)
├── core/
│   └── stache.class.svelte.ts  # CoreStache class (base fetch/cache engine)
├── stache/
│   ├── stache.svelte.ts        # Query factory (createStache)
│   ├── cache.svelte.ts         # Global stache cache (SvelteMap)
│   └── test/                   # Stache unit tests
├── paged/
│   ├── paged.svelte.ts         # Pagination factory (createPagedStache)
│   ├── paged-cache.svelte.ts   # Global paged stache cache (3-level SvelteMap)
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

Both `createStache` and `createPagedStache` return an `invalidate` function:

- `invalidate(params)` — invalidates the cache entry for those params
- `invalidate()` — invalidates **all** cached entries for that factory instance (all param variants)

Types exported: `Mutation`, `UseStacheFn`, `CreateStacheFn`, `CreatePagedStacheFn`, `MutationFn`, `Stache`

Library also exports a `./devtools` entrypoint: `StacheDevtools`, `StacheDevtoolsPanel`, `JsonViewer`, `StatusBadge`

## Key Concepts

### Caching

- Global cache keyed by stache `id` + hashed params (`hashKey`)
- Reference counting for automatic cleanup after `cleanupTime`
- Cache status: `'fresh'` (within staleTime), `'stale'`, or `'empty'`
- Custom `globalCache` can be injected (e.g. for localStorage persistence)

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
pnpm dev          # Start dev server
pnpm test         # Run all tests
pnpm test:browser # Run browser tests (vitest browser config)
pnpm check        # Type checking (svelte-check)
pnpm lint         # Lint and format check
pnpm build        # Build library
```

## Development Notes

- Uses Svelte 5 runes (`$state`, `$derived`, `$effect`, `$effect.pre`)
- Uses `SvelteMap` from `svelte/reactivity` for reactive caching
- Uses `SvelteDate` for reactive timestamp tracking
- Tests use `@vitest/browser` and run in a real browser environment
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

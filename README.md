<p align="center">
	<img src="static/stache_logo.svg" alt="Stache Logo" width="128" height="128" />
</p>

# Stache

A state management library for Svelte 5, built with Svelte runes for reactive data fetching, caching, and mutations.

Supports experimental Svelte 5 features like top-level await and hydration, for a seamless experience across client and server rendering.

Use it **instead of** SvelteKit remote functions, or **with** them to add more controlled client-side caching, pagination and mutation state on top.

## Features

- **Define Once, Use Anywhere** - A query is a value you import, with its own `useStache` and `invalidate`. No cache keys to repeat or remember
- **Automatic Caching** - Same parameters reuse cached data
- **Smart Cleanup** - Unused data auto-removed after configurable delay when no longer referenced
- **Stale Management** - Configurable stale times with auto-refetch
- **Pagination Support** - Built-in multi-page fetching and aggregation
- **Mutations** - Handle data modifications with status, retries and lifecycle hooks
- **Window Focus Refetch** - Optionally refresh stale data on focus
- **SSR Hydration** - Await on the server, reuse the result on the client without refetching
- **TypeScript** - Full type safety and inference

## Define Once, Use Anywhere - Reactively

You define a query once with `createStache`. It gives you back the functions you need to work with it, ready to export and import wherever they're needed:

```typescript
// src/lib/queries/user.ts
import { createStache } from 'svelte-stache';

export const { useStache: useUser, invalidate: invalidateUser } = createStache({
	id: 'user',
	fetch: (userId: string) => api.getUser(userId),
	staleTime: 1000 * 60
});
```

Any component can then use the query by importing it. The fetch function, options and cache key all stay in the definition, so call sites can't drift apart:

```svelte
<script lang="ts">
	import { useUser } from '$lib/queries/user';

	const user = useUser(() => ({ params: userId }));
</script>
```

The type of `params` is inferred from the arguments of the fetch function, ensuring type safety at every call site.

`useStache` options are passed as a thunk, meaning you provide a function that returns the options object. This allows staches to reactively update based on changing parameters or other reactive values.

See the [Reactive Queries guide](https://svelte-stache.pages.dev/docs/guides/reactive-queries) for more details on using reactive parameters with `useStache`.

Invalidating works the same way. Import `invalidateUser` and call it, with no key to look up or rebuild:

```typescript
invalidateUser('user-123'); // one user
invalidateUser(); // every cached user
```

Because these are plain functions, TypeScript checks the params at every call site. Renaming or moving a query is a normal refactor, and "find references" shows everywhere it's used.

The underlying key is generated from the stache ID and the parameters you pass to `useStache`. You don't need to manage it manually; it's handled internally to ensure consistent caching and invalidation.

## Installation

```bash
npm install svelte-stache
# or
pnpm add svelte-stache
```

Requires Svelte 5.0.0 or higher.

## Quick Start

### Setup

Stache keeps its cache in Svelte context, so each server request gets its own cache. Wrap your root layout in `StacheProvider`:

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
	import StacheProvider from 'svelte-stache/StacheProvider.svelte';

	let { children } = $props();
</script>

<StacheProvider>
	{@render children()}
</StacheProvider>
```

Because the cache comes from context, `useStache` must be called during component initialisation: at the top level of a component's `<script>`, or in a function called from there. Calling it later, for example in an event handler or `onMount`, throws Svelte's `lifecycle_outside_component` error. `createStache` works anywhere, and the `invalidate` function it returns works anywhere in the browser.

See the [Svelte Context guide](https://svelte-stache.dev/docs/guides/context) for more.

### Basic Query

```svelte
<script lang="ts">
	import { createStache } from 'svelte-stache';

	const { useStache: getUsers, invalidate: invalidateUsers } = createStache({
		id: 'user',
		fetch: async (userId: string) => {
			const res = await fetch(`/api/users/${userId}`);
			return res.json();
		}
	});

	const user = getUsers(() => ({ params: 'user-123' }));
</script>

{#if user.isLoading}
	<p>Loading...</p>
{:else if user.isError}
	<p>Error: {user.error}</p>
{:else if user.data}
	<p>Hello, {user.data.name}!</p>
{/if}
```

### Paginated Query

```svelte
<script lang="ts">
	import { createPagedStache } from 'svelte-stache';

	const { useStache: getPosts } = createPagedStache({
		id: 'posts',
		fetch: async (params, { pageIndex, pageSize }) => {
			const res = await fetch(`/api/posts?page=${pageIndex}&size=${pageSize}`);
			return res.json();
		},
		pageSize: 10,
		getData: (res) => res.items,
		getTotalCount: (res) => res.total
	});

	let pageCount = $state(0);
	const posts = getPosts(() => ({
		params: null,
		pageParams: { pageOffset: 0, pageCount }
	}));
</script>

{#each posts.data ?? [] as post}
	<article>{post.title}</article>
{/each}

{#if posts.hasMore}
	<button onclick={() => pageCount++}>Load more</button>
{/if}
```

### Mutations

```svelte
<script lang="ts">
	import { createMutation } from 'svelte-stache';

	const createPost = createMutation({
		mutationFn: async (data: { title: string }) => {
			const res = await fetch('/api/posts', {
				method: 'POST',
				body: JSON.stringify(data)
			});
			return res.json();
		},
		onSuccess: () => {
			// Invalidate related queries
			postsQuery.invalidate();
		}
	});

	const mutation = createPost();
</script>

<button onclick={() => mutation.mutate({ title: 'New Post' })} disabled={mutation.isLoading}>
	{mutation.isLoading ? 'Creating...' : 'Create Post'}
</button>
```

## API Reference

### createStache

Creates a reusable query definition.

```typescript
const { useStache, invalidate } = createStache({
  id: string,                      // Unique query identifier
  fetch: (params) => Promise<T>,   // Fetch function
  staleTime?: number,              // Time until stale (default: 5 min)
  cleanupTime?: number,            // Cleanup delay when unused (default: 5 min)
  refetchOnStale?: boolean,        // Auto-refetch when stale (default: false)
  refetchOnWindowFocus?: boolean,  // Refetch on window focus (default: true)
  isHydratable?: boolean,          // Reuse SSR result on the client via hydratable() (default: false)
});
```

#### useStache

```typescript
const query = useStache(() => ({
  params: T,                       // Parameters for fetch function
  enabled?: boolean,               // Enable/disable fetching (default: true)
  initialData?: Data,              // Initial data before fetch
}));
```

#### Query Return Value

```typescript
{
  data: T | undefined,             // Fetched data
  error: unknown,                  // Error if fetch failed
  fetchStatus: 'idle' | 'loading' | 'error' | 'success',
  cacheStatus: 'fresh' | 'stale',
  isLoading: boolean,              // fetchStatus === 'loading'
  isError: boolean,                // fetchStatus === 'error'
  isSuccess: boolean,              // fetchStatus === 'success'
  isFetching: boolean,             // Currently fetching
  lastFetched: Date | undefined,   // Last successful fetch time
  invalidate: () => void,          // Force refetch
  then, catch, finally,            // Thenable: `await` resolves once the fetch completes, rejects on error
}
```

### createPagedStache

Creates a paginated query definition.

```typescript
const { useStache, invalidate } = createPagedStache({
  id: string,
  fetch: (params, { pageIndex, pageSize }) => Promise<T>,
  pageSize: number,
  getData: (response) => Item[],      // Extract items from response
  getTotalCount: (response) => number, // Extract total count
  // ...same options as createStache
});
```

#### Paged useStache

```typescript
const query = useStache(() => ({
	params: T,
	pageParams: {
		pageOffset: number, // Starting page index
		pageCount: number // Number of pages to fetch
	}
}));
```

#### Paged Query Return Value

Includes all standard query properties plus:

```typescript
{
  pages: T[],              // Array of page data
  totalCount: number,      // Total items across all pages
  hasMore: boolean,        // More pages available
}
```

### createMutation

Creates a mutation handler.

```typescript
const useMutation = createMutation({
  mutationFn: (params) => Promise<T>,
  beforeMutate?: (params) => void,
  afterMutate?: (params) => void,
  onSuccess?: ({ params, result }) => void,
  onError?: (error) => void,
  retries?: number,        // max retry attempts, default 0
  shouldRetry?: ({ error, attempt, params }) => boolean,
  retryDelay?: number | (({ error, attempt, params }) => number), // ms, default 300
});

const mutation = useMutation({
  // Override or extend callbacks per-instance
  onSuccess?: ({ params, result }) => void,
});
```

#### Mutation Return Value

```typescript
{
  data: T | undefined,     // Mutation result
  error: unknown,          // Error from the last failed attempt (set while retrying, too)
  status: 'idle' | 'loading' | 'retrying' | 'error' | 'success',
  isLoading: boolean,
  isRetrying: boolean,
  isError: boolean,
  isSuccess: boolean,
  mutate: (params) => Promise<T>,
}
```

## Configuration

### Stale Time

Data is considered "fresh" for the duration of `staleTime`. After that, it becomes "stale" and may be refetched based on configuration.

```typescript
createStache({
	staleTime: 1000 * 60 * 5 // 5 minutes (default)
});
```

### Cleanup Time

When no components are using a cached query (reference count reaches 0), it will be removed from cache after `cleanupTime`.

```typescript
createStache({
	cleanupTime: 1000 * 60 * 5 // 5 minutes (default)
});
```

### Window Focus Refetch

Automatically refetch stale data when the browser window regains focus.

```typescript
createStache({
	refetchOnWindowFocus: true // default
});
```

## Stache vs Remote Functions

Stache does much of what SvelteKit [remote functions](https://svelte.dev/docs/kit/remote-functions) do on the client, and more:

| Feature                                           | Remote functions         | Stache                                 |
| ------------------------------------------------- | ------------------------ | -------------------------------------- |
| Deduplicate identical requests                    | ✅                       | ✅                                     |
| `await` in components                             | ✅                       | ✅                                     |
| SSR hydration without a second fetch              | ✅                       | ✅ `isHydratable`                      |
| Keep data after unmount (instant back-navigation) | ❌                       | ✅ `cleanupTime`                       |
| Stale time, refetch on focus / when stale         | ❌                       | ✅ `staleTime`, `refetchOnWindowFocus` |
| Retries for failed fetches                        | ❌                       | ✅ `retries`                           |
| Pagination with per-page caching                  | ❌                       | ✅ `createPagedStache`                 |
| Mutation status, retries and lifecycle hooks      | ❌                       | ✅ `createMutation`                    |
| Invalidate every cached variant at once           | ❌                       | ✅ `invalidate()`                      |
| Cache inspection devtools                         | ❌                       | ✅                                     |
| Any backend, with or without SvelteKit            | ❌ your SvelteKit server | ✅                                     |

They also work well together. A remote `query` or `command` can be used directly as a stache's `fetch` or `mutationFn`:

```typescript
import { createStache, createMutation } from 'svelte-stache';
import { getPost, likePost } from './posts.remote';

export const { useStache: usePost, invalidate: invalidatePost } = createStache({
	id: 'post',
	fetch: (slug: string) => getPost(slug), // remote query
	staleTime: 1000 * 60
});

export const useLikePost = createMutation({
	mutationFn: (slug: string) => likePost(slug), // remote command
	retries: 2,
	onSuccess: ({ params }) => invalidatePost(params)
});
```

Remote functions still do things Stache doesn't, like forms, `query.batch`, `query.live`, single-flight mutations, and the ability to perform server-side only operations. See the [Remote Functions guide](https://svelte-stache.pages.dev/docs/guides/remote-functions) for the full comparison.

## License

MIT

<p align="center">
	<img src="static/stache_logo.svg" alt="Stache Logo" width="128" height="128" />
</p>

# Stache

A state management library for Svelte 5, built with Svelte runes for reactive data fetching, caching, and mutations.

Supports experimental Svelte 5 features like top-level await and hydration, for a seamless experience across client and server rendering.

Can be used with or instead of sveltekit remote functions, making it flexible for various data fetching strategies.

## Features

- **Automatic Caching** - Same parameters reuse cached data
- **Smart Cleanup** - Unused data auto-removed after configurable delay when no longer referenced
- **Stale Management** - Configurable stale times with auto-refetch
- **Pagination Support** - Built-in multi-page fetching and aggregation
- **Mutations** - Handle data modifications with lifecycle hooks
- **Window Focus Refetch** - Optionally refresh stale data on focus
- **TypeScript** - Full type safety and inference

## Installation

```bash
npm install svelte-stache
# or
pnpm add svelte-stache
```

Requires Svelte 5.0.0 or higher.

## Quick Start

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

## License

MIT

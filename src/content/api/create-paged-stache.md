---
title: createPagedStache
description: API reference for creating paginated query definitions
section: API
---

# createPagedStache

Creates a paginated query definition that manages multiple pages of data. Each page is a separate cached instance, enabling per-page caching and independent status tracking.

## Import

```typescript
import { createPagedStache } from 'svelte-stache';
```

## Signature

```typescript
function createPagedStache<Params, PageResult, PageFetchReturn>(
	options: CreatePagedStacheOptions<Params, PageResult, PageFetchReturn>
): {
	useStache: UsePagedStacheFn<Params, PageResult>;
	invalidate: (
		params?: Params,
		pageArgs?: { pageIndex: number; pageSize: number }
	) => Promise<void>;
};
```

## Options

Inherits all options from [`createStache`](/docs/api/create-stache), plus:

### Required Options

#### `pageSize`

**Type:** `number`

The number of items per page. This is passed to your fetch function.

```typescript
createPagedStache({
	id: 'posts',
	pageSize: 20,
	fetch: fetchPosts
});
```

#### `fetch`

**Type:** `(params: Params, pageParams: { pageIndex: number; pageSize: number }) => Promise<PageFetchReturn> | PageFetchReturn`

A function that fetches a single page. Receives both your params and pagination info.

```typescript
createPagedStache({
	id: 'posts',
	pageSize: 20,
	fetch: async (filters, { pageIndex, pageSize }) => {
		const res = await fetch(
			`/api/posts?page=${pageIndex}&size=${pageSize}&category=${filters.category}`
		);
		return res.json();
	}
});
```

### Optional Options

#### `getData`

**Type:** `(response: PageFetchReturn) => PageResult`

Extracts the page data from the API response. Use when your API wraps data in an object.

```typescript
createPagedStache({
	id: 'posts',
	pageSize: 20,
	fetch: fetchPosts,
	// API returns { items: [...], total: 100 }
	getData: (response) => response.items
});
```

#### `getTotalCount`

**Type:** `(response: PageFetchReturn) => number`

Extracts the total count from the API response. Used to calculate `hasMore`. If not provided, falls back to `pages.length * pageSize`.

```typescript
createPagedStache({
	id: 'posts',
	pageSize: 20,
	fetch: fetchPosts,
	getData: (response) => response.items,
	getTotalCount: (response) => response.total
});
```

## Return Value

### `useStache`

A function to use the paginated query in a component.

### `invalidate`

A function to manually invalidate cached pages. Returns a `Promise<void>` that resolves when all invalidated fetches complete.

- **`invalidate()`** — invalidates all pages across every cached param variant
- **`invalidate(params)`** — invalidates all pages for the given params
- **`invalidate(params, pageArgs)`** — invalidates a specific page for the given params, where `pageArgs` is `{ pageIndex: number; pageSize: number }`

## useStache Options

When calling `useStache`, you pass pagination params in addition to regular params:

```typescript
const posts = getPosts(() => ({
	params: { category: 'tech' },
	pageParams: {
		pageOffset: 0,
		pageCount: 3
	}
}));
```

### `params`

**Type:** `Params`

Your custom parameters passed to the fetch function.

### `pageParams`

**Type:** `{ pageOffset: number; pageCount: number }`

Controls which pages to fetch:

- `pageOffset` - The starting page index (0-based, default: 0)
- `pageCount` - How many consecutive pages to fetch (default: 1)

```typescript
// Fetch pages 0, 1, 2
pageParams: { pageOffset: 0, pageCount: 3 }

// Fetch pages 5, 6
pageParams: { pageOffset: 5, pageCount: 2 }
```

### `enabled`

**Type:** `boolean`
**Default:** `true`

Same as `createStache` - controls whether fetching is enabled.

### `initialData`

**Type:** `PageFetchReturn[]`
**Default:** `undefined`

Pre-populate the stache with data before any fetch runs. The data is available immediately on mount — no loading state, no network request. Useful for handing off server-fetched data to the client without a redundant round-trip.

Ignored if a cache entry for these params already exists (i.e. a previous `useStache` call with the same params already populated the cache).

```svelte
<!-- +page.server.ts loads the first two pages, component uses them immediately -->
<script lang="ts">
	let { data } = $props(); // { pages: ApiResponse[], fetchedAt: string }

	const posts = getPosts(() => ({
		params: null,
		pageParams: { pageOffset: 0, pageCount: 3 },
		initialData: data.pages, // pre-populate pages 0 and 1; page 2 fetches normally
		initialDataFetched: new Date(data.fetchedAt)
	}));
</script>

<!-- posts.pages[0] and posts.pages[1] are available immediately -->
{#each posts.data ?? [] as post}
	<article>{post.title}</article>
{/each}
```

### `initialDataFetched`

**Type:** `Date`
**Default:** `new Date()` (when `initialData` is provided)

The timestamp to associate with all pages in `initialData`. Applied uniformly — all pre-populated pages share the same freshness timestamp.

Stache compares this against `staleTime` to decide whether the initial data is still fresh or already stale.

- If the timestamp is within `staleTime`, `cacheStatus` is `'fresh'` and no fetch is triggered for pre-populated pages.
- If the timestamp is older than `staleTime`, `cacheStatus` is `'stale'` and a fetch runs for all pre-populated pages.

```svelte
<script lang="ts">
	let { data } = $props(); // { pages: ApiResponse[], fetchedAt: string }

	const posts = getPosts(() => ({
		params: null,
		pageParams: { pageOffset: 0, pageCount: 2 },
		initialData: data.pages,
		// Pass the server's fetch time — if the page was cached for >5 min,
		// the client will refetch automatically
		initialDataFetched: new Date(data.fetchedAt)
	}));
</script>
```

## Paged Stache Object

Returns all base stache properties, plus pagination-specific ones:

### Pagination Properties

| Property     | Type                        | Description                                                     |
| ------------ | --------------------------- | --------------------------------------------------------------- |
| `data`       | `PageResult \| null`        | All loaded items aggregated (flattened via `.flat()`)           |
| `pages`      | `Array<PageResult \| null>` | Per-page data after `getData()`, null if not yet loaded         |
| `totalCount` | `number`                    | Total items (from `getTotalCount` or `pages.length * pageSize`) |
| `hasMore`    | `boolean`                   | Whether more pages exist (`data.length < totalCount`)           |

### Status Aggregation

Status properties are aggregated across all loaded pages:

- `isLoading` - True if any page is loading
- `isError` - True if any page has an error
- `isSuccess` - True only if all pages succeeded
- `cacheStatus` - `'fresh'` if all pages fresh, `'stale'` if any stale, `'empty'` otherwise

## Examples

### Basic Pagination

```typescript
const { useStache: getPosts } = createPagedStache({
	id: 'posts',
	pageSize: 10,
	fetch: async (_, { pageIndex, pageSize }) => {
		const res = await fetch(`/api/posts?page=${pageIndex}&limit=${pageSize}`);
		return res.json();
	}
});
```

### With API Response Parsing

```typescript
interface ApiResponse {
	data: Post[];
	meta: {
		total: number;
		page: number;
		perPage: number;
	};
}

const { useStache: getPosts } = createPagedStache({
	id: 'posts',
	pageSize: 20,
	fetch: async (filters, { pageIndex, pageSize }): Promise<ApiResponse> => {
		const res = await fetch(
			`/api/posts?page=${pageIndex}&limit=${pageSize}&status=${filters.status}`
		);
		return res.json();
	},
	getData: (response) => response.data,
	getTotalCount: (response) => response.meta.total
});
```

### Infinite Scroll Component

```svelte
<script lang="ts">
	import { getPosts } from '$lib/queries/posts';

	let pageCount = $state(1);

	const posts = getPosts(() => ({
		params: null,
		pageParams: { pageOffset: 0, pageCount }
	}));

	const loadMore = () => {
		if (posts.hasMore && !posts.isLoading) {
			pageCount++;
		}
	};
</script>

<div class="posts">
	{#each posts.data ?? [] as post}
		<article>
			<h2>{post.title}</h2>
			<p>{post.excerpt}</p>
		</article>
	{/each}
</div>

{#if posts.isLoading}
	<div class="loading">Loading...</div>
{/if}

{#if posts.hasMore && !posts.isLoading}
	<button onclick={loadMore}>Load More</button>
{/if}

{#if !posts.hasMore && posts.data?.length}
	<p>No more posts</p>
{/if}
```

### With Filters

```svelte
<script lang="ts">
	import { getPosts } from '$lib/queries/posts';

	let category = $state('all');
	let pageCount = $state(1);

	// Reset page count when category changes
	$effect(() => {
		category; // Track category
		pageCount = 1;
	});

	const posts = getPosts(() => ({
		params: { category },
		pageParams: { pageOffset: 0, pageCount }
	}));
</script>

<select bind:value={category}>
	<option value="all">All Categories</option>
	<option value="tech">Technology</option>
	<option value="design">Design</option>
</select>

<div class="posts">
	{#each posts.data ?? [] as post}
		<article>{post.title}</article>
	{/each}
</div>

{#if posts.hasMore}
	<button onclick={() => pageCount++}>Load More</button>
{/if}
```

### Page Window (Virtualized)

Load a "window" of pages around the current view:

```svelte
<script lang="ts">
	import { getPosts } from '$lib/queries/posts';

	let currentPage = $state(0);
	const windowSize = 3; // Load 3 pages around current

	const posts = getPosts(() => ({
		params: null,
		pageParams: {
			pageOffset: Math.max(0, currentPage - 1),
			pageCount: windowSize
		}
	}));
</script>

<button onclick={() => (currentPage = Math.max(0, currentPage - 1))}> Previous </button>

<span>Page {currentPage + 1}</span>

<button onclick={() => currentPage++} disabled={!posts.hasMore}> Next </button>
```

---
title: Pagination
description: Loading paginated data with infinite scroll
section: Examples
---

<script>
  import PaginationDemo from '#lib/docs/examples/PaginationDemo.svelte';
</script>

# Pagination Example

This example shows how to use `createPagedStache` to implement an infinite scroll pattern with paginated data.

## Live Demo

<PaginationDemo />

## The Code

### Query Definition

Create a paged stache for fetching posts:

```typescript title="src/lib/queries/posts.ts"
import { createPagedStache } from 'svelte-stache';

interface Post {
	id: string;
	title: string;
	excerpt: string;
	author: string;
	category: string;
	publishedAt: string;
	readTime: number;
}

interface PostsResponse {
	data: Post[];
	meta: {
		total: number;
		page: number;
		perPage: number;
		totalPages: number;
	};
}

interface PostFilters {
	category: string | null;
}

export const { useStache: getPosts, invalidate: invalidatePosts } = createPagedStache({
	id: 'posts',
	pageSize: 10,
	fetch: async (filters: PostFilters, { pageIndex, pageSize }): Promise<PostsResponse> => {
		const params = new URLSearchParams({
			page: String(pageIndex),
			limit: String(pageSize)
		});

		if (filters.category && filters.category !== 'all') {
			params.set('category', filters.category);
		}

		const response = await fetch(`/api/posts?${params}`);
		return response.json();
	},
	getData: (response) => response.data,
	getTotalCount: (response) => response.meta.total,
	staleTime: 1000 * 60 * 2 // 2 minutes
});
```

### Component Usage

```svelte title="PostList.svelte"
<script lang="ts">
	import { getPosts } from '#lib/queries/posts';

	let category = $state<string>('all');
	let pageCount = $state(1);

	// Reset page count when category changes
	$effect(() => {
		category; // Track category changes
		pageCount = 1;
	});

	const posts = getPosts(() => ({
		params: { category: category === 'all' ? null : category },
		pageParams: {
			pageOffset: 0,
			pageCount
		}
	}));

	const loadMore = () => {
		if (posts.hasMore && !posts.isLoading) {
			pageCount++;
		}
	};
</script>

<div class="filters">
	<label for="category">Category:</label>
	<select id="category" bind:value={category}>
		<option value="all">All Categories</option>
		<option value="technology">Technology</option>
		<option value="design">Design</option>
		<option value="business">Business</option>
		<option value="lifestyle">Lifestyle</option>
		<option value="science">Science</option>
	</select>
</div>

<div class="stats">
	Showing {posts.data?.length ?? 0} of {posts.totalCount} posts
</div>

<div class="posts-grid">
	{#each posts.data ?? [] as post}
		<article class="post-card">
			<span class="category">{post.category}</span>
			<h3>{post.title}</h3>
			<p>{post.excerpt}</p>
			<div class="post-meta">
				<span>{post.author}</span>
				<span>{post.readTime} min read</span>
			</div>
		</article>
	{/each}
</div>

{#if posts.isLoading}
	<div class="loading">Loading more posts...</div>
{/if}

{#if posts.hasMore && !posts.isLoading}
	<button class="load-more" onclick={loadMore}> Load More Posts </button>
{/if}

{#if !posts.hasMore && posts.data?.length}
	<p class="end-message">You've reached the end!</p>
{/if}
```

## Key Points

1. **Page Aggregation** - All loaded pages are automatically combined into a single `data` array
2. **Total Count** - Use `getTotalCount` to extract the total from your API response
3. **Has More** - The `hasMore` property tells you if there are more pages to load
4. **Filter Reset** - When filters change, reset `pageCount` to start fresh
5. **Loading States** - `isLoading` is true when loading any page

## What to Try

1. **Click "Load More"** - Loads the next page and appends to the list
2. **Change category** - Resets to page 1 and fetches filtered results
3. **Load multiple pages, then change category** - Everything resets cleanly
4. **Watch the stats** - Shows how many posts are loaded vs total

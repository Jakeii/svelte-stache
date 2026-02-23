<script lang="ts">
	import { PUBLIC_API_URL } from '$env/static/public';
	import { createPagedStache } from '$lib/index.js';

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

	const { useStache: getPosts } = createPagedStache({
		id: 'demo-posts',
		pageSize: 5,
		fetch: async (filters: PostFilters, { pageIndex, pageSize }): Promise<PostsResponse> => {
			// eslint-disable-next-line svelte/prefer-svelte-reactivity
			const params = new URLSearchParams({
				page: String(pageIndex),
				limit: String(pageSize)
			});

			if (filters.category) {
				params.set('category', filters.category);
			}

			const response = await fetch(`${PUBLIC_API_URL}/posts?${params}`);
			return response.json();
		},
		getData: (response) => response.data,
		getTotalCount: (response) => response.meta.total,
		staleTime: 1000 * 60 * 2
	});

	let category = $state<string>('all');
	let pageCount = $state(1);

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

<div class="demo-container">
	<div class="controls">
		<div class="filter">
			<label for="category">Category:</label>
			<select
				id="category"
				bind:value={
					() => category,
					(v) => {
						pageCount = 1; // Reset to first page on filter change
						category = v;
					}
				}
			>
				<option value="all">All Categories</option>
				<option value="Technology">Technology</option>
				<option value="Design">Design</option>
				<option value="Business">Business</option>
				<option value="Lifestyle">Lifestyle</option>
				<option value="Science">Science</option>
			</select>
		</div>
		<div class="stats">
			Showing {posts.data?.length ?? 0} of {posts.totalCount ?? 0} posts
		</div>
	</div>

	<div class="posts-list">
		{#each posts.data ?? [] as post (post.id)}
			<article class="post-card">
				<span class="category">{post.category}</span>
				<h4>{post.title}</h4>
				<p class="excerpt">{post.excerpt}</p>
				<div class="post-meta">
					<span class="author">{post.author}</span>
					<span class="read-time">{post.readTime} min read</span>
				</div>
			</article>
		{/each}
	</div>

	{#if posts.isLoading}
		<div class="loading">
			<span class="spinner"></span>
			Loading posts...
		</div>
	{/if}

	{#if posts.hasMore && !posts.isLoading}
		<button class="load-more" onclick={loadMore}>Load More Posts</button>
	{/if}

	{#if !posts.hasMore && (posts.data?.length ?? 0) > 0}
		<p class="end-message">You've reached the end!</p>
	{/if}

	{#if posts.isError}
		<div class="error">
			Error loading posts: {posts.error instanceof Error ? posts.error.message : 'Unknown error'}
		</div>
	{/if}
</div>

<style>
	.demo-container {
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding: 1.5rem;
		background: var(--color-background-secondary, #f9fafb);
	}

	.controls {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.filter {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.filter label {
		font-weight: 500;
		font-size: 0.875rem;
	}

	.filter select {
		padding: 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		background: var(--color-background);
		font-size: 0.875rem;
	}

	.stats {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.posts-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.post-card {
		padding: 1rem;
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: 6px;
	}

	.post-card .category {
		display: inline-block;
		padding: 0.125rem 0.5rem;
		background: var(--color-primary);
		color: white;
		border-radius: 4px;
		font-size: 0.625rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.post-card h4 {
		margin: 0.5rem 0 0.25rem;
		font-size: 0.95rem;
		line-height: 1.3;
	}

	.post-card .excerpt {
		margin: 0;
		font-size: 0.8rem;
		color: var(--color-text-muted);
		line-height: 1.4;
	}

	.post-meta {
		display: flex;
		justify-content: space-between;
		margin-top: 0.75rem;
		font-size: 0.7rem;
		color: var(--color-text-muted);
	}

	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 1rem;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}

	.spinner {
		width: 1rem;
		height: 1rem;
		border: 2px solid var(--color-border);
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.load-more {
		display: block;
		width: 100%;
		padding: 0.75rem;
		margin-top: 1rem;
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
	}

	.load-more:hover {
		opacity: 0.9;
	}

	.end-message {
		text-align: center;
		padding: 1rem;
		color: var(--color-text-muted);
		font-size: 0.875rem;
		margin: 0;
	}

	.error {
		padding: 1rem;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 4px;
		color: #dc2626;
		font-size: 0.875rem;
		margin-top: 1rem;
	}
</style>

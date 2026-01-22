<script lang="ts">
	import { createMutation } from '$lib/index.js';

	interface CreatePostInput {
		title: string;
		content: string;
		category: string;
	}

	interface Post {
		id: string;
		title: string;
		content: string;
		excerpt: string;
		category: string;
		author: string;
		publishedAt: string;
	}

	const useCreatePost = createMutation<CreatePostInput, Post>({
		mutationFn: async (data: CreatePostInput): Promise<Post> => {
			const response = await fetch('/api/posts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});

			if (!response.ok) {
				throw new Error('Failed to create post');
			}

			return response.json();
		}
	});

	const mutation = useCreatePost({
		onSuccess: ({ result }) => {
			title = '';
			content = '';
			category = 'Technology';
			successMessage = `Post "${result.title}" created successfully!`;
			createdPosts = [result, ...createdPosts].slice(0, 3);

			setTimeout(() => (successMessage = ''), 3000);
		}
	});

	let title = $state('');
	let content = $state('');
	let category = $state('Technology');
	let successMessage = $state('');
	let createdPosts = $state<Post[]>([]);

	const handleSubmit = async (e: Event) => {
		e.preventDefault();

		if (!title.trim() || !content.trim()) return;

		await mutation.mutate({
			title: title.trim(),
			content: content.trim(),
			category
		});
	};

	const isValid = $derived(title.trim().length > 0 && content.trim().length > 0);
</script>

<div class="demo-container">
	<form onsubmit={handleSubmit}>
		<div class="field">
			<label for="title">Title</label>
			<input
				id="title"
				type="text"
				bind:value={title}
				placeholder="Enter post title"
				disabled={mutation.isLoading}
			/>
		</div>

		<div class="field">
			<label for="category">Category</label>
			<select id="category" bind:value={category} disabled={mutation.isLoading}>
				<option value="Technology">Technology</option>
				<option value="Design">Design</option>
				<option value="Business">Business</option>
				<option value="Lifestyle">Lifestyle</option>
				<option value="Science">Science</option>
			</select>
		</div>

		<div class="field">
			<label for="content">Content</label>
			<textarea
				id="content"
				bind:value={content}
				placeholder="Write your post content..."
				rows="3"
				disabled={mutation.isLoading}
			></textarea>
		</div>

		{#if mutation.isError}
			<div class="error">
				{mutation.error instanceof Error ? mutation.error.message : 'An error occurred'}
			</div>
		{/if}

		{#if successMessage}
			<div class="success">{successMessage}</div>
		{/if}

		<button type="submit" disabled={mutation.isLoading || !isValid}>
			{#if mutation.isLoading}
				<span class="spinner"></span>
				Creating...
			{:else}
				Create Post
			{/if}
		</button>
	</form>

	<div class="status-bar">
		<span class="status-label">Mutation Status:</span>
		<span
			class="status-value"
			class:idle={mutation.status === 'idle'}
			class:loading={mutation.status === 'loading'}
			class:success={mutation.status === 'success'}
			class:error={mutation.status === 'error'}
		>
			{mutation.status}
		</span>
	</div>

	{#if createdPosts.length > 0}
		<div class="created-posts">
			<h4>Recently Created Posts</h4>
			{#each createdPosts as post}
				<div class="created-post">
					<span class="category-tag">{post.category}</span>
					<span class="post-title">{post.title}</span>
				</div>
			{/each}
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

	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.field label {
		font-size: 0.875rem;
		font-weight: 500;
	}

	.field input,
	.field select,
	.field textarea {
		padding: 0.625rem;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-background);
		font-size: 0.875rem;
		font-family: inherit;
	}

	.field input:focus,
	.field select:focus,
	.field textarea:focus {
		outline: 2px solid var(--color-primary);
		outline-offset: -1px;
	}

	.field input:disabled,
	.field select:disabled,
	.field textarea:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.field textarea {
		resize: vertical;
		min-height: 80px;
	}

	.error {
		padding: 0.75rem;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 6px;
		color: #dc2626;
		font-size: 0.875rem;
	}

	.success {
		padding: 0.75rem;
		background: #dcfce7;
		border: 1px solid #bbf7d0;
		border-radius: 6px;
		color: #16a34a;
		font-size: 0.875rem;
	}

	button[type='submit'] {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: opacity 0.15s;
	}

	button[type='submit']:hover:not(:disabled) {
		opacity: 0.9;
	}

	button[type='submit']:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.spinner {
		width: 1rem;
		height: 1rem;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.status-bar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-border);
		font-size: 0.75rem;
	}

	.status-label {
		color: var(--color-text-muted);
	}

	.status-value {
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-weight: 500;
	}

	.status-value.idle {
		background: #f3f4f6;
		color: #6b7280;
	}

	.status-value.loading {
		background: #dbeafe;
		color: #2563eb;
	}

	.status-value.success {
		background: #dcfce7;
		color: #16a34a;
	}

	.status-value.error {
		background: #fef2f2;
		color: #dc2626;
	}

	.created-posts {
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-border);
	}

	.created-posts h4 {
		margin: 0 0 0.75rem;
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--color-text-muted);
	}

	.created-post {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		margin-bottom: 0.5rem;
		font-size: 0.8rem;
	}

	.category-tag {
		padding: 0.125rem 0.375rem;
		background: var(--color-primary);
		color: white;
		border-radius: 3px;
		font-size: 0.625rem;
		font-weight: 500;
		text-transform: uppercase;
	}

	.post-title {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>

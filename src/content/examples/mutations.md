---
title: Mutations
description: Creating and updating data with mutation handlers
section: Examples
---

<script>
  import MutationsDemo from '#lib/docs/examples/MutationsDemo.svelte';
</script>

# Mutations Example

This example demonstrates how to use `createMutation` to handle form submissions, with loading states and cache invalidation.

## Live Demo

<MutationsDemo />

## The Code

### Mutation Definition

Create a mutation for creating posts:

```typescript title="src/lib/mutations/post.ts"
import { createMutation } from 'svelte-stache';
import { invalidatePosts } from '#lib/queries/posts';

interface CreatePostInput {
	title: string;
	content: string;
	category: string;
}

interface Post {
	id: string;
	title: string;
	content: string;
	category: string;
	author: string;
	publishedAt: string;
}

export const useCreatePost = createMutation({
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
	},
	onSuccess: () => {
		// Invalidate the posts list so it refetches
		invalidatePosts();
	},
	onError: (error) => {
		console.error('Failed to create post:', error);
	}
});
```

### Component Usage

```svelte title="CreatePostForm.svelte"
<script lang="ts">
	import { useCreatePost } from '#lib/mutations/post';

	const mutation = useCreatePost({
		onSuccess: ({ result }) => {
			// Clear form on success
			title = '';
			content = '';
			category = 'Technology';
			successMessage = `Post "${result.title}" created!`;

			// Clear success message after 3 seconds
			setTimeout(() => (successMessage = ''), 3000);
		}
	});

	let title = $state('');
	let content = $state('');
	let category = $state('Technology');
	let successMessage = $state('');

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
		</select>
	</div>

	<div class="field">
		<label for="content">Content</label>
		<textarea
			id="content"
			bind:value={content}
			placeholder="Write your post content..."
			rows="4"
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
		{mutation.isLoading ? 'Creating...' : 'Create Post'}
	</button>
</form>

<div class="status-info">
	<span>Status: {mutation.status}</span>
	{#if mutation.data}
		<span>Last created: {mutation.data.title}</span>
	{/if}
</div>
```

## Key Points

1. **Loading State** - Use `isLoading` to disable form inputs and show progress
2. **Error Handling** - `isError` and `error` provide error feedback
3. **Success Callback** - Use `onSuccess` to clear the form and show confirmation
4. **Cache Invalidation** - Call `invalidatePosts()` to refresh related queries
5. **Instance Callbacks** - Callbacks at mutation definition and usage are both called

## Mutation Lifecycle

```
mutate() called
    ↓
beforeMutate() → mutationFn() → afterMutate()
                      ↓
            ┌────────┴────────┐
         success            error
            ↓                  ↓
       onSuccess()        onError()
```

## What to Try

1. **Fill out the form and submit** - Watch the button text change while loading
2. **Create multiple posts** - Each submission invalidates the cache
3. **Try submitting with empty fields** - The button is disabled until valid
4. **Check the mutation status** - See how it transitions through states

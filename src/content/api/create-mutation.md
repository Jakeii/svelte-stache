---
title: createMutation
description: API reference for creating mutation handlers
section: API
---

# createMutation

Creates a mutation handler for modifying data. Mutations are used for create, update, and delete operations.

## Import

```typescript
import { createMutation } from 'svelte-stache';
```

## Signature

```typescript
function createMutation<Params, Result>(
	options: MutationOptions<Params, Result>
): (instanceOptions?: MutationInstanceOptions<Params, Result>) => Mutation<Params, Result>;
```

## Options

### Required Options

#### `mutationFn`

**Type:** `(params: Params) => Promise<Result>`

The async function that performs the mutation.

```typescript
createMutation({
	mutationFn: async (data: CreatePostInput) => {
		const res = await fetch('/api/posts', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data)
		});
		return res.json();
	}
});
```

### Optional Options

#### `beforeMutate`

**Type:** `(params: Params) => void | Promise<void>`

Called before the mutation executes. Useful for optimistic updates.

```typescript
createMutation({
	mutationFn: createPost,
	beforeMutate: (data) => {
		console.log('About to create post:', data.title);
	}
});
```

#### `afterMutate`

**Type:** `(params: Params) => void | Promise<void>`

Called after the mutation completes (success or failure). Useful for cleanup.

```typescript
createMutation({
	mutationFn: createPost,
	afterMutate: (data) => {
		console.log('Mutation completed for:', data.title);
	}
});
```

#### `onSuccess`

**Type:** `(context: { params: Params; result: Result }) => void`

Called when the mutation succeeds. Common use case: invalidate related queries.

```typescript
createMutation({
	mutationFn: createPost,
	onSuccess: ({ params, result }) => {
		console.log('Created post:', result.id);
		// Invalidate posts list to refetch
		invalidatePosts();
	}
});
```

#### `onError`

**Type:** `(error: unknown) => void`

Called when the mutation fails.

```typescript
createMutation({
	mutationFn: createPost,
	onError: (error) => {
		console.error('Failed to create post:', error);
		showToast('Failed to create post');
	}
});
```

## Return Value

`createMutation` returns a factory function. Call it to create a mutation instance:

```typescript
const useCreatePost = createMutation({ ... });

// In a component:
const mutation = useCreatePost();
```

### Instance Options

When creating a mutation instance, you can override or extend callbacks:

```typescript
const mutation = useCreatePost({
	onSuccess: ({ result }) => {
		// This runs IN ADDITION to the base onSuccess
		goto(`/posts/${result.id}`);
	},
	onError: (error) => {
		// This runs IN ADDITION to the base onError
		showErrorDialog(error);
	}
});
```

## Mutation Object

The mutation instance with reactive properties and methods:

### Properties

| Property    | Type                                          | Description                      |
| ----------- | --------------------------------------------- | -------------------------------- |
| `status`    | `'idle' \| 'loading' \| 'error' \| 'success'` | Current mutation status          |
| `isLoading` | `boolean`                                     | True while mutation is executing |
| `isError`   | `boolean`                                     | True if mutation failed          |
| `isSuccess` | `boolean`                                     | True if mutation succeeded       |
| `data`      | `Result \| null`                              | The mutation result              |
| `error`     | `unknown`                                     | Error if mutation failed         |

### Methods

#### `mutate(params)`

**Type:** `(params: Params) => Promise<Result>`

Execute the mutation. Returns a promise that resolves to the result.

```typescript
await mutation.mutate({ title: 'New Post', content: '...' });
```

## Examples

### Basic Create

```typescript
import { createMutation } from 'svelte-stache';

interface CreatePostInput {
	title: string;
	content: string;
}

interface Post {
	id: string;
	title: string;
	content: string;
	createdAt: string;
}

const useCreatePost = createMutation({
	mutationFn: async (data: CreatePostInput): Promise<Post> => {
		const res = await fetch('/api/posts', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data)
		});
		if (!res.ok) throw new Error('Failed to create post');
		return res.json();
	}
});

export { useCreatePost };
```

### With Cache Invalidation

```typescript
import { createMutation } from 'svelte-stache';
import { invalidatePosts } from './posts-query';

const useCreatePost = createMutation({
	mutationFn: createPostApi,
	onSuccess: () => {
		// Refetch the posts list after creating a new post
		invalidatePosts();
	}
});
```

### Form Component

```svelte
<script lang="ts">
	import { useCreatePost } from '$lib/mutations/post';
	import { goto } from '$app/navigation';

	const mutation = useCreatePost({
		onSuccess: ({ result }) => {
			goto(`/posts/${result.id}`);
		}
	});

	let title = $state('');
	let content = $state('');

	const handleSubmit = async (e: Event) => {
		e.preventDefault();
		await mutation.mutate({ title, content });
	};
</script>

<form onsubmit={handleSubmit}>
	<div>
		<label for="title">Title</label>
		<input id="title" bind:value={title} required />
	</div>

	<div>
		<label for="content">Content</label>
		<textarea id="content" bind:value={content} required></textarea>
	</div>

	{#if mutation.isError}
		<div class="error">
			{mutation.error instanceof Error ? mutation.error.message : 'An error occurred'}
		</div>
	{/if}

	<button type="submit" disabled={mutation.isLoading}>
		{mutation.isLoading ? 'Creating...' : 'Create Post'}
	</button>
</form>
```

### Update Mutation

```typescript
const useUpdatePost = createMutation({
	mutationFn: async ({ id, ...data }: UpdatePostInput) => {
		const res = await fetch(`/api/posts/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data)
		});
		return res.json();
	},
	onSuccess: ({ params }) => {
		// Invalidate the specific post
		invalidatePost(params.id);
		// Also invalidate the list
		invalidatePosts();
	}
});
```

### Delete with Confirmation

```svelte
<script lang="ts">
	import { useDeletePost } from '$lib/mutations/post';

	let { postId } = $props();

	const mutation = useDeletePost({
		onSuccess: () => {
			goto('/posts');
		}
	});

	const handleDelete = async () => {
		if (confirm('Are you sure you want to delete this post?')) {
			await mutation.mutate(postId);
		}
	};
</script>

<button onclick={handleDelete} disabled={mutation.isLoading} class="delete-btn">
	{mutation.isLoading ? 'Deleting...' : 'Delete Post'}
</button>
```

### Optimistic Updates

```typescript
const useToggleLike = createMutation({
	mutationFn: async (postId: string) => {
		const res = await fetch(`/api/posts/${postId}/like`, { method: 'POST' });
		return res.json();
	},
	beforeMutate: (postId) => {
		// Optimistically update the UI
		// (You might use a store or context for this)
		updatePostLikeStatus(postId, true);
	},
	onError: (error) => {
		// Revert on error
		updatePostLikeStatus('unknown', false);
		showToast('Failed to like post');
	}
});
```

### Multiple Mutations in One Component

```svelte
<script lang="ts">
	import { useCreatePost, useUpdatePost, useDeletePost } from '$lib/mutations/post';

	const createMutation = useCreatePost();
	const updateMutation = useUpdatePost();
	const deleteMutation = useDeletePost();

	// Each mutation has independent state
	const isAnyLoading = $derived(
		createMutation.isLoading || updateMutation.isLoading || deleteMutation.isLoading
	);
</script>
```

---
title: Basic Fetch
description: A simple example of fetching and displaying user data
section: Examples
---

<script>
  import BasicFetchDemo from '#lib/docs/examples/BasicFetchDemo.svelte';
</script>

# Basic Fetch Example

This example demonstrates the core functionality of `createStache`: fetching data, handling loading states, and displaying the result.

## Live Demo

<BasicFetchDemo />

## The Code

### Query Definition

First, create a stache definition for fetching user data:

```typescript title="src/lib/queries/user.ts"
import { createStache } from 'svelte-stache';

interface User {
	id: string;
	name: string;
	email: string;
	role: string;
	avatar: string;
	bio?: string;
	department?: string;
	location?: string;
}

export const { useStache: getUser, invalidate: invalidateUser } = createStache({
	id: 'user',
	fetch: async (userId: string): Promise<User> => {
		const response = await fetch(`/api/users/${userId}`);
		if (!response.ok) {
			throw new Error('Failed to fetch user');
		}
		return response.json();
	},
	staleTime: 1000 * 60 * 5, // 5 minutes
	refetchOnWindowFocus: true
});
```

### Component Usage

Use the query in a Svelte component:

```svelte title="UserProfile.svelte"
<script lang="ts">
	import { getUser, invalidateUser } from '#lib/queries/user';

	let userId = $state('user-1');

	// The query automatically fetches when userId changes
	const user = getUser(() => ({
		params: userId
	}));
</script>

<div class="user-selector">
	<label for="user-select">Select User:</label>
	<select id="user-select" bind:value={userId}>
		<option value="user-1">Alice Johnson</option>
		<option value="user-2">Bob Smith</option>
		<option value="user-3">Carol Williams</option>
		<option value="user-4">David Brown</option>
		<option value="user-5">Eva Martinez</option>
	</select>
</div>

{#if user.isLoading}
	<div class="loading">
		<span class="spinner"></span>
		Loading user...
	</div>
{:else if user.isError}
	<div class="error">
		Error: {user.error instanceof Error ? user.error.message : 'Unknown error'}
	</div>
{:else if user.data}
	<div class="profile-card">
		<img src={user.data.avatar} alt={user.data.name} class="avatar" />
		<div class="info">
			<h2>{user.data.name}</h2>
			<p class="role">{user.data.role}</p>
			<p class="email">{user.data.email}</p>
			{#if user.data.bio}
				<p class="bio">{user.data.bio}</p>
			{/if}
		</div>
	</div>

	<div class="meta">
		<span class="status" class:fresh={user.cacheStatus === 'fresh'}>
			Cache: {user.cacheStatus}
		</span>
		<button onclick={() => user.invalidate()}> Refresh </button>
	</div>
{/if}
```

## Key Points

1. **Reactive Parameters** - When `userId` changes, the stache automatically fetches the new user
2. **Cache Sharing** - If you switch back to a previously loaded user, the cached data is shown immediately
3. **Loading States** - Use `isLoading`, `isError`, and `isSuccess` to handle different states
4. **Manual Refresh** - Call `invalidate()` to force a refetch
5. **Cache Status** - Check `cacheStatus` to know if data is `fresh` or `stale`

## What to Try

1. **Select different users** - Notice how the first load shows a spinner, but cached users appear instantly
2. **Click "Refresh"** - Forces a refetch even if the data is fresh
3. **Switch away and back** - Previously loaded users are served from cache
4. **Wait for data to become stale** - After 5 minutes, the cache status changes to "stale"

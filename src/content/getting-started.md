---
title: Getting Started
description: Install and start using Stache in your project
section: Overview
---

# Getting Started

This guide will walk you through installing Stache and creating your first query.

## Installation

Install Stache using your preferred package manager:

```bash
npm install svelte-stache
```

```bash
pnpm add svelte-stache
```

```bash
yarn add svelte-stache
```

## Setup

Stache stores its cache in Svelte context for SSR safety. Wrap your root layout with the `StacheProvider` provider:

```svelte title="src/routes/+layout.svelte"
<script lang="ts">
	import StacheProvider from 'svelte-stache/StacheProvider.svelte';

	let { children } = $props();
</script>

<StacheProvider>
	{@render children()}
</StacheProvider>
```

This creates a `StacheCache` instance that all stache factories share. Without this wrapper, `createStache` and `createPagedStache` will fail to find the cache context.

Because the cache comes from context, `useStache` must be called during component initialisation: at the top level of a component's `<script>`, or in a function called from there. Calling it from an event handler or `onMount` throws Svelte's `lifecycle_outside_component` error. See the [Svelte Context guide](/docs/guides/context) for patterns that work.

## Your First Query

Let's create a simple query that fetches user data from an API.

### 1. Create a Stache Definition

First, define your query using `createStache`. This is typically done in a shared module, so any component can import the query and its `invalidate` function. The fetch logic, options and cache key are written once, here:

```typescript title="src/lib/queries/user.ts"
import { createStache } from 'svelte-stache';

interface User {
	id: string;
	name: string;
	email: string;
}

export const { useStache: getUser, invalidate: invalidateUser } = createStache({
	id: 'user',
	fetch: async (userId: string): Promise<User> => {
		const response = await fetch(`/api/users/${userId}`);
		if (!response.ok) throw new Error('Failed to fetch user');
		return response.json();
	}
});
```

### 2. Use in a Component

Now use the query in your Svelte component:

```svelte title="src/routes/profile/+page.svelte"
<script lang="ts">
	import { getUser } from '$lib/queries/user';

	let { data } = $props();

	const user = getUser(() => ({ params: data.userId }));
</script>

{#if user.isLoading}
	<div class="loading">Loading user...</div>
{:else if user.isError}
	<div class="error">
		Error: {user.error instanceof Error ? user.error.message : 'Unknown error'}
	</div>
{:else if user.data}
	<div class="profile">
		<h1>{user.data.name}</h1>
		<p>{user.data.email}</p>
	</div>
{/if}
```

## Understanding the Return Value

The `useStache` function returns an object with reactive properties:

```typescript
const user = getUser(() => ({ params: 'user-123' }));

// Data
user.data; // The fetched data (or undefined)
user.error; // Error if fetch failed

// Status flags
user.isLoading; // True while fetching
user.isError; // True if fetch failed
user.isSuccess; // True if fetch succeeded

// Cache information
user.fetchStatus; // 'idle' | 'loading' | 'error' | 'success'
user.cacheStatus; // 'fresh' | 'stale' | 'empty'
user.lastFetched; // Date of last successful fetch

// Actions
user.invalidate(); // Force a refetch
```

## Reactive Parameters

Parameters can be reactive. When they change, a new fetch is triggered:

```svelte
<script lang="ts">
	import { getUser } from '$lib/queries/user';

	let userId = $state('user-1');

	// Automatically refetches when userId changes
	const user = getUser(() => ({ params: userId }));
</script>

<select bind:value={userId}>
	<option value="user-1">User 1</option>
	<option value="user-2">User 2</option>
</select>

<p>Current user: {user.data?.name ?? 'Loading...'}</p>
```

## Configuration Options

Customize caching behavior when creating a stache:

```typescript
const { useStache } = createStache({
	id: 'user',
	fetch: fetchUser,

	// Time until data is considered stale (default: 5 minutes)
	staleTime: 1000 * 60 * 5,

	// Time to keep unused data in cache (default: 5 minutes)
	cleanupTime: 1000 * 60 * 5,

	// Auto-refetch when data becomes stale
	refetchOnStale: false,

	// Refetch when window regains focus (default: true)
	refetchOnWindowFocus: true
});
```

## Next Steps

Now that you have the basics, explore more features:

- [createStache API](/docs/api/create-stache) - Full API reference
- [createPagedStache](/docs/api/create-paged-stache) - Paginated queries
- [createMutation](/docs/api/create-mutation) - Data mutations
- [Examples](/docs/examples/basic-fetch) - Working examples

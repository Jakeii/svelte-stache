---
title: Introduction
description: A state management library for Svelte 5 inspired by TanStack Query, using runes for reactive data fetching and caching.
section: Overview
---

# Stache

A state management library for Svelte 5 inspired by [TanStack Query](https://tanstack.com/query), built with Svelte runes for reactive data fetching, caching, and mutations.

Supports experimental Svelte 5 features like top-level await and hydration, providing a seamless experience across client and server rendering.

Can be used with or instead of sveltekit remote functions, making it flexible for various data fetching strategies.

## Why Stache?

Data fetching in modern web applications involves more than just making API calls. You need to handle:

- **Caching** - Avoid redundant network requests
- **Loading states** - Show feedback while fetching
- **Error handling** - Gracefully handle failures
- **Stale data** - Know when to refetch
- **Memory management** - Clean up unused data

Stache handles all of this with a simple, declarative API that feels natural in Svelte.

## Core Concepts

### Stache

A "stache" (short for cache + state) represents a cached piece of server data. Each stache is identified by a unique ID and parameters, and automatically manages its lifecycle.

```typescript
const { useStache } = createStache({
	id: 'user',
	fetch: (userId) => api.getUser(userId)
});

const user = useStache(() => ({ params: 'user-123' }));
// user.data, user.isLoading, user.error, etc.
```

### Automatic Caching

When multiple components request the same data (same ID + params), they share a single stache instance. No duplicate requests, no wasted memory.

### Reference Counting

Staches track how many components are using them. When a component unmounts, the reference count decreases. When it reaches zero, the stache schedules cleanup after a configurable delay.

### Cache Status

Data transitions through states:

- **Fresh** - Recently fetched, within `staleTime`
- **Stale** - Older than `staleTime`, may need refresh

## Main Exports

Stache provides three main functions:

| Function            | Purpose                                         |
| ------------------- | ----------------------------------------------- |
| `createStache`      | Create cacheable query definitions              |
| `createPagedStache` | Create paginated query definitions              |
| `createMutation`    | Create mutation handlers for data modifications |

## Quick Example

```svelte
<script lang="ts">
	import { createStache } from 'svelte-stache';

	const { useStache: getUser } = createStache({
		id: 'user',
		fetch: async (id: string) => {
			const res = await fetch(`/api/users/${id}`);
			return res.json();
		}
	});

	const user = getUser(() => ({ params: 'user-123' }));
</script>

{#if user.isLoading}
	<p>Loading...</p>
{:else if user.isError}
	<p>Error: {user.error}</p>
{:else}
	<h1>Hello, {user.data.name}!</h1>
{/if}
```

## Setup

Stache requires a context provider at the root of your app to initialize its cache:

```svelte title="src/routes/+layout.svelte"
<script lang="ts">
	import StacheProvider from 'svelte-stache/StacheProvider.svelte';

	let { children } = $props();
</script>

<StacheProvider>
	{@render children()}
</StacheProvider>
```

This stores the cache in Svelte context, ensuring each server request gets its own cache instance. See [Getting Started](/docs/getting-started) for more details.

## Requirements

- Svelte 5.0.0 or higher
- A modern browser or Node.js environment

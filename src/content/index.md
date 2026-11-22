---
title: Introduction
description: A state management library for Svelte 5, using runes for reactive data fetching and caching.
section: Overview
---

# Stache

A state management library for Svelte 5, built with Svelte runes for reactive data fetching, caching, and mutations.

Supports experimental Svelte 5 features like top-level await and hydration, providing a seamless experience across client and server rendering.

## Why Stache?

Data fetching in modern web applications involves more than just making API calls. You need to handle:

- **Caching** - Avoid redundant network requests
- **Reactive** - Automatically refetch when query parameters change
- **Type safety** - Parameter and return types are inferred from your fetch function and checked at every call site.
- **Loading states** - Show feedback while fetching
- **Error handling** - Gracefully handle failures
- **Stale data** - Know when to refetch
- **Memory management** - Clean up unused data
- **Server-side rendering** - Fetch on the server and hydrate on the client without refetching ([guide](/docs/guides/ssr))

Stache handles all of this with a simple, declarative API that feels natural in Svelte.

## Define Once, Use Anywhere

A query in Stache is defined once and then imported wherever you need it. `createStache` returns the functions you use to work with that query:

```typescript title="src/lib/queries/user.ts"
import { createStache } from 'svelte-stache';

export const { useStache: useUser, invalidate: invalidateUser } = createStache({
	id: 'user',
	fetch: (userId: string) => api.getUser(userId),
	staleTime: 1000 * 60
});
```

This gives you:

- **One source of truth.** The fetch function, options and cache key live in the definition. Every component that imports `useUser` gets the same behaviour and shares the same cache.
- **Invalidation without keys.** Call `invalidateUser('user-123')` for one entry, or `invalidateUser()` for all of them. You never need to look up or rebuild a cache key.
- **Type safety everywhere.** Params and return types are inferred from your fetch function and available at every call site, including invalidation.
- **Easy refactoring.** A query is a normal export, so "find references", rename and move work as they do for any other code.

```svelte
<script lang="ts">
	import { useUser, invalidateUser } from '$lib/queries/user';

	const user = useUser(() => ({ params: userId }));
</script>

<button onclick={() => invalidateUser(userId)}>Refresh</button>
```

## Core Concepts

### Stache

A "stache" represents a cached piece of server data. Each stache is identified by a unique ID and parameters, and automatically manages its lifecycle.

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

This stores the cache in Svelte context, ensuring each server request gets its own cache instance. It also means `useStache` has to be called during component initialisation. See [Getting Started](/docs/getting-started) for more details, and the [Svelte Context guide](/docs/guides/context) for where each part of the API can be used.

## Stache and Remote Functions

Stache covers much of what SvelteKit [remote functions](https://svelte.dev/docs/kit/remote-functions) do on the client: deduplicated requests, `await` in components, and SSR hydration with no second fetch. It also adds things remote functions don't have:

- **Data that outlives the component.** Cached results survive navigation, so going back to a page renders immediately.
- **Stale time and refetching.** `fresh` / `stale` status, refetch on window focus, and refetch on stale.
- **Pagination.** Per-page caching with `hasMore` and `totalCount`.
- **Mutation state.** Loading, error and retrying status, retries, and lifecycle hooks.
- **Invalidate everything at once.** Refresh every cached variant of a query with one call.
- **Any backend.** Works with any async function, with or without SvelteKit.

Use it **instead of** remote functions, or **with** them by calling a remote `query` or `command` from a stache. See the [Remote Functions guide](/docs/guides/remote-functions) for a full comparison.

## Requirements

- Svelte 5.0.0 or higher
- A modern browser or Node.js environment

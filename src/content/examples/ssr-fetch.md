---
title: SSR Fetch
description: Server-render user data by awaiting a stache, then hydrate on the client
section: Examples
---

<script>
  import SSRFetchDemo from '$lib/docs/examples/SSRFetchDemo.svelte';
</script>

# SSR Fetch Example

This example builds on [Basic Fetch](/docs/examples/basic-fetch), but awaits the stache so the data is fetched on the server and included in the initial HTML. With `isHydratable` enabled, the client reuses the server result instead of fetching again.

For background and caveats, see the [SSR guide](/docs/guides/ssr).

## Live Demo

<SSRFetchDemo />

## Prerequisites

Awaiting in a component's `<script>` needs Svelte's experimental async support:

```javascript title="svelte.config.js"
const config = {
	compilerOptions: {
		experimental: {
			async: true
		}
	}
};
```

## The Code

### Query Definition

Same as the basic example, with `isHydratable: true` added:

```typescript title="src/lib/queries/user.ts"
import { createStache } from 'svelte-stache';
import { PUBLIC_API_URL } from '$env/static/public';

interface User {
	id: string;
	name: string;
	email: string;
	role: string;
	avatar: string;
	bio?: string;
}

export const { useStache: getUser, invalidate: invalidateUser } = createStache({
	id: 'user',
	fetch: async (userId: string): Promise<User> => {
		// Absolute URL: the global fetch can't resolve relative URLs on the server
		const response = await fetch(`${PUBLIC_API_URL}/users/${userId}`);
		if (!response.ok) {
			throw new Error('Failed to fetch user');
		}
		return response.json();
	},
	staleTime: 1000 * 60 * 5, // 5 minutes
	isHydratable: true
});
```

### Component Usage

`await` the result of `getUser`. Rendering waits for the first fetch, so `user.data` is already populated on the server:

```svelte title="UserProfile.svelte"
<script lang="ts">
	import { getUser } from '$lib/queries/user';

	let userId = $state('user-1');

	// Waits for the first fetch, during SSR and on the client
	const user = await getUser(() => ({
		params: userId
	}));
</script>

<select bind:value={userId}>
	<option value="user-1">Alice Johnson</option>
	<option value="user-2">Bob Smith</option>
	<option value="user-3">Carol Williams</option>
</select>

{#if !user.data && user.isLoading}
	<p>Loading user...</p>
{:else if user.isError}
	<p>Error: {user.error instanceof Error ? user.error.message : 'Unknown error'}</p>
{:else if user.data}
	<div class="profile-card">
		<img src={user.data.avatar} alt={user.data.name} />
		<h2>{user.data.name}</h2>
		<p>{user.data.role}</p>
	</div>
{/if}

<button onclick={() => user.invalidate()}>Refresh</button>
```

## Key Points

1. **Await the stache** - `useStache()` returns a thenable, so `await getUser(...)` resolves once the first fetch completes
2. **No initial loading state** - The server renders the data straight into the HTML, so there's no spinner on first paint
3. **Hydration without refetching** - `isHydratable` serializes the server result (via `hydratable()` and devalue) so the client doesn't fetch again
4. **Still reactive** - After the first await, `user` behaves like a normal stache: changing `userId` fetches the new user and updates `isLoading`, `data`, and `cacheStatus`
5. **Serializable data** - The fetch return value must be serializable by [devalue](https://github.com/Rich-Harris/devalue)

## What to Try

1. **View the page source** - The profile card is already in the server-rendered HTML
2. **Check the network tab on reload** - No request to `/api/users/user-1` is made from the browser
3. **Select a different user** - Later fetches happen on the client, with a loading state
4. **Click "Refresh"** - Forces a client-side refetch

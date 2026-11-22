---
title: Svelte Context
description: Where staches can be used, and how to avoid the lifecycle_outside_component error
section: Guides
---

# Svelte Context

Stache keeps its cache in [Svelte context](https://svelte.dev/docs/svelte/context), provided by `StacheProvider`. On the server this gives every request its own cache, so one user's data is never served to another.

The trade-off is that Svelte context can only be read while a component is initialising. This guide covers what that means for where you call each part of the API.

## What Needs a Component

| Call                                 | Where it can run                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| `createStache` / `createPagedStache` | Anywhere, including the top level of a module                                   |
| `useStache`                          | During component initialisation                                                 |
| `await` a stache for SSR             | In a component's `<script>`                                                     |
| Factory `invalidate()`               | Anywhere in the browser, e.g. event handlers, mutation callbacks, other modules |
| Instance `query.invalidate()`        | Anywhere you have the query object                                              |

`createStache` doesn't touch the cache until `useStache` is called, so you can define staches in shared modules and import them wherever you need them.

## The `lifecycle_outside_component` Error

`useStache` reads the cache from context. If it runs anywhere other than component initialisation, it throws:

```text
Staches can only be used during component initialisation as it depends on svelte context
https://svelte.dev/e/lifecycle_outside_component
```

If the component isn't inside a `StacheProvider`, you'll see `Staches can only be used within a component wrapped by StacheProvider` instead.

Component initialisation means the top level of a component's `<script>`, or a function that is called synchronously from there. These all happen too late:

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import { getUser } from '$lib/queries/user';

	// ✅ Top level of the script
	const user = getUser(() => ({ params: userId }));

	// ❌ Event handler: runs after the component has initialised
	const onclick = () => {
		const other = getUser(() => ({ params: 'user-2' }));
	};

	// ❌ onMount, setTimeout, .then() callbacks and so on
	onMount(() => {
		const other = getUser(() => ({ params: 'user-2' }));
	});
</script>
```

If you need a query that only runs after some user action, call `useStache` at the top level and control it with reactive params and `enabled`:

```svelte
<script lang="ts">
	let selectedId = $state<string | undefined>();

	const user = getUser(() => ({
		params: selectedId,
		enabled: selectedId !== undefined
	}));
</script>

<button onclick={() => (selectedId = 'user-2')}>Load user 2</button>
```

## Using Staches in Module Functions

`useStache` doesn't have to be called directly in a component. It works inside any function, as long as that function is called during component initialisation. This lets you group related queries into a reusable function:

```typescript title="src/lib/queries/profile.ts"
import { getUser } from './user';
import { getPosts } from './posts';

export const useProfile = (getUserId: () => string) => {
	const user = getUser(() => ({ params: getUserId() }));
	const posts = getPosts(() => ({ params: { authorId: getUserId() } }));

	return { user, posts };
};
```

```svelte title="Profile.svelte"
<script lang="ts">
	import { useProfile } from '$lib/queries/profile';

	let { userId } = $props();

	// Called during initialisation, so the useStache calls inside can read context
	const { user, posts } = useProfile(() => userId);
</script>
```

Pass params as a getter (`() => userId`) rather than a value, so the queries stay reactive when the prop changes.

## Awaiting for SSR

For [server-side rendering](/docs/guides/ssr), a stache has to be awaited so the server waits for its data before rendering. Do the `await` in the component's `<script>`.

If a module function creates the stache, return it without awaiting and let the component await it:

```typescript title="src/lib/queries/profile.ts"
export const useProfileUser = (getUserId: () => string) => {
	// Return the stache itself, not an awaited value
	return getUser(() => ({ params: getUserId() }));
};
```

```svelte title="Profile.svelte"
<script lang="ts">
	import { useProfileUser } from '$lib/queries/profile';

	let { userId } = $props();

	const user = await useProfileUser(() => userId);
</script>

<h1>{user.data?.name}</h1>
```

Awaiting resolves to the stache itself, so `user` stays reactive after the first fetch.

When you await more than one stache, create them all before the first `await`. Every `useStache` call then happens during initialisation, and the fetches run in parallel instead of one after another:

```svelte
<script lang="ts">
	// Both fetches start here
	const user = getUser(() => ({ params: userId }));
	const posts = getPosts(() => ({ params: { authorId: userId } }));

	await Promise.all([user, posts]);
</script>
```

## Invalidating From Anywhere

The `invalidate` function returned by `createStache` doesn't need a component, so you can call it from event handlers, mutation callbacks or plain modules:

```typescript
import { createMutation } from 'svelte-stache';
import { invalidateUser } from '$lib/queries/user';

export const useUpdateUser = createMutation({
	mutationFn: (user: { id: string; name: string }) => api.updateUser(user),
	onSuccess: ({ params }) => invalidateUser(params.id)
});
```

### Not During SSR

Having invalidate work outside of components relies on browser-only APIs. During SSR, there is no browser environment to listen for these events, so calling `invalidate` on the server will do nothing and log a warning.

You shouldn't ever need to call `invalidate` during SSR anyway.

---
title: Server-Side Rendering
description: Fetching data on the server and hydrating it on the client
section: Guides
---

# Server-Side Rendering

Stache works with SvelteKit's server-side rendering. By awaiting a stache and enabling `isHydratable`, data is fetched on the server, rendered into the initial HTML, and reused on the client without a second request.

See the [SSR Fetch example](/docs/examples/ssr-fetch) for a live demo.

## Request-Isolated Cache

The cache lives in Svelte context, not in module-level state. Wrapping your root layout in `StacheProvider` gives every server request its own `StacheCache`, so cached data is never shared between users:

```svelte title="src/routes/+layout.svelte"
<script lang="ts">
	import StacheProvider from 'svelte-stache/StacheProvider.svelte';

	let { children } = $props();
</script>

<StacheProvider>
	{@render children()}
</StacheProvider>
```

See the [Caching guide](/docs/guides/caching) for more on how the cache works.

## Enabling Async Svelte

Awaiting in a component's `<script>` relies on Svelte's experimental async support:

```javascript title="svelte.config.js"
const config = {
	compilerOptions: {
		experimental: {
			async: true
		}
	}
};
```

## Fetching on the Server

Set `isHydratable: true` on the stache definition:

```typescript title="src/lib/queries/user.ts"
import { createStache } from 'svelte-stache';
import { PUBLIC_API_URL } from '$env/static/public';

export const { useStache: getUser } = createStache({
	id: 'user',
	fetch: async (userId: string) => {
		const response = await fetch(`${PUBLIC_API_URL}/users/${userId}`);
		if (!response.ok) {
			throw new Error('Failed to fetch user');
		}
		return response.json();
	},
	isHydratable: true
});
```

Then `await` the result of `useStache` in your component:

```svelte title="UserProfile.svelte"
<script lang="ts">
	import { getUser } from '$lib/queries/user';

	let { userId } = $props();

	const user = await getUser(() => ({
		params: userId
	}));
</script>

<h1>{user.data?.name}</h1>
```

`useStache` returns a thenable, so `await` resolves once the first fetch completes. On the server, rendering waits for it, so `user.data` is already set when the HTML is generated.

The `await` has to happen in a component's `<script>`. If you create the stache in a module function, return it unawaited and await it in the component. See the [Svelte Context guide](/docs/guides/context#awaiting-for-ssr).

After the first await, `user` behaves like any other stache. When `userId` changes, the new fetch runs on the client and `isLoading`, `data` and `cacheStatus` update reactively.

## How Hydration Works

With `isHydratable` enabled, the fetch is wrapped in Svelte's [`hydratable()`](https://svelte.dev/docs/svelte/hydratable):

1. On the server, the fetch result is serialized into the page under a key made from the stache `id` and the hashed params
2. On the client, the same key is looked up during hydration and the serialized value is returned instead of calling `fetch`
3. Later fetches (new params, invalidation, refetch on stale) go to the network as usual

Without `isHydratable`, the server still renders the data, but the client calls `fetch` again during hydration.

## Things to Watch Out For

### Use absolute URLs on the server

The global `fetch` on the server can't resolve relative URLs like `/api/users/1`. Use an absolute URL in your fetch function, for example by prefixing a `PUBLIC_API_URL` environment variable as shown above.

### Return serializable data

Hydrated values are serialized with [devalue](https://github.com/Rich-Harris/devalue). Plain objects, arrays, `Date`, `Map`, `Set` and similar types are supported. Class instances and functions are not, so return plain data from your fetch function, or leave `isHydratable` off for that stache.

### Dev server warning

In development, SvelteKit logs _"Avoid calling `fetch` eagerly during server-side rendering"_ when a stache fetches during SSR. This is expected with this pattern.

### Paged staches

`createPagedStache` supports the same pattern. Its return value is thenable, and awaiting it resolves once every requested page has loaded. With `isHydratable` enabled, each page is hydrated under its own key, so changing `pageParams` on the client only fetches the pages that weren't rendered on the server.

```svelte
<script lang="ts">
	const posts = await getPosts(() => ({
		params: { category: 'news' },
		pageParams: { pageOffset: 0, pageCount: 2 }
	}));
</script>
```

## Without Async Svelte

If you don't want to enable experimental async, you can load the data in a SvelteKit `load` function and pass it to the stache as `initialData`:

```svelte title="+page.svelte"
<script lang="ts">
	let { data } = $props(); // From +page.server.ts

	const user = getUser(() => ({
		params: data.userId,
		initialData: data.user
	}));
</script>
```

See the [`initialData` option](/docs/api/create-stache) for how it interacts with stale time and refetching.

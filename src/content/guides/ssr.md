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

## Authenticated Requests

On the server, the global `fetch` knows nothing about the page request it runs in. It can't send the user's cookies, and it can't resolve relative URLs. SvelteKit's [`event.fetch`](https://svelte.dev/docs/kit/web-standards#Fetch-APIs) can do both. `createFetchProvider` from `svelte-stache/utils` gives your fetch functions the current request's `event.fetch` on the server, and the normal `fetch` in the browser.

Create a provider in a shared module:

```typescript title="src/lib/api.ts"
import { createFetchProvider } from 'svelte-stache/utils';

export const api = createFetchProvider();
```

Register SvelteKit's `getRequestEvent` once, at the top level of your server hooks:

```typescript title="src/hooks.server.ts"
import { getRequestEvent } from '$app/server';
import { api } from '$lib/api';

api.register(getRequestEvent);
```

Then call `api.fetch` instead of `fetch`:

```typescript title="src/lib/queries/user.ts"
import { createStache } from 'svelte-stache';
import { api } from '$lib/api';

export const { useStache: getUser } = createStache({
	id: 'user',
	fetch: async (userId: string) => {
		const response = await api.fetch(`/api/users/${userId}`);
		if (!response.ok) {
			throw new Error('Failed to fetch user');
		}
		return response.json();
	},
	isHydratable: true
});
```

On the server, `api.fetch` uses `event.fetch`, which:

- sends the request's cookies to your app's origin and its subdomains
- resolves relative URLs like `/api/users/1`
- calls your own `+server` routes directly, without an HTTP round trip
- runs through your [`handleFetch`](https://svelte.dev/docs/kit/hooks#Server-hooks-handleFetch) hook

In the browser, `api.fetch` is the global `fetch`, so the browser sends cookies as usual. It also works in fetches that start outside a component, like invalidation and refetching on focus or when stale.

### APIs on another domain

`event.fetch` only forwards cookies to your app's origin and its subdomains. For an API on another domain, add the credentials in `handleFetch`:

```typescript title="src/hooks.server.ts"
import type { HandleFetch } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';
import { PUBLIC_API_URL } from '$env/static/public';
import { api } from '$lib/api';

api.register(getRequestEvent);

export const handleFetch: HandleFetch = ({ event, request, fetch }) => {
	if (request.url.startsWith(PUBLIC_API_URL)) {
		request.headers.set('authorization', `Bearer ${event.locals.token}`);
	}
	return fetch(request);
};
```

In the browser, requests to another domain only include cookies with `api.fetch(url, { credentials: 'include' })`, and only if the API allows it through CORS. If that isn't an option, call a `+server` route in your app that forwards the request, so the credentials stay on your server.

### Remote functions

If a stache's `fetch` calls a [remote function](/docs/guides/remote-functions), you don't need a provider. The remote function always runs on your server, and can read the user's cookies with `getRequestEvent()`, both during SSR and when called from the browser.

### Without AsyncLocalStorage

`getRequestEvent` uses `AsyncLocalStorage` to find the request after an `await`. Async Svelte needs `AsyncLocalStorage` too, so the setup on this page already has it.

If you render without async Svelte on a runtime that lacks it (for example Cloudflare without the `nodejs_compat` flag), call `api.fetch` before any `await` in your fetch function. Stache calls fetch functions synchronously while the component initialises, so `await api.fetch(...)` as the first statement works.

### Other clients e.g. Supabase

If you're using another client like Supabase, the `createServerClient` also requires cookies to be provided to the client. You could achieve this by creating a "provider" similar to `createFetchProvider`, instead of fetch you can use the provider to inject the cookies into the Supabase client.

Example:

```typescript title="src/lib/supabase.ts"
// src/lib/supabase.ts
import { createBrowserClient, createServerClient, isBrowser } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RequestEvent } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public';

let getRequestEvent: (() => RequestEvent) | undefined;

export const registerRequestEvent = (fn: () => RequestEvent) => {
	getRequestEvent = fn;
};

export const getSupabase = (): SupabaseClient => {
	if (isBrowser()) {
		// Returns the same client on every call
		return createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY);
	}

	if (!getRequestEvent) {
		throw new Error('Call registerRequestEvent(getRequestEvent) in hooks.server.ts');
	}

	const event = getRequestEvent();

	return createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
		global: {
			fetch: event.fetch
		},
		cookies: {
			getAll: () => event.cookies.getAll()
		}
	});
};
```

```typescript title="src/hooks.server.ts"
// src/hooks.server.ts
import { getRequestEvent } from '$app/server';
import { registerRequestEvent } from '$lib/supabase';

registerRequestEvent(getRequestEvent);
```

```typescript title="src/lib/queries/profile.ts"
// src/lib/queries/profile.ts
import { createStache } from 'svelte-stache';
import { getSupabase } from '$lib/supabase';

export const { useStache: getProfile } = createStache({
	id: 'profile',
	fetch: async (userId: string) => {
		const { data, error } = await getSupabase()
			.from('profiles')
			.select('*')
			.eq('id', userId)
			.single();
		if (error) {
			throw error;
		}
		return data;
	},
	isHydratable: true
});
```

The server client here only reads cookies, so it can't save a refreshed session. Keep refreshing the session in your `handle` hook, as in Supabase's SvelteKit setup, so the cookies are current before the page renders.

## Things to Watch Out For

### Return serializable data

Hydrated values are serialized with [devalue](https://github.com/Rich-Harris/devalue). Plain objects, arrays, `Date`, `Map`, `Set` and similar types are supported. Class instances and functions are not, so return plain data from your fetch function, or leave `isHydratable` off for that stache.

### Dev server warning

In development, SvelteKit logs _"Avoid calling `fetch` eagerly during server-side rendering"_ when a stache fetches during SSR. This is expected with this pattern. Requests to your own app through `api.fetch` don't trigger it, but requests to other domains still do, because `event.fetch` hands them to the global `fetch`.

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

---
title: Remote Functions
description: How Stache compares to SvelteKit remote functions, and how to use them together
section: Guides
---

# Stache and Remote Functions

SvelteKit's [remote functions](https://svelte.dev/docs/kit/remote-functions) let you call server code from components, dedupe identical queries, and hydrate server-rendered data. Stache does those things as well, plus extensive client-side cache management that remote functions don't.

You can use Stache **instead of** remote functions, for example to talk to any HTTP API, or outside SvelteKit. You can also use it **with** them, wrapping your remote queries and commands so they get caching, stale handling, pagination and mutation state.

## At a Glance

| Feature                                              | Remote functions            | Stache                                                |
| ---------------------------------------------------- | --------------------------- | ----------------------------------------------------- |
| Deduplicate identical requests                       | ✅                          | ✅                                                    |
| Stable cache keys for object args                    | ✅                          | ✅ (object keys are sorted)                           |
| `await` in components / `{#await}`                   | ✅                          | ✅ (thenable return value)                            |
| SSR with hydration (no second fetch)                 | ✅                          | ✅ `isHydratable`                                     |
| Loading / error / data state                         | ✅                          | ✅ plus `fetchStatus`, `isFetching`, `lastFetched`    |
| Manual refresh                                       | ✅ `refresh()` per instance | ✅ `invalidate()` per instance, per param, or **all** |
| Keep data after unmount for instant back-navigation  | ❌ released once unused     | ✅ `cleanupTime`                                      |
| Stale time and `fresh` / `stale` status              | ❌                          | ✅ `staleTime`, `cacheStatus`                         |
| Refetch on window focus / when stale                 | ❌                          | ✅ `refetchOnWindowFocus`, `refetchOnStale`           |
| Retries for failed fetches                           | ❌                          | ✅ `retries`                                          |
| Pagination / "load more" with per-page caching       | ❌                          | ✅ `createPagedStache`                                |
| Mutation status, retries with delay, lifecycle hooks | ❌                          | ✅ `createMutation`                                   |
| Conditional / dependent queries                      | Manual                      | ✅ `enabled`                                          |
| Seed from `load` data                                | Manual                      | ✅ `initialData`                                      |
| Cache inspector                                      | ❌                          | ✅ [DevTools](/docs/guides/devtools)                  |
| Works with any backend (REST, GraphQL, third-party)  | Your SvelteKit server only  | ✅ any async function                                 |
| Works without SvelteKit                              | ❌                          | ✅                                                    |
| Stable API                                           | Experimental                | ✅ (async SSR is opt-in)                              |

Remote functions have their own strengths that Stache doesn't try to replace:

- **Type-safe server RPC.** Code runs on the server with access to databases and secrets, and arguments are validated with a Standard Schema.
- **`form`** with progressive enhancement and field-level validation.
- **`query.batch`** to solve n+1 problems on the server.
- **`query.live`** for streaming real-time values.
- **`prerender`** for build-time data served from a CDN.
- **Single-flight mutations** that return refreshed query data in the same response as the mutation.

Because a Stache `fetch` function can be any async function, you can keep all of these and still get Stache's caching.

## What Stache Adds

### Data that outlives the component

A remote query is cached only while something is using it. Navigate away and back, and it fetches again. A stache keeps its data for `cleanupTime` after the last component unmounts, so returning to a page renders cached data immediately and only refetches if the data is stale.

```typescript
export const { useStache: getPost } = createStache({
	id: 'post',
	fetch: (slug: string) => api.getPost(slug),
	staleTime: 1000 * 60, // fresh for 1 minute
	cleanupTime: 1000 * 60 * 10 // keep for 10 minutes after the last use
});
```

### Knowing when data is stale

Every stache has a `cacheStatus` of `'fresh'`, `'stale'` or `'empty'`, and a `lastFetched` date. Stale data can refetch automatically when the window regains focus (on by default) or as soon as it goes stale:

```typescript
createStache({
	id: 'notifications',
	fetch: fetchNotifications,
	staleTime: 30_000,
	refetchOnStale: true
});
```

See the [Caching guide](/docs/guides/caching) for the full lifecycle.

### Invalidating every variant at once

To refresh a remote query from the client, you call `refresh()` on the instance with the exact same argument. With Stache, the factory's `invalidate` can target one param set, or every cached variant:

```typescript
const { useStache: getPosts, invalidate: invalidatePosts } = createStache({
	id: 'posts',
	fetch: (filter: { author?: string; tag?: string }) => api.getPosts(filter)
});

invalidatePosts({ author: 'jake' }); // just this filter
invalidatePosts(); // every filter currently cached
```

### Pagination

`createPagedStache` fetches and caches each page separately, then joins them. Increasing `pageCount` for "load more" only fetches the new page, and `hasMore` and `totalCount` come built in. See [createPagedStache](/docs/api/create-paged-stache).

### Mutation state

A `command` is an async call. Tracking whether it is running, has failed or is retrying is up to you. `createMutation` gives you `status` (`idle`, `loading`, `retrying`, `error`, `success`), `data`, `error`, retries with a configurable delay, and `beforeMutate` / `onSuccess` / `onError` / `afterMutate` hooks. See [createMutation](/docs/api/create-mutation).

## Using Stache With Remote Functions

Remote queries can be awaited in any context, so they work as a stache `fetch` function. The remote function handles the server call, validation and serialization, and Stache handles caching on the client.

```typescript title="src/lib/posts.remote.ts"
import * as v from 'valibot';
import { query, command } from '$app/server';
import * as db from '$lib/server/database';

export const getPost = query(v.string(), (slug) => db.getPost(slug));

export const getPosts = query(v.object({ page: v.number(), size: v.number() }), ({ page, size }) =>
	db.getPosts({ page, size })
);

export const likePost = command(v.string(), (slug) => db.likePost(slug));
```

```typescript title="src/lib/queries.ts"
import { createStache, createPagedStache, createMutation } from 'svelte-stache';
import { getPost, getPosts, likePost } from './posts.remote';

export const { useStache: usePost, invalidate: invalidatePost } = createStache({
	id: 'post',
	fetch: (slug: string) => getPost(slug),
	staleTime: 1000 * 60
});

export const { useStache: usePosts } = createPagedStache({
	id: 'posts',
	fetch: (_params: null, { pageIndex, pageSize }) => getPosts({ page: pageIndex, size: pageSize }),
	pageSize: 20,
	getData: (res) => res.items,
	getTotalCount: (res) => res.total
});

export const useLikePost = createMutation({
	mutationFn: (slug: string) => likePost(slug),
	retries: 2,
	onSuccess: ({ params: slug }) => invalidatePost(slug)
});
```

```svelte title="src/routes/blog/[slug]/+page.svelte"
<script lang="ts">
	import { usePost, useLikePost } from '$lib/queries';

	let { params } = $props();

	const post = usePost(() => ({ params: params.slug }));
	const like = useLikePost();
</script>

{#if post.data}
	<h1>{post.data.title}</h1>
	<p>{post.data.likes} likes</p>
	<button onclick={() => like.mutate(params.slug)} disabled={like.isLoading}>
		{like.isRetrying ? 'Retrying...' : 'Like'}
	</button>
{/if}
```

Navigating between posts and back now shows the cached post right away. The paged list keeps the pages it has already loaded, and the like button shows its state without extra code.

## Using Stache Instead of Remote Functions

If your data comes from an existing API, a third-party service, or you're not using SvelteKit, call it directly from the `fetch` function. You still get server rendering and hydration through `isHydratable` (see the [SSR guide](/docs/guides/ssr)), and none of it depends on an experimental SvelteKit flag.

```typescript
export const { useStache: getRepo } = createStache({
	id: 'github-repo',
	fetch: async (name: string) => {
		const res = await fetch(`https://api.github.com/repos/${name}`);
		if (!res.ok) throw new Error(res.statusText);
		return res.json();
	},
	isHydratable: true,
	retries: 2
});
```

## Which Should I Use?

- **Remote functions only.** Good for simple pages that read from your own server, where refetching on every visit is fine.
- **Stache with remote functions.** Good when you want remote functions' type-safe server calls along with client-side caching, pagination or mutation state.
- **Stache only.** Good when data comes from an external API, when you're not on SvelteKit, or when you'd rather not rely on experimental features.

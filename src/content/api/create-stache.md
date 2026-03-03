---
title: createStache
description: API reference for creating cacheable query definitions
section: API
---

# createStache

Creates a reusable, cacheable query definition. This is the primary function for data fetching in Stache.

## Import

```typescript
import { createStache } from 'svelte-stache';
```

## Signature

```typescript
function createStache<Params, Result>(
	options: CreateStacheOptions<Params, Result>
): {
	useStache: UseStacheFn<Params, Result>;
	invalidate: (params?: Params) => void;
};
```

## Options

### Required Options

#### `id`

**Type:** `string`

A unique identifier for this query type. Used as part of the cache key.

```typescript
createStache({
	id: 'user', // Unique identifier
	fetch: fetchUser
});
```

#### `fetch`

**Type:** `(params: Params) => Promise<Result> | Result`

A function that fetches the data. Receives the params and should return the data.

```typescript
createStache({
	id: 'user',
	fetch: async (userId: string) => {
		const res = await fetch(`/api/users/${userId}`);
		return res.json();
	}
});
```

### Optional Options

#### `staleTime`

**Type:** `number`
**Default:** `300000` (5 minutes)

Time in milliseconds until data is considered stale. During this time, cached data is returned immediately without refetching.

```typescript
createStache({
	id: 'user',
	fetch: fetchUser,
	staleTime: 1000 * 60 * 10 // 10 minutes
});
```

#### `cleanupTime`

**Type:** `number`
**Default:** `300000` (5 minutes)

Time in milliseconds to wait before removing unused data from the cache. The countdown starts when the last component using this data unmounts.

```typescript
createStache({
	id: 'user',
	fetch: fetchUser,
	cleanupTime: 1000 * 60 * 30 // Keep in cache for 30 minutes after last use
});
```

#### `refetchOnStale`

**Type:** `boolean`
**Default:** `false`

When `true`, automatically triggers a refetch when data becomes stale, even if no component explicitly requests it.

```typescript
createStache({
	id: 'user',
	fetch: fetchUser,
	refetchOnStale: true // Keep data fresh automatically
});
```

#### `refetchOnWindowFocus`

**Type:** `boolean`
**Default:** `true`

When `true`, refetches stale data when the browser window regains focus. Useful for keeping data fresh when users return to your app.

```typescript
createStache({
	id: 'user',
	fetch: fetchUser,
	refetchOnWindowFocus: false // Disable window focus refetch
});
```

#### `retries`

**Type:** `number`
**Default:** `0`

Number of times to retry a failed fetch before giving up.

```typescript
createStache({
	id: 'user',
	fetch: fetchUser,
	retries: 3 // Retry up to 3 times on failure
});
```

#### `isHydratable`

**Type:** `boolean`
**Default:** `false`

When `true`, wraps the fetch in Svelte's `hydratable()` to cache the result during SSR and reuse it on the client, avoiding duplicate fetches on hydration. Requires experimental async Svelte support and a return type compatible with [devalue](https://github.com/Rich-Harris/devalue) serialization.

```typescript
createStache({
	id: 'user',
	fetch: fetchUser,
	isHydratable: true
});
```

## Return Value

### `useStache`

A function to use the query with params. Returns a reactive stache object.

```typescript
const { useStache: getUser } = createStache({ ... });

// In a component:
const user = getUser(() => ({ params: 'user-123' }));
```

### `invalidate`

A function to manually invalidate cached data. Forces a refetch immediately.

- **`invalidate(params)`** — invalidates the cache entry for the given params
- **`invalidate()`** — invalidates all cache entries for this stache (all param variants)

```typescript
const { invalidate: invalidateUser } = createStache({ ... });

// Force refetch for a specific user
invalidateUser('user-123');

// Force refetch for all cached users
invalidateUser();
```

## useStache Options

When calling `useStache`, pass an options function that returns an object. This allows Svelte's reactivity system to track changes to the options.

```typescript
const user = getUser(() => ({
	params: userId,
	enabled: true
}));
```

### `params`

**Type:** `Params`

The parameters to pass to the fetch function, the type of which is inferred from the `fetch` function provided to `createStache`.

Is used as part of the cache key along with the stache `id` to uniquely identify this query instance.

```typescript
const user = getUser(() => ({ params: userId }));
```

### `enabled`

**Type:** `boolean`
**Default:** `true`

When `false`, the query won't execute. Useful for dependent queries.

```typescript
const user = getUser(() => ({
	params: userId,
	enabled: !!userId // Only fetch when userId is truthy
}));
```

## Stache Object

The object returned by `useStache` with reactive properties:

### Data Properties

| Property | Type             | Description               |
| -------- | ---------------- | ------------------------- |
| `data`   | `Result \| null` | The fetched data          |
| `error`  | `unknown`        | Error if the fetch failed |
| `params` | `Params`         | Current parameters        |

### Status Properties

| Property      | Type                                          | Description             |
| ------------- | --------------------------------------------- | ----------------------- |
| `fetchStatus` | `'idle' \| 'loading' \| 'error' \| 'success'` | Current fetch status    |
| `cacheStatus` | `'fresh' \| 'stale' \| 'empty'`               | Cache freshness state   |
| `isLoading`   | `boolean`                                     | True while fetching     |
| `isError`     | `boolean`                                     | True if fetch failed    |
| `isSuccess`   | `boolean`                                     | True if fetch succeeded |

### Metadata Properties

| Property      | Type           | Description                   |
| ------------- | -------------- | ----------------------------- |
| `lastFetched` | `Date \| null` | Time of last successful fetch |
| `enabled`     | `boolean`      | Whether the stache is active  |

### Methods

| Method         | Description     |
| -------------- | --------------- |
| `invalidate()` | Force a refetch |

## Examples

### Basic Usage

```typescript
const { useStache: getUser } = createStache({
	id: 'user',
	fetch: async (id: string) => {
		const res = await fetch(`/api/users/${id}`);
		return res.json();
	}
});
```

### With All Options

```typescript
const { useStache: getUser, invalidate: invalidateUser } = createStache({
	id: 'user',
	fetch: async (id: string) => {
		const res = await fetch(`/api/users/${id}`);
		if (!res.ok) throw new Error('Failed to fetch');
		return res.json();
	},
	staleTime: 1000 * 60 * 10, // 10 minutes
	cleanupTime: 1000 * 60 * 30, // 30 minutes
	refetchOnStale: true,
	refetchOnWindowFocus: true,
	retries: 2
});
```

### Conditional Fetching

```svelte
<script lang="ts">
	let selectedUserId = $state<string | null>(null);

	const user = getUser(() => ({
		params: selectedUserId!,
		enabled: selectedUserId !== null
	}));
</script>
```

### Using with await (SSR)

```svelte
<script lang="ts">
	let { data } = $props(); // From +page.server.ts

	const user = getUser(() => ({
		params: data.userId
	}));
</script>

{#await user}
	<p>Loading...</p>
{:then result}
	<h1>{result.data?.name}</h1>
{/await}
```

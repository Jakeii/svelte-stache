---
title: createStache
description: API reference for creating cacheable query definitions
section: API
---

# createStache

Creates a reusable, cacheable query definition. This is the primary function for data fetching in Svelte Stache.

## Import

```typescript
import { createStache } from 'svelte-stache';
```

## Signature

```typescript
function createStache<Params, Result, FetchReturn = Result>(
  options: CreateStacheOptions<Params, Result, FetchReturn>
): {
  useStache: UseStacheFn<Params, Result>;
  invalidate: (params: Params) => void;
}
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

**Type:** `(params: Params) => Promise<FetchReturn>`

An async function that fetches the data. Receives the params and should return the data.

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
  staleTime: 1000 * 60 * 10, // 10 minutes
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
  cleanupTime: 1000 * 60 * 30, // Keep in cache for 30 minutes after last use
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
  refetchOnStale: true, // Keep data fresh automatically
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
  refetchOnWindowFocus: false, // Disable window focus refetch
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
  retries: 3, // Retry up to 3 times on failure
});
```

## Return Value

### `useStache`

A function to use the query in a component. Returns a reactive stache object.

```typescript
const { useStache: getUser } = createStache({ ... });

// In a component:
const user = getUser(() => ({ params: 'user-123' }));
```

### `invalidate`

A function to manually invalidate cached data for specific params. Forces a refetch the next time the data is requested.

```typescript
const { invalidate: invalidateUser } = createStache({ ... });

// Force refetch for a specific user
invalidateUser('user-123');
```

## useStache Options

When calling `useStache`, you can pass an options function:

```typescript
const user = getUser(() => ({
  params: userId,
  enabled: true,
  initialData: cachedUser,
}));
```

### `params`

**Type:** `Params`

The parameters to pass to the fetch function.

### `enabled`

**Type:** `boolean`
**Default:** `true`

When `false`, the query won't execute. Useful for dependent queries.

```typescript
const user = getUser(() => ({
  params: userId,
  enabled: !!userId, // Only fetch when userId is truthy
}));
```

### `initialData`

**Type:** `Result`

Initial data to use before the first fetch completes. Useful for SSR hydration.

```typescript
const user = getUser(() => ({
  params: userId,
  initialData: ssrUser, // Use server-rendered data initially
}));
```

## Stache Object

The object returned by `useStache` with reactive properties:

### Data Properties

| Property | Type | Description |
|----------|------|-------------|
| `data` | `Result \| undefined` | The fetched data |
| `error` | `unknown` | Error if the fetch failed |
| `params` | `Params` | Current parameters |

### Status Properties

| Property | Type | Description |
|----------|------|-------------|
| `fetchStatus` | `'idle' \| 'loading' \| 'error' \| 'success'` | Current fetch status |
| `cacheStatus` | `'fresh' \| 'stale'` | Whether data is fresh or stale |
| `isLoading` | `boolean` | True during initial load |
| `isFetching` | `boolean` | True during any fetch |
| `isError` | `boolean` | True if fetch failed |
| `isSuccess` | `boolean` | True if fetch succeeded |

### Metadata Properties

| Property | Type | Description |
|----------|------|-------------|
| `lastFetched` | `Date \| undefined` | Time of last successful fetch |
| `referenceCount` | `number` | Number of components using this stache |

### Methods

| Method | Description |
|--------|-------------|
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
  staleTime: 1000 * 60 * 10,      // 10 minutes
  cleanupTime: 1000 * 60 * 30,    // 30 minutes
  refetchOnStale: true,
  refetchOnWindowFocus: true,
  retries: 2,
});
```

### Conditional Fetching

```svelte
<script lang="ts">
  let selectedUserId = $state<string | null>(null);

  const user = getUser(() => ({
    params: selectedUserId!,
    enabled: selectedUserId !== null,
  }));
</script>
```

### With Initial Data (SSR)

```svelte
<script lang="ts">
  let { data } = $props(); // From +page.server.ts

  const user = getUser(() => ({
    params: data.userId,
    initialData: data.user, // Server-side loaded user
  }));
</script>
```

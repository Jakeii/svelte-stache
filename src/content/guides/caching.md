---
title: Caching
description: Understanding how Svelte Stache caches and manages data
section: Guides
---

# Caching

Svelte Stache uses a smart caching system to minimize network requests and provide instant data when possible. This guide explains how it works.

## How Caching Works

### Cache Keys

Each piece of cached data is identified by a unique key composed of:

1. **Query ID** - The `id` you provide when creating a stache
2. **Hashed Parameters** - A deterministic hash of the params

```typescript
createStache({ id: 'user', fetch: fetchUser });

// These use different cache keys:
getUser(() => ({ params: 'user-1' }));  // key: user:hash("user-1")
getUser(() => ({ params: 'user-2' }));  // key: user:hash("user-2")
```

### Parameter Hashing

Parameters are hashed with sorted keys, so object property order doesn't matter:

```typescript
// These produce the SAME cache key:
getUser(() => ({ params: { id: 1, type: 'admin' } }));
getUser(() => ({ params: { type: 'admin', id: 1 } }));
```

## Cache Sharing

When multiple components request the same data, they share a single stache instance:

```svelte
<!-- ComponentA.svelte -->
<script>
  const user = getUser(() => ({ params: 'user-1' }));
</script>

<!-- ComponentB.svelte -->
<script>
  // Same cache entry - no duplicate fetch!
  const user = getUser(() => ({ params: 'user-1' }));
</script>
```

Both components receive the same reactive stache object. When one component triggers a refetch, both see the updated data.

## Cache Status

Data in the cache has three possible statuses:

### Empty

Data is **empty** when no fetch has completed yet for this stache instance.

### Fresh

Data is **fresh** when it was fetched within the `staleTime` period. Fresh data is returned immediately without any network request.

```typescript
createStache({
  id: 'user',
  fetch: fetchUser,
  staleTime: 1000 * 60 * 5, // 5 minutes
});

// If fetched less than 5 minutes ago, returns instantly
```

### Stale

Data becomes **stale** after `staleTime` has passed. Stale data is still returned immediately, but may trigger a background refetch depending on configuration.

## Stale Time Configuration

Control how long data stays fresh:

```typescript
// Short stale time - data refreshes frequently
createStache({
  id: 'notifications',
  fetch: fetchNotifications,
  staleTime: 1000 * 30, // 30 seconds
});

// Long stale time - data cached longer
createStache({
  id: 'user-profile',
  fetch: fetchProfile,
  staleTime: 1000 * 60 * 30, // 30 minutes
});

// Zero stale time - always refetch
createStache({
  id: 'live-data',
  fetch: fetchLiveData,
  staleTime: 0, // Always considered stale
});
```

## Automatic Refetching

### On Window Focus

By default, stale data is refetched when the window regains focus:

```typescript
createStache({
  id: 'user',
  fetch: fetchUser,
  refetchOnWindowFocus: true, // default
});
```

This keeps data fresh when users return to your app after being away.

### On Stale

Optionally refetch automatically when data becomes stale:

```typescript
createStache({
  id: 'dashboard',
  fetch: fetchDashboard,
  refetchOnStale: true, // Proactively keep fresh
});
```

## Reference Counting

Staches track how many components are using them internally. When a component mounts it increments the reference count; when it unmounts the count decrements. When the count reaches 0, the stache schedules cleanup.

## Cleanup

Unused cache entries are automatically removed after `cleanupTime`:

```typescript
createStache({
  id: 'user',
  fetch: fetchUser,
  cleanupTime: 1000 * 60 * 5, // Remove after 5 minutes of no use
});
```

### Cleanup Timeline

```
1. Last component unmounts
2. referenceCount becomes 0
3. Cleanup timer starts (cleanupTime)
4. If no new references, cache entry removed
5. If new component mounts before cleanup, timer cancelled
```

This prevents memory leaks while keeping recently-used data available.

## Manual Invalidation

Force a refetch at any time:

```typescript
// Instance method
user.invalidate();

// Factory function
invalidateUser('user-1');
```

Invalidation:
1. Marks the data as stale
2. Triggers an immediate refetch
3. Updates all components using this stache

## Best Practices

### Choose Appropriate Stale Times

| Data Type | Suggested Stale Time |
|-----------|---------------------|
| User profile | 5-30 minutes |
| Lists/feeds | 1-5 minutes |
| Notifications | 30 seconds - 1 minute |
| Real-time data | 0 (always stale) |
| Static content | 1+ hours |

### Invalidate After Mutations

Always invalidate related queries after mutations:

```typescript
const useCreatePost = createMutation({
  mutationFn: createPost,
  onSuccess: () => {
    invalidatePosts(); // Refresh the posts list
  },
});
```

### Use Cleanup Time Wisely

- **Short cleanup** (1-2 min): Memory-conscious, frequent data changes
- **Long cleanup** (10-30 min): Better UX for data users return to
- **No cleanup** (Infinity): Persist for session duration

```typescript
// Keep navigation data cached for the whole session
createStache({
  id: 'navigation',
  fetch: fetchNavigation,
  cleanupTime: Infinity,
});
```

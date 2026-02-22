---
title: Search
description: Reactive search with debouncing and caching
section: Examples
---

<script>
  import SearchDemo from '$lib/docs/examples/SearchDemo.svelte';
</script>

# Search Example

This example shows how to build a reactive search feature with `createStache`, using debounced parameters and smart caching.

## Live Demo

<SearchDemo />

## The Code

### Query Definition

Create a stache for searching users:

```typescript title="src/lib/queries/search-users.ts"
import { createStache } from 'svelte-stache';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
}

export const { useStache: searchUsers } = createStache({
  id: 'user-search',
  fetch: async (query: string): Promise<User[]> => {
    // Don't search if query is empty
    if (!query.trim()) {
      return [];
    }

    const response = await fetch(`/api/users?search=${encodeURIComponent(query)}`);
    return response.json();
  },
  staleTime: 1000 * 60, // 1 minute - search results can be cached briefly
  refetchOnWindowFocus: false, // Don't refetch search on focus
});
```

### Component with Debouncing

```svelte title="UserSearch.svelte"
<script lang="ts">
  import { searchUsers } from '$lib/queries/search-users';

  let inputValue = $state('');
  let debouncedQuery = $state('');
  let debounceTimer: ReturnType<typeof setTimeout>;

  // Debounce the search query
  $effect(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debouncedQuery = inputValue;
    }, 300);

    return () => clearTimeout(debounceTimer);
  });

  // The search only runs when debouncedQuery changes
  const results = searchUsers(() => ({
    params: debouncedQuery,
    enabled: debouncedQuery.length > 0,
  }));
</script>

<div class="search-container">
  <input
    type="search"
    bind:value={inputValue}
    placeholder="Search users by name, email, or role..."
  />

  {#if inputValue && inputValue !== debouncedQuery}
    <span class="typing-indicator">Typing...</span>
  {/if}
</div>

{#if results.isLoading}
  <div class="loading">Searching...</div>
{:else if results.isError}
  <div class="error">Search failed</div>
{:else if debouncedQuery && results.data?.length === 0}
  <div class="no-results">No users found for "{debouncedQuery}"</div>
{:else if results.data && results.data.length > 0}
  <ul class="results">
    {#each results.data as user}
      <li class="user-result">
        <img src={user.avatar} alt={user.name} />
        <div class="user-info">
          <span class="name">{user.name}</span>
          <span class="email">{user.email}</span>
        </div>
        <span class="role">{user.role}</span>
      </li>
    {/each}
  </ul>
{/if}

<div class="cache-info">
  {#if debouncedQuery}
    <span>Cache: {results.cacheStatus}</span>
  {/if}
</div>
```

## Key Points

1. **Debouncing** - Wait for the user to stop typing before searching
2. **Conditional Fetching** - Use `enabled: false` when the query is empty
3. **Cache Benefits** - Previous searches are cached, so going back to them is instant
4. **Typing Indicator** - Show feedback while waiting for debounce

## Debounce Pattern

The debounce effect ensures we don't make a request on every keystroke:

```typescript
let inputValue = $state('');      // Updates immediately
let debouncedQuery = $state('');  // Updates after 300ms pause

$effect(() => {
  const timer = setTimeout(() => {
    debouncedQuery = inputValue;  // Only update after user stops typing
  }, 300);
  return () => clearTimeout(timer);
});

// Query uses debouncedQuery, not inputValue
const results = searchUsers(() => ({ params: debouncedQuery }));
```

## What to Try

1. **Type quickly** - Notice the "Typing..." indicator during debounce
2. **Search for "Alice" or "Developer"** - See results populate
3. **Clear and retype the same query** - Results come from cache instantly
4. **Watch the cache status** - Shows whether data is fresh or stale
5. **Try invalid searches** - See the "No results" message

---
'svelte-stache': minor
---

Add a new prop `initialData` for `useStache` and `usePagedStache` that allows specifying the stache data before calling the fetch function, a companion `initialDataFetchedAt` can be provided and will be used to calculate if the `initialData` is `stale` or `fresh`, to delay fetching.

The type of `initialData` can be different to the expected fetched data, but the stache `data` prop will be a union of both.

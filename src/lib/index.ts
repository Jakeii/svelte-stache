export { createStache } from './stache/stache.svelte';
export { createPagedStache } from './paged/paged.svelte';
export { createMutation } from './mutation/mutation.svelte';

export { default as StacheProvider } from './StacheProvider.svelte';

export { getStacheCache, initStacheCache } from './cache';

export type { Mutation } from './mutation/mutation.class.svelte';
export type { Stache } from './stache/stache.svelte';
export type { PagedStache } from './paged/paged.svelte';

export type { StacheCache } from './cache';

export type { UseStacheFn } from './stache/stache.svelte';
export type { CreateStacheFn } from './stache/stache.svelte';
export type { CreatePagedStacheFn } from './paged/paged.svelte';
export type { MutationFn, ShouldRetryFn, RetryDelayFn } from './mutation/mutation.class.svelte';

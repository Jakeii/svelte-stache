<script lang="ts">
	import { initStacheCache, listenForInvalidation } from './cache.svelte';

	let { children } = $props();

	const cache = initStacheCache();

	$effect(() => listenForInvalidation(cache));
</script>

{@render children()}

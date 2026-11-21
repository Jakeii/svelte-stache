<script lang="ts">
	import { initStacheCache } from './cache.svelte';

	let { children } = $props();

	initStacheCache();
</script>

{@render children()}

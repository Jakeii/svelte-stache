<script lang="ts">
	import { initializeGlobalPagedStacheCache } from './paged/paged-cache';
	import { initializeGlobalStacheCache } from './stache/cache';

	let { children } = $props();

	initializeGlobalStacheCache();
	initializeGlobalPagedStacheCache();
</script>

test
{@render children()}

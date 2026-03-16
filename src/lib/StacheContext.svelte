<script lang="ts">
	import { createStacheCache } from './cache';

	let { children } = $props();

	createStacheCache();
</script>

{@render children()}

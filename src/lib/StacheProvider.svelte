<script lang="ts">
	import { initStacheCache } from './cache';

	let { children } = $props();

	initStacheCache();
</script>

{@render children()}

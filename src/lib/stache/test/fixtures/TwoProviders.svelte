<script lang="ts">
	import StacheProvider from '../../../StacheProvider.svelte';
	import type { StacheCache } from '../../../cache.svelte';
	import CacheChild from './CacheChild.svelte';

	type Props = {
		useA: () => unknown;
		useB: () => unknown;
		onCache: (name: string, cache: StacheCache) => void;
	};

	let { useA, useB, onCache }: Props = $props();
</script>

<StacheProvider>
	<CacheChild name="A" use={useA} {onCache} />
</StacheProvider>

<StacheProvider>
	<CacheChild name="B" use={useB} {onCache} />
</StacheProvider>

<script lang="ts">
	import { getStacheCache, type StacheCache } from '../../../cache';

	type Props = {
		name: string;
		use: () => unknown;
		onCache: (name: string, cache: StacheCache) => void;
	};

	let { name, use, onCache }: Props = $props();

	// Props are read once on purpose: this runs during component initialisation, like real usage
	// svelte-ignore state_referenced_locally
	onCache(name, getStacheCache());
	// svelte-ignore state_referenced_locally
	use();
</script>

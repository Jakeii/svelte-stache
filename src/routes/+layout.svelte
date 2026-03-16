<script lang="ts">
	import { StacheDevtools } from '$lib/devtools';
	import { siteConfig } from '$lib/docs/site-config';
	import StacheContext from '$lib/StacheContext.svelte';
	import '../app.css';
	import { useSiteConfig } from '@svecodocs/kit';

	let { children } = $props();

	useSiteConfig(() => siteConfig);
</script>

<StacheContext>
	{@render children?.()}
	<StacheDevtools initialOpen={true} buttonPosition="bottom-left" panelHeight={500} />
</StacheContext>

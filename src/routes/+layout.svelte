<script lang="ts">
	import { StacheDevtools } from '#lib/devtools/index.js';
	import { siteConfig } from '#lib/docs/site-config.js';
	import StacheProvider from '#lib/StacheProvider.svelte';
	import '../app.css';
	import { useSiteConfig } from '@svecodocs/kit';

	let { children } = $props();

	useSiteConfig(() => siteConfig);
</script>

<StacheProvider>
	{@render children?.()}
	<StacheDevtools initialOpen={true} buttonPosition="bottom-left" panelHeight={500} />
</StacheProvider>

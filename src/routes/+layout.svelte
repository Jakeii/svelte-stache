<script lang="ts">
	import { StacheDevtools } from '$lib/devtools';
	import { siteConfig } from '$lib/docs/site-config';
	import '../app.css';
	import { useSiteConfig } from '@svecodocs/kit';

	let { children } = $props();

	useSiteConfig(() => siteConfig);
</script>

{@render children?.()}
<StacheDevtools initialOpen={true} buttonPosition="bottom-left" panelHeight={500} />

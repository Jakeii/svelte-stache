<script lang="ts">
	import { DocsLayout } from '@svecodocs/kit';
	import { navigation } from '$lib/docs/navigation';

	let { children } = $props();
</script>

<DocsLayout {navigation}>
	{#snippet logo()}
		<span class="logo-text">
			<span class="logo-icon">📦</span>
			<span class="logo-name">Stache</span>
		</span>
		<span class="sr-only">Stache</span>
	{/snippet}

	{@render children?.()}
</DocsLayout>

<style>
	.logo-text {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 600;
		font-size: 1.125rem;
	}

	.logo-icon {
		font-size: 1.25rem;
	}

	.logo-name {
		background: linear-gradient(135deg, var(--color-primary) 0%, #7c3aed 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}
</style>

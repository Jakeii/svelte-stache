<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect } from 'storybook/test';
	import SearchDemo from './SearchDemo.svelte';
	import { userHandlers } from './msw-handlers.js';
	import { getStacheVariantMap } from '$lib/stache/cache.svelte.js';

	const globalCache = getStacheVariantMap('demo-search');

	const { Story } = defineMeta({
		title: 'Examples/SearchDemo',
		component: SearchDemo,
		parameters: {
			msw: { handlers: userHandlers() }
		},
		beforeEach: async () => {
			globalCache.clear();
		}
	});
</script>

<!-- Default: empty state with suggestion chips visible -->
<Story
	name="Default"
	play={async ({ canvas }) => {
		await expect(canvas.getByText('Try searching for:')).toBeInTheDocument();
		await expect(canvas.getByRole('button', { name: 'Alice' })).toBeInTheDocument();
	}}
/>

<!-- SearchResults: type a query, wait for debounce, assert results -->
<Story
	name="SearchResults"
	parameters={{ msw: { handlers: userHandlers() } }}
	play={async ({ canvas, userEvent }) => {
		const input = canvas.getByRole('searchbox');
		await userEvent.type(input, 'Alice');
		// Debounce is 300ms — wait for results
		await expect(
			canvas.findByText('Alice Johnson', {}, { timeout: 2000 })
		).resolves.toBeInTheDocument();
		await expect(canvas.findByText('alice@example.com')).resolves.toBeInTheDocument();
	}}
/>

<!-- NoResults: query returns empty array, "No users found" shown -->
<Story
	name="NoResults"
	parameters={{ msw: { handlers: userHandlers() } }}
	play={async ({ canvas, userEvent }) => {
		const input = canvas.getByRole('searchbox');
		await userEvent.type(input, 'zzznomatch');
		await expect(
			canvas.findByText(/No users found/i, {}, { timeout: 2000 })
		).resolves.toBeInTheDocument();
	}}
/>

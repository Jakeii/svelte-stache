<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect } from 'storybook/test';
	import PaginationDemo from './PaginationDemo.svelte';
	import { postHandlers } from './msw-handlers.js';
	import { getPagedStacheCache } from '$lib/paged/paged-cache.svelte.js';

	const globalCache = getPagedStacheCache('demo-posts');

	const { Story } = defineMeta({
		title: 'Examples/PaginationDemo',
		component: PaginationDemo,
		parameters: {
			msw: { handlers: postHandlers() }
		},
		beforeEach: async () => {
			globalCache.clear();
		}
	});
</script>

<!-- Default: first page of posts renders with count -->
<Story
	name="Default"
	play={async ({ canvas }) => {
		await expect(canvas.findByText(/^Post Title 1/)).resolves.toBeInTheDocument();
		await expect(canvas.findByText(/Showing \d+ of \d+ posts/)).resolves.toBeInTheDocument();
	}}
/>

<!-- LoadMore: click button, additional posts appear -->
<Story
	name="LoadMore"
	parameters={{ msw: { handlers: postHandlers() } }}
	play={async ({ canvas, userEvent }) => {
		await expect(canvas.findByText(/^Post Title 1/)).resolves.toBeInTheDocument();
		const loadMore = canvas.getByRole('button', { name: /load more/i });
		await userEvent.click(loadMore);
		await expect(canvas.findByText(/^Post Title 6/)).resolves.toBeInTheDocument();
	}}
/>

<!-- FilterByCategory: change category, list updates -->
<Story
	name="FilterByCategory"
	parameters={{ msw: { handlers: postHandlers() } }}
	play={async ({ canvas, userEvent }) => {
		await expect(canvas.findByText(/^Post Title 1/)).resolves.toBeInTheDocument();
		const select = canvas.getByRole('combobox', { name: /category/i });
		await userEvent.selectOptions(select, 'Technology');
		// After filtering, only Technology posts should show
		const posts = await canvas.findAllByText('Technology');
		await expect(posts.length).toBeGreaterThan(0);
	}}
/>

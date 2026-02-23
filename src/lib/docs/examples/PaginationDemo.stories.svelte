<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, within, userEvent } from 'storybook/test';
	import PaginationDemo from './PaginationDemo.svelte';
	import { postHandlers } from './msw-handlers.js';

	const { Story } = defineMeta({
		title: 'Examples/PaginationDemo',
		component: PaginationDemo,
		parameters: {
			msw: { handlers: postHandlers() }
		}
	});
</script>

<!-- Default: first page of posts renders with count -->
<Story
	name="Default"
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.findByText('Post Title 1')).resolves.toBeInTheDocument();
		await expect(canvas.findByText(/Showing \d+ of \d+ posts/)).resolves.toBeInTheDocument();
	}}
/>

<!-- LoadMore: click button, additional posts appear -->
<Story
	name="LoadMore"
	parameters={{ msw: { handlers: postHandlers() } }}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.findByText('Post Title 1')).resolves.toBeInTheDocument();
		const loadMore = canvas.getByRole('button', { name: /load more/i });
		await userEvent.click(loadMore);
		await expect(canvas.findByText('Post Title 6')).resolves.toBeInTheDocument();
	}}
/>

<!-- FilterByCategory: change category, list updates -->
<Story
	name="FilterByCategory"
	parameters={{ msw: { handlers: postHandlers() } }}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.findByText('Post Title 1')).resolves.toBeInTheDocument();
		const select = canvas.getByRole('combobox', { name: /category/i });
		await userEvent.selectOptions(select, 'Technology');
		// After filtering, only Technology posts should show
		const posts = await canvas.findAllByText('Technology');
		await expect(posts.length).toBeGreaterThan(0);
	}}
/>

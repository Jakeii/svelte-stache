<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect } from 'storybook/test';
	import MutationsDemo from './MutationsDemo.svelte';
	import { postHandlers } from './msw-handlers.js';

	const { Story } = defineMeta({
		title: 'Examples/MutationsDemo',
		component: MutationsDemo,
		parameters: {
			msw: { handlers: postHandlers() }
		}
	});
</script>

<!-- Default: form is empty, status badge shows idle -->
<Story
	name="Default"
	play={async ({ canvas }) => {
		await expect(canvas.getByLabelText('Title')).toBeInTheDocument();
		await expect(canvas.getByLabelText('Content')).toBeInTheDocument();
		await expect(canvas.getByText('idle')).toBeInTheDocument();
	}}
/>

<!-- SubmitSuccess: fill + submit, assert success message and post in list -->
<Story
	name="SubmitSuccess"
	parameters={{ msw: { handlers: postHandlers() } }}
	play={async ({ canvas, userEvent }) => {
		await userEvent.type(canvas.getByLabelText('Title'), 'My New Post');
		await userEvent.type(canvas.getByLabelText('Content'), 'Some interesting content here.');
		await userEvent.click(canvas.getByRole('button', { name: /create post/i }));
		await expect(
			canvas.findByText(/My New Post.*created successfully/i)
		).resolves.toBeInTheDocument();
		await expect(canvas.findByText('My New Post')).resolves.toBeInTheDocument();
	}}
/>

<!-- SubmitError: MSW returns 500, error message should appear -->
<Story
	name="SubmitError"
	parameters={{ msw: { handlers: postHandlers({ error: true }) } }}
	play={async ({ canvas, userEvent }) => {
		await userEvent.type(canvas.getByLabelText('Title'), 'My New Post');
		await userEvent.type(canvas.getByLabelText('Content'), 'Some content.');
		await userEvent.click(canvas.getByRole('button', { name: /create post/i }));
		await expect(canvas.findByText(/Failed to create post/i)).resolves.toBeInTheDocument();
	}}
/>

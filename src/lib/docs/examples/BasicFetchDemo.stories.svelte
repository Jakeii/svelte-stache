<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, within, userEvent } from 'storybook/test';
	import BasicFetchDemo from './BasicFetchDemo.svelte';
	import { userHandlers } from './msw-handlers.js';

	const { Story } = defineMeta({
		title: 'Examples/BasicFetchDemo',
		component: BasicFetchDemo,
		parameters: {
			msw: { handlers: userHandlers() }
		}
	});
</script>

<!-- Default: renders profile card with mock user data -->
<Story
	name="Default"
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.findByText('Alice Johnson')).resolves.toBeInTheDocument();
		await expect(canvas.findByText('Engineer')).resolves.toBeInTheDocument();
		await expect(canvas.findByText('alice@example.com')).resolves.toBeInTheDocument();
	}}
/>

<!-- Loading: MSW delays 3 s, spinner should be visible immediately -->
<Story
	name="Loading"
	parameters={{ msw: { handlers: userHandlers({ delayMs: 3000 }) } }}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.findByText('Loading user...')).resolves.toBeInTheDocument();
	}}
/>

<!-- Error: MSW returns 500, error UI should render -->
<Story
	name="Error"
	parameters={{ msw: { handlers: userHandlers({ error: true }) } }}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.findByText(/Failed to fetch user/i)).resolves.toBeInTheDocument();
	}}
/>

<!-- SwitchingUsers: change select, assert new user data loads -->
<Story
	name="SwitchingUsers"
	parameters={{ msw: { handlers: userHandlers() } }}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		// Wait for initial load
		await expect(canvas.findByText('Alice Johnson')).resolves.toBeInTheDocument();
		// Switch to Bob Smith
		const select = canvas.getByRole('combobox');
		await userEvent.selectOptions(select, 'user-2');
		await expect(canvas.findByText('Bob Smith')).resolves.toBeInTheDocument();
	}}
/>

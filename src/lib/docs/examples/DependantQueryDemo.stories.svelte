<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, within } from 'storybook/test';
	import DependantQueryDemo from './DependantQueryDemo.svelte';
	import { userHandlers, departmentHandlers } from './msw-handlers.js';

	const { Story } = defineMeta({
		title: 'Examples/DependantQueryDemo',
		component: DependantQueryDemo,
		parameters: {
			msw: { handlers: [...userHandlers(), ...departmentHandlers()] }
		}
	});
</script>

<!-- Default: user and departments both load successfully -->
<Story
	name="Default"
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.findByText('Alice Johnson')).resolves.toBeInTheDocument();
		await expect(canvas.findByText('Engineering - San Francisco')).resolves.toBeInTheDocument();
	}}
/>

<!-- DepartmentError: user loads, departments fail with error message -->
<Story
	name="DepartmentError"
	parameters={{
		msw: {
			handlers: [...userHandlers(), ...departmentHandlers({ error: true })]
		}
	}}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.findByText('Alice Johnson')).resolves.toBeInTheDocument();
		await expect(canvas.findByText(/Failed to fetch department/i)).resolves.toBeInTheDocument();
	}}
/>

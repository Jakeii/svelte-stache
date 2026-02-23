<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect } from 'storybook/test';
	import DependantQueryDemo from './DependantQueryDemo.svelte';
	import { userHandlers, departmentHandlers } from './msw-handlers.js';
	import { getStacheCache } from '$lib/stache/cache.svelte.js';

	const demoUserCache = getStacheCache('demo-user');
	const demoDepartmentCache = getStacheCache('demo-user-departments');

	const { Story } = defineMeta({
		title: 'Examples/DependantQueryDemo',
		component: DependantQueryDemo,
		parameters: {
			msw: { handlers: [...userHandlers(), ...departmentHandlers()] }
		},
		beforeEach: async () => {
			demoUserCache.clear();
			demoDepartmentCache.clear();
		}
	});
</script>

<!-- Default: user and departments both load successfully -->
<Story
	name="Default"
	play={async ({ canvas }) => {
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
	play={async ({ canvas }) => {
		await expect(canvas.findByText('Alice Johnson')).resolves.toBeInTheDocument();
		await expect(canvas.findByText(/Failed to fetch department/i)).resolves.toBeInTheDocument();
	}}
/>

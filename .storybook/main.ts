import type { StorybookConfig } from '@storybook/sveltekit';

const config: StorybookConfig = {
	stories: ['../src/**/*.stories.@(js|ts|svelte)'],
	addons: [
		'@storybook/addon-svelte-csf',
		'@storybook/addon-mcp',
		'@storybook/addon-essentials',
		'@storybook/addon-interactions'
	],
	framework: '@storybook/sveltekit',
	viteFinal: async (config) => {
		config.define = {
			...config.define,
			// Shim SvelteKit $env/static/public — MSW intercepts before network
			'import.meta.env.PUBLIC_API_URL': JSON.stringify('http://localhost')
		};
		return config;
	}
};

export default config;

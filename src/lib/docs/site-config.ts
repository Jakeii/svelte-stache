import { defineSiteConfig } from '@svecodocs/kit';

export const siteConfig = defineSiteConfig({
	name: 'Stache',
	url: 'https://svelte-stache.dev',
	ogImage: {
		url: 'https://svelte-stache.dev/og.png',
		height: '630',
		width: '1200'
	},
	description:
		'A state management library for Svelte 5, using runes for reactive data fetching and caching.',
	author: 'Jake',
	keywords: ['svelte', 'svelte 5', 'state management', 'data fetching', 'cache', 'runes'],
	license: {
		name: 'MIT',
		url: 'https://github.com/jake/svelte-stache/blob/main/LICENSE'
	},
	links: {
		github: 'https://github.com/jake/svelte-stache'
	}
});

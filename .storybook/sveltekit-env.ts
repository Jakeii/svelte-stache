// SvelteKit 3's generated `$app/env/*` dev modules read `globalThis.__sveltekit_dev`,
// which is only set up by the SvelteKit dev server, not by Storybook.
// This can be removed when storybook/sveltekit is updated to 11.0.0 or later
Object.assign(globalThis, {
	__sveltekit_dev: { env: {}, ...Reflect.get(globalThis, '__sveltekit_dev') }
});

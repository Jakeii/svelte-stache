import type { Preview } from '@storybook/sveltekit';
import { initialize, mswLoader } from 'msw-storybook-addon';
import '../src/app.css';

initialize({
	onUnhandledRequest: 'bypass',
	quiet: import.meta.env.VITEST_STORYBOOK === 'false'
});

const preview: Preview = {
	initialGlobals: {},
	loaders: [mswLoader],
	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i
			}
		}
	}
};

export default preview;

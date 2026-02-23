import type { Preview } from '@storybook/sveltekit';
import { initialize, mswLoader } from 'msw-storybook-addon';
import '../src/app.css';
// Start MSW service worker with no default handlers (stories provide their own)
initialize({
	onUnhandledRequest: 'bypass'
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

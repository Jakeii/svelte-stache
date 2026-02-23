import type { Preview } from '@storybook/sveltekit';
import { setupWorker } from 'msw/browser';

// Start MSW service worker with no default handlers (stories provide their own)
const worker = setupWorker();

const preview: Preview = {
	initialGlobals: {},
	decorators: [
		async (Story, context) => {
			// Apply per-story MSW handlers if provided
			const handlers = context.parameters?.msw?.handlers ?? [];
			await worker.start({
				onUnhandledRequest: 'bypass',
				serviceWorker: { url: '/mockServiceWorker.js' }
			});
			worker.resetHandlers(...handlers);
			return Story();
		}
	],
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

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createFetchProvider, ALREADY_REGISTERED_ERROR, type HandleFetch } from './fetch';

const ok = (body: string) => Promise.resolve(new Response(body));

const requestEvent = (fetch: typeof globalThis.fetch, url = 'https://app.test/page') => ({
	fetch,
	url: new URL(url)
});

describe('createFetchProvider', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('uses the global fetch when nothing is registered', async () => {
		const globalFetch = vi.fn(() => ok('global'));
		vi.stubGlobal('fetch', globalFetch);
		const api = createFetchProvider();

		const response = await api.fetch('https://example.com/users', { method: 'GET' });

		expect(await response.text()).toBe('global');
		expect(globalFetch).toHaveBeenCalledWith('https://example.com/users', { method: 'GET' });
	});

	it('uses the current request event fetch once registered', async () => {
		const globalFetch = vi.fn(() => ok('global'));
		vi.stubGlobal('fetch', globalFetch);
		const eventFetch = vi.fn(() => ok('event'));
		const api = createFetchProvider();

		api.register(() => requestEvent(eventFetch));
		const response = await api.fetch('/api/users');

		expect(await response.text()).toBe('event');
		expect(eventFetch).toHaveBeenCalledWith('/api/users', undefined);
		expect(globalFetch).not.toHaveBeenCalled();
	});

	it('looks up the request on every call so requests never share a fetch', async () => {
		const requestA = vi.fn(() => ok('a'));
		const requestB = vi.fn(() => ok('b'));
		let current = requestA;
		const api = createFetchProvider();
		api.register(() => requestEvent(current));

		const a = await api.fetch('/me');
		current = requestB;
		const b = await api.fetch('/me');

		expect(await a.text()).toBe('a');
		expect(await b.text()).toBe('b');
	});

	it('decides which fetch to use at call time, so destructuring is safe', async () => {
		const eventFetch = vi.fn(() => ok('event'));
		const api = createFetchProvider();
		const { fetch } = api;

		api.register(() => requestEvent(eventFetch));
		await fetch('/later');

		expect(eventFetch).toHaveBeenCalledOnce();
	});

	it('allows registering the same function again', () => {
		const getRequestEvent = () => requestEvent(vi.fn(() => ok('event')));
		const api = createFetchProvider();

		api.register(getRequestEvent);

		expect(() => api.register(getRequestEvent)).not.toThrow();
	});

	it('throws when a different function is registered, e.g. from inside handle', () => {
		const api = createFetchProvider();
		api.register(() => requestEvent(vi.fn(() => ok('first'))));

		expect(() => api.register(() => requestEvent(vi.fn(() => ok('second'))))).toThrow(
			ALREADY_REGISTERED_ERROR
		);
	});

	it('does not fall back to the global fetch when the request event is unavailable', () => {
		const globalFetch = vi.fn(() => ok('global'));
		vi.stubGlobal('fetch', globalFetch);
		const api = createFetchProvider();
		api.register(() => {
			throw new Error(
				'Can only read the current request event inside functions invoked during `handle`'
			);
		});

		expect(() => api.fetch('/me')).toThrow('Can only read the current request event');
		expect(globalFetch).not.toHaveBeenCalled();
	});

	describe('handleFetch', () => {
		it('runs in the browser with no event and the global fetch', async () => {
			const globalFetch = vi.fn<typeof fetch>((request) =>
				request instanceof Request ? ok(request.headers.get('x-client') ?? '') : ok('')
			);
			vi.stubGlobal('fetch', globalFetch);
			const handleFetch = vi.fn<HandleFetch>(({ request, fetch }) => {
				request.headers.set('x-client', 'web');
				return fetch(request);
			});
			const api = createFetchProvider({ handleFetch });

			const response = await api.fetch('https://example.com/users', { method: 'POST' });

			expect(await response.text()).toBe('web');
			expect(handleFetch.mock.calls[0][0].event).toBeUndefined();
			expect(handleFetch.mock.calls[0][0].request.method).toBe('POST');
		});

		it('runs on the server with the event, event.fetch and relative URLs resolved', async () => {
			const eventFetch = vi.fn<typeof fetch>((request) =>
				request instanceof Request
					? ok(`${request.url} ${request.headers.get('authorization')}`)
					: ok('not a request')
			);
			const api = createFetchProvider<{ fetch: typeof fetch; url: URL; token: string }>({
				handleFetch: ({ request, fetch, event }) => {
					if (event) {
						request.headers.set('authorization', `Bearer ${event.token}`);
					}
					return fetch(request);
				}
			});
			api.register(() => ({ ...requestEvent(eventFetch), token: 'abc' }));

			const response = await api.fetch('/api/users');

			expect(await response.text()).toBe('https://app.test/api/users Bearer abc');
		});

		it('lets the handler return its own response without fetching', async () => {
			const globalFetch = vi.fn(() => ok('global'));
			vi.stubGlobal('fetch', globalFetch);
			const api = createFetchProvider({
				handleFetch: () => new Response('cached')
			});

			const response = await api.fetch('https://example.com/users');

			expect(await response.text()).toBe('cached');
			expect(globalFetch).not.toHaveBeenCalled();
		});

		it('turns errors thrown by the handler into a rejected promise', async () => {
			const api = createFetchProvider({
				handleFetch: () => {
					throw new Error('offline');
				}
			});

			await expect(api.fetch('https://example.com/users')).rejects.toThrow('offline');
		});
	});
});

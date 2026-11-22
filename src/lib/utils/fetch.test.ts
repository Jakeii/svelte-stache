import { describe, it, expect, vi, afterEach } from 'vitest';
import { createFetchProvider, ALREADY_REGISTERED_ERROR } from './fetch';

const ok = (body: string) => Promise.resolve(new Response(body));

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

		api.register(() => ({ fetch: eventFetch }));
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
		api.register(() => ({ fetch: current }));

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

		api.register(() => ({ fetch: eventFetch }));
		await fetch('/later');

		expect(eventFetch).toHaveBeenCalledOnce();
	});

	it('allows registering the same function again', () => {
		const getRequestEvent = () => ({ fetch: vi.fn(() => ok('event')) });
		const api = createFetchProvider();

		api.register(getRequestEvent);

		expect(() => api.register(getRequestEvent)).not.toThrow();
	});

	it('throws when a different function is registered, e.g. from inside handle', () => {
		const api = createFetchProvider();
		api.register(() => ({ fetch: vi.fn(() => ok('first')) }));

		expect(() => api.register(() => ({ fetch: vi.fn(() => ok('second')) }))).toThrow(
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
});

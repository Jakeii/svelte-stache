type Fetch = typeof fetch;

/**
 * The parts of SvelteKit's `RequestEvent` that the provider uses.
 */
type RequestEventLike = { fetch: Fetch; url: URL };

/**
 * SvelteKit's `getRequestEvent` (from `$app/server`), or anything with the same shape.
 */
type GetRequestEvent<Event extends RequestEventLike = RequestEventLike> = () => Event;

/**
 * Augments or replaces every fetch made through the provider. Shaped like SvelteKit's `handleFetch`.
 * Call `fetch(request)` to continue with the request, or return any `Response`.
 *
 * - On the server, `event` is the current request's event, `fetch` is `event.fetch`, and relative URLs
 *   are already resolved against the page URL. SvelteKit's own `handleFetch` hook still runs afterwards.
 * - In the browser, `event` is `undefined` and `fetch` is the global `fetch`.
 */
type HandleFetch<Event extends RequestEventLike = RequestEventLike> = (input: {
	request: Request;
	fetch: Fetch;
	event: Event | undefined;
}) => Response | Promise<Response>;

type FetchProviderOptions<Event extends RequestEventLike = RequestEventLike> = {
	/**
	 * Runs for every fetch, on the server and in the browser. Check `event` to tell them apart.
	 */
	handleFetch?: HandleFetch<Event>;
};

type FetchProvider<Event extends RequestEventLike = RequestEventLike> = {
	/**
	 * Registers SvelteKit's `getRequestEvent` so `fetch` uses the current request's `event.fetch` on the server.
	 *
	 * Call it once at the top level of `hooks.server.ts`, passing `getRequestEvent` itself.
	 * Never pass a function that closes over a specific `event` (e.g. inside `handle`), as every request would share it.
	 *
	 * @throws If a different function has already been registered.
	 */
	register: (getRequestEvent: GetRequestEvent<Event>) => void;
	/**
	 * Fetches with the current request's `event.fetch` on the server, or the global `fetch` in the browser,
	 * passing through `handleFetch` if one was given.
	 *
	 * Which fetch to use is decided when it's called, so it is safe to destructure or pass around.
	 */
	fetch: Fetch;
};

const ALREADY_REGISTERED_ERROR =
	'A different getRequestEvent has already been registered with this fetch provider. Call register(getRequestEvent) once at the top level of hooks.server.ts, not inside handle.';

const toRequest = (input: RequestInfo | URL, init: RequestInit | undefined, base?: URL) =>
	input instanceof Request ? new Request(input, init) : new Request(new URL(input, base), init);

// Runs a handler so that errors it throws become a rejected promise, like a failed fetch
const runHandler = async (handler: () => Response | Promise<Response>) => handler();

/**
 * Creates a fetch that is isolated per request on the server and works anywhere in the browser.
 *
 * On the server, nothing request-specific is stored: the registered `getRequestEvent` looks up the
 * current request each time `fetch` is called. The browser never registers anything, so it uses
 * the global `fetch`, which works outside components (invalidation, focus refetches, timers).
 *
 * @example
 * ```ts
 * // src/lib/api.ts
 * export const api = createFetchProvider<RequestEvent>({
 * 	handleFetch: ({ request, fetch, event }) => {
 * 		if (event) {
 * 			request.headers.set('authorization', `Bearer ${event.locals.token}`);
 * 		}
 * 		return fetch(request);
 * 	}
 * });
 *
 * // src/hooks.server.ts
 * import { getRequestEvent } from '$app/server';
 * api.register(getRequestEvent);
 *
 * // In a stache fetch function
 * fetch: async (id: string) => (await api.fetch(`/api/users/${id}`)).json()
 * ```
 */
const createFetchProvider = <Event extends RequestEventLike = RequestEventLike>({
	handleFetch
}: FetchProviderOptions<Event> = {}): FetchProvider<Event> => {
	let getRequestEvent: GetRequestEvent<Event> | undefined;

	const register = (fn: GetRequestEvent<Event>) => {
		if (getRequestEvent && getRequestEvent !== fn) {
			throw new Error(ALREADY_REGISTERED_ERROR);
		}
		getRequestEvent = fn;
	};

	const providerFetch: Fetch = (input, init) => {
		// Read the event synchronously, before anything is awaited
		const event = getRequestEvent?.();
		const fetch = event ? event.fetch : globalThis.fetch;

		if (!handleFetch) {
			return fetch(input, init);
		}
		const request = toRequest(input, init, event?.url);
		return runHandler(() => handleFetch({ request, fetch, event }));
	};

	return {
		register,
		fetch: providerFetch
	};
};

export { createFetchProvider, ALREADY_REGISTERED_ERROR };
export type { FetchProvider, FetchProviderOptions, GetRequestEvent, HandleFetch, RequestEventLike };

type Fetch = typeof fetch;

/**
 * The part of SvelteKit's `getRequestEvent` (from `$app/server`) that the provider uses.
 */
type GetRequestEvent = () => { fetch: Fetch };

type FetchProvider = {
	/**
	 * Registers SvelteKit's `getRequestEvent` so `fetch` uses the current request's `event.fetch` on the server.
	 *
	 * Call it once at the top level of `hooks.server.ts`, passing `getRequestEvent` itself.
	 * Never pass a function that closes over a specific `event` (e.g. inside `handle`), as every request would share it.
	 *
	 * @throws If a different function has already been registered.
	 */
	register: (getRequestEvent: GetRequestEvent) => void;
	/**
	 * Fetches with the current request's `event.fetch` on the server, or the global `fetch` in the browser.
	 *
	 * Which fetch to use is decided when it's called, so it is safe to destructure or pass around.
	 * On the server, `event.fetch` forwards the request's cookies to the app's origin and its subdomains,
	 * resolves relative URLs, and runs through the `handleFetch` hook.
	 */
	fetch: Fetch;
};

const ALREADY_REGISTERED_ERROR =
	'A different getRequestEvent has already been registered with this fetch provider. Call register(getRequestEvent) once at the top level of hooks.server.ts, not inside handle.';

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
 * export const api = createFetchProvider();
 *
 * // src/hooks.server.ts
 * import { getRequestEvent } from '$app/server';
 * api.register(getRequestEvent);
 *
 * // In a stache fetch function
 * fetch: async (id: string) => (await api.fetch(`/api/users/${id}`)).json()
 * ```
 */
const createFetchProvider = (): FetchProvider => {
	let getRequestEvent: GetRequestEvent | undefined;

	const register = (fn: GetRequestEvent) => {
		if (getRequestEvent && getRequestEvent !== fn) {
			throw new Error(ALREADY_REGISTERED_ERROR);
		}
		getRequestEvent = fn;
	};

	const resolveFetch = (): Fetch => (getRequestEvent ? getRequestEvent().fetch : globalThis.fetch);

	return {
		register,
		fetch: (input, init) => resolveFetch()(input, init)
	};
};

export { createFetchProvider, ALREADY_REGISTERED_ERROR };
export type { FetchProvider, GetRequestEvent };

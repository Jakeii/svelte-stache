import { clearGlobalPagedStacheCache, invalidatePagedStacheById } from './paged/paged-cache.svelte';
import { clearGlobalStacheCache, invalidateStacheById } from './stache/cache.svelte';

function isPlainObject(x: unknown) {
	if (Object.prototype.toString.call(x) !== '[object Object]') {
		return false;
	}
	const prototype = Object.getPrototypeOf(x);
	return prototype === null || prototype === Object.prototype;
}

function hashKey(queryKey?: unknown[] | unknown): string {
	return JSON.stringify(queryKey, (_, val) =>
		isPlainObject(val)
			? Object.keys(val)
					.sort()
					.reduce(
						(result, key) => {
							result[key] = val[key];
							return result;
						},
						{} as Record<string, unknown>
					)
			: val
	);
}

/**
 * Clear all stache caches, useful for testing.
 */
const clearAllCaches = () => {
	clearGlobalStacheCache();
	clearGlobalPagedStacheCache();
};

/**
 * Invalidate a stache by its ID.
 **/
const invalidateStache = (id: string) => {
	invalidateStacheById(id);
	invalidatePagedStacheById(id);
};

export { hashKey, clearAllCaches, invalidateStache };

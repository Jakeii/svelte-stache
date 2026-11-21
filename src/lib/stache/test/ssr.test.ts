import { describe, it, expect, vi, afterEach } from 'vitest';
import { createStache } from '../stache.svelte';
import { createPagedStache } from '../../paged/paged.svelte';
import { StacheCache } from '../../cache.svelte';
import { SSR_INVALIDATE_WARNING } from '../../utils';

// Runs in the node (server) project, where there is no `window`

describe('factory invalidate during SSR', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('createStache invalidate warns and does not touch the cache', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const invalidateStache = vi.spyOn(StacheCache.prototype, 'invalidateStache');
		const { invalidate } = createStache({
			id: 'ssr-invalidate',
			fetch: (id: string) => Promise.resolve(id),
			globalCache: new StacheCache()
		});

		invalidate('a');
		invalidate();

		expect(warn).toHaveBeenCalledTimes(2);
		expect(warn).toHaveBeenCalledWith(SSR_INVALIDATE_WARNING);
		expect(invalidateStache).not.toHaveBeenCalled();
	});

	it('createPagedStache invalidate warns and does not touch the cache', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const invalidatePagedStache = vi.spyOn(StacheCache.prototype, 'invalidatePagedStache');
		const { invalidate } = createPagedStache({
			id: 'ssr-invalidate-paged',
			fetch: (id: string) => Promise.resolve([id]),
			pageSize: 10,
			globalCache: new StacheCache()
		});

		invalidate('a');
		invalidate();

		expect(warn).toHaveBeenCalledTimes(2);
		expect(warn).toHaveBeenCalledWith(SSR_INVALIDATE_WARNING);
		expect(invalidatePagedStache).not.toHaveBeenCalled();
	});
});

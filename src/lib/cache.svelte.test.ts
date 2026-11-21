import { describe, it, expect, vi } from 'vitest';
import { flushSync } from 'svelte';
import { StacheCache } from './cache.svelte';
import { CoreStache } from './core/stache.class.svelte';

const makeStache = (id: string, params: string) =>
	new CoreStache<string, string>(
		{ id, fetch: vi.fn().mockResolvedValue('data') },
		{ params, enabled: false }
	);

const makePageStache = (id: string, params: string, page: number) =>
	new CoreStache<string, string, string>(
		{ id, fetch: vi.fn().mockResolvedValue('data') },
		{ params, enabled: false },
		{ pageIndex: page, pageSize: 10 }
	);

describe('StacheCache version', () => {
	it('starts at 0', () => {
		expect(new StacheCache().version).toBe(0);
	});

	describe('staches', () => {
		it('increments when a stache is set', () => {
			const cache = new StacheCache();

			cache.setStache('a', 'p1', makeStache('a', 'p1'));
			expect(cache.version).toBe(1);

			cache.setStache('a', 'p2', makeStache('a', 'p2'));
			expect(cache.version).toBe(2);
		});

		it('increments when an existing stache is deleted', () => {
			const cache = new StacheCache();
			cache.setStache('a', 'p1', makeStache('a', 'p1'));
			const before = cache.version;

			cache.deleteStache('a', 'p1');

			expect(cache.version).toBe(before + 1);
		});

		it('does not increment when deleting a missing stache', () => {
			const cache = new StacheCache();
			cache.setStache('a', 'p1', makeStache('a', 'p1'));
			const before = cache.version;

			cache.deleteStache('a', 'missing');
			cache.deleteStache('missing', 'p1');

			expect(cache.version).toBe(before);
		});

		it('does not increment on reads or invalidation', () => {
			const cache = new StacheCache();
			cache.setStache('a', 'p1', makeStache('a', 'p1'));
			const before = cache.version;

			cache.getStache('a', 'p1');
			cache.hasStache('a', 'p1');
			cache.getStacheGroup('a');
			cache.invalidateStache('a');
			cache.invalidateStache('a', 'p1');

			expect(cache.version).toBe(before);
		});
	});

	describe('paged staches', () => {
		it('increments when a page is set', () => {
			const cache = new StacheCache();

			cache.setPagedStachePage('a', 'p1', '0', makePageStache('a', 'p1', 0));
			expect(cache.version).toBe(1);

			cache.setPagedStachePage('a', 'p1', '1', makePageStache('a', 'p1', 1));
			expect(cache.version).toBe(2);
		});

		it('increments when an existing page is deleted', () => {
			const cache = new StacheCache();
			cache.setPagedStachePage('a', 'p1', '0', makePageStache('a', 'p1', 0));
			const before = cache.version;

			cache.deletePagedStachePage('a', 'p1', '0');

			expect(cache.version).toBe(before + 1);
		});

		it('does not increment when deleting a missing page', () => {
			const cache = new StacheCache();
			cache.setPagedStachePage('a', 'p1', '0', makePageStache('a', 'p1', 0));
			const before = cache.version;

			cache.deletePagedStachePage('a', 'p1', 'missing');
			cache.deletePagedStachePage('a', 'missing', '0');
			cache.deletePagedStachePage('missing', 'p1', '0');

			expect(cache.version).toBe(before);
		});

		it('does not increment on reads or invalidation', () => {
			const cache = new StacheCache();
			cache.setPagedStachePage('a', 'p1', '0', makePageStache('a', 'p1', 0));
			const before = cache.version;

			cache.getPagedStachePage('a', 'p1', '0');
			cache.getPagedStache('a', 'p1');
			cache.getPagedStacheGroup('a');
			cache.invalidatePagedStache('a');
			cache.invalidatePagedStache('a', 'p1', '0');

			expect(cache.version).toBe(before);
		});
	});

	it('increments when cleared', () => {
		const cache = new StacheCache();
		cache.setStache('a', 'p1', makeStache('a', 'p1'));
		cache.setPagedStachePage('b', 'p1', '0', makePageStache('b', 'p1', 0));
		const before = cache.version;

		cache.clear();

		expect(cache.version).toBe(before + 1);
	});

	it('re-runs deriveds that read it when the cache structure changes', () => {
		const cache = new StacheCache();
		const counts: number[] = [];

		const cleanup = $effect.root(() => {
			const total = $derived.by(() => {
				void cache.version;
				return [...cache.stacheCache.values()].reduce((sum, group) => sum + group.size, 0);
			});

			$effect(() => {
				counts.push(total);
			});
		});

		flushSync();
		cache.setStache('a', 'p1', makeStache('a', 'p1'));
		flushSync();
		cache.setStache('a', 'p2', makeStache('a', 'p2'));
		flushSync();
		cache.deleteStache('a', 'p1');
		flushSync();

		expect(counts).toEqual([0, 1, 2, 1]);

		cleanup();
	});
});

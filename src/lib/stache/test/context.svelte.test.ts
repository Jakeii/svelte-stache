import { describe, it, expect, vi, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { createStache } from '../stache.svelte';
import { createPagedStache } from '../../paged/paged.svelte';
import { hashKey } from '../../utils';
import type { StacheCache } from '../../cache.svelte';
import TwoProviders from './fixtures/TwoProviders.svelte';

// Uses real Svelte context (no createContext mock) so each StacheProvider has its own cache

let component: ReturnType<typeof mount> | undefined;

afterEach(() => {
	if (component) {
		unmount(component);
		component = undefined;
	}
});

// Mounts child A then child B, each under its own StacheProvider, and returns their caches
const mountTwoProviders = (useA: () => unknown, useB: () => unknown) => {
	const caches = new Map<string, StacheCache>();
	component = mount(TwoProviders, {
		target: document.body,
		props: { useA, useB, onCache: (name, cache) => caches.set(name, cache) }
	});
	flushSync();

	const cacheA = caches.get('A');
	const cacheB = caches.get('B');
	if (!cacheA || !cacheB) throw new Error('caches were not captured');
	return { cacheA, cacheB };
};

describe('createStache with multiple StacheProviders', () => {
	it('keeps a stache in its own provider cache when params change', () => {
		const { useStache } = createStache({
			id: 'multi-provider',
			fetch: vi.fn((params: string) => Promise.resolve(params))
		});
		const params = $state({ a: 'a1', b: 'b1' });

		const { cacheA, cacheB } = mountTwoProviders(
			() => useStache(() => ({ params: params.a })),
			() => useStache(() => ({ params: params.b }))
		);

		expect(cacheA).not.toBe(cacheB);
		expect(cacheA.hasStache('multi-provider', hashKey('a1'))).toBe(true);
		expect(cacheB.hasStache('multi-provider', hashKey('b1'))).toBe(true);

		// Child B mounted last; A's param change must still use A's provider cache
		params.a = 'a2';
		flushSync();

		expect.soft(cacheA.hasStache('multi-provider', hashKey('a2'))).toBe(true);
		expect.soft(cacheB.hasStache('multi-provider', hashKey('a2'))).toBe(false);
	});
});

describe('factory invalidate with multiple StacheProviders', () => {
	it('createStache invalidate reaches every provider cache', () => {
		const { useStache, invalidate } = createStache({
			id: 'multi-provider-invalidate',
			fetch: vi.fn((params: string) => Promise.resolve(params))
		});

		const { cacheA, cacheB } = mountTwoProviders(
			() => useStache(() => ({ params: 'shared' })),
			() => useStache(() => ({ params: 'shared' }))
		);
		const invalidateA = vi.spyOn(cacheA, 'invalidateStache');
		const invalidateB = vi.spyOn(cacheB, 'invalidateStache');

		invalidate('shared');

		expect(invalidateA).toHaveBeenCalledWith('multi-provider-invalidate', hashKey('shared'));
		expect(invalidateB).toHaveBeenCalledWith('multi-provider-invalidate', hashKey('shared'));
	});

	it('createPagedStache invalidate reaches every provider cache', async () => {
		const { useStache, invalidate } = createPagedStache({
			id: 'multi-provider-paged-invalidate',
			fetch: vi.fn((params: string) => Promise.resolve([params])),
			pageSize: 2
		});
		const pageParams = { pageOffset: 0, pageCount: 1 };

		const { cacheA, cacheB } = mountTwoProviders(
			() => useStache(() => ({ params: 'a', pageParams })),
			() => useStache(() => ({ params: 'b', pageParams }))
		);
		const invalidateA = vi.spyOn(cacheA, 'invalidatePagedStache');
		const invalidateB = vi.spyOn(cacheB, 'invalidatePagedStache');

		await invalidate();

		expect(invalidateA).toHaveBeenCalledWith(
			'multi-provider-paged-invalidate',
			undefined,
			undefined
		);
		expect(invalidateB).toHaveBeenCalledWith(
			'multi-provider-paged-invalidate',
			undefined,
			undefined
		);
	});

	it('stops reaching a provider once it is unmounted', () => {
		const { useStache, invalidate } = createStache({
			id: 'unmounted-provider-invalidate',
			fetch: vi.fn((params: string) => Promise.resolve(params))
		});

		const { cacheA, cacheB } = mountTwoProviders(
			() => useStache(() => ({ params: 'a' })),
			() => useStache(() => ({ params: 'b' }))
		);
		const invalidateA = vi.spyOn(cacheA, 'invalidateStache');
		const invalidateB = vi.spyOn(cacheB, 'invalidateStache');

		if (component) unmount(component);
		component = undefined;
		invalidate();

		expect(invalidateA).not.toHaveBeenCalled();
		expect(invalidateB).not.toHaveBeenCalled();
	});
});

describe('createPagedStache with multiple StacheProviders', () => {
	it('keeps pages in their own provider cache when page params change', () => {
		const pageSize = 2;
		const { useStache } = createPagedStache({
			id: 'multi-provider-paged',
			fetch: vi.fn((params: string, { pageIndex }: { pageIndex: number }) =>
				Promise.resolve([`${params}-${pageIndex}`])
			),
			pageSize
		});
		const pageCountA = $state({ value: 1 });

		const { cacheA, cacheB } = mountTwoProviders(
			() =>
				useStache(() => ({
					params: 'a',
					pageParams: { pageOffset: 0, pageCount: pageCountA.value }
				})),
			() => useStache(() => ({ params: 'b', pageParams: { pageOffset: 0, pageCount: 1 } }))
		);

		const pageKey = (pageIndex: number) => hashKey({ pageIndex, pageSize });
		const pageOf = (cache: StacheCache, params: string, pageIndex: number) =>
			cache.getPagedStachePage('multi-provider-paged', hashKey(params), pageKey(pageIndex));

		expect(cacheA).not.toBe(cacheB);
		expect(pageOf(cacheA, 'a', 0)).toBeDefined();
		expect(pageOf(cacheB, 'b', 0)).toBeDefined();

		// Child B mounted last; A loading another page must still use A's provider cache
		pageCountA.value = 2;
		flushSync();

		expect.soft(pageOf(cacheA, 'a', 1)).toBeDefined();
		expect.soft(pageOf(cacheB, 'a', 1)).toBeUndefined();
	});
});

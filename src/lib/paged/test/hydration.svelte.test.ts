import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPagedStache } from '../paged.svelte';
import { StacheCache } from '../../cache';

const hydratableMock = vi.hoisted(() =>
	vi.fn(<T>(key: string, fetcher: () => Promise<T>) => Promise.resolve(fetcher()))
);

vi.mock('svelte', async () => {
	const svelte = await vi.importActual('svelte');
	return {
		...svelte,
		hydratable: hydratableMock
	};
});

function withEffectRoot(fn: () => void | Promise<void>) {
	return async () => {
		let promise: void | Promise<void> = Promise.resolve();
		const cleanup = $effect.root(() => {
			promise = fn();
		});
		await promise;
		cleanup();
	};
}

describe('createPagedStache hydration', () => {
	beforeEach(() => {
		hydratableMock.mockClear();
	});

	it(
		'should wrap each page fetch in hydratable with a unique key when isHydratable is true',
		withEffectRoot(async () => {
			const fetchFn = vi
				.fn()
				.mockImplementation((params, { pageIndex }) => Promise.resolve([pageIndex]));

			const { useStache } = createPagedStache({
				id: 'hydratable-paged',
				fetch: fetchFn,
				pageSize: 10,
				isHydratable: true,
				globalCache: new StacheCache()
			});

			const params = $state({ query: 'test' });
			const stache = await useStache(() => ({
				params,
				pageParams: { pageOffset: 0, pageCount: 2 }
			}));

			expect(stache.data).toEqual([0, 1]);
			expect(hydratableMock).toHaveBeenCalledTimes(2);

			const keys = hydratableMock.mock.calls.map(([key]) => key);
			expect(new Set(keys).size).toBe(2);
			keys.forEach((key) => expect(key).toMatch(/^stache:hydratable-paged:/));
		})
	);

	it(
		'should not use hydratable when isHydratable is not set',
		withEffectRoot(async () => {
			const fetchFn = vi.fn().mockResolvedValue([1]);

			const { useStache } = createPagedStache({
				id: 'non-hydratable-paged',
				fetch: fetchFn,
				pageSize: 10,
				globalCache: new StacheCache()
			});

			const params = $state({ query: 'test' });
			await useStache(() => ({ params }));

			expect(fetchFn).toHaveBeenCalledTimes(1);
			expect(hydratableMock).not.toHaveBeenCalled();
		})
	);
});

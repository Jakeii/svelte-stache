import { createContext } from 'svelte';
import type { CoreStache } from './core/stache.class.svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StacheGroup = Map<string, CoreStache<any, any>>;

type PagedStache<FetchParams, FetchReturnData> = Map<
	string,
	CoreStache<FetchParams, FetchReturnData>
>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PagedStacheGroup = Map<string, PagedStache<any, any>>;

/**
 * A cache for staches, organized by stache ID and hashed parameters. Provides methods for retrieving, setting, and invalidating staches.
 */
class StacheCache {
	readonly stacheCache: Map<string, StacheGroup> = new Map();

	readonly pagedStacheCache: Map<string, PagedStacheGroup> = new Map();

	getStache<FetchParams, FetchReturnData>(
		id: string,
		hashedParamsKey: string
	): CoreStache<FetchParams, FetchReturnData> | undefined {
		return this.stacheCache.get(id)?.get(hashedParamsKey);
	}

	setStache<FetchParams, FetchReturnData>(
		id: string,
		hashedParamsKey: string,
		stache: CoreStache<FetchParams, FetchReturnData>
	): void {
		let stacheGroup = this.stacheCache.get(id);
		if (!stacheGroup) {
			stacheGroup = new Map<string, CoreStache<FetchParams, FetchReturnData>>();
			this.stacheCache.set(id, stacheGroup);
		}
		stacheGroup.set(hashedParamsKey, stache);
	}

	deleteStache(id: string, hashedParamsKey: string): void {
		const stacheGroup = this.stacheCache.get(id);
		if (stacheGroup) {
			stacheGroup.delete(hashedParamsKey);
			if (stacheGroup.size === 0) {
				this.stacheCache.delete(id);
			}
		}
	}

	hasStache(id: string, hashedParamsKey: string): boolean {
		const stacheGroup = this.stacheCache.get(id);
		return stacheGroup ? stacheGroup.has(hashedParamsKey) : false;
	}

	getStacheGroup(id: string): StacheGroup | undefined {
		const stacheGroup = this.stacheCache.get(id);
		return stacheGroup;
	}

	invalidateStache(id: string, hashedParamsKey?: string): void {
		const stacheGroup = this.stacheCache.get(id);

		if (stacheGroup) {
			if (hashedParamsKey) {
				const stache = stacheGroup?.get(hashedParamsKey);
				if (stache) {
					stache.invalidate();
				}
			} else {
				for (const stache of stacheGroup.values()) {
					stache.invalidate();
				}
			}
		}
	}

	getPagedStachePage<FetchParams, FetchReturnData>(
		id: string,
		stacheKey: string,
		pageKey: string
	): CoreStache<FetchParams, FetchReturnData> | undefined {
		return this.pagedStacheCache.get(id)?.get(stacheKey)?.get(pageKey);
	}

	setPagedStachePage<FetchParams, FetchReturnData>(
		id: string,
		stacheKey: string,
		pageKey: string,
		stache: CoreStache<FetchParams, FetchReturnData>
	): void {
		let stacheGroup = this.pagedStacheCache.get(id);
		if (!stacheGroup) {
			stacheGroup = new Map<string, PagedStache<FetchParams, FetchReturnData>>();
			this.pagedStacheCache.set(id, stacheGroup);
		}
		let pageCache = stacheGroup.get(stacheKey);
		if (!pageCache) {
			pageCache = new Map<string, CoreStache<FetchParams, FetchReturnData>>();
			stacheGroup.set(stacheKey, pageCache);
		}
		pageCache.set(pageKey, stache);
	}

	getPagedStache<FetchParams, FetchReturnData>(
		id: string,
		stacheKey: string
	): PagedStache<FetchParams, FetchReturnData> | undefined {
		return this.pagedStacheCache.get(id)?.get(stacheKey);
	}

	getPagedStacheGroup(id: string): PagedStacheGroup | undefined {
		return this.pagedStacheCache.get(id);
	}

	deletePagedStachePage(id: string, stacheKey: string, pageKey: string): void {
		const stacheGroup = this.pagedStacheCache.get(id);
		const pageCache = stacheGroup?.get(stacheKey);
		if (pageCache) {
			pageCache.delete(pageKey);
			if (pageCache.size === 0) {
				stacheGroup?.delete(stacheKey);
				if (stacheGroup?.size === 0) {
					this.pagedStacheCache.delete(id);
				}
			}
		}
	}

	invalidatePagedStache(id: string, stacheKey?: string, pageKey?: string): void {
		const stacheGroup = this.pagedStacheCache.get(id);
		if (stacheKey) {
			const pageCache = stacheGroup?.get(stacheKey);
			if (pageCache) {
				if (pageKey) {
					const stache = pageCache.get(pageKey);
					if (stache) {
						stache.invalidate();
					}
				} else {
					for (const stache of pageCache.values()) {
						stache.invalidate();
					}
				}
			}
		} else if (stacheGroup) {
			for (const pageCache of stacheGroup.values()) {
				for (const stache of pageCache.values()) {
					stache.invalidate();
				}
			}
		}
	}

	clear(): void {
		this.stacheCache.forEach((stacheGroup) => stacheGroup.clear());
		this.stacheCache.clear();
		this.pagedStacheCache.forEach((stacheGroup) => {
			stacheGroup.forEach((pageCache) => pageCache.clear());
			stacheGroup.clear();
		});
		this.pagedStacheCache.clear();
	}
}

const [getStacheCacheContext, setStacheCacheContext] = createContext<StacheCache>();

const initStacheCache = (): void => {
	setStacheCacheContext(new StacheCache());
};

const getStacheCache = (): StacheCache => {
	try {
		return getStacheCacheContext();
	} catch (error) {
		if (error instanceof Error) {
			if (error.message.includes('missing_context')) {
				throw new Error('Staches can only be used within a component wrapped by `StacheProvider`', {
					cause: error
				});
			} else if (error.message.includes('lifecycle_outside_component')) {
				throw new Error(
					'Staches can only be used during component initialisation as it depends on svelte context\nhttps://svelte.dev/e/lifecycle_outside_component',
					{ cause: error }
				);
			}
		}
		throw error;
	}
};

export { StacheCache, getStacheCache, initStacheCache };
export type { StacheGroup, PagedStacheGroup, PagedStache };

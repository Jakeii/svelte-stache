import { SvelteDate } from 'svelte/reactivity';
import { tick, untrack } from 'svelte';
import {
	getPageCache,
	getPagedStache,
	getPagedStacheCache,
	type GlobalPagedStacheCache,
	type PagedStacheCache
} from './cache/paged-stache.svelte';
import {
	Stache,
	type StacheConstructorOptions,
	type PagedFetchFn,
	type UsePagedStacheOptions,
	type FetchPageParams
} from './stache.class.svelte';
import type { PublicStache, UseStacheFn } from './stache.svelte';
import { hashKey } from './utils';
import type { Exact, Merge } from 'type-fest';

type CreatePagedStacheOptions<StacheParams, Result, FetchReturnData> = Merge<
	StacheConstructorOptions<StacheParams, Result, FetchReturnData>,
	{
		fetch: PagedFetchFn<StacheParams, FetchReturnData>;
		pageSize: number;
		getData?: (data: FetchReturnData) => Result;
		getTotalCount?: (data: FetchReturnData) => number;
		globalCache?: GlobalPagedStacheCache;
	}
>;

type CreatePagedStacheFn = <StacheParams, Result, FetchReturnData>(
	defineOptions: CreatePagedStacheOptions<StacheParams, Result, FetchReturnData>
) => {
	useStache: UseStacheFn<StacheParams, Result>;
	/**
	 * Invalidates the paged stache with the given parameters, if it exists.
	 * @param args The parameters of the paged stache to invalidate.
	 */
	invalidate: (args: StacheParams) => void;
};

type PublicPagedStache<Params, Result = unknown, FetchReturnData = unknown> = Merge<
	Pick<
		Stache<Params, Result, FetchReturnData>,
		| 'data'
		| 'enabled'
		| 'error'
		| 'fetchStatus'
		| 'lastFetched'
		| 'invalidate'
		| 'cacheStatus'
		| 'referenceCount'
		| 'params'
	>,
	{
		_stache: Stache<Params, Result, FetchReturnData> | null;
		data: Result | null;
		isError: boolean;
		isLoading: boolean;
		isSuccess: boolean;
		totalCount: number;
	}
>;

// Helper function to create/retrieve page staches
const getOrCreatePageStaches = <StacheParams, Result, FetchReturnData>(
	cache: PagedStacheCache,
	createOptions: CreatePagedStacheOptions<StacheParams, Result, FetchReturnData>,
	useOptions: UsePagedStacheOptions<StacheParams, Result>
): Array<Stache<StacheParams, Result, FetchReturnData>> => {
	const { pageOffset = 0, pageCount = 1 } = useOptions.pageParams || {};
	const { pageSize = 10 } = createOptions;

	const stacheKey = hashKey(useOptions?.params);

	const pageCache = getPageCache<StacheParams, Result, FetchReturnData>(cache, stacheKey);

	return Array.from({ length: pageCount }, (_, i) => i).map((i) => {
		const pageIndex = pageOffset + i;
		const pageStacheKey = hashKey({
			pageIndex,
			pageSize
		});

		let stache = getPagedStache<StacheParams, Result, FetchReturnData>(pageCache, pageStacheKey);

		if (!stache) {
			const fetchPageParams: FetchPageParams = {
				pageIndex,
				pageSize
			};

			const stacheConstructorOptions: StacheConstructorOptions<
				StacheParams,
				Result,
				FetchReturnData
			> = {
				id: createOptions.id,
				fetch: createOptions.fetch,
				retries: createOptions.retries,
				staleTime: createOptions.staleTime,
				cleanupTime: createOptions.cleanupTime,
				refetchOnStale: createOptions.refetchOnStale,
				refetchOnWindowFocus: createOptions.refetchOnWindowFocus,
				globalCache: createOptions.globalCache
			};

			const usePagedOptions: UsePagedStacheOptions<StacheParams, Result> = {
				params: useOptions.params as StacheParams,
				enabled: useOptions.enabled
			};

			stache = new Stache<StacheParams, Result, FetchReturnData>(
				stacheConstructorOptions,
				usePagedOptions,
				fetchPageParams
			);

			pageCache.set(pageStacheKey, stache);
		} else {
			stache.referenceCount++;
		}
		return stache;
	});
};

/**
 * Creates a paged stache definition with the given options.
 * The returned `useStache` function can be used to create and manage stache instances.
 *
 *
 *
 * @param createOptions The options to define the stache.
 * @returns An object containing the `useStache` function and an `invalidate` method.
 */
const createPagedStache = <StacheParams, Result, FetchReturnData>(
	createOptions: CreatePagedStacheOptions<StacheParams, Result, FetchReturnData>
) => {
	const cache = getPagedStacheCache(createOptions.id, createOptions.globalCache);

	const useStache = <T extends Exact<UsePagedStacheOptions<StacheParams, Result>, T>>(
		useOptionsFn: () => T = () => ({}) as T
	) => {
		const useOptions = useOptionsFn() as UsePagedStacheOptions<StacheParams, Result>;
		const { getData, getTotalCount } = createOptions;

		let effectHasRun = $state(false);
		let pages = $state(
			getOrCreatePageStaches<StacheParams, Result, FetchReturnData>(
				cache,
				createOptions,
				useOptions
			)
		);

		const { pageSize = 10 } = createOptions;

		// Effect to reactively update pages when pageParams change
		$effect.pre(() => {
			const useOptions = useOptionsFn() as UsePagedStacheOptions<StacheParams, Result>;

			// Use untrack to avoid infinite loops when updating pages
			untrack(() => {
				if (!effectHasRun) {
					effectHasRun = true;
					return;
				}
				// Get new pages based on updated pageParams
				pages = getOrCreatePageStaches<StacheParams, Result, FetchReturnData>(
					cache,
					createOptions,
					useOptions
				);
			});

			return () => {
				const stacheKey = hashKey(useOptions?.params);

				const pageCache = getPageCache<StacheParams, Result, FetchReturnData>(cache, stacheKey);
				// Cleanup: Decrement reference count of page staches when effect re-runs or component unmounts
				pages.forEach((stache, pageIndex) => {
					const pageStacheKey = hashKey({
						pageIndex,
						pageSize
					});
					if (stache.referenceCount > 0) {
						stache.referenceCount--;
					}
					if (stache.referenceCount === 0) {
						// Schedule cleanup of stache if no longer referenced
						void tick().then(() => {
							if (stache.referenceCount <= 0) {
								stache.cleanupTimeout = setTimeout(() => {
									if (stache.referenceCount <= 0) {
										pageCache.delete(pageStacheKey);

										if (pageCache.size === 0) {
											cache.delete(stacheKey);
										}
									}
									stache.cleanupTimeout = null;
								}, stache.cleanupTime);
							}
						});
					}
				});
			};
		});

		const pagedStache: PublicPagedStache<StacheParams, Result, FetchReturnData> = {
			// Aggregate data from all page staches
			get data() {
				const pagesData = pages
					.flatMap((stache) => {
						const pageData = stache.data && getData ? getData(stache.data) : stache.data;
						return pageData;
					})
					.filter((page) => {
						return page !== null && page !== undefined;
					});
				return Array.isArray(pagesData) ? (pagesData as unknown as Result) : null;
			},
			get pages() {
				return pages.map((stache) => (stache.data && getData ? getData(stache.data) : stache.data));
			},

			get totalCount() {
				if (getTotalCount) {
					// Assume total count is same across all pages, take from first page
					const firstPage = pages[0];
					return firstPage && firstPage.data ? getTotalCount(firstPage.data as FetchReturnData) : 0;
				}
				return pages.length * pageSize; // Fallback if no getTotalCount provided
			},
			get error() {
				return pages.find((stache) => stache.error)?.error || null;
			},
			get fetchStatus() {
				return pages.some((stache) => stache.fetchStatus === 'loading')
					? 'loading'
					: pages.every((stache) => stache.fetchStatus === 'success')
						? 'success'
						: pages.every((stache) => stache.fetchStatus === 'idle')
							? 'error'
							: 'idle';
			},
			get isError() {
				return pages.some((stache) => stache.fetchStatus === 'error');
			},
			get isLoading() {
				return pages.some((stache) => stache.fetchStatus === 'loading');
			},
			get isSuccess() {
				return pages.every((stache) => stache.fetchStatus === 'success');
			},
			get lastFetched() {
				const dates = pages
					.map((stache) => stache.lastFetched)
					.filter((date): date is SvelteDate => date instanceof Date);
				return dates.length ? new SvelteDate(Math.max(...dates.map((d) => d.getTime()))) : null;
			},
			get cacheStatus() {
				return pages.every((stache) => stache.cacheStatus === 'fresh')
					? 'fresh'
					: pages.some((stache) => stache.cacheStatus === 'stale')
						? 'stale'
						: 'empty';
			},
			get params() {
				return useOptions.params;
			},
			get hasMore() {
				return Array.isArray(this.data) ? this.data.length < this.totalCount : false;
			},
			invalidate: () => {
				pages.forEach((stache) => stache.invalidate());
			},
			get _stache() {
				return null; // Not applicable for paged staches
			}
		};
	};

	const invalidate = async (args: StacheParams) => {
		const stacheKey = hashKey(args);
		for (const stache of cache?.get(stacheKey)?.values() ?? []) {
			await stache.invalidate();
		}
	};

	return {
		useStache,
		invalidate
	};
};

export { createPagedStache };

export type { CreatePagedStacheFn, CreatePagedStacheOptions };

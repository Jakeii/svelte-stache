import { SvelteDate } from 'svelte/reactivity';
import { tick, untrack } from 'svelte';
import {
	getPageCache,
	getPagedStache,
	getPagedStacheCache,
	type GlobalPagedStacheCache,
	type PagedStacheCache
} from './paged-cache.svelte';
import {
	CoreStache,
	type StacheConstructorOptions,
	type PagedFetchFn,
	type UsePagedStacheOptions,
	type FetchPageParams
} from '../core/stache.class.svelte';
import type { UseStacheFn } from '../stache/stache.svelte';
import { hashKey } from '../utils';
import type { Exact, Merge } from 'type-fest';

type CreatePagedStacheOptions<StacheParams, PageResult, PageFetchReturnData> = Merge<
	StacheConstructorOptions<StacheParams, PageFetchReturnData>,
	{
		fetch: PagedFetchFn<StacheParams, PageFetchReturnData>;
		pageSize: number;
		getData?: (data: PageFetchReturnData) => PageResult;
		getTotalCount?: (data: PageFetchReturnData) => number;
		globalCache?: GlobalPagedStacheCache;
	}
>;

type CreatePagedStacheFn = <StacheParams, PageResult, PageFetchReturnData>(
	defineOptions: CreatePagedStacheOptions<StacheParams, PageResult, PageFetchReturnData>
) => {
	useStache: UseStacheFn<StacheParams, PageResult>;
	/**
	 * Invalidates the paged stache with the given parameters, if it exists.
	 * @param args The parameters of the paged stache to invalidate.
	 */
	invalidate: (args: StacheParams) => void;
};

type PagedStache<Params, Result, PageResult = Result[], PageFetchReturnData = unknown> = Merge<
	Pick<
		CoreStache<Params, PageFetchReturnData>,
		| 'data'
		| 'enabled'
		| 'error'
		| 'fetchStatus'
		| 'lastFetched'
		| 'invalidate'
		| 'cacheStatus'
		| 'params'
	>,
	{
		data: Result | null;
		pages: Array<PageResult | null>;
		hasMore: boolean;
		isError: boolean;
		isLoading: boolean;
		isSuccess: boolean;
		totalCount: number;
	}
>;

// Helper function to create/retrieve page staches
const getOrCreatePageStaches = <StacheParams, PageResult, PageFetchReturnData>(
	cache: PagedStacheCache,
	createOptions: CreatePagedStacheOptions<StacheParams, PageResult, PageFetchReturnData>,
	useOptions: UsePagedStacheOptions<StacheParams, PageResult>
): Array<CoreStache<StacheParams, PageFetchReturnData>> => {
	const { pageOffset = 0, pageCount = 1 } = useOptions.pageParams || {};
	const { pageSize = 10 } = createOptions;

	const stacheKey = hashKey(useOptions?.params);

	const pageCache = getPageCache<StacheParams, PageFetchReturnData>(cache, stacheKey);

	return Array.from({ length: pageCount }, (_, i) => i).map((i) => {
		const pageIndex = pageOffset + i;
		const pageStacheKey = hashKey({
			pageIndex,
			pageSize
		});

		let stache = getPagedStache<StacheParams, PageFetchReturnData>(pageCache, pageStacheKey);

		if (!stache) {
			const fetchPageParams: FetchPageParams = {
				pageIndex,
				pageSize
			};

			const stacheConstructorOptions: StacheConstructorOptions<StacheParams, PageFetchReturnData> =
				{
					id: createOptions.id,
					fetch: createOptions.fetch,
					retries: createOptions.retries,
					staleTime: createOptions.staleTime,
					cleanupTime: createOptions.cleanupTime,
					refetchOnStale: createOptions.refetchOnStale,
					refetchOnWindowFocus: createOptions.refetchOnWindowFocus,
					globalCache: createOptions.globalCache
				};

			const usePagedOptions: UsePagedStacheOptions<StacheParams, PageResult> = {
				params: useOptions.params as StacheParams,
				enabled: useOptions.enabled
			};

			stache = new CoreStache<StacheParams, PageFetchReturnData>(
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
const createPagedStache = <
	StacheParams,
	PageResult extends Array<unknown>,
	PageFetchReturnData,
	Result = PageResult
>(
	createOptions: CreatePagedStacheOptions<StacheParams, PageResult, PageFetchReturnData>
) => {
	const cache = getPagedStacheCache(createOptions.id, createOptions.globalCache);

	const useStache = <T extends Exact<UsePagedStacheOptions<StacheParams, PageResult>, T>>(
		useOptionsFn: () => T = () => ({}) as T
	) => {
		const useOptions = useOptionsFn() as UsePagedStacheOptions<StacheParams, PageResult>;
		const {
			getData = (data: PageFetchReturnData) => data as unknown as PageResult,
			getTotalCount
		} = createOptions;

		let effectHasRun = $state(false);
		let pages = $state(
			getOrCreatePageStaches<StacheParams, PageResult, PageFetchReturnData>(
				cache,
				createOptions,
				useOptions
			)
		);

		const { pageSize = 10 } = createOptions;

		// Effect to reactively update pages when pageParams change
		$effect.pre(() => {
			const useOptions = useOptionsFn() as UsePagedStacheOptions<StacheParams, PageResult>;

			// Use untrack to avoid infinite loops when updating pages
			untrack(() => {
				if (!effectHasRun) {
					effectHasRun = true;
					return;
				}
				// Get new pages based on updated pageParams
				pages = getOrCreatePageStaches<StacheParams, PageResult, PageFetchReturnData>(
					cache,
					createOptions,
					useOptions
				);
			});

			return () => {
				const stacheKey = hashKey(useOptions?.params);

				const pageCache = getPageCache<StacheParams, PageResult>(cache, stacheKey);
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

		const pagedStache: PagedStache<StacheParams, Result, PageResult, PageFetchReturnData> = {
			// Aggregate data from all page staches
			get data() {
				const pagesData = this.pages
					.filter((page) => {
						return page !== null && page !== undefined;
					})
					.flat() as Result;
				return pagesData;
			},
			get pages() {
				return pages.map((stache) => (stache.data ? getData(stache.data) : null));
			},

			get enabled() {
				return pages.some((stache) => stache.enabled);
			},

			get totalCount() {
				if (getTotalCount) {
					// Assume total count is same across all pages, take from first page
					const firstPage = pages[0];
					return firstPage && firstPage.data
						? getTotalCount(firstPage.data as PageFetchReturnData)
						: 0;
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
				return useOptions.params as StacheParams;
			},
			get hasMore() {
				return Array.isArray(this.data) ? this.data.length < this.totalCount : false;
			},
			invalidate: () => {
				pages.forEach((stache) => stache.invalidate());
			}
		};

		return pagedStache;
	};

	/**
	 * Invalidates the paged stache with the given parameters, if it exists. If no parameters are provided, invalidates all page staches in this `pagedStache` instance.
	 *
	 * @param args
	 * @returns
	 */
	const invalidate = async (args?: StacheParams) => {
		if (!args) {
			// Invalidate all staches in the cache
			for (const pageCache of cache.values()) {
				for (const stache of pageCache.values()) {
					await stache.invalidate();
				}
			}
			return;
		}
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

export type { CreatePagedStacheFn, CreatePagedStacheOptions, PagedStache };

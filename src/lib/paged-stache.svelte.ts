import { SvelteDate, SvelteMap } from 'svelte/reactivity';
import { untrack } from 'svelte';
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
	type FetchPageParams,
	type PageParams
} from './stache.class.svelte';
import type { UseStacheFn } from './stache.svelte';
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

	console.log(
		`Getting/creating page staches for stacheKey ${stacheKey} with pageOffset ${pageOffset} and pageCount ${pageCount}`
	);
	console.log('Current page cache keys:', Array.from(pageCache.keys()));

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
				pageCache,
				fetchPageParams
			);

			console.log(`Created new page stache for pageIndex ${pageIndex} with key ${pageStacheKey}`);
		} else {
			console.log(
				`Reusing existing page stache for pageIndex ${pageIndex} with key ${pageStacheKey}`
			);
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
				// Decrement reference count for old pages
				pages.forEach((stache) => {
					stache.referenceCount--;
				});

				// Get new pages based on updated pageParams
				pages = getOrCreatePageStaches<StacheParams, Result, FetchReturnData>(
					cache,
					createOptions,
					useOptions
				);
			});
		});

		return {
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

			get isFetching() {
				return pages.some((stache) => stache.isFetching);
			},
			get error() {
				return pages.find((stache) => stache.error)?.error || null;
			},
			get fetchStatus() {
				return pages.some((stache) => stache.isFetching)
					? 'fetching'
					: pages.every((stache) => stache.isSuccess)
						? 'success'
						: pages.every((stache) => stache.isError)
							? 'error'
							: 'idle';
			},
			get isError() {
				return pages.some((stache) => stache.isError);
			},
			get isLoading() {
				return pages.some((stache) => stache.isLoading);
			},
			get isSuccess() {
				return pages.every((stache) => stache.isSuccess);
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
						: 'expired';
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

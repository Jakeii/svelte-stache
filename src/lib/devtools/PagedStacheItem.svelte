<script lang="ts">
	import type { Stache } from '../stache.class.svelte';
	import type { PagedStacheCache } from '../global/cache.svelte';
	import { invalidatePagedStacheById } from '../global/cache.svelte';
	import StatusBadge from './StatusBadge.svelte';
	import StacheItem from './StacheItem.svelte';

	interface Props {
		id: string;
		pagedCache: PagedStacheCache;
	}

	let { id, pagedCache }: Props = $props();

	let expanded = $state(false);
	let expandedParams = $state<Set<string>>(new Set());

	const toggle = () => {
		expanded = !expanded;
	};

	const toggleParams = (paramsKey: string) => {
		const newSet = new Set(expandedParams);
		if (newSet.has(paramsKey)) {
			newSet.delete(paramsKey);
		} else {
			newSet.add(paramsKey);
		}
		expandedParams = newSet;
	};

	// Count total pages across all param combinations
	const totalPages = $derived(() => {
		let count = 0;
		for (const pageCache of pagedCache.values()) {
			count += pageCache.size;
		}
		return count;
	});

	// Count loading pages
	const loadingPages = $derived(() => {
		let count = 0;
		for (const pageCache of pagedCache.values()) {
			for (const stache of pageCache.values()) {
				if (stache.isFetching) count++;
			}
		}
		return count;
	});

	// Get overall status (loading if any page is loading, error if any has error, success otherwise)
	const overallStatus = $derived((): 'idle' | 'loading' | 'error' | 'success' => {
		let hasError = false;
		let hasLoading = false;
		let hasSuccess = false;

		for (const pageCache of pagedCache.values()) {
			for (const stache of pageCache.values()) {
				if (stache.fetchStatus === 'loading') hasLoading = true;
				if (stache.fetchStatus === 'error') hasError = true;
				if (stache.fetchStatus === 'success') hasSuccess = true;
			}
		}

		if (hasLoading) return 'loading';
		if (hasError) return 'error';
		if (hasSuccess) return 'success';
		return 'idle';
	});

	// Get overall cache status (stale if any page is stale)
	const overallCacheStatus = $derived((): 'fresh' | 'stale' => {
		for (const pageCache of pagedCache.values()) {
			for (const stache of pageCache.values()) {
				if (stache.cacheStatus === 'stale') return 'stale';
			}
		}
		return 'fresh';
	});

	// Total references across all pages
	const totalRefs = $derived(() => {
		let count = 0;
		for (const pageCache of pagedCache.values()) {
			for (const stache of pageCache.values()) {
				count += stache.referenceCount;
			}
		}
		return count;
	});

	const handleInvalidateAll = () => {
		invalidatePagedStacheById(id);
	};
</script>

<div class="paged-stache-item" class:expanded>
	<button class="paged-header" onclick={toggle} aria-expanded={expanded}>
		<span class="expand-icon" class:rotated={expanded}>
			<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
				<path d="M4 3l4 3-4 3z" />
			</svg>
		</span>
		<StatusBadge fetchStatus={overallStatus()} cacheStatus={overallCacheStatus()} />
		<span class="paged-id">{id}</span>
		<span class="paged-stats">
			<span class="stat" title="Total pages">
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
					<line x1="8" y1="21" x2="16" y2="21"></line>
					<line x1="12" y1="17" x2="12" y2="21"></line>
				</svg>
				{totalPages()}
			</span>
			{#if loadingPages() > 0}
				<span class="stat loading" title="Loading pages">
					<span class="mini-spinner"></span>
					{loadingPages()}
				</span>
			{/if}
			<span class="stat" title="Total references">
				<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
					<circle cx="9" cy="7" r="4"></circle>
				</svg>
				{totalRefs()}
			</span>
		</span>
	</button>

	{#if expanded}
		<div class="paged-details">
			{#each [...pagedCache.entries()] as [paramsKey, pageCache]}
				<div class="params-group">
					<button
						class="params-header"
						onclick={() => toggleParams(paramsKey)}
						aria-expanded={expandedParams.has(paramsKey)}
					>
						<span class="expand-icon small" class:rotated={expandedParams.has(paramsKey)}>
							<svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor">
								<path d="M4 3l4 3-4 3z" />
							</svg>
						</span>
						<span class="params-key" title={paramsKey}>
							{paramsKey === 'no-params' ? '(no params)' : paramsKey}
						</span>
						<span class="page-count">{pageCache.size} pages</span>
					</button>

					{#if expandedParams.has(paramsKey)}
						<div class="pages-list">
							{#each [...pageCache.entries()] as [pageKey, stache]}
								<div class="page-item">
									<div class="page-label">
										<span class="page-index">Page {pageKey}</span>
										<StatusBadge fetchStatus={stache.fetchStatus} cacheStatus={stache.cacheStatus} />
									</div>
									<StacheItem {stache} stacheKey={`${paramsKey}:${pageKey}`} />
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}

			<div class="actions">
				<button class="invalidate-all-btn" onclick={handleInvalidateAll}>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points="23 4 23 10 17 10"></polyline>
						<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
					</svg>
					Invalidate All Pages
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.paged-stache-item {
		border: 1px solid var(--stache-devtools-border, #2d2d44);
		border-radius: 6px;
		background-color: var(--stache-devtools-bg-alt, #16213e);
		overflow: hidden;
	}

	.paged-stache-item.expanded {
		border-color: var(--stache-devtools-accent, #7c3aed);
	}

	.paged-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.625rem 0.75rem;
		background: none;
		border: none;
		color: var(--stache-devtools-text, #eaeaea);
		cursor: pointer;
		font-size: 0.8125rem;
		text-align: left;
		transition: background-color 0.15s;
	}

	.paged-header:hover {
		background-color: color-mix(in srgb, var(--stache-devtools-accent, #7c3aed) 10%, transparent);
	}

	.expand-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--stache-devtools-text-muted, #a0a0a0);
		transition: transform 0.15s ease;
	}

	.expand-icon.rotated {
		transform: rotate(90deg);
	}

	.expand-icon.small {
		width: 16px;
		height: 16px;
	}

	.paged-id {
		flex: 1;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.paged-stats {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.stat {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.6875rem;
		color: var(--stache-devtools-text-muted, #a0a0a0);
		padding: 0.125rem 0.375rem;
		background-color: var(--stache-devtools-border, #2d2d44);
		border-radius: 3px;
	}

	.stat.loading {
		color: var(--stache-status-loading, #3b82f6);
		background-color: color-mix(in srgb, var(--stache-status-loading, #3b82f6) 15%, transparent);
	}

	.mini-spinner {
		width: 8px;
		height: 8px;
		border: 1.5px solid transparent;
		border-top-color: currentColor;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	.paged-details {
		padding: 0.75rem;
		border-top: 1px solid var(--stache-devtools-border, #2d2d44);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.params-group {
		border: 1px solid var(--stache-devtools-border, #2d2d44);
		border-radius: 4px;
		overflow: hidden;
	}

	.params-header {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		width: 100%;
		padding: 0.5rem 0.625rem;
		background-color: var(--stache-devtools-bg, #1a1a2e);
		border: none;
		color: var(--stache-devtools-text, #eaeaea);
		cursor: pointer;
		font-size: 0.75rem;
		text-align: left;
		transition: background-color 0.15s;
	}

	.params-header:hover {
		background-color: color-mix(in srgb, var(--stache-devtools-accent, #7c3aed) 10%, transparent);
	}

	.params-key {
		flex: 1;
		font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
		font-size: 0.6875rem;
		color: var(--stache-devtools-text-muted, #a0a0a0);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.page-count {
		font-size: 0.625rem;
		color: var(--stache-devtools-text-muted, #a0a0a0);
		padding: 0.125rem 0.375rem;
		background-color: var(--stache-devtools-border, #2d2d44);
		border-radius: 3px;
	}

	.pages-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem;
		background-color: var(--stache-devtools-bg, #1a1a2e);
	}

	.page-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.page-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.6875rem;
		padding-left: 0.25rem;
	}

	.page-index {
		font-weight: 500;
		color: var(--stache-devtools-text-muted, #a0a0a0);
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		padding-top: 0.5rem;
		border-top: 1px dashed var(--stache-devtools-border, #2d2d44);
	}

	.invalidate-all-btn {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.75rem;
		background-color: var(--stache-devtools-accent, #7c3aed);
		border: none;
		border-radius: 4px;
		color: white;
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
		transition: opacity 0.15s, background-color 0.15s;
	}

	.invalidate-all-btn:hover {
		background-color: color-mix(in srgb, var(--stache-devtools-accent, #7c3aed) 80%, black);
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>

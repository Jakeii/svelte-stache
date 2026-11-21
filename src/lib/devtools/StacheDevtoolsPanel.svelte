<script lang="ts">
	import { getStacheCache } from '../cache.svelte';
	import StacheItem from './StacheItem.svelte';
	import PagedStacheItem from './PagedStacheItem.svelte';
	import { SvelteSet } from 'svelte/reactivity';

	export type Theme = 'light' | 'dark' | 'system';

	interface Props {
		onclose: () => void;
		theme?: Theme;
		onthemechange?: (theme: Theme) => void;
	}

	let { onclose, theme = 'system', onthemechange }: Props = $props();

	// Detect system preference
	const getSystemTheme = (): 'light' | 'dark' => {
		if (typeof window === 'undefined') return 'dark';
		return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	};

	let systemTheme = $state<'light' | 'dark'>(getSystemTheme());

	// Listen for system theme changes
	$effect(() => {
		if (typeof window === 'undefined') return;
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const handler = (e: MediaQueryListEvent) => {
			systemTheme = e.matches ? 'dark' : 'light';
		};
		mediaQuery.addEventListener('change', handler);
		return () => mediaQuery.removeEventListener('change', handler);
	});

	const resolvedTheme = $derived(theme === 'system' ? systemTheme : theme);

	const cycleTheme = () => {
		const themes: Theme[] = ['light', 'dark', 'system'];
		const currentIndex = themes.indexOf(theme);
		const nextTheme = themes[(currentIndex + 1) % themes.length];
		onthemechange?.(nextTheme);
	};

	const stacheCache = getStacheCache();
	// const globalCache = stacheCache.stacheCache;
	// const pagedGlobalCache = stacheCache.pagedStacheCache;

	let activeTab = $state<'staches' | 'paged'>('staches');
	let searchFilter = $state('');
	let expandedIds = new SvelteSet<string>();

	const toggleId = (id: string) => {
		if (expandedIds.has(id)) {
			expandedIds.delete(id);
		} else {
			expandedIds.add(id);
		}
	};

	// Snapshots of the (non-reactive) cache maps, re-taken whenever the cache version changes
	const globalCache = $derived.by(() => {
		void stacheCache.version;
		return $state.snapshot(stacheCache.stacheCache);
	});

	const pagedGlobalCache = $derived.by(() => {
		void stacheCache.version;
		return $state.snapshot(stacheCache.pagedStacheCache);
	});
	// Filtered stache IDs
	const filteredStacheIds = $derived(
		[...globalCache.keys()].filter((id) => id.toLowerCase().includes(searchFilter.toLowerCase()))
	);

	const filteredPagedStacheIds = $derived(
		[...pagedGlobalCache.keys()].filter((id) =>
			id.toLowerCase().includes(searchFilter.toLowerCase())
		)
	);

	// Stats
	const totalStaches = $derived(
		[...globalCache.values()].reduce((sum, cache) => sum + cache.size, 0)
	);

	const totalPagedStaches = $derived(
		[...pagedGlobalCache.values()].reduce((sum, cache) => {
			return sum + [...cache.values()].reduce((s, c) => s + c.size, 0);
		}, 0)
	);

	const handleInvalidateId = (id: string) => {
		stacheCache.invalidateStache(id);
	};

	const handleKeydown = (e: KeyboardEvent) => {
		if (e.key === 'Escape') {
			onclose();
		}
	};
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="devtools-panel" class:light={resolvedTheme === 'light'}>
	<header class="panel-header">
		<div class="header-left">
			<div class="logo">
				<svg width="20" height="20" viewBox="0 0 100 60" fill="currentColor">
					<path
						d="M10 30 C 10 10, 30 10, 35 25 C 40 35, 45 35, 50 30 C 55 35, 60 35, 65 25 C 70 10, 90 10, 90 30 C 90 45, 75 50, 65 45 C 60 42, 55 42, 50 45 C 45 42, 40 42, 35 45 C 25 50, 10 45, 10 30"
					/>
				</svg>
				<span class="title">Stache Devtools</span>
			</div>
			<div class="stats">
				<span class="stat-item">
					<span class="stat-value">{totalStaches}</span>
					<span class="stat-label">queries</span>
				</span>
				<span class="stat-item">
					<span class="stat-value">{totalPagedStaches}</span>
					<span class="stat-label">paged</span>
				</span>
			</div>
		</div>
		<div class="header-actions">
			<button
				class="theme-btn"
				onclick={cycleTheme}
				aria-label="Toggle theme"
				title="Theme: {theme}"
			>
				{#if theme === 'system'}
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
						<line x1="8" y1="21" x2="16" y2="21"></line>
						<line x1="12" y1="17" x2="12" y2="21"></line>
					</svg>
				{:else if theme === 'dark'}
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
					</svg>
				{:else}
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<circle cx="12" cy="12" r="5"></circle>
						<line x1="12" y1="1" x2="12" y2="3"></line>
						<line x1="12" y1="21" x2="12" y2="23"></line>
						<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
						<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
						<line x1="1" y1="12" x2="3" y2="12"></line>
						<line x1="21" y1="12" x2="23" y2="12"></line>
						<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
						<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
					</svg>
				{/if}
			</button>
			<button class="close-btn" onclick={onclose} aria-label="Close devtools">
				<svg
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<line x1="18" y1="6" x2="6" y2="18"></line>
					<line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
			</button>
		</div>
	</header>

	<div class="panel-toolbar">
		<div class="search-container">
			<svg
				class="search-icon"
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<circle cx="11" cy="11" r="8"></circle>
				<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
			</svg>
			<input
				type="text"
				class="search-input"
				placeholder="Filter by ID..."
				bind:value={searchFilter}
			/>
			{#if searchFilter}
				<button class="clear-search" onclick={() => (searchFilter = '')} aria-label="Clear search">
					<svg
						width="12"
						height="12"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			{/if}
		</div>
		<div class="tabs">
			<button
				class="tab"
				class:active={activeTab === 'staches'}
				onclick={() => (activeTab = 'staches')}
			>
				Queries
				{#if totalStaches > 0}
					<span class="tab-count">{totalStaches}</span>
				{/if}
			</button>
			<button
				class="tab"
				class:active={activeTab === 'paged'}
				onclick={() => (activeTab = 'paged')}
			>
				Paged
				{#if totalPagedStaches > 0}
					<span class="tab-count">{totalPagedStaches}</span>
				{/if}
			</button>
		</div>
	</div>

	<div class="panel-content">
		{#if activeTab === 'staches'}
			{#if filteredStacheIds.length === 0}
				<div class="empty-state">
					{#if searchFilter}
						<p>No queries match "{searchFilter}"</p>
					{:else}
						<p>No queries in cache</p>
						<span class="empty-hint">Queries will appear here when created</span>
					{/if}
				</div>
			{:else}
				<div class="stache-list">
					{#each filteredStacheIds as id (id)}
						{@const cache = globalCache.get(id)}
						{#if cache && cache.size > 0}
							<div class="stache-group">
								<div
									class="group-header"
									role="button"
									tabindex="0"
									aria-expanded={expandedIds.has(id)}
									onclick={() => toggleId(id)}
									onkeydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											toggleId(id);
										}
									}}
								>
									<span class="expand-icon" class:rotated={expandedIds.has(id)}>
										<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
											<path d="M4 3l4 3-4 3z" />
										</svg>
									</span>
									<span class="group-id">{id}</span>
									<span class="group-count">{cache.size}</span>
									<button
										class="invalidate-group-btn"
										onclick={(e) => {
											e.stopPropagation();
											handleInvalidateId(id);
										}}
										title="Invalidate all"
									>
										<svg
											width="12"
											height="12"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
										>
											<polyline points="23 4 23 10 17 10"></polyline>
											<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
										</svg>
									</button>
								</div>

								{#if expandedIds.has(id)}
									<div class="group-items">
										{#each [...cache.entries()] as [stacheKey, stache] (stacheKey)}
											<StacheItem {stache} {stacheKey} />
										{/each}
									</div>
								{/if}
							</div>
						{/if}
					{/each}
				</div>
			{/if}
		{:else if filteredPagedStacheIds.length === 0}
			<div class="empty-state">
				{#if searchFilter}
					<p>No paged queries match "{searchFilter}"</p>
				{:else}
					<p>No paged queries in cache</p>
					<span class="empty-hint">Paged queries will appear here when created</span>
				{/if}
			</div>
		{:else}
			<div class="stache-list">
				{#each filteredPagedStacheIds as id (id)}
					{@const pagedCache = pagedGlobalCache.get(id)}
					{#if pagedCache && pagedCache.size > 0}
						<PagedStacheItem {id} {pagedCache} />
					{/if}
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.devtools-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background-color: var(--stache-devtools-bg);
		color: var(--stache-devtools-text);
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
		font-size: 0.875rem;

		/* Dark theme (default) */
		--stache-devtools-bg: #1a1a2e;
		--stache-devtools-bg-alt: #16213e;
		--stache-devtools-text: #eaeaea;
		--stache-devtools-text-muted: #a0a0a0;
		--stache-devtools-border: #2d2d44;
		--stache-devtools-accent: #7c3aed;
		--stache-status-idle: #6b7280;
		--stache-status-loading: #3b82f6;
		--stache-status-success: #10b981;
		--stache-status-error: #ef4444;
		--stache-status-fresh: #10b981;
		--stache-status-stale: #f59e0b;
	}

	/* Light theme */
	.devtools-panel.light {
		--stache-devtools-bg: #ffffff;
		--stache-devtools-bg-alt: #f8fafc;
		--stache-devtools-text: #1e293b;
		--stache-devtools-text-muted: #64748b;
		--stache-devtools-border: #e2e8f0;
		--stache-devtools-accent: #7c3aed;
		--stache-status-idle: #94a3b8;
		--stache-status-loading: #3b82f6;
		--stache-status-success: #10b981;
		--stache-status-error: #ef4444;
		--stache-status-fresh: #10b981;
		--stache-status-stale: #f59e0b;
		--stache-status-empty: #6b7280;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		background-color: var(--stache-devtools-bg-alt);
		border-bottom: 1px solid var(--stache-devtools-border);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 1.5rem;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.theme-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		background: none;
		border: none;
		border-radius: 4px;
		color: var(--stache-devtools-text-muted);
		cursor: pointer;
		transition:
			color 0.15s,
			background-color 0.15s;
	}

	.theme-btn:hover {
		color: var(--stache-devtools-text);
		background-color: var(--stache-devtools-border);
	}

	.logo {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--stache-devtools-accent);
	}

	.title {
		font-weight: 600;
		font-size: 0.9375rem;
	}

	.stats {
		display: flex;
		gap: 1rem;
	}

	.stat-item {
		display: flex;
		align-items: baseline;
		gap: 0.25rem;
	}

	.stat-value {
		font-weight: 600;
		color: var(--stache-devtools-text);
	}

	.stat-label {
		font-size: 0.75rem;
		color: var(--stache-devtools-text-muted);
	}

	.close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		background: none;
		border: none;
		border-radius: 4px;
		color: var(--stache-devtools-text-muted);
		cursor: pointer;
		transition:
			color 0.15s,
			background-color 0.15s;
	}

	.close-btn:hover {
		color: var(--stache-devtools-text);
		background-color: var(--stache-devtools-border);
	}

	.panel-toolbar {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.625rem 1rem;
		border-bottom: 1px solid var(--stache-devtools-border);
	}

	.search-container {
		flex: 1;
		position: relative;
		display: flex;
		align-items: center;
	}

	.search-icon {
		position: absolute;
		left: 0.625rem;
		color: var(--stache-devtools-text-muted);
		pointer-events: none;
	}

	.search-input {
		width: 100%;
		padding: 0.5rem 0.625rem 0.5rem 2rem;
		background-color: var(--stache-devtools-bg-alt);
		border: 1px solid var(--stache-devtools-border);
		border-radius: 4px;
		color: var(--stache-devtools-text);
		font-size: 0.8125rem;
		outline: none;
		transition: border-color 0.15s;
	}

	.search-input::placeholder {
		color: var(--stache-devtools-text-muted);
	}

	.search-input:focus {
		border-color: var(--stache-devtools-accent);
	}

	.clear-search {
		position: absolute;
		right: 0.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		background: none;
		border: none;
		border-radius: 3px;
		color: var(--stache-devtools-text-muted);
		cursor: pointer;
		transition:
			color 0.15s,
			background-color 0.15s;
	}

	.clear-search:hover {
		color: var(--stache-devtools-text);
		background-color: var(--stache-devtools-border);
	}

	.tabs {
		display: flex;
		gap: 0.25rem;
	}

	.tab {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 0.75rem;
		background: none;
		border: none;
		border-radius: 4px;
		color: var(--stache-devtools-text-muted);
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		transition:
			color 0.15s,
			background-color 0.15s;
	}

	.tab:hover {
		color: var(--stache-devtools-text);
		background-color: var(--stache-devtools-border);
	}

	.tab.active {
		color: var(--stache-devtools-accent);
		background-color: color-mix(in srgb, var(--stache-devtools-accent) 15%, transparent);
	}

	.tab-count {
		font-size: 0.6875rem;
		padding: 0.125rem 0.375rem;
		background-color: var(--stache-devtools-border);
		border-radius: 3px;
	}

	.tab.active .tab-count {
		background-color: color-mix(in srgb, var(--stache-devtools-accent) 30%, transparent);
	}

	.panel-content {
		flex: 1;
		overflow-y: auto;
		padding: 0.75rem;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem 1rem;
		text-align: center;
	}

	.empty-state p {
		margin: 0;
		color: var(--stache-devtools-text-muted);
	}

	.empty-hint {
		margin-top: 0.5rem;
		font-size: 0.75rem;
		color: var(--stache-devtools-text-muted);
		opacity: 0.7;
	}

	.stache-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.stache-group {
		border: 1px solid var(--stache-devtools-border);
		border-radius: 6px;
		overflow: hidden;
	}

	.group-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.625rem 0.75rem;
		background-color: var(--stache-devtools-bg-alt);
		border: none;
		color: var(--stache-devtools-text);
		cursor: pointer;
		font-size: 0.8125rem;
		text-align: left;
		transition: background-color 0.15s;
	}

	.group-header:hover {
		background-color: color-mix(in srgb, var(--stache-devtools-accent) 10%, transparent);
	}

	.expand-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--stache-devtools-text-muted);
		transition: transform 0.15s ease;
	}

	.expand-icon.rotated {
		transform: rotate(90deg);
	}

	.group-id {
		flex: 1;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.group-count {
		font-size: 0.6875rem;
		padding: 0.125rem 0.375rem;
		background-color: var(--stache-devtools-border);
		border-radius: 3px;
		color: var(--stache-devtools-text-muted);
	}

	.invalidate-group-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		background: none;
		border: none;
		border-radius: 4px;
		color: var(--stache-devtools-text-muted);
		cursor: pointer;
		transition:
			color 0.15s,
			background-color 0.15s;
	}

	.invalidate-group-btn:hover {
		color: var(--stache-devtools-accent);
		background-color: color-mix(in srgb, var(--stache-devtools-accent) 20%, transparent);
	}

	.group-items {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem;
		background-color: var(--stache-devtools-bg);
	}
</style>

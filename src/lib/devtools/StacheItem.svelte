<script lang="ts">
	import type { CoreStache } from '../core/stache.class.svelte';
	import StatusBadge from './StatusBadge.svelte';
	import JsonViewer from './JsonViewer.svelte';

	interface Props {
		stache: CoreStache<unknown, unknown, unknown>;
		stacheKey: string;
	}

	let { stache, stacheKey }: Props = $props();

	let expanded = $state(false);

	const toggle = () => {
		expanded = !expanded;
	};

	const formatTime = (date: Date | null): string => {
		if (!date) return 'Never';
		const now = Date.now();
		const diff = now - date.getTime();

		if (diff < 1000) return 'Just now';
		if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
		if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
		if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
		return date.toLocaleString();
	};

	const formatMs = (ms: number): string => {
		if (ms < 1000) return `${ms}ms`;
		if (ms < 60000) return `${(ms / 1000).toFixed(0)}s`;
		return `${(ms / 60000).toFixed(0)}m`;
	};

	const formatParams = (params: unknown): string => {
		if (params === undefined || params === null) return 'none';
		try {
			const str = JSON.stringify(params);
			return str.length > 50 ? str.slice(0, 47) + '...' : str;
		} catch {
			return String(params);
		}
	};
</script>

<div class="stache-item" class:expanded>
	<button class="stache-header" onclick={toggle} aria-expanded={expanded}>
		<span class="expand-icon" class:rotated={expanded}>
			<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
				<path d="M4 3l4 3-4 3z" />
			</svg>
		</span>
		<StatusBadge fetchStatus={stache.fetchStatus} cacheStatus={stache.cacheStatus} />
		<span class="stache-key" title={stacheKey}
			>{stacheKey === 'no-params' ? '(no params)' : stacheKey}</span
		>
		<span class="ref-count" title="Reference count">
			<svg
				width="12"
				height="12"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
				<circle cx="9" cy="7" r="4"></circle>
				<path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
				<path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
			</svg>
			{stache.referenceCount}
		</span>
	</button>

	{#if expanded}
		<div class="stache-details">
			<div class="detail-section">
				<div class="detail-row">
					<span class="detail-label">Status</span>
					<span class="detail-value">
						<span class="status-text" class:error={stache.fetchStatus === 'error'}>
							{stache.fetchStatus}
						</span>
						{#if stache.cacheStatus}
							<span class="separator">/</span>
							<span class="cache-text" class:stale={stache.cacheStatus === 'stale'}>
								{stache.cacheStatus}
							</span>
						{/if}
					</span>
				</div>
				<div class="detail-row">
					<span class="detail-label">Params</span>
					<span class="detail-value mono" title={JSON.stringify(stache.params)}>
						{formatParams(stache.params)}
					</span>
				</div>
				<div class="detail-row">
					<span class="detail-label">Last Fetched</span>
					<span class="detail-value">{formatTime(stache.lastFetched)}</span>
				</div>
				<div class="detail-row">
					<span class="detail-label">References</span>
					<span class="detail-value">{stache.referenceCount}</span>
				</div>
			</div>

			{#if stache.error}
				<div class="detail-section error-section">
					<div class="section-title">Error</div>
					<div class="error-content">
						{stache.error instanceof Error ? stache.error.message : String(stache.error)}
					</div>
				</div>
			{/if}

			<div class="detail-section">
				<div class="section-title">Data</div>
				{#if stache.data !== null}
					<JsonViewer data={stache.data} />
				{:else}
					<span class="no-data">No data</span>
				{/if}
			</div>

			<div class="detail-section config-section">
				<div class="section-title">Configuration</div>
				<div class="config-grid">
					<span class="config-item" title="Time until data is considered stale">
						<span class="config-label">staleTime</span>
						<span class="config-value">{formatMs(stache.staleTime)}</span>
					</span>
					<span class="config-item" title="Time to keep in cache after no references">
						<span class="config-label">cleanupTime</span>
						<span class="config-value">{formatMs(stache.cleanupTime)}</span>
					</span>
					<span class="config-item" title="Refetch when window gains focus">
						<span class="config-label">refetchOnFocus</span>
						<span class="config-value">{stache.refetchOnWindowFocus ? 'yes' : 'no'}</span>
					</span>
					<span class="config-item" title="Refetch when data becomes stale">
						<span class="config-label">refetchOnStale</span>
						<span class="config-value">{stache.refetchOnStale ? 'yes' : 'no'}</span>
					</span>
				</div>
			</div>

			<div class="actions">
				<button
					class="invalidate-btn"
					onclick={() => stache.invalidate()}
					disabled={stache.isFetching}
				>
					{#if stache.isFetching}
						<span class="spinner"></span>
						Fetching...
					{:else}
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<polyline points="23 4 23 10 17 10"></polyline>
							<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
						</svg>
						Invalidate
					{/if}
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.stache-item {
		border: 1px solid var(--stache-devtools-border, #2d2d44);
		border-radius: 6px;
		background-color: var(--stache-devtools-bg-alt, #16213e);
		overflow: hidden;
	}

	.stache-item.expanded {
		border-color: var(--stache-devtools-accent, #7c3aed);
	}

	.stache-header {
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

	.stache-header:hover {
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

	.stache-key {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
		font-size: 0.75rem;
		color: var(--stache-devtools-text-muted, #a0a0a0);
	}

	.ref-count {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.6875rem;
		color: var(--stache-devtools-text-muted, #a0a0a0);
		padding: 0.125rem 0.375rem;
		background-color: var(--stache-devtools-border, #2d2d44);
		border-radius: 3px;
	}

	.stache-details {
		padding: 0.75rem;
		border-top: 1px solid var(--stache-devtools-border, #2d2d44);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.detail-section {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.section-title {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--stache-devtools-text-muted, #a0a0a0);
		margin-bottom: 0.25rem;
	}

	.detail-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.75rem;
	}

	.detail-label {
		color: var(--stache-devtools-text-muted, #a0a0a0);
	}

	.detail-value {
		color: var(--stache-devtools-text, #eaeaea);
	}

	.detail-value.mono {
		font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
		max-width: 60%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.status-text.error {
		color: var(--stache-status-error, #ef4444);
	}

	.cache-text.stale {
		color: var(--stache-status-stale, #f59e0b);
	}

	.separator {
		color: var(--stache-devtools-text-muted, #a0a0a0);
		margin: 0 0.25rem;
	}

	.error-section {
		background-color: color-mix(in srgb, var(--stache-status-error, #ef4444) 10%, transparent);
		padding: 0.625rem;
		border-radius: 4px;
		border: 1px solid color-mix(in srgb, var(--stache-status-error, #ef4444) 30%, transparent);
	}

	.error-content {
		font-size: 0.75rem;
		color: var(--stache-status-error, #ef4444);
		font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
		word-break: break-word;
	}

	.no-data {
		font-size: 0.75rem;
		color: var(--stache-devtools-text-muted, #a0a0a0);
		font-style: italic;
	}

	.config-section {
		padding-top: 0.5rem;
		border-top: 1px dashed var(--stache-devtools-border, #2d2d44);
	}

	.config-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.375rem;
	}

	.config-item {
		display: flex;
		justify-content: space-between;
		font-size: 0.6875rem;
		padding: 0.25rem 0.375rem;
		background-color: var(--stache-devtools-bg, #1a1a2e);
		border-radius: 3px;
	}

	.config-label {
		color: var(--stache-devtools-text-muted, #a0a0a0);
	}

	.config-value {
		color: var(--stache-devtools-text, #eaeaea);
		font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		padding-top: 0.5rem;
		border-top: 1px dashed var(--stache-devtools-border, #2d2d44);
	}

	.invalidate-btn {
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
		transition:
			opacity 0.15s,
			background-color 0.15s;
	}

	.invalidate-btn:hover:not(:disabled) {
		background-color: color-mix(in srgb, var(--stache-devtools-accent, #7c3aed) 80%, black);
	}

	.invalidate-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.spinner {
		width: 12px;
		height: 12px;
		border: 2px solid transparent;
		border-top-color: currentColor;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>

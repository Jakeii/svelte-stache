<script lang="ts">
	type FetchStatus = 'idle' | 'loading' | 'error' | 'success';
	type CacheStatus = 'fresh' | 'stale';

	interface Props {
		fetchStatus: FetchStatus;
		cacheStatus?: CacheStatus;
		showLabel?: boolean;
	}

	let { fetchStatus, cacheStatus, showLabel = false }: Props = $props();

	const fetchStatusConfig = {
		idle: { color: 'var(--stache-status-idle)', label: 'Idle' },
		loading: { color: 'var(--stache-status-loading)', label: 'Loading' },
		error: { color: 'var(--stache-status-error)', label: 'Error' },
		success: { color: 'var(--stache-status-success)', label: 'Success' }
	};

	const cacheStatusConfig = {
		fresh: { color: 'var(--stache-status-fresh)', label: 'Fresh' },
		stale: { color: 'var(--stache-status-stale)', label: 'Stale' }
	};

	const config = $derived(fetchStatusConfig[fetchStatus]);
	const cacheConfig = $derived(cacheStatus ? cacheStatusConfig[cacheStatus] : null);
</script>

<span class="status-badge-container">
	<span
		class="status-badge"
		class:loading={fetchStatus === 'loading'}
		style:--badge-color={config.color}
		title={config.label}
	>
		<span class="status-dot"></span>
		{#if showLabel}
			<span class="status-label">{config.label}</span>
		{/if}
	</span>
	{#if cacheConfig}
		<span
			class="cache-badge"
			class:stale={cacheStatus === 'stale'}
			style:--cache-color={cacheConfig.color}
			title={`Cache: ${cacheConfig.label}`}
		>
			{cacheConfig.label}
		</span>
	{/if}
</span>

<style>
	.status-badge-container {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
	}

	.status-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background-color: var(--badge-color);
		flex-shrink: 0;
	}

	.status-badge.loading .status-dot {
		animation: pulse 1.5s ease-in-out infinite;
	}

	.status-label {
		font-size: 0.6875rem;
		color: var(--stache-devtools-text-muted, #a0a0a0);
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.cache-badge {
		font-size: 0.625rem;
		padding: 0.125rem 0.375rem;
		border-radius: 3px;
		background-color: color-mix(in srgb, var(--cache-color) 20%, transparent);
		color: var(--cache-color);
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.cache-badge.stale {
		animation: stale-pulse 2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.5;
			transform: scale(0.85);
		}
	}

	@keyframes stale-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.7;
		}
	}
</style>

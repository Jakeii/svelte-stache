<script lang="ts">
	interface Props {
		data: unknown;
		maxLines?: number;
		initialCollapsed?: boolean;
	}

	let { data, maxLines = 20, initialCollapsed = true }: Props = $props();

	let collapsed = $state(initialCollapsed);
	let showAll = $state(false);
	let copyFeedback = $state(false);

	const formatJson = (value: unknown): string => {
		try {
			return JSON.stringify(value, null, 2);
		} catch {
			return String(value);
		}
	};

	const formatted = $derived(formatJson(data));
	const lines = $derived(formatted.split('\n'));
	const isTruncated = $derived(lines.length > maxLines && !showAll);
	const displayedLines = $derived(isTruncated ? lines.slice(0, maxLines) : lines);
	const displayedJson = $derived(displayedLines.join('\n'));

	const preview = $derived(() => {
		if (data === null) return 'null';
		if (data === undefined) return 'undefined';
		if (typeof data === 'string') return `"${data.slice(0, 50)}${data.length > 50 ? '...' : ''}"`;
		if (typeof data === 'number' || typeof data === 'boolean') return String(data);
		if (Array.isArray(data)) return `Array(${data.length})`;
		if (typeof data === 'object') {
			const keys = Object.keys(data);
			return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', ...' : ''}}`;
		}
		return String(data);
	});

	const copyToClipboard = async () => {
		try {
			await navigator.clipboard.writeText(formatted);
			copyFeedback = true;
			setTimeout(() => {
				copyFeedback = false;
			}, 1500);
		} catch {
			// Clipboard API not available
		}
	};

	const toggleCollapsed = () => {
		collapsed = !collapsed;
	};

	const toggleShowAll = () => {
		showAll = !showAll;
	};
</script>

<div class="json-viewer">
	<div class="json-header">
		<button class="toggle-btn" onclick={toggleCollapsed} aria-expanded={!collapsed}>
			<span class="toggle-icon" class:expanded={!collapsed}>
				<svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
					<path d="M3 2l4 3-4 3z" />
				</svg>
			</span>
			<span class="preview">{preview()}</span>
		</button>
		<button class="copy-btn" onclick={copyToClipboard} title="Copy to clipboard">
			{#if copyFeedback}
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<polyline points="20 6 9 17 4 12"></polyline>
				</svg>
			{:else}
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
					<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
				</svg>
			{/if}
		</button>
	</div>
	{#if !collapsed}
		<div class="json-content">
			<pre><code>{displayedJson}</code></pre>
			{#if isTruncated}
				<button class="show-more-btn" onclick={toggleShowAll}>
					Show {lines.length - maxLines} more lines...
				</button>
			{:else if showAll && lines.length > maxLines}
				<button class="show-more-btn" onclick={toggleShowAll}> Show less </button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.json-viewer {
		font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
		font-size: 0.75rem;
		border-radius: 4px;
		background-color: var(--stache-devtools-bg-alt, #16213e);
		border: 1px solid var(--stache-devtools-border, #2d2d44);
		overflow: hidden;
	}

	.json-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.375rem 0.5rem;
		background-color: color-mix(in srgb, var(--stache-devtools-bg, #1a1a2e) 50%, transparent);
		border-bottom: 1px solid var(--stache-devtools-border, #2d2d44);
	}

	.toggle-btn {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		background: none;
		border: none;
		color: var(--stache-devtools-text, #eaeaea);
		cursor: pointer;
		padding: 0;
		font-family: inherit;
		font-size: inherit;
	}

	.toggle-btn:hover {
		color: var(--stache-devtools-accent, #7c3aed);
	}

	.toggle-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.15s ease;
	}

	.toggle-icon.expanded {
		transform: rotate(90deg);
	}

	.preview {
		color: var(--stache-devtools-text-muted, #a0a0a0);
		max-width: 300px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.copy-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		color: var(--stache-devtools-text-muted, #a0a0a0);
		cursor: pointer;
		padding: 0.25rem;
		border-radius: 3px;
		transition:
			color 0.15s,
			background-color 0.15s;
	}

	.copy-btn:hover {
		color: var(--stache-devtools-text, #eaeaea);
		background-color: var(--stache-devtools-border, #2d2d44);
	}

	.json-content {
		padding: 0.5rem;
		overflow-x: auto;
	}

	pre {
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
	}

	code {
		color: var(--stache-devtools-text, #eaeaea);
	}

	.show-more-btn {
		display: block;
		width: 100%;
		margin-top: 0.5rem;
		padding: 0.375rem;
		background-color: var(--stache-devtools-border, #2d2d44);
		border: none;
		border-radius: 3px;
		color: var(--stache-devtools-text-muted, #a0a0a0);
		font-size: 0.6875rem;
		cursor: pointer;
		transition:
			background-color 0.15s,
			color 0.15s;
	}

	.show-more-btn:hover {
		background-color: var(--stache-devtools-accent, #7c3aed);
		color: var(--stache-devtools-text, #eaeaea);
	}
</style>

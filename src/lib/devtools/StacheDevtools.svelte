<script lang="ts">
	import StacheDevtoolsPanel, { type Theme } from './StacheDevtoolsPanel.svelte';

	type ButtonPosition = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';

	interface Props {
		/** Initial open state of the devtools panel */
		initialOpen?: boolean;
		/** Position of the toggle button */
		buttonPosition?: ButtonPosition;
		/** Custom z-index for the devtools */
		zIndex?: number;
		/** Initial panel height in pixels */
		panelHeight?: number;
		/** Minimum panel height in pixels */
		minPanelHeight?: number;
		/** Maximum panel height in pixels */
		maxPanelHeight?: number;
		/** Theme preference: 'light', 'dark', or 'system' (follows OS preference) */
		theme?: Theme;
	}

	let {
		initialOpen = false,
		buttonPosition = 'bottom-right',
		zIndex = 99999,
		panelHeight: initialPanelHeight = 400,
		minPanelHeight = 200,
		maxPanelHeight = 800,
		theme: initialTheme = 'system'
	}: Props = $props();

	const STORAGE_KEY_OPEN = 'stache-devtools-open';
	const STORAGE_KEY_THEME = 'stache-devtools-theme';
	const STORAGE_KEY_HEIGHT = 'stache-devtools-height';

	// Check if we're in a browser environment
	const isBrowser = typeof window !== 'undefined';

	// Initialize from localStorage if available
	const getInitialOpen = (): boolean => {
		if (!isBrowser) return initialOpen;
		try {
			const stored = localStorage.getItem(STORAGE_KEY_OPEN);
			return stored !== null ? stored === 'true' : initialOpen;
		} catch {
			return initialOpen;
		}
	};

	const getInitialTheme = (): Theme => {
		if (!isBrowser) return initialTheme;
		try {
			const stored = localStorage.getItem(STORAGE_KEY_THEME);
			if (stored === 'light' || stored === 'dark' || stored === 'system') {
				return stored;
			}
			return initialTheme;
		} catch {
			return initialTheme;
		}
	};

	const getInitialHeight = (): number => {
		if (!isBrowser) return initialPanelHeight;
		try {
			const stored = localStorage.getItem(STORAGE_KEY_HEIGHT);
			if (stored !== null) {
				const height = parseInt(stored, 10);
				if (!isNaN(height) && height >= minPanelHeight && height <= maxPanelHeight) {
					return height;
				}
			}
			return initialPanelHeight;
		} catch {
			return initialPanelHeight;
		}
	};

	let isOpen = $state(getInitialOpen());
	let theme = $state<Theme>(getInitialTheme());
	let currentHeight = $state(getInitialHeight());
	let isResizing = $state(false);

	// Persist open state to localStorage
	$effect(() => {
		if (isBrowser) {
			try {
				localStorage.setItem(STORAGE_KEY_OPEN, String(isOpen));
			} catch {
				// localStorage not available
			}
		}
	});

	// Persist theme to localStorage
	$effect(() => {
		if (isBrowser) {
			try {
				localStorage.setItem(STORAGE_KEY_THEME, theme);
			} catch {
				// localStorage not available
			}
		}
	});

	// Persist height to localStorage
	$effect(() => {
		if (isBrowser) {
			try {
				localStorage.setItem(STORAGE_KEY_HEIGHT, String(currentHeight));
			} catch {
				// localStorage not available
			}
		}
	});

	const toggle = () => {
		isOpen = !isOpen;
	};

	const handleThemeChange = (newTheme: Theme) => {
		theme = newTheme;
	};

	const positionStyles: Record<ButtonPosition, { button: string; panel: string }> = {
		'bottom-right': {
			button: 'bottom: 16px; right: 16px;',
			panel: 'bottom: 0; left: 0; right: 0;'
		},
		'bottom-left': {
			button: 'bottom: 16px; left: 16px;',
			panel: 'bottom: 0; left: 0; right: 0;'
		},
		'top-right': {
			button: 'top: 16px; right: 16px;',
			panel: 'top: 0; left: 0; right: 0;'
		},
		'top-left': {
			button: 'top: 16px; left: 16px;',
			panel: 'top: 0; left: 0; right: 0;'
		}
	};

	const styles = $derived(positionStyles[buttonPosition]);
	const isTop = $derived(buttonPosition.startsWith('top'));

	// Resize handling
	const handleResizeStart = (e: MouseEvent | TouchEvent) => {
		e.preventDefault();
		isResizing = true;

		const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
		const startHeight = currentHeight;

		const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
			const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
			const delta = isTop ? currentY - startY : startY - currentY;
			const newHeight = Math.min(maxPanelHeight, Math.max(minPanelHeight, startHeight + delta));
			currentHeight = newHeight;
		};

		const handleEnd = () => {
			isResizing = false;
			document.removeEventListener('mousemove', handleMove);
			document.removeEventListener('mouseup', handleEnd);
			document.removeEventListener('touchmove', handleMove);
			document.removeEventListener('touchend', handleEnd);
		};

		document.addEventListener('mousemove', handleMove);
		document.addEventListener('mouseup', handleEnd);
		document.addEventListener('touchmove', handleMove);
		document.addEventListener('touchend', handleEnd);
	};
</script>

{#if isOpen}
	<div
		class="stache-devtools-panel"
		class:top={isTop}
		class:resizing={isResizing}
		style="z-index: {zIndex}; {styles.panel} height: {currentHeight}px;"
	>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="resize-handle"
			class:top={isTop}
			onmousedown={handleResizeStart}
			ontouchstart={handleResizeStart}
		></div>
		<StacheDevtoolsPanel onclose={toggle} {theme} onthemechange={handleThemeChange} />
	</div>
{/if}

<button
	class="stache-devtools-toggle"
	class:open={isOpen}
	style="z-index: {zIndex + 1}; {styles.button}"
	onclick={toggle}
	aria-label={isOpen ? 'Close Stache Devtools' : 'Open Stache Devtools'}
	title={isOpen ? 'Close Stache Devtools' : 'Open Stache Devtools'}
>
	<svg
		class="toggle-icon"
		width="24"
		height="24"
		viewBox="0 0 100 60"
		fill="currentColor"
	>
		<!-- Mustache icon -->
		<path d="M10 30 C 10 10, 30 10, 35 25 C 40 35, 45 35, 50 30 C 55 35, 60 35, 65 25 C 70 10, 90 10, 90 30 C 90 45, 75 50, 65 45 C 60 42, 55 42, 50 45 C 45 42, 40 42, 35 45 C 25 50, 10 45, 10 30" />
	</svg>
</button>

<style>
	.stache-devtools-toggle {
		position: fixed;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		background-color: #7c3aed;
		border: none;
		border-radius: 50%;
		color: white;
		cursor: pointer;
		box-shadow:
			0 4px 12px rgba(124, 58, 237, 0.4),
			0 2px 4px rgba(0, 0, 0, 0.2);
		transition:
			transform 0.2s ease,
			box-shadow 0.2s ease,
			background-color 0.2s ease;
	}

	.stache-devtools-toggle:hover {
		transform: scale(1.05);
		box-shadow:
			0 6px 16px rgba(124, 58, 237, 0.5),
			0 3px 6px rgba(0, 0, 0, 0.25);
	}

	.stache-devtools-toggle:active {
		transform: scale(0.98);
	}

	.stache-devtools-toggle.open {
		background-color: #5b21b6;
	}

	.toggle-icon {
		transition: transform 0.3s ease;
	}

	.stache-devtools-toggle.open .toggle-icon {
		transform: rotate(180deg);
	}

	.stache-devtools-panel {
		position: fixed;
		background-color: #1a1a2e;
		box-shadow:
			0 -4px 20px rgba(0, 0, 0, 0.4),
			0 -2px 8px rgba(0, 0, 0, 0.2);
		overflow: hidden;
	}

	.stache-devtools-panel.top {
		box-shadow:
			0 4px 20px rgba(0, 0, 0, 0.4),
			0 2px 8px rgba(0, 0, 0, 0.2);
	}

	.stache-devtools-panel.resizing {
		user-select: none;
	}

	.resize-handle {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 6px;
		cursor: ns-resize;
		background: transparent;
		transition: background-color 0.15s ease;
		z-index: 10;
	}

	.resize-handle:hover,
	.stache-devtools-panel.resizing .resize-handle {
		background-color: rgba(124, 58, 237, 0.5);
	}

	.resize-handle.top {
		top: auto;
		bottom: 0;
	}

	/* Responsive adjustments */
	@media (max-width: 640px) {
		.stache-devtools-toggle {
			width: 40px;
			height: 40px;
		}

		.toggle-icon {
			width: 20px;
			height: 20px;
		}
	}
</style>

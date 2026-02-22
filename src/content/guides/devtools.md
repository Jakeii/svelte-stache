---
title: DevTools
description: Inspect and debug your Svelte Stache cache with the built-in DevTools
section: Guides
---

# DevTools

Svelte Stache includes a built-in DevTools panel for inspecting and debugging your cache in development. Similar to TanStack Query DevTools, it provides real-time visibility into all cached queries.

## Installation

The DevTools are included in the main package but exported separately for tree-shaking:

```typescript
import { StacheDevtools } from 'svelte-stache/devtools';
```

## Basic Usage

Add the DevTools component to your app's root layout:

```svelte
<script lang="ts">
	import { StacheDevtools } from 'svelte-stache/devtools';

	let { children } = $props();
</script>

{@render children()}

<StacheDevtools />
```

A floating button will appear in the corner of your screen. Click it to open the DevTools panel.

## Development Only

To exclude DevTools from production builds, conditionally render based on environment:

```svelte
<script lang="ts">
	import { dev } from '$app/environment';
	import { StacheDevtools } from 'svelte-stache/devtools';

	let { children } = $props();
</script>

{@render children()}

{#if dev}
	<StacheDevtools />
{/if}
```

The bundler will tree-shake the DevTools import in production when wrapped in this condition.

## Configuration

### Props

| Prop             | Type                                                           | Default          | Description                           |
| ---------------- | -------------------------------------------------------------- | ---------------- | ------------------------------------- |
| `initialOpen`    | `boolean`                                                      | `false`          | Whether the panel starts open         |
| `buttonPosition` | `'bottom-right' \| 'bottom-left' \| 'top-right' \| 'top-left'` | `'bottom-right'` | Position of the toggle button         |
| `zIndex`         | `number`                                                       | `99999`          | z-index for the DevTools UI           |
| `panelHeight`    | `number`                                                       | `400`            | Initial height of the panel in pixels |
| `minPanelHeight` | `number`                                                       | `200`            | Minimum height when resizing          |
| `maxPanelHeight` | `number`                                                       | `800`            | Maximum height when resizing          |
| `theme`          | `'light' \| 'dark' \| 'system'`                                | `'system'`       | Color theme preference                |

### Example with Options

```svelte
<StacheDevtools initialOpen={true} buttonPosition="bottom-left" panelHeight={500} theme="dark" />
```

## Features

### Query List

The DevTools display all cached staches organized by their `id`. Each entry shows:

- **Status Badge** - Visual indicator of fetch status (idle, loading, success, error)
- **Cache Status** - Whether data is fresh or stale
- **Reference Count** - Number of components using this stache
- **Parameters** - The params used to fetch this data

### Expanded View

Click on any stache entry to see detailed information:

- **Fetch Status** - Current status with timestamp
- **Cache Status** - Fresh/stale indicator
- **Parameters** - Full params object
- **Last Fetched** - When data was last successfully fetched
- **Data Preview** - Collapsible JSON view of the cached data
- **Error Details** - Error message if the fetch failed
- **Configuration** - staleTime, cleanupTime, refetch settings

### Actions

- **Invalidate** - Force a refetch of individual staches
- **Invalidate All** - Invalidate all staches with a given ID

### Tabs

- **Queries** - Regular staches created with `createStache`
- **Paged** - Paginated staches created with `createPagedStache`

### Search

Filter staches by ID using the search box in the toolbar.

## Keyboard Shortcuts

| Key      | Action                   |
| -------- | ------------------------ |
| `Escape` | Close the DevTools panel |

### Resizable Panel

The panel height can be adjusted by dragging the edge of the panel:

- **Bottom-positioned panels** - Drag the top edge up or down
- **Top-positioned panels** - Drag the bottom edge up or down

The resize handle highlights when hovered. Panel height is constrained between `minPanelHeight` and `maxPanelHeight`.

## State Persistence

The open/closed state, theme preference, and panel height are persisted to `localStorage`, so they will remember your settings across page reloads.

## Theming

The DevTools support light, dark, and system themes:

- **`'system'`** (default) - Automatically follows the user's OS color scheme preference
- **`'dark'`** - Always use dark theme
- **`'light'`** - Always use light theme

You can toggle between themes by clicking the theme button in the panel header (sun/moon/monitor icon). The theme cycles through: light → dark → system.

```svelte
<!-- Force dark theme -->
<StacheDevtools theme="dark" />

<!-- Follow system preference (default) -->
<StacheDevtools theme="system" />
```

## Styling

The DevTools styles are isolated from your app using scoped CSS with the `stache-devtools-` prefix to avoid conflicts.

## Advanced: Individual Components

For custom debugging UIs, you can import individual DevTools components:

```typescript
import {
	StacheDevtools, // Main component with toggle
	StacheDevtoolsPanel, // Panel content only
	JsonViewer, // JSON display component
	StatusBadge // Status indicator component
} from 'svelte-stache/devtools';
```

### JsonViewer

Display any data as collapsible JSON:

```svelte
<script lang="ts">
	import { JsonViewer } from 'svelte-stache/devtools';
</script>

<JsonViewer data={{ user: { name: 'Alice', id: 1 } }} maxLines={10} initialCollapsed={false} />
```

### StatusBadge

Show fetch/cache status:

```svelte
<script lang="ts">
	import { StatusBadge } from 'svelte-stache/devtools';
</script>

<StatusBadge fetchStatus="success" cacheStatus="fresh" showLabel={true} />
```

## Troubleshooting

### DevTools Not Showing

1. Make sure you've imported from `svelte-stache/devtools` (not the main package)
2. Check that the component is rendered in the DOM (not blocked by conditional rendering)
3. Verify the z-index isn't being overridden by other elements

### Cache Appears Empty

Staches only appear in DevTools when they have been created and used. If no queries have been made yet, the list will be empty.

### Performance

The DevTools use Svelte's reactive `SvelteMap` which updates efficiently. However, if you have a very large number of cached staches (hundreds), you may notice some performance impact. Consider filtering by ID to reduce the displayed items.

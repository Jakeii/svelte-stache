<script lang="ts">
	import { PUBLIC_API_URL } from '$env/static/public';
	import { createStache } from '$lib/index.js';
	import { Debounced } from 'runed';

	interface User {
		id: string;
		name: string;
		email: string;
		role: string;
		avatar: string;
	}

	const { useStache: searchUsers } = createStache({
		id: 'demo-user-search',
		fetch: async (query: string): Promise<User[]> => {
			if (!query.trim()) {
				return [];
			}

			const response = await fetch(`${PUBLIC_API_URL}/users?search=${encodeURIComponent(query)}`);
			return response.json();
		},
		staleTime: 1000 * 5
		// refetchOnWindowFocus: false
	});

	let inputValue = $state('');

	let debouncedQuery = new Debounced(() => inputValue, 300);

	const results = searchUsers(() => ({
		params: debouncedQuery.current,
		enabled: debouncedQuery.current !== ''
	}));

	const isTyping = $derived(debouncedQuery.pending);
</script>

<div class="demo-container">
	<div class="search-box">
		<svg class="search-icon" viewBox="0 0 20 20" fill="currentColor">
			<path
				fill-rule="evenodd"
				d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
				clip-rule="evenodd"
			/>
		</svg>
		<input
			type="search"
			bind:value={inputValue}
			placeholder="Search users by name, email, or role..."
		/>
		{#if isTyping}
			<span class="typing-indicator">
				<span class="dot"></span>
				<span class="dot"></span>
				<span class="dot"></span>
			</span>
		{/if}
	</div>

	{#if results.isLoading && !isTyping}
		<div class="loading">
			<span class="spinner"></span>
			Searching...
		</div>
	{:else if results.isError}
		<div class="error">Search failed. Please try again.</div>
	{:else if debouncedQuery && results.data?.length === 0 && !results.isLoading}
		<div class="no-results">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<circle cx="12" cy="12" r="10" />
				<path d="M8 15s1.5-2 4-2 4 2 4 2" />
				<line x1="9" y1="9" x2="9.01" y2="9" />
				<line x1="15" y1="9" x2="15.01" y2="9" />
			</svg>
			<span>No users found for "{debouncedQuery}"</span>
		</div>
	{:else if results.data && results.data.length > 0}
		<ul class="results">
			{#each results.data as user (user.id)}
				<li class="user-result">
					<img src={user.avatar} alt={user.name} class="user-avatar" />
					<div class="user-info">
						<span class="name">{user.name}</span>
						<span class="email">{user.email}</span>
					</div>
					<span class="role">{user.role}</span>
				</li>
			{/each}
		</ul>
	{:else if !debouncedQuery.current}
		<div class="placeholder">
			<p>Try searching for:</p>
			<div class="suggestions">
				<button onclick={() => (inputValue = 'Alice')}>Alice</button>
				<button onclick={() => (inputValue = 'Developer')}>Developer</button>
				<button onclick={() => (inputValue = 'example.com')}>example.com</button>
			</div>
		</div>
	{/if}

	{#if debouncedQuery.current && results.data}
		<div class="status-bar">
			<span class="result-count"
				>{results.data.length} result{results.data.length !== 1 ? 's' : ''}</span
			>
			<span
				class="cache-status"
				class:fresh={results.cacheStatus === 'fresh'}
				class:stale={results.cacheStatus === 'stale'}
			>
				{results.cacheStatus}
			</span>
		</div>
	{/if}
</div>

<style>
	.demo-container {
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding: 1.5rem;
		background: var(--color-background-secondary, #f9fafb);
	}

	.search-box {
		position: relative;
		display: flex;
		align-items: center;
	}

	.search-icon {
		position: absolute;
		left: 0.75rem;
		width: 1.125rem;
		height: 1.125rem;
		color: var(--color-text-muted);
		pointer-events: none;
	}

	.search-box input {
		width: 100%;
		padding: 0.75rem 2.5rem 0.75rem 2.5rem;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background: var(--color-background);
		font-size: 0.9rem;
	}

	.search-box input:focus {
		outline: 2px solid var(--color-primary);
		outline-offset: -1px;
	}

	.typing-indicator {
		position: absolute;
		right: 0.75rem;
		display: flex;
		gap: 3px;
	}

	.typing-indicator .dot {
		width: 6px;
		height: 6px;
		background: var(--color-primary);
		border-radius: 50%;
		animation: bounce 1.4s ease-in-out infinite;
	}

	.typing-indicator .dot:nth-child(2) {
		animation-delay: 0.2s;
	}

	.typing-indicator .dot:nth-child(3) {
		animation-delay: 0.4s;
	}

	@keyframes bounce {
		0%,
		80%,
		100% {
			transform: scale(0.8);
			opacity: 0.5;
		}
		40% {
			transform: scale(1);
			opacity: 1;
		}
	}

	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 2rem;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}

	.spinner {
		width: 1rem;
		height: 1rem;
		border: 2px solid var(--color-border);
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.error {
		padding: 1rem;
		margin-top: 1rem;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 6px;
		color: #dc2626;
		font-size: 0.875rem;
		text-align: center;
	}

	.no-results {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 2rem;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}

	.no-results svg {
		width: 2.5rem;
		height: 2.5rem;
		opacity: 0.5;
	}

	.placeholder {
		padding: 1.5rem;
		text-align: center;
	}

	.placeholder p {
		margin: 0 0 0.75rem;
		color: var(--color-text-muted);
		font-size: 0.875rem;
	}

	.suggestions {
		display: flex;
		gap: 0.5rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	.suggestions button {
		padding: 0.375rem 0.75rem;
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: 20px;
		font-size: 0.8rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.suggestions button:hover {
		background: var(--color-primary);
		color: white;
		border-color: var(--color-primary);
	}

	.results {
		list-style: none;
		padding: 0;
		margin: 1rem 0 0;
	}

	.user-result {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: 6px;
		margin-bottom: 0.5rem;
	}

	.user-avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--color-border);
	}

	.user-info {
		flex: 1;
		min-width: 0;
	}

	.user-info .name {
		display: block;
		font-weight: 500;
		font-size: 0.9rem;
	}

	.user-info .email {
		display: block;
		font-size: 0.75rem;
		color: var(--color-text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.role {
		padding: 0.25rem 0.5rem;
		background: var(--color-background-secondary, #f3f4f6);
		border-radius: 4px;
		font-size: 0.7rem;
		font-weight: 500;
		color: var(--color-text-muted);
	}

	.status-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-border);
		font-size: 0.75rem;
	}

	.result-count {
		color: var(--color-text-muted);
	}

	.cache-status {
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-weight: 500;
	}

	.cache-status.fresh {
		background: #dcfce7;
		color: #16a34a;
	}

	.cache-status.stale {
		background: #fef3c7;
		color: #d97706;
	}
</style>

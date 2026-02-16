<script lang="ts">
	import { createStache } from '$lib';

	interface User {
		id: string;
		name: string;
		email: string;
		role: string;
		avatar: string;
		bio?: string;
		department?: string;
		location?: string;
	}

	const { useStache: getUser } = createStache({
		id: 'demo-user',
		fetch: async (userId: string): Promise<User> => {
			const response = await fetch(`http://localhost:5173/api/users/${userId}`);
			if (!response.ok) {
				throw new Error('Failed to fetch user');
			}
			return response.json();
		},
		staleTime: 1000 * 5,
		cleanupTime: 1000 * 10
	});

	let userId = $state('user-1');

	let enabled = $state(true);

	const user = await getUser(() => ({
		params: userId,
		enabled: enabled
	}));

	$inspect('data', user.data);
</script>

<div class="demo-container">
	<div class="user-selector">
		<label for="user-select">Select User:</label>
		<select id="user-select" bind:value={userId}>
			<option value="user-1">Alice Johnson</option>
			<option value="user-2">Bob Smith</option>
			<option value="user-3">Carol Williams</option>
			<option value="user-4">David Brown</option>
			<option value="user-5">Eva Martinez</option>
		</select>
	</div>

	{#if user.isLoading}
		<div class="loading">
			<span class="spinner"></span>
			Loading user...
		</div>
	{:else if user.isError}
		<div class="error">
			Error: {user.error instanceof Error ? user.error.message : 'Unknown error'}
		</div>
	{:else if user.data}
		<div class="profile-card">
			<img src={user.data.avatar} alt={user.data.name} class="avatar" />
			<div class="info">
				<h3>{user.data.name} {user.data.id}</h3>
				<p class="role">{user.data.role}</p>
				<p class="email">{user.data.email}</p>
				{#if user.data.bio}
					<p class="bio">{user.data.bio}</p>
				{/if}
				{#if user.data.location}
					<p class="location">{user.data.location}</p>
				{/if}
			</div>
		</div>
	{/if}

	<div class="meta">
		<span
			class="status"
			class:fresh={user.cacheStatus === 'fresh'}
			class:stale={user.cacheStatus === 'stale'}
		>
			Cache: {user.cacheStatus}
		</span>
		<button
			onclick={() => {
				enabled = !enabled;
			}}>Enabled: {enabled ? 'Yes' : 'No'}</button
		>
		<span class="fetch-status">Status: {user.fetchStatus}</span>
		<button onclick={() => user.invalidate()}>Refresh</button>
	</div>
</div>

<style>
	.demo-container {
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding: 1.5rem;
		background: var(--color-background-secondary, #f9fafb);
	}

	.user-selector {
		margin-bottom: 1rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.user-selector label {
		font-weight: 500;
	}

	.user-selector select {
		padding: 0.5rem;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		background: var(--color-background);
		font-size: 0.875rem;
	}

	.loading {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 2rem;
		justify-content: center;
		color: var(--color-text-muted);
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
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 4px;
		color: #dc2626;
	}

	.profile-card {
		display: flex;
		gap: 1rem;
		padding: 1rem;
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: 8px;
	}

	.avatar {
		width: 80px;
		height: 80px;
		border-radius: 50%;
		background: var(--color-border);
	}

	.info h3 {
		margin: 0 0 0.25rem;
		font-size: 1.125rem;
	}

	.info p {
		margin: 0.25rem 0;
		font-size: 0.875rem;
	}

	.role {
		color: var(--color-primary);
		font-weight: 500;
	}

	.email {
		color: var(--color-text-muted);
	}

	.bio {
		margin-top: 0.5rem !important;
		font-style: italic;
	}

	.location {
		color: var(--color-text-muted);
		font-size: 0.8rem !important;
	}

	.meta {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-border);
		font-size: 0.75rem;
	}

	.status {
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-weight: 500;
	}

	.status.fresh {
		background: #dcfce7;
		color: #16a34a;
	}

	.status.stale {
		background: #fef3c7;
		color: #d97706;
	}

	.fetch-status {
		color: var(--color-text-muted);
	}

	.meta button {
		margin-left: auto;
		padding: 0.375rem 0.75rem;
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 0.75rem;
		cursor: pointer;
	}

	.meta button:hover {
		opacity: 0.9;
	}
</style>

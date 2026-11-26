<script lang="ts">
	import '@fontsource-variable/eb-garamond';
	import '../app.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { api } from '#lib/api.ts';
	import { session, refreshSession } from '#lib/session.svelte.ts';

	let { children } = $props();

	onMount(refreshSession);

	async function signOut() {
		await api.logout();
		await refreshSession();
		goto('/');
	}
</script>

<svelte:head><title>Secret Santa</title></svelte:head>

<header>
	<a class="brand" href="/">Secret Santa</a>
	{#if session.loaded && page.url.pathname !== '/signin'}
		<nav>
			{#if session.me?.name}
				<span class="status">{session.me.name}</span>
				<button class="btn-ghost" onclick={signOut}>Sign out</button>
			{:else}
				<span class="status">View only</span>
				<a class="btn-ghost" href="/signin">Sign in</a>
			{/if}
		</nav>
	{/if}
</header>

<main>
	{@render children()}
</main>

<style>
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		min-height: 4rem;
		padding: 0.75rem 1.25rem;
	}
	.brand {
		font-weight: 600;
		color: inherit;
		text-decoration: none;
	}
	nav {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}
	.status {
		color: var(--muted);
		padding: 0.4rem 0.3rem;
	}
	main {
		max-width: 28rem;
		margin: 0 auto;
		padding: 1.5rem 1rem 4rem;
	}
</style>

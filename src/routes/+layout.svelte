<script lang="ts">
	import '@fontsource/ibm-plex-sans/400.css';
	import '@fontsource/ibm-plex-sans/500.css';
	import '@fontsource/ibm-plex-sans/600.css';
	import '@fontsource/ibm-plex-sans/700.css';
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
		position: relative;
		z-index: 2; /* above page backgrounds */
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 15px;
		min-height: 62px;
		padding: 26px 30px 0;
	}
	nav {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.status {
		color: var(--muted);
		padding: 6px;
	}
	main {
		max-width: 1120px;
		margin: auto;
		padding: 32px 30px 65px;
	}
	@media (max-width: 700px) {
		header {
			padding: 20px 16px 0;
		}
		main {
			padding: 24px 16px 48px;
		}
	}
</style>

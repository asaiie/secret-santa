<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
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

<header>
	<a class="brand" href="/">Secret Santa</a>
	{#if session.loaded}
		{#if session.me?.name}
			<div class="account">
				<span>{session.me.name}</span>
				<button onclick={signOut}>Sign out</button>
			</div>
		{:else}
			<a class="button" href="/signin">Sign in</a>
		{/if}
	{/if}
</header>

<main>
	{@render children()}
</main>

<style>
	:global(body) {
		margin: 0;
		font-family: system-ui, sans-serif;
		background: #fbf8f3;
		color: #2a2620;
	}
	:global(button),
	.button {
		font: inherit;
		padding: 0.5rem 1rem;
		border: 1px solid currentColor;
		border-radius: 999px;
		background: transparent;
		color: inherit;
		text-decoration: none;
		cursor: pointer;
	}
	:global(button:disabled) {
		opacity: 0.5;
		cursor: default;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.25rem;
	}
	.brand {
		font-weight: 600;
		color: inherit;
		text-decoration: none;
	}
	.account {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}
	main {
		max-width: 32rem;
		margin: 0 auto;
		padding: 2rem 1rem;
	}
</style>

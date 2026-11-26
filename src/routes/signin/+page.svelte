<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { api, type User } from '#lib/api.ts';
	import type { Name } from '#lib/names.ts';
	import { refreshSession } from '#lib/session.svelte.ts';

	let users = $state<User[]>([]);
	let name = $state<Name | ''>('');
	let password = $state('');
	let confirmPassword = $state('');
	let error = $state('');
	let busy = $state(false);

	const selected = $derived(users.find((u) => u.name === name));
	const isNew = $derived(selected ? !selected.hasPassword : false);

	onMount(async () => {
		try {
			users = await api.users();
		} catch (e) {
			error = (e as Error).message;
		}
	});

	// Clear the fields when switching names.
	$effect(() => {
		name;
		password = '';
		confirmPassword = '';
		error = '';
	});

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!name) return;
		if (isNew && password !== confirmPassword) {
			error = "Passwords don't match";
			return;
		}
		busy = true;
		error = '';
		try {
			if (isNew) await api.setPassword(name, password);
			else await api.login(name, password);
			await refreshSession();
			goto('/');
		} catch (e) {
			error = (e as Error).message;
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Sign in · Secret Santa</title></svelte:head>

<h1>Sign in</h1>

<form onsubmit={submit}>
	<label>
		Who are you?
		<select bind:value={name} required>
			<option value="" disabled>Choose your name</option>
			{#each users as u (u.name)}
				<option value={u.name}>{u.name}</option>
			{/each}
		</select>
	</label>

	{#if selected}
		{#if isNew}
			<p class="hint">First time here. Choose a password.</p>
			<label>
				Password
				<input type="password" bind:value={password} autocomplete="new-password" minlength="4" required />
			</label>
			<label>
				Confirm password
				<input type="password" bind:value={confirmPassword} autocomplete="new-password" required />
			</label>
		{:else}
			<label>
				Password
				<input type="password" bind:value={password} autocomplete="current-password" required />
			</label>
		{/if}
		<button type="submit" disabled={busy}>{isNew ? 'Set password' : 'Sign in'}</button>
	{/if}

	{#if error}<p class="error">{error}</p>{/if}
</form>

<style>
	form {
		display: grid;
		gap: 1rem;
	}
	label {
		display: grid;
		gap: 0.35rem;
	}
	select,
	input {
		font: inherit;
		padding: 0.5rem;
	}
	.hint {
		margin: 0;
		opacity: 0.75;
	}
	.error {
		color: #b3261e;
		margin: 0;
	}
	button {
		justify-self: start;
	}
</style>

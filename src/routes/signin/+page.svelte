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

	function onNameChange() {
		confirmPassword = '';
		error = '';
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!name) return;
		if (isNew && password !== confirmPassword) {
			error = "Passwords don't match.";
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

<h1>Sign in</h1>

<form onsubmit={submit}>
	<label>
		<span>Your name</span>
		<select bind:value={name} onchange={onNameChange} required>
			<option value="" disabled>Choose your name</option>
			{#each users as u (u.name)}
				<option value={u.name}>{u.name}</option>
			{/each}
		</select>
	</label>

	<label>
		<span>Password</span>
		<input
			type="password"
			bind:value={password}
			autocomplete={isNew ? 'new-password' : 'current-password'}
			minlength={isNew ? 4 : undefined}
			required
		/>
	</label>

	{#if isNew}
		<label>
			<span>Confirm password</span>
			<input type="password" bind:value={confirmPassword} autocomplete="new-password" required />
		</label>
		<p class="note">Create a password.</p>
	{/if}

	{#if error}<p class="note error">{error}</p>{/if}

	<button class="btn-primary" type="submit" disabled={busy}>Sign in</button>
</form>

<a class="btn-ghost back" href="/">Back to viewing</a>

<style>
	h1 {
		font-size: 2.6rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		margin: 0 0 1.5rem;
	}
	form {
		display: grid;
		gap: 1.4rem;
	}
	label {
		display: grid;
		gap: 0.5rem;
	}
	select,
	input {
		width: 100%;
		height: 3.4rem;
		padding: 0 1rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--bg);
		font-size: 1.25rem;
	}
	select {
		appearance: none;
		padding-right: 2.75rem;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='8' fill='none' stroke='%231f1e1c' stroke-width='1.5'%3E%3Cpath d='M1 1l6 6 6-6'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 1rem center;
	}
	select:invalid {
		color: var(--muted);
	}
	select:focus,
	input:focus {
		outline: 2px solid var(--ink);
		outline-offset: -1px;
	}
	.note {
		margin: -0.4rem 0 0;
		color: var(--muted);
		font-size: 1.1rem;
	}
	.note.error {
		color: var(--error);
	}
	.back {
		margin-top: 1.25rem;
		margin-left: -0.7rem;
	}
</style>

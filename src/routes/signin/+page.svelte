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

<div class="login">
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

<p><a class="btn-ghost" href="/">Back to viewing</a></p>
</div>

<style>
	.login {
		max-width: 380px;
		margin: 4vh auto 0;
	}
	h1 {
		font-size: 28px;
	}
	form {
		display: grid;
		gap: 20px;
		margin-top: 25px;
	}
	label {
		display: grid;
		gap: 8px;
		font-size: 13px;
	}
	select,
	input {
		width: 100%;
		min-width: 0;
		min-height: 46px;
		padding: 10px;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: transparent;
		font-size: 16px;
	}
	select {
		appearance: none;
		padding-right: 36px;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='7' fill='none' stroke='%2320211f' stroke-width='1.5'%3E%3Cpath d='M1 1l5 5 5-5'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 12px center;
	}
	select:invalid {
		color: var(--muted);
	}
	select:focus-visible,
	input:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 3px;
	}
	.note {
		margin: 0;
		color: var(--muted);
		line-height: 1.6;
	}
	.note.error {
		color: var(--error);
	}
	@media (max-width: 700px) {
		.note {
			font-size: 12px;
		}
	}
</style>

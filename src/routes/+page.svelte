<script lang="ts">
	import { api } from '#lib/api.ts';
	import { session, refreshSession } from '#lib/session.svelte.ts';

	let recipient = $state<string | null>(null);
	let drawing = $state(false);
	let error = $state('');

	// Fetch the signed-in person's own recipient once the draw has happened.
	$effect(() => {
		if (session.me?.name && session.me.drawn) {
			api.recipient().then((r: { recipient: string | null }) => (recipient = r.recipient));
		} else {
			recipient = null;
		}
	});

	async function draw() {
		if (!confirm('Run the draw for everyone? This can only be done once.')) return;
		drawing = true;
		error = '';
		try {
			await api.draw();
			await refreshSession();
		} catch (e) {
			error = (e as Error).message;
		} finally {
			drawing = false;
		}
	}
</script>

<svelte:head><title>Secret Santa</title></svelte:head>

<h1>Hello, world!</h1>

{#if session.me?.name}
	{#if session.me.drawn}
		{#if recipient}
			<p>You're getting a gift for <strong>{recipient}</strong>.</p>
		{/if}
	{:else}
		<p>The draw hasn't happened yet.</p>
		{#if session.me.isAdmin}
			<button onclick={draw} disabled={drawing}>{drawing ? 'Drawing…' : 'Run the draw'}</button>
		{/if}
	{/if}
	{#if error}<p class="error">{error}</p>{/if}
{/if}

<style>
	.error {
		color: #b3261e;
	}
</style>

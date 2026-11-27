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

<div class="content">
<h1 class="visually-hidden">AJ Rhabdo Secret Santa 2026</h1>
{#if session.me?.name}
	{#if session.me.drawn}
		{#if recipient}
			<p>You're getting a gift for <strong>{recipient}</strong>.</p>
		{/if}
	{:else}
		<p>The draw hasn't happened yet.</p>
		{#if session.me.isAdmin}
			<button class="btn-primary" onclick={draw} disabled={drawing}>{drawing ? 'Drawing…' : 'Run the draw'}</button>
		{/if}
	{/if}
	{#if error}<p class="error">{error}</p>{/if}
{/if}
</div>

<style>
	.content {
		position: relative;
		z-index: 1; /* above the painting */
	}
	/* The title is painted on the canvas; this keeps it readable for screen readers. */
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>

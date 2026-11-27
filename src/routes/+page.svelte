<script lang="ts">
	import { api } from '#lib/api.ts';
	import { session, refreshSession } from '#lib/session.svelte.ts';
	import { scene } from '#lib/scene.svelte.ts';
	import { paintEnvelope, paintScroll } from '#lib/paintProps.ts';
	import PropButton from '#lib/PropButton.svelte';

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

{#if session.me?.name && scene.treeDone && scene.envelope && scene.scroll}
	<!-- Not wired up yet. -->
	<PropButton prop={scene.envelope} caption="Giftee" label="See who you're giving a gift to" paint={paintEnvelope} />
	<PropButton prop={scene.scroll} caption="Wishlist" label="Your wishlist" paint={paintScroll} />
{/if}

<div class="content">
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
</style>

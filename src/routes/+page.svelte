<script lang="ts">
	import { session, refreshSession } from '#lib/session.svelte.ts';
	import { scene } from '#lib/scene.svelte.ts';
	import { paintScroll } from '#lib/paintProps.ts';
	import { paintEnvelopeProp } from '#lib/envelope/index.ts';
	import { propSeed } from '#lib/propCanvases.ts';
	import PropButton from '#lib/PropButton.svelte';
	import WishlistModal from '#lib/WishlistModal.svelte';
	import GifteeModal from '#lib/GifteeModal.svelte';
	import { goto } from '$app/navigation';

	let wishlistOpen = $state(false);
	let gifteeOpen = $state(false);
	let envelopeShake = $state(0);
	let gifteeSeed = $state(1);
	let gifteePreview = $state(false);

	// Props are for signed-in people; anyone else is sent to sign in first.
	const openWishlist = () => (session.me?.name ? (wishlistOpen = true) : goto('/signin'));

	async function openGiftee() {
		if (!session.me?.name) return goto('/signin');
		// The draw may have happened since the page loaded.
		if (!session.me.drawn) await refreshSession();
		const drawn = !!session.me?.drawn;
		// Before the draw, the organizer can still open it (with a sample card) to test it.
		if (drawn || session.me?.isAdmin) {
			// Same seed as the envelope on the tree, so the one that opens is the one you clicked.
			gifteeSeed = propSeed('envelope') ?? 1;
			gifteePreview = !drawn;
			gifteeOpen = true;
		} else envelopeShake++; // not yet: just a little shake
	}
</script>

<!-- Shown to everyone; signed-out clicks go to sign-in. -->
{#if scene.treeDone && scene.envelope && scene.scroll}
	<PropButton
		prop={scene.envelope}
		caption="Giftee"
		captionAt={63}
		label="See who you're giving a gift to"
		paint={paintEnvelopeProp}
		paintKey="envelope"
		animate={scene.treeLive}
		shake={envelopeShake}
		onclick={openGiftee}
	/>
	<PropButton
		prop={scene.scroll}
		caption="Wishlist"
		label="Your wishlist"
		paint={paintScroll}
		paintKey="scroll"
		animate={scene.treeLive}
		onclick={openWishlist}
	/>
{/if}

{#if session.me?.name}
	<WishlistModal bind:open={wishlistOpen} />
	<GifteeModal bind:open={gifteeOpen} seed={gifteeSeed} preview={gifteePreview} />
{/if}

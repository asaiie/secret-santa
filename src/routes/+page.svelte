<script lang="ts">
	import { session } from '#lib/session.svelte.ts';
	import { scene } from '#lib/scene.svelte.ts';
	import { paintEnvelope, paintScroll } from '#lib/paintProps.ts';
	import PropButton from '#lib/PropButton.svelte';
	import WishlistModal from '#lib/WishlistModal.svelte';
	import { goto } from '$app/navigation';

	let wishlistOpen = $state(false);

	// Props are for signed-in people; anyone else is sent to sign in first.
	const openWishlist = () => (session.me?.name ? (wishlistOpen = true) : goto('/signin'));
</script>

<!-- Shown to everyone; what they do will depend on being signed in (not wired up yet). -->
{#if scene.treeDone && scene.envelope && scene.scroll}
	<PropButton prop={scene.envelope} caption="Giftee" label="See who you're giving a gift to" paint={paintEnvelope} paintKey="envelope" animate={scene.treeLive} />
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
{/if}

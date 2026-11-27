<script lang="ts">
	import { api } from './api.ts';
	import { playEnvelopeOpening, type Opening } from './envelope/index.ts';

	/**
	 * Opens the envelope: the seal breaks, the flap lifts and a card slides out with your
	 * giftee's name and wishlist. Left side on desktop, centred on phones. Click during
	 * the animation to skip it; close with the X, a click outside, or Esc.
	 */
	let {
		open = $bindable(false),
		seed = 1,
		preview = false
	}: {
		open?: boolean;
		seed?: number;
		/** Organizer's test run before the draw: sample card, nothing fetched. */
		preview?: boolean;
	} = $props();

	let dialog: HTMLDialogElement;
	let stage: HTMLDivElement;
	let opening: Opening | null = null;
	let closeButton: HTMLButtonElement | null = null;
	let done = false;
	let closing = $state(false);
	let closeTimer = 0;

	const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

	$effect(() => {
		if (open && !dialog.open) show();
		else if (!open && dialog.open) requestClose();
	});

	function show() {
		clearTimeout(closeTimer);
		closing = false;
		done = false;
		dialog.showModal();
		opening = playEnvelopeOpening(stage, { seed, onDone: () => revealClose() });
		addCloseButton(opening.textArea.parentElement!);
		// Fetch while the seal breaks; the card's text fades in near the end anyway.
		const area = opening.textArea;
		if (preview) {
			fillPreview(area);
			return;
		}
		api.giftee()
			.then((res) => fill(area, res.giftee))
			.catch(() => fill(area, undefined));
	}

	// The card box is built by the animation; put a painted-ink X in its top-left corner
	// (the holly sprig has the top-right).
	function addCloseButton(cardBox: HTMLElement) {
		const b = document.createElement('button');
		b.className = 'giftee-close';
		b.setAttribute('aria-label', 'Close');
		b.innerHTML =
			'<svg viewBox="0 0 22 22" width="22" height="22" aria-hidden="true">' +
			'<path d="M5.2 5.6C8.8 9 13 13.3 16.9 16.8"/><path d="M16.6 5.1C13.2 8.8 9.3 12.7 5.4 17.2"/></svg>';
		b.addEventListener('click', requestClose);
		cardBox.appendChild(b);
		closeButton = b;
	}

	function revealClose() {
		done = true;
		closeButton?.classList.add('shown');
	}

	type Giftee = { name: string; wishlist: string } | null | undefined;

	/** Writes the card with DOM nodes and textContent only, so names and wishes can't inject HTML. */
	function fill(area: HTMLElement, giftee: Giftee) {
		const el = (tag: string, cls: string, text?: string) => {
			const n = document.createElement(tag);
			n.className = cls;
			if (text) n.textContent = text;
			return n;
		};
		area.replaceChildren();
		if (giftee === undefined) {
			area.append(el('div', 'ss-empty', "Couldn't open the envelope. Try again in a moment."));
			return;
		}
		if (giftee === null) {
			area.append(el('div', 'ss-empty', "The draw hasn't happened yet."));
			return;
		}
		area.append(el('div', 'ss-intro', "You're the Secret Santa for"), el('div', 'ss-name', giftee.name));
		// One item per line; drop the dashes/bullets people type themselves.
		const items = giftee.wishlist
			.split('\n')
			.map((l) => l.replace(/^\s*[-•*–]\s*/, '').trim())
			.filter(Boolean);
		if (items.length === 0) {
			area.append(el('div', 'ss-empty', 'No wishlist yet. Check back soon.'));
			return;
		}
		const list = el('ul', 'ss-list');
		for (const item of items) list.append(el('li', '', item));
		area.append(list);
	}

	/** A clearly-labelled sample card for testing the animation before the draw. */
	function fillPreview(area: HTMLElement) {
		const el = (tag: string, cls: string, text: string) => {
			const n = document.createElement(tag);
			n.className = cls;
			n.textContent = text;
			return n;
		};
		const list = el('ul', 'ss-list', '');
		for (const item of ['Preview only: the draw hasn’t happened', 'Their wishlist will show up here', 'One line per item'])
			list.append(el('li', '', item));
		area.replaceChildren(el('div', 'ss-intro', "You're the Secret Santa for"), el('div', 'ss-name', 'Your giftee'), list);
	}

	/** Slide the card away, then close the dialog. */
	function requestClose() {
		if (!dialog.open || closing) return;
		closing = true;
		if (reduceMotion()) dialog.close();
		else closeTimer = window.setTimeout(() => dialog.close(), 220);
	}

	function onClose() {
		opening?.destroy();
		opening = null;
		closeButton = null;
		closing = false;
		open = false;
	}

	function onCancel(e: Event) {
		e.preventDefault();
		requestClose();
	}

	function onClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		// Any click while it's still opening just skips to the card.
		if (!done && target !== dialog) {
			opening?.skip();
			return;
		}
		// Outside the card (the backdrop, or the empty stage around the card) closes it.
		if (target === dialog || target === stage) requestClose();
	}
</script>

<dialog
	bind:this={dialog}
	onclose={onClose}
	oncancel={onCancel}
	onclick={onClick}
	aria-label="Your giftee"
>
	<div class="stage" class:closing bind:this={stage}></div>
</dialog>

<style>
	dialog {
		/* Desktop: on the left, mirroring the wishlist. The animation scales to fit. */
		margin: auto auto auto 32px;
		width: min(440px, calc(100vw - 16px));
		height: min(620px, calc(100dvh - 24px));
		max-width: none;
		max-height: none;
		padding: 0;
		border: 0;
		background: transparent;
		overflow: visible;
	}
	/* The dialog takes focus when it opens; the panel itself is the visible focus. */
	dialog:focus,
	dialog:focus-visible {
		outline: none;
	}
	/* No tint: the page stays as it is. The invisible backdrop still catches outside clicks. */
	dialog::backdrop {
		background: transparent;
	}
	.stage {
		position: relative;
		width: 100%;
		height: 100%;
		transition:
			opacity 200ms ease,
			transform 220ms ease-in;
	}
	.stage.closing {
		opacity: 0;
		transform: translateY(16px);
	}

	/* The card's writing area is filled with these (created at runtime, hence :global).
	   Painted rules sit every 28px from the top: intro = 1 row, name = 2 rows, list = the rest. */
	.stage :global(.ss-intro) {
		flex: none;
		font: 20px/28px 'Cedarville Cursive', cursive;
	}
	.stage :global(.ss-name) {
		flex: none;
		height: 56px;
		padding-top: 6px;
		font: 40px/56px 'Cedarville Cursive', cursive;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.stage :global(.ss-list) {
		flex: 1 1 auto;
		min-height: 0;
		margin: 0;
		padding: 0;
		list-style: none;
		overflow-y: auto;
		overscroll-behavior: contain;
		scrollbar-width: thin;
		scrollbar-color: rgba(150, 110, 70, 0.35) transparent;
	}
	.stage :global(.ss-list li) {
		position: relative;
		padding-left: 18px;
	}
	.stage :global(.ss-list li::before) {
		content: '';
		position: absolute;
		left: 3px;
		top: 12px;
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: rgba(143, 29, 44, 0.55);
	}
	.stage :global(.ss-empty) {
		color: rgba(58, 47, 38, 0.6);
		font: 20px/28px 'Cedarville Cursive', cursive;
	}
	.stage :global(.giftee-close) {
		position: absolute;
		left: 10px;
		top: 10px;
		width: 34px;
		height: 34px;
		display: grid;
		place-items: center;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: transparent;
		color: #3a2f26;
		cursor: pointer;
		pointer-events: auto;
		opacity: 0;
		transition:
			opacity 300ms ease,
			background-color 150ms ease;
	}
	.stage :global(.giftee-close.shown) {
		opacity: 0.7;
	}
	.stage :global(.giftee-close.shown:hover),
	.stage :global(.giftee-close.shown:focus-visible) {
		opacity: 1;
		background: rgba(120, 90, 60, 0.08);
		outline: none;
	}
	.stage :global(.giftee-close path) {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.7;
		stroke-linecap: round;
	}

	/* Phones and narrow windows: centred. */
	@media (max-width: 760px) {
		dialog {
			margin: auto;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.stage {
			transition: none;
		}
	}
</style>

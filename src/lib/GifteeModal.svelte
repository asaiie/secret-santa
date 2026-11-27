<script lang="ts">
	import { api } from './api.ts';
	import { openingEnvelopeAnchor, playEnvelopeOpening, propEnvelopeAnchor, type Opening } from './envelope/index.ts';
	import { propCanvasEl } from './propCanvases.ts';

	/**
	 * Opens the envelope: the one by the tree flies over and grows, then the seal breaks,
	 * the flap lifts and a card slides out with your giftee's name and wishlist. Left side on desktop, centred on phones. Click during
	 * the animation to skip it; close with the X, a click outside, or Esc.
	 */
	let { open = $bindable(false), seed = 1 }: { open?: boolean; seed?: number } = $props();

	let dialog: HTMLDialogElement;
	let stage: HTMLDivElement;
	let opening: Opening | null = null;
	let closeButton: HTMLButtonElement | null = null;
	let done = false;
	let closing = $state(false);
	let closeTimer = 0;
	let flight: HTMLCanvasElement | null = null;
	let hiddenProp: HTMLElement | null = null;
	const GLOW = 'drop-shadow(0 0 5px rgba(255, 199, 66, 0.75)) drop-shadow(0 0 16px rgba(255, 183, 40, 0.45))';

	const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

	$effect(() => {
		if (open && !dialog.open) show();
		else if (!open && dialog.open) requestClose();
	});

	async function show() {
		clearTimeout(closeTimer);
		closing = false;
		done = false;
		dialog.showModal();
		await flyIn();
		if (!dialog.open || closing) return; // closed during the flight
		opening = playEnvelopeOpening(stage, { seed, onDone: () => revealClose() });
		// The animation's first frame now matches the flown copy exactly; swap them.
		stage.style.visibility = '';
		flight?.remove();
		flight = null;
		addCloseButton(opening.textArea.parentElement!);
		// Fetch while the seal breaks; the card's text fades in near the end anyway.
		const area = opening.textArea;
		api.giftee()
			.then((res) => fill(area, res.giftee))
			.catch(() => fill(area, undefined));
	}

	/**
	 * Lift a copy of the envelope by the tree and glide it into place, growing, to exactly
	 * where the opening animation's envelope starts (same painting, same seed and tilt).
	 */
	async function flyIn() {
		const src = propCanvasEl('envelope');
		const button = src?.closest<HTMLElement>('.prop');
		if (!src || !button || reduceMotion()) return;
		const from = src.getBoundingClientRect();
		const a = propEnvelopeAnchor(from);
		const b = openingEnvelopeAnchor(stage.getBoundingClientRect());
		const copy = document.createElement('canvas');
		copy.width = src.width;
		copy.height = src.height;
		copy.getContext('2d')!.drawImage(src, 0, 0);
		Object.assign(copy.style, {
			position: 'fixed',
			left: `${from.left}px`,
			top: `${from.top}px`,
			width: `${from.width}px`,
			height: `${from.height}px`,
			transformOrigin: `${a.x - from.left}px ${a.y - from.top}px`,
			pointerEvents: 'none'
		});
		// Inside the dialog so it's drawn in the top layer, above the page.
		dialog.appendChild(copy);
		flight = copy;
		stage.style.visibility = 'hidden';
		button.style.visibility = 'hidden';
		hiddenProp = button;
		const k = b.unit / a.unit;
		await copy
			.animate(
				[
					{ transform: 'translate(0, 0) scale(1)', filter: GLOW },
					{ transform: `translate(${b.x - a.x}px, ${b.y - a.y}px) scale(${k})`, filter: 'none' }
				],
				{ duration: 560, easing: 'cubic-bezier(0.3, 0.7, 0.2, 1)', fill: 'forwards' }
			)
			.finished.catch(() => {});
	}

	/** Put the envelope back by the tree, fading in. */
	function restoreProp() {
		const button = hiddenProp;
		hiddenProp = null;
		if (!button) return;
		button.style.visibility = '';
		const canvas = button.querySelector('canvas');
		if (canvas && !reduceMotion()) {
			canvas.style.animation = 'none';
			void canvas.offsetWidth; // restart the fade
			canvas.style.animation = 'prop-fade-in 500ms ease-out both';
		}
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
		for (const item of items) {
			const li = el('li', '');
			li.append(...linkify(item));
			list.append(li);
		}
		area.append(list);
	}

	/**
	 * Turns web addresses in a wishlist line into links (new tab), leaving the rest as text.
	 * Only http(s) URLs; everything goes in via textContent/href, never as HTML.
	 */
	function linkify(line: string): Node[] {
		const out: Node[] = [];
		const re = /https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]]/gi;
		let last = 0;
		for (const m of line.matchAll(re)) {
			let url: URL;
			try {
				url = new URL(m[0]);
			} catch {
				continue;
			}
			if (m.index! > last) out.push(document.createTextNode(line.slice(last, m.index)));
			const a = document.createElement('a');
			a.className = 'ss-link';
			a.href = url.href;
			a.target = '_blank';
			a.rel = 'noopener noreferrer';
			a.title = url.href;
			// Short, readable label: site + page, without "www." or the query string.
			const label = url.hostname.replace(/^www\./, '') + url.pathname.replace(/\/$/, '');
			a.textContent = label.length > 42 ? label.slice(0, 41) + '…' : label;
			out.push(a);
			last = m.index! + m[0].length;
		}
		if (last < line.length) out.push(document.createTextNode(line.slice(last)));
		return out;
	}

	/** Slide the card away, then close the dialog. */
	function requestClose() {
		if (!dialog.open || closing) return;
		closing = true;
		if (reduceMotion()) dialog.close();
		else closeTimer = window.setTimeout(() => dialog.close(), 220);
	}

	function onClose() {
		flight?.remove();
		flight = null;
		stage.style.visibility = '';
		restoreProp();
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
		height: 84px; /* the name's two rows, plus one empty row before the list */
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
	.stage :global(.ss-list li) {
		overflow-wrap: anywhere; /* long words wrap onto the next ruled line */
	}
	.stage :global(.ss-link) {
		color: #8f1d2c;
		text-decoration: underline;
		text-decoration-color: rgba(143, 29, 44, 0.35);
		text-underline-offset: 3px;
	}
	.stage :global(.ss-link:hover),
	.stage :global(.ss-link:focus-visible) {
		text-decoration-color: currentColor;
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

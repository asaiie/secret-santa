<script lang="ts">
	import { api } from './api.ts';
	import { WISHLIST_MAX } from './names.ts';
	import { ROLL_R, paintRoll, paintSheet } from './paintParchment.ts';

	/**
	 * Your wishlist, written on a painted scroll that unrolls when it opens: on the
	 * right on desktop, over the tree on phones. Saves a moment after you stop typing
	 * and again when it closes; the note only says "saved" once the server has it.
	 */
	let { open = $bindable(false) }: { open?: boolean } = $props();

	type Status = 'loading' | 'saved' | 'unsaved' | 'saving' | 'error';

	let dialog: HTMLDialogElement;
	let panel: HTMLDivElement;
	let sheetCanvas: HTMLCanvasElement;
	let topRoll: HTMLCanvasElement;
	let bottomRoll: HTMLCanvasElement;
	let textarea = $state<HTMLTextAreaElement>();
	let unrolled = $state(false);
	let text = $state('');
	let status = $state<Status>('loading');
	let loaded = $state(false);
	let savedText = '';
	let timer = 0;
	let inflight = false;
	let again = false;
	let closing = 0;

	const DEBOUNCE = 700;
	const RETRY = 3000;
	const UNROLL_MS = 650;
	const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

	$effect(() => {
		if (open && !dialog.open) show();
		else if (!open && dialog.open && !closing) requestClose();
	});

	function show() {
		clearTimeout(closing);
		closing = 0;
		unrolled = false;
		dialog.showModal();
		// Paint a fresh variation at the panel's real size, then unroll it.
		const w = panel.clientWidth;
		const h = panel.clientHeight;
		const seed = Math.floor(Math.random() * 2 ** 31);
		paintSheet(sheetCanvas, w, h, seed);
		paintRoll(topRoll, w, seed + 1);
		paintRoll(bottomRoll, w, seed + 2);
		panel.style.setProperty('--travel', `${h - ROLL_R * 2}px`);
		requestAnimationFrame(() => requestAnimationFrame(() => (unrolled = true)));
		load();
	}

	/** Roll the scroll back up, then close the dialog. */
	function requestClose() {
		if (!dialog.open || closing) return;
		unrolled = false;
		if (reduceMotion()) dialog.close();
		else closing = window.setTimeout(() => dialog.close(), UNROLL_MS * 0.8);
	}

	function onClose() {
		closing = 0;
		open = false;
		// Flush anything typed in the last moment.
		if (loaded && text !== savedText) save();
	}

	function onCancel(e: Event) {
		// Esc: roll up first instead of vanishing.
		e.preventDefault();
		requestClose();
	}

	// A click that lands on the <dialog> itself (not the scroll inside it) is the backdrop.
	function onBackdrop(e: MouseEvent) {
		if (e.target === dialog) requestClose();
	}

	async function load() {
		// Don't clobber edits that haven't reached the server yet.
		if (loaded && text !== savedText) return;
		if (!loaded) status = 'loading';
		try {
			const res = await api.wishlist();
			if (loaded && text !== savedText) return;
			text = savedText = res.text;
			loaded = true;
			status = 'saved';
			setTimeout(() => textarea?.focus({ preventScroll: true }), reduceMotion() ? 0 : UNROLL_MS);
		} catch {
			status = 'error';
		}
	}

	function onInput() {
		status = 'unsaved';
		clearTimeout(timer);
		timer = window.setTimeout(save, DEBOUNCE);
	}

	async function save() {
		clearTimeout(timer);
		if (!loaded) return;
		if (text === savedText) {
			status = 'saved';
			return;
		}
		if (inflight) {
			again = true;
			return;
		}
		inflight = true;
		status = 'saving';
		const sending = text;
		try {
			await api.saveWishlist(sending);
			savedText = sending;
			status = text === savedText ? 'saved' : 'unsaved';
			if (text !== savedText) timer = window.setTimeout(save, DEBOUNCE);
		} catch {
			status = 'error';
			timer = window.setTimeout(save, RETRY);
		} finally {
			inflight = false;
			if (again) {
				again = false;
				save();
			}
		}
	}

	const statusText: Record<Status, string> = {
		loading: 'unrolling…',
		saved: 'saved',
		unsaved: 'saving…',
		saving: 'saving…',
		error: "couldn't save, retrying…"
	};
</script>

<dialog
	bind:this={dialog}
	onclose={onClose}
	oncancel={onCancel}
	onclick={onBackdrop}
	aria-labelledby="wishlist-title"
>
	<div class="scroll" class:unrolled bind:this={panel}>
		<canvas class="sheet" bind:this={sheetCanvas} aria-hidden="true"></canvas>
		<canvas class="roll top" bind:this={topRoll} aria-hidden="true"></canvas>
		<canvas class="roll bottom" bind:this={bottomRoll} aria-hidden="true"></canvas>

		<div class="writing">
			<header>
				<h2 id="wishlist-title">Wishlist</h2>
				<button class="close" onclick={requestClose} aria-label="Close">
					<svg viewBox="0 0 22 22" width="22" height="22" aria-hidden="true">
						<path d="M5.2 5.6C8.8 9 13 13.3 16.9 16.8" />
						<path d="M16.6 5.1C13.2 8.8 9.3 12.7 5.4 17.2" />
					</svg>
				</button>
			</header>
			<textarea
				bind:this={textarea}
				bind:value={text}
				oninput={onInput}
				disabled={!loaded}
				maxlength={WISHLIST_MAX}
				placeholder="What would you love to get? Ideas, sizes, links…"
				aria-label="Your wishlist"
			></textarea>
			<p class="status" class:error={status === 'error'} role="status" aria-live="polite">
				{#if status === 'saved'}
					<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
						<path d="M3 8.7c1.1 1 2 2 2.9 3.1C8 8.6 10.3 6 13.2 3.6" />
					</svg>
				{/if}
				{statusText[status]}
			</p>
		</div>
	</div>
</dialog>

<style>
	dialog {
		/* The dialog is just a positioned, invisible frame; the scroll is the panel. */
		--w: min(400px, calc(100vw - 32px));
		--h: min(600px, calc(100dvh - 64px));
		--ink: #3a2f26;
		margin: auto 32px auto auto;
		width: var(--w);
		height: var(--h);
		max-width: none;
		max-height: none;
		padding: 0;
		border: 0;
		background: transparent;
		overflow: visible;
	}
	/* No tint: the page stays as it is. The invisible backdrop still catches outside clicks. */
	dialog::backdrop {
		background: transparent;
	}
	.scroll {
		position: relative;
		width: 100%;
		height: 100%;
		--ease: cubic-bezier(0.3, 0.7, 0.25, 1);
	}
	canvas {
		position: absolute;
		left: 0;
		display: block;
		width: 100%;
		pointer-events: none;
	}
	.sheet {
		top: 0;
		height: 100%;
		/* Hidden behind the top roll until it unrolls. */
		clip-path: inset(0 0 calc(100% - 24px) 0);
		transition: clip-path 650ms var(--ease);
	}
	.roll {
		height: 34px; /* ROLL_R * 2 + 10 */
		z-index: 1;
	}
	.roll.top {
		top: -2px;
	}
	.roll.bottom {
		top: -2px;
		transform: translateY(0);
		transition: transform 650ms var(--ease);
	}
	.unrolled .sheet {
		clip-path: inset(0 0 0 0);
	}
	.unrolled .roll.bottom {
		transform: translateY(var(--travel));
	}

	.writing {
		position: absolute;
		inset: 30px 30px 26px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		opacity: 0;
		transition: opacity 200ms ease;
	}
	.unrolled .writing {
		opacity: 1;
		transition: opacity 350ms ease 380ms;
	}
	header {
		position: relative;
		display: flex;
		justify-content: center;
	}
	h2 {
		margin: 2px 0 0;
		font-family: 'Cedarville Cursive', cursive;
		font-size: 32px;
		font-weight: 400;
		line-height: 1.2;
		color: var(--ink);
	}
	.close {
		position: absolute;
		right: -6px;
		top: 4px;
		width: 34px;
		height: 34px;
		display: grid;
		place-items: center;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: transparent;
		color: var(--ink);
		cursor: pointer;
		opacity: 0.7;
		transition:
			opacity 150ms ease,
			background-color 150ms ease;
	}
	.close:hover,
	.close:focus-visible {
		opacity: 1;
		background: rgba(120, 90, 60, 0.08);
		outline: none;
	}
	.close path,
	.status path {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.7;
		stroke-linecap: round;
	}
	textarea {
		flex: 1;
		width: 100%;
		min-height: 0;
		resize: none;
		margin: 0;
		padding: 0 2px;
		border: 0;
		outline: none;
		/* Faint ink rules, one per line, that scroll with the text. */
		--rule: 28px;
		background: repeating-linear-gradient(
			to bottom,
			transparent 0,
			transparent calc(var(--rule) - 1px),
			rgba(150, 110, 70, 0.22) calc(var(--rule) - 1px),
			rgba(150, 110, 70, 0.22) var(--rule)
		);
		background-attachment: local;
		color: var(--ink);
		font: inherit;
		font-size: 16px; /* 16px stops iOS zooming in on focus */
		line-height: var(--rule);
	}
	textarea::placeholder {
		color: rgba(58, 47, 38, 0.45);
	}
	textarea:disabled {
		color: rgba(58, 47, 38, 0.5);
	}
	.status {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 4px;
		min-height: 24px;
		margin: 2px 0 0;
		font-family: 'Cedarville Cursive', cursive;
		font-size: 17px;
		color: rgba(58, 47, 38, 0.65);
	}
	.status.error {
		color: var(--error);
	}

	/* Phones and narrow windows: centred over the tree. */
	@media (max-width: 760px) {
		dialog {
			margin: auto;
			--h: min(520px, calc(100dvh - 120px));
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.sheet,
		.roll.bottom,
		.writing,
		.unrolled .writing {
			transition: none;
		}
	}
</style>

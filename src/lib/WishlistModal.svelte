<script lang="ts">
	import { api } from './api.ts';
	import { WISHLIST_MAX } from './names.ts';

	/**
	 * Your wishlist, in a panel: right side on desktop, over the tree on phones.
	 * Saves a moment after you stop typing and again when it closes; the status line
	 * only says "Saved" once the server has stored it.
	 */
	let { open = $bindable(false) }: { open?: boolean } = $props();

	type Status = 'loading' | 'saved' | 'unsaved' | 'saving' | 'error';

	let dialog: HTMLDialogElement;
	let textarea = $state<HTMLTextAreaElement>();
	let text = $state('');
	let status = $state<Status>('loading');
	let savedText = '';
	let loaded = $state(false);
	let timer = 0;
	let inflight = false;
	let again = false;

	const DEBOUNCE = 700;
	const RETRY = 3000;

	$effect(() => {
		if (open && !dialog.open) {
			dialog.showModal();
			load();
		} else if (!open && dialog.open) {
			dialog.close();
		}
	});

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
			queueMicrotask(() => textarea?.focus());
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

	function onClose() {
		open = false;
		// Flush anything typed in the last moment.
		if (loaded && text !== savedText) save();
	}

	// A click that lands on the <dialog> itself (not the panel inside it) is the backdrop.
	function onBackdrop(e: MouseEvent) {
		if (e.target === dialog) dialog.close();
	}

	const statusText: Record<Status, string> = {
		loading: 'Loading…',
		saved: 'Saved',
		unsaved: 'Saving…',
		saving: 'Saving…',
		error: "Couldn't save. Retrying…"
	};
</script>

<dialog bind:this={dialog} onclose={onClose} onclick={onBackdrop} aria-labelledby="wishlist-title">
	<div class="panel">
		<header>
			<h2 id="wishlist-title">Wishlist</h2>
			<button class="close btn-ghost" onclick={() => dialog.close()} aria-label="Close">
				<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
					<path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
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
				<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
					<path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			{/if}
			{statusText[status]}
		</p>
	</div>
</dialog>

<style>
	dialog {
		/* Desktop: a panel on the right, vertically centred. */
		margin: auto 32px auto auto;
		width: min(380px, calc(100vw - 32px));
		max-height: calc(100dvh - 48px);
		padding: 0;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--bg);
		color: var(--ink);
		box-shadow:
			0 1px 2px rgba(0, 0, 0, 0.08),
			0 18px 40px -16px rgba(30, 25, 40, 0.35);
	}
	dialog[open] {
		animation: slide-in 220ms cubic-bezier(0.2, 0.8, 0.3, 1);
	}
	dialog::backdrop {
		background: rgba(32, 33, 31, 0.18);
	}
	.panel {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px 18px 14px;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	h2 {
		margin: 0;
		font-size: 17px;
		font-weight: 700;
	}
	.close {
		margin: -6px -8px -6px 0;
		width: 36px;
	}
	textarea {
		width: 100%;
		min-height: 260px;
		max-height: 60dvh;
		resize: vertical;
		padding: 10px;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--bg);
		font: inherit;
		font-size: 16px; /* 16px stops iOS zooming in on focus */
		line-height: 1.5;
	}
	textarea:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: -1px;
	}
	textarea:disabled {
		color: var(--muted);
	}
	.status {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 4px;
		min-height: 18px;
		margin: 0;
		font-size: 13px;
		color: var(--muted);
	}
	.status.error {
		color: var(--error);
	}
	@keyframes slide-in {
		from {
			opacity: 0;
			transform: translateX(16px);
		}
	}
	/* Phones and narrow windows: centred over the tree. */
	@media (max-width: 760px) {
		dialog {
			margin: auto;
		}
		dialog[open] {
			animation-name: rise;
		}
		textarea {
			min-height: 200px;
		}
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		dialog[open] {
			animation: none;
		}
	}
</style>

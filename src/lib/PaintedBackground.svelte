<script lang="ts">
	import '@fontsource/pinyon-script/400.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { computeLayout } from './layout.ts';
	import { paintInk, TITLE_FONT } from './paintInk.ts';
	import { paintTree, type PaintMode } from './paintTree.ts';

	/**
	 * The watercolor backdrop for every page. Lives in the layout so it survives
	 * navigation: it's painted once per page load, never on route changes.
	 *
	 * Two stacked canvases share one seed, so their splotches are identical:
	 * - `plain`: paper, splotches, snow, grain
	 * - `withTree`: the same plus the Christmas tree, shown only on the home page
	 * Plus `title`: the calligraphy, written in once the tree is finished.
	 */
	let plain: HTMLCanvasElement;
	let withTree: HTMLCanvasElement;
	let title: HTMLCanvasElement;

	const showTree = $derived(page.url.pathname === '/');

	onMount(() => {
		const seed = Math.floor(Math.random() * 9000) + 1000;
		const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
		const fontReady = document.fonts.load(`100px "${TITLE_FONT}"`).catch(() => {});
		let stops: (() => void)[] = [];
		let cancelled = false;

		const writeTitle = async (animate: boolean) => {
			await fontReady;
			if (cancelled) return;
			const box = computeLayout(window.innerWidth, window.innerHeight).title;
			stops.push(paintInk(title, box, { seed, animate }));
		};

		const paintAll = (plainMode: PaintMode, treeMode: PaintMode) => {
			stops.forEach((stop) => stop());
			stops = [
				paintTree(plain, { seed, tree: false, mode: plainMode }),
				paintTree(withTree, {
					seed,
					tree: true,
					mode: treeMode,
					// Write the title as the last stroke, only if the tree was painted on screen.
					onDone: () => writeTitle(treeMode === 'live')
				})
			];
		};

		// Watch whichever canvas is on screen being painted; finish the hidden one quietly.
		const visible: PaintMode = reduceMotion ? 'instant' : 'live';
		if (page.url.pathname === '/') paintAll('quick', visible);
		else paintAll(visible, 'quick');

		// Repaint (instantly, same painting) only when the window really changes size.
		// Small height changes, like a phone's address bar sliding away, just stretch.
		let painted = { w: window.innerWidth, h: window.innerHeight };
		let timer = 0;
		const onResize = () => {
			clearTimeout(timer);
			timer = window.setTimeout(() => {
				const w = window.innerWidth;
				const h = window.innerHeight;
				if (w === painted.w && Math.abs(h - painted.h) < 140) return;
				paintAll('instant', 'instant');
				painted = { w, h };
			}, 200);
		};
		window.addEventListener('resize', onResize);

		return () => {
			cancelled = true;
			stops.forEach((stop) => stop());
			clearTimeout(timer);
			window.removeEventListener('resize', onResize);
		};
	});
</script>

<canvas bind:this={plain} aria-hidden="true"></canvas>
<canvas bind:this={withTree} class="tree" class:shown={showTree} aria-hidden="true"></canvas>
<canvas bind:this={title} class="title tree" class:shown={showTree} aria-hidden="true"></canvas>

<style>
	canvas {
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
		z-index: 0;
		pointer-events: none;
	}
	.title {
		/* Positioned and sized over the title box by paintInk. */
		inset: auto;
		width: 0;
		height: 0;
	}
	.tree {
		visibility: hidden;
	}
	.tree.shown {
		visibility: visible;
	}
</style>

<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { paintTree } from './paintTree.ts';

	/**
	 * The watercolor backdrop for every page. Lives in the layout so it survives
	 * navigation: it's painted once per page load, never on route changes.
	 *
	 * Two stacked canvases share one seed, so their splotches are identical:
	 * - `plain`: paper, splotches, snow, grain
	 * - `withTree`: the same plus the Christmas tree, shown only on the home page
	 */
	let plain: HTMLCanvasElement;
	let withTree: HTMLCanvasElement;

	const showTree = $derived(page.url.pathname === '/');

	onMount(() => {
		const seed = Math.floor(Math.random() * 9000) + 1000;
		const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
		// Watch whichever canvas is on screen being painted; finish the hidden one quietly.
		const treeFirst = page.url.pathname === '/';
		const visible = reduceMotion ? 'instant' : 'live';
		let stops = [
			paintTree(plain, { seed, tree: false, mode: treeFirst ? 'quick' : visible }),
			paintTree(withTree, { seed, tree: true, mode: treeFirst ? visible : 'quick' })
		];

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
				stops.forEach((stop) => stop());
				stops = [
					paintTree(plain, { seed, tree: false, mode: 'instant' }),
					paintTree(withTree, { seed, tree: true, mode: 'instant' })
				];
				painted = { w, h };
			}, 200);
		};
		window.addEventListener('resize', onResize);

		return () => {
			stops.forEach((stop) => stop());
			clearTimeout(timer);
			window.removeEventListener('resize', onResize);
		};
	});
</script>

<canvas bind:this={plain} aria-hidden="true"></canvas>
<canvas bind:this={withTree} class="tree" class:shown={showTree} aria-hidden="true"></canvas>

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
	.tree {
		visibility: hidden;
	}
	.tree.shown {
		visibility: visible;
	}
</style>

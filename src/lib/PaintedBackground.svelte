<script lang="ts">
	import '@fontsource/cedarville-cursive/400.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { computeLayout } from './layout.ts';
	import { paintTree, type PaintMode } from './paintTree.ts';

	/**
	 * The watercolor backdrop for every page. Lives in the layout so it survives
	 * navigation: it's painted once per page load, never on route changes.
	 *
	 * Two stacked canvases share one seed, so their splotches are identical:
	 * - `plain`: paper, splotches, snow, grain
	 * - `withTree`: the same plus the Christmas tree, shown only on the home page
	 * Plus the title, which fades in above the tree once it's finished.
	 */
	let plain: HTMLCanvasElement;
	let withTree: HTMLCanvasElement;
	let titleY = $state(0);
	let titleH = $state(0);
	let titleIn = $state(false);
	let titleAnimate = $state(true);

	const showTree = $derived(page.url.pathname === '/');

	onMount(() => {
		const seed = Math.floor(Math.random() * 9000) + 1000;
		const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
		let stops: (() => void)[] = [];

		const placeTitle = () => {
			({ titleY, titleH } = computeLayout(window.innerWidth, window.innerHeight));
		};

		const paintAll = (plainMode: PaintMode, treeMode: PaintMode) => {
			stops.forEach((stop) => stop());
			placeTitle();
			stops = [
				paintTree(plain, { seed, tree: false, mode: plainMode }),
				paintTree(withTree, {
					seed,
					tree: true,
					mode: treeMode,
					// Fade the title in as the finishing touch, only if the tree was painted on screen.
					onDone: () => {
						titleAnimate = treeMode === 'live';
						titleIn = true;
					}
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
			stops.forEach((stop) => stop());
			clearTimeout(timer);
			window.removeEventListener('resize', onResize);
		};
	});
</script>

<canvas bind:this={plain} aria-hidden="true"></canvas>
<canvas bind:this={withTree} class="tree" class:shown={showTree} aria-hidden="true"></canvas>
<h1
	class="title"
	class:shown={showTree}
	class:in={titleIn}
	class:animate={titleAnimate}
	style:top="{titleY}px"
	style:height="{titleH}px"
>
	AJ Rhabdo Secret Santa 2026
</h1>

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
	.title {
		position: fixed;
		left: 0;
		right: 0;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0;
		padding: 0 16px;
		font-family: 'Cedarville Cursive', cursive;
		font-size: clamp(24px, 2.9vw, 36px);
		font-weight: 400;
		white-space: nowrap;
		pointer-events: none;
		visibility: hidden;
		opacity: 0;
	}
	.title.shown {
		visibility: visible;
	}
	.title.in {
		opacity: 1;
	}
	.title.in.animate {
		transition: opacity 1.2s ease;
	}
</style>

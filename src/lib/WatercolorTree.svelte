<script lang="ts">
	import { onMount } from 'svelte';
	import { paintTree } from './paintTree.ts';

	/** Full-screen watercolor Christmas tree that paints itself in on load. */
	let canvas: HTMLCanvasElement;

	onMount(() => {
		const seed = Math.floor(Math.random() * 9000) + 1000;
		const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
		let stop = paintTree(canvas, { seed, animate: !reduceMotion });
		let painted = { w: window.innerWidth, h: window.innerHeight };
		let timer = 0;

		// Repaint (instantly, same painting) when the window really changes size. Small
		// height changes, like a phone's address bar sliding away, just stretch slightly.
		const onResize = () => {
			clearTimeout(timer);
			timer = window.setTimeout(() => {
				const w = window.innerWidth;
				const h = window.innerHeight;
				if (w === painted.w && Math.abs(h - painted.h) < 140) return;
				stop();
				stop = paintTree(canvas, { seed, animate: false });
				painted = { w, h };
			}, 200);
		};
		window.addEventListener('resize', onResize);

		return () => {
			stop();
			clearTimeout(timer);
			window.removeEventListener('resize', onResize);
		};
	});
</script>

<canvas bind:this={canvas} aria-hidden="true"></canvas>

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
</style>

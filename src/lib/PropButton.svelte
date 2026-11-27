<script lang="ts">
	import { onMount } from 'svelte';
	import type { Prop } from './layout.ts';

	/** A painted prop that works as a button: gold glow, grows and glows brighter on hover. */
	let {
		prop,
		caption,
		captionAt = 91,
		label,
		paint,
		onclick
	}: {
		prop: Prop;
		/** Short visible label above the prop. */
		caption: string;
		/** Caption's baseline, as % of the prop's height from the bottom (painted art doesn't fill the square). */
		captionAt?: number;
		/** Fuller description for screen readers. */
		label: string;
		paint: (canvas: HTMLCanvasElement) => void;
		onclick?: () => void;
	} = $props();

	let canvas: HTMLCanvasElement;

	onMount(() => paint(canvas));
</script>

<button
	class="prop"
	aria-label={label}
	style:left="{prop.x}px"
	style:top="{prop.y}px"
	style:width="{prop.w}px"
	style:height="{prop.h}px"
	{onclick}
>
	<!-- Caption and painting scale together as one piece. -->
	<span class="art">
		<span class="caption" style:bottom="{captionAt}%" aria-hidden="true">{caption}</span>
		<canvas bind:this={canvas} aria-hidden="true"></canvas>
	</span>
</button>

<style>
	.prop {
		position: fixed;
		z-index: 1;
		transform: translate(-50%, -50%);
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		animation: appear 450ms ease-out both;
	}
	.art {
		position: relative;
		display: block;
		width: 100%;
		height: 100%;
		transition: transform 220ms cubic-bezier(0.2, 0.8, 0.3, 1.2);
	}
	.caption {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		/* Same hand as the page title (font loaded by PaintedBackground). */
		font-family: 'Cedarville Cursive', cursive;
		font-size: 20px;
		line-height: 1.2;
		color: var(--muted);
		/* A soft paper-white halo keeps it legible where it overlaps the tree (phones). */
		text-shadow:
			0 0 3px rgba(255, 255, 255, 0.95),
			0 0 8px rgba(255, 255, 255, 0.8);
		white-space: nowrap;
		transition: color 220ms ease;
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
		/* The glow follows the painted shape, not the square. */
		filter: drop-shadow(0 0 5px rgba(255, 199, 66, 0.75)) drop-shadow(0 0 16px rgba(255, 183, 40, 0.45));
		transition: filter 220ms ease;
	}
	.prop:hover .art,
	.prop:focus-visible .art {
		transform: scale(1.14);
	}
	.prop:hover .caption,
	.prop:focus-visible .caption {
		color: var(--ink);
	}
	.prop:hover canvas,
	.prop:focus-visible canvas {
		filter: drop-shadow(0 0 8px rgba(255, 206, 80, 0.98)) drop-shadow(0 0 28px rgba(255, 186, 45, 0.75))
			drop-shadow(0 0 48px rgba(255, 176, 30, 0.35));
	}
	.prop:active .art {
		transform: scale(1.06);
	}
	.prop:focus-visible {
		outline: none;
	}
	@keyframes appear {
		from {
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.prop {
			animation: none;
		}
		.art {
			transition: none;
		}
		.prop:hover .art,
		.prop:focus-visible .art,
		.prop:active .art {
			transform: none;
		}
	}
</style>

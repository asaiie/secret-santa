<script lang="ts">
	import { onMount } from 'svelte';
	import { paintCrystal, type CrystalStyle, type Sprite } from './watercolor.ts';

	/** Ambient watercolor snow drifting down behind the page. Purely decorative. */
	let { density = 1 }: { density?: number } = $props();

	let canvas: HTMLCanvasElement;
	let visible = $state(false);

	type Flake = {
		x: number;
		y: number;
		r: number; // drawn radius in CSS px
		depth: number; // 0 (far) .. 1 (near): drives speed, size, opacity
		speed: number;
		swayPhase: number;
		swaySpeed: number;
		swayAmp: number;
		sprite: Sprite;
		angle: number;
		spin: number;
	};

	onMount(() => {
		const ctx = canvas.getContext('2d')!;
		const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

		// Paint a small set of unique flakes once; every falling flake reuses one.
		// Small, distant flakes use the bold 'star' design so they still read as snowflakes.
		const paint = (style: CrystalStyle, n: number) => Array.from({ length: n }, () => paintCrystal(style));
		const far = paint('star', 6);
		const near = [...paint('branched', 4), ...paint('fern', 3), ...paint('plate', 3), ...paint('star', 2)];
		const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

		let width = 0;
		let height = 0;
		let flakes: Flake[] = [];
		let frame = 0;
		let last = performance.now();

		const makeFlake = (anywhere: boolean): Flake => {
			const depth = Math.random() ** 1.5; // more far flakes than near ones
			const r = 5 + depth * 11;
			return {
				x: Math.random() * width,
				y: anywhere ? Math.random() * height : -r * 3 - Math.random() * 40,
				r,
				depth,
				speed: 12 + depth * 36, // px per second
				swayPhase: Math.random() * Math.PI * 2,
				swaySpeed: 0.3 + Math.random() * 0.5,
				swayAmp: 8 + depth * 22,
				sprite: depth < 0.35 ? pick(far) : pick(near),
				angle: Math.random() * Math.PI * 2,
				spin: (Math.random() - 0.5) * 0.5
			};
		};

		const resize = () => {
			const dpr = Math.min(window.devicePixelRatio || 1, 2);
			width = window.innerWidth;
			height = window.innerHeight;
			canvas.width = width * dpr;
			canvas.height = height * dpr;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.imageSmoothingQuality = 'high';
			// About one flake per 20k px², capped so big screens stay calm.
			const target = Math.min(90, Math.round(((width * height) / 20000) * density));
			while (flakes.length < target) flakes.push(makeFlake(true));
			flakes.length = target;
		};

		const draw = (dt: number, t: number) => {
			const dpr = canvas.width / width;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, width, height);
			for (const f of flakes) {
				f.y += f.speed * dt;
				f.angle += f.spin * dt;
				if (f.y - f.r * 2 > height) Object.assign(f, makeFlake(false));
				const x = f.x + Math.sin(t * f.swaySpeed + f.swayPhase) * f.swayAmp;
				const scale = f.r / f.sprite.radius;
				const s = f.sprite.size * scale;
				ctx.globalAlpha = 0.35 + f.depth * 0.35;
				ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
				ctx.translate(x, f.y);
				ctx.rotate(f.angle);
				ctx.drawImage(f.sprite.canvas, -s / 2, -s / 2, s, s);
			}
			ctx.globalAlpha = 1;
		};

		const loop = (now: number) => {
			// Clamp so a backgrounded tab doesn't make everything jump on return.
			const dt = Math.min((now - last) / 1000, 0.05);
			last = now;
			draw(dt, now / 1000);
			frame = requestAnimationFrame(loop);
		};

		const start = () => {
			cancelAnimationFrame(frame);
			if (reduceMotion.matches) {
				draw(0, 0); // a still scene instead of motion
			} else {
				last = performance.now();
				frame = requestAnimationFrame(loop);
			}
		};

		resize();
		start();
		requestAnimationFrame(() => (visible = true));

		const onResize = () => {
			resize();
			if (reduceMotion.matches) draw(0, 0);
		};
		window.addEventListener('resize', onResize);
		reduceMotion.addEventListener('change', start);

		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener('resize', onResize);
			reduceMotion.removeEventListener('change', start);
		};
	});
</script>

<canvas bind:this={canvas} class:visible aria-hidden="true"></canvas>

<style>
	canvas {
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: 0;
		opacity: 0;
		transition: opacity 1.2s ease;
		/* Paint glazes over whatever is behind it, like watercolor on paper. */
		mix-blend-mode: multiply;
	}
	canvas.visible {
		opacity: 1;
	}
</style>

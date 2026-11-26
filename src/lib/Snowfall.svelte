<script lang="ts">
	import { onMount } from 'svelte';

	/** Ambient snow drifting down behind the page. Purely decorative. */
	let { density = 1 }: { density?: number } = $props();

	let canvas: HTMLCanvasElement;
	let visible = $state(false);

	type Flake = {
		x: number;
		y: number;
		r: number; // radius in CSS px
		depth: number; // 0 (far) .. 1 (near): drives speed, size, opacity
		speed: number;
		swayPhase: number;
		swaySpeed: number;
		swayAmp: number;
		crystal: boolean;
		angle: number;
		spin: number;
	};

	onMount(() => {
		const ctx = canvas.getContext('2d')!;
		const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
		let width = 0;
		let height = 0;
		let flakes: Flake[] = [];
		let frame = 0;
		let last = performance.now();

		const makeFlake = (anywhere: boolean): Flake => {
			const depth = Math.random() ** 1.6; // more far flakes than near ones
			const crystal = depth > 0.55 && Math.random() < 0.35;
			const r = crystal ? 4 + depth * 5 : 1 + depth * 2.6;
			return {
				x: Math.random() * width,
				y: anywhere ? Math.random() * height : -r * 2 - Math.random() * 40,
				r,
				depth,
				speed: 12 + depth * 38, // px per second
				swayPhase: Math.random() * Math.PI * 2,
				swaySpeed: 0.3 + Math.random() * 0.5,
				swayAmp: 8 + depth * 22,
				crystal,
				angle: Math.random() * Math.PI,
				spin: (Math.random() - 0.5) * 0.4
			};
		};

		const resize = () => {
			const dpr = Math.min(window.devicePixelRatio || 1, 2);
			width = window.innerWidth;
			height = window.innerHeight;
			canvas.width = width * dpr;
			canvas.height = height * dpr;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			// About one flake per 14k px², capped so big screens stay calm.
			const target = Math.min(140, Math.round(((width * height) / 14000) * density));
			while (flakes.length < target) flakes.push(makeFlake(true));
			flakes.length = target;
		};

		const drawCrystal = (f: Flake, x: number, y: number) => {
			ctx.save();
			ctx.translate(x, y);
			ctx.rotate(f.angle);
			ctx.lineWidth = 1.1;
			ctx.lineCap = 'round';
			ctx.beginPath();
			for (let i = 0; i < 6; i++) {
				const a = (i * Math.PI) / 3;
				const cx = Math.cos(a);
				const sy = Math.sin(a);
				ctx.moveTo(0, 0);
				ctx.lineTo(cx * f.r, sy * f.r);
				// small V near each tip
				const bx = cx * f.r * 0.6;
				const by = sy * f.r * 0.6;
				const t = f.r * 0.28;
				ctx.moveTo(bx, by);
				ctx.lineTo(bx + Math.cos(a + 0.7) * t, by + Math.sin(a + 0.7) * t);
				ctx.moveTo(bx, by);
				ctx.lineTo(bx + Math.cos(a - 0.7) * t, by + Math.sin(a - 0.7) * t);
			}
			ctx.stroke();
			ctx.restore();
		};

		const draw = (dt: number, t: number) => {
			ctx.clearRect(0, 0, width, height);
			for (const f of flakes) {
				f.y += f.speed * dt;
				f.angle += f.spin * dt;
				if (f.y - f.r > height) Object.assign(f, makeFlake(false));
				const x = f.x + Math.sin(t * f.swaySpeed + f.swayPhase) * f.swayAmp;
				const alpha = 0.25 + f.depth * 0.55;
				ctx.fillStyle = ctx.strokeStyle = `rgba(150, 172, 196, ${alpha})`;
				if (f.crystal) {
					drawCrystal(f, x, f.y);
				} else {
					ctx.beginPath();
					ctx.arc(x, f.y, f.r, 0, Math.PI * 2);
					ctx.fill();
				}
			}
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
	}
	canvas.visible {
		opacity: 1;
	}
</style>

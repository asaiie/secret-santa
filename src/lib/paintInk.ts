/**
 * The calligraphy title: fountain-pen ink on paper, revealed left to right as if
 * being written, with a few ink splatters and a blot.
 *
 * The ink is painted once into an offscreen canvas; the visible canvas then shows
 * more of it each frame through a soft-edged mask that sweeps along each line.
 */

import type { Rect } from './layout.ts';

export const TITLE_FONT = 'Pinyon Script';

type Pt = [number, number];
export type InkOptions = { seed: number; animate: boolean };

// Blue-black, like iron-gall fountain pen ink.
const ink = (a: number) => `rgba(16, 15, 24, ${a})`;

function mulberry(seed: number) {
	let a = seed;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * Paints `lines` to fit inside `box` (viewport coordinates) and positions `canvas`
 * over it. Returns a function that stops the reveal animation.
 */
export function paintInk(
	canvas: HTMLCanvasElement,
	box: Rect & { lines: string[] },
	{ seed, animate }: InkOptions
): () => void {
	const rnd = mulberry(seed ^ 0x27d4eb2f);
	const R = (a: number, b: number) => a + rnd() * (b - a);
	const gauss = () => {
		let u = 0;
		let v = 0;
		while (!u) u = rnd();
		while (!v) v = rnd();
		return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
	};

	/* ---------- size the text to fit the box ---------- */
	const measure = document.createElement('canvas').getContext('2d')!;
	measure.font = `100px "${TITLE_FONT}"`;
	const widest = Math.max(...box.lines.map((l) => measure.measureText(l).width));
	const lineGap = 1.02; // line height as a multiple of font size
	const size = Math.min((box.w * 0.94 * 100) / widest, box.h / (box.lines.length * lineGap + 0.3));
	const lineH = size * lineGap;

	// The canvas covers the box plus a margin for flourishes and splatter.
	const pad = size * 0.6;
	const rect = { x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: box.h + pad * 2 };
	Object.assign(canvas.style, {
		left: `${rect.x}px`,
		top: `${rect.y}px`,
		width: `${rect.w}px`,
		height: `${rect.h}px`
	});
	const dpr = Math.min(window.devicePixelRatio || 1, 2);
	const W = Math.ceil(rect.w * dpr);
	const H = Math.ceil(rect.h * dpr);
	canvas.width = W;
	canvas.height = H;

	// Text positions, in canvas CSS px (vertically centred block, centred lines).
	const font = `${size}px "${TITLE_FONT}"`;
	measure.font = font;
	const blockH = lineH * box.lines.length;
	const firstBaseline = pad + (box.h - blockH) / 2 + size * 0.78;
	const lines = box.lines.map((text, i) => {
		const w = measure.measureText(text).width;
		return { text, x: pad + (box.w - w) / 2, y: firstBaseline + i * lineH, w };
	});

	/* ---------- paint the ink offscreen ---------- */
	const off = document.createElement('canvas');
	off.width = W;
	off.height = H;
	const o = off.getContext('2d')!;
	o.setTransform(dpr, 0, 0, dpr, 0, 0);
	o.font = font;
	o.textBaseline = 'alphabetic';

	// 1. Feathering: ink wicking a hair into the paper fibres.
	o.save();
	o.shadowColor = ink(0.45);
	o.shadowBlur = Math.max(1, size * 0.025) * dpr;
	o.fillStyle = ink(0.3);
	for (const l of lines) o.fillText(l.text, l.x, l.y);
	o.restore();
	// 2. Body: a few slightly offset passes, so overlaps read as denser ink.
	for (let p = 0; p < 3; p++) {
		o.fillStyle = ink(0.55);
		const j = size * 0.004;
		for (const l of lines) o.fillText(l.text, l.x + gauss() * j, l.y + gauss() * j);
	}
	// 3. Pooling: ink settles toward the lower edge of each stroke.
	o.fillStyle = ink(0.25);
	for (const l of lines) o.fillText(l.text, l.x, l.y + size * 0.008);

	// 4. Splatter flicked from the nib, and one blot where the pen rested.
	const blob = (x: number, y: number, r: number, a: number) => {
		const n = 12;
		const pts: Pt[] = Array.from({ length: n }, (_, i) => {
			const ang = (i / n) * Math.PI * 2;
			const rr = r * (1 + gauss() * 0.12);
			return [x + Math.cos(ang) * rr, y + Math.sin(ang) * rr];
		});
		o.beginPath();
		pts.forEach(([px, py], i) => {
			const [nx, ny] = pts[(i + 1) % n];
			const mx = (px + nx) / 2;
			const my = (py + ny) / 2;
			if (i === 0) o.moveTo(mx, my);
			o.quadraticCurveTo(nx, ny, (nx + pts[(i + 2) % n][0]) / 2, (ny + pts[(i + 2) % n][1]) / 2);
		});
		o.closePath();
		o.fillStyle = ink(a);
		o.fill();
	};
	const splatter = (x: number, y: number, scale: number, dir: number) => {
		const r = scale * R(0.035, 0.06);
		blob(x, y, r, 0.9);
		// Satellite droplets thrown away from the main drop.
		const n = Math.round(R(7, 14));
		for (let k = 0; k < n; k++) {
			const a = dir + gauss() * 0.6;
			const d = r * R(1.6, 6);
			const dr = r * R(0.06, 0.32);
			const px = x + Math.cos(a) * d;
			const py = y + Math.sin(a) * d;
			if (rnd() < 0.35) {
				// Elongated drop pointing outward.
				o.save();
				o.translate(px, py);
				o.rotate(a);
				o.beginPath();
				o.ellipse(0, 0, dr * 2.2, dr * 0.7, 0, 0, Math.PI * 2);
				o.fillStyle = ink(0.85);
				o.fill();
				o.restore();
			} else {
				blob(px, py, dr, 0.85);
			}
		}
		// Fine mist.
		for (let k = 0; k < 10; k++) {
			const a = dir + gauss() * 1.1;
			const d = r * R(3, 10);
			o.beginPath();
			o.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, R(0.3, 0.8), 0, Math.PI * 2);
			o.fillStyle = ink(R(0.4, 0.8));
			o.fill();
		}
	};
	const first = lines[0];
	const last = lines[lines.length - 1];
	// After the final word, as if the pen flicked at the end.
	splatter(last.x + last.w + size * R(0.15, 0.3), last.y - size * R(0.1, 0.3), size, R(-0.4, 0.2));
	// Up near the first capital.
	splatter(first.x + size * R(-0.1, 0.25), first.y - size * R(0.85, 1.0), size * 0.7, R(-2.6, -1.8));
	// A blot where the nib paused, at the end of the first line.
	blob(first.x + first.w + size * R(0.06, 0.14), first.y + size * R(-0.02, 0.06), size * R(0.05, 0.07), 0.92);
	blob(first.x + first.w + size * R(0.06, 0.14), first.y + size * 0.06, size * 0.02, 0.6);

	// 5. Paper tooth showing through the ink.
	o.save();
	o.setTransform(1, 0, 0, 1, 0, 0);
	o.globalCompositeOperation = 'destination-out';
	const specks = (W * H) / 40;
	for (let k = 0; k < specks; k++) {
		o.fillStyle = `rgba(0,0,0,${rnd() * 0.22})`;
		o.fillRect(rnd() * W, rnd() * H, 1, 1);
	}
	o.restore();

	/* ---------- reveal ---------- */
	const ctx = canvas.getContext('2d')!;
	const show = () => {
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.globalCompositeOperation = 'source-over';
		ctx.clearRect(0, 0, W, H);
		ctx.drawImage(off, 0, 0);
	};
	if (!animate) {
		show();
		return () => {};
	}

	// Each line gets a horizontal band; bands meet halfway between baselines so
	// splatter near a line appears as the "pen" passes it.
	const bands = lines.map((l, i) => {
		const top = i === 0 ? 0 : (lines[i - 1].y + l.y) / 2 - size * 0.25;
		const bottom = i === lines.length - 1 ? rect.h : (l.y + lines[i + 1].y) / 2 - size * 0.25;
		const start = i === 0 ? 0 : l.x - size * 0.3;
		const end = i === 0 || i === lines.length - 1 ? rect.w : l.x + l.w + size * 0.6;
		return { top, bottom, start, end };
	});
	const feather = size * 0.45;
	const speed = size * 5.5; // px per second: roughly a calligrapher's unhurried pace
	const pause = 0.25; // seconds between lines, like lifting the pen
	const timeline: { t0: number; t1: number }[] = [];
	let tAcc = 0;
	for (const b of bands) {
		const dur = (b.end - b.start + feather) / speed;
		timeline.push({ t0: tAcc, t1: tAcc + dur });
		tAcc += dur + pause;
	}

	const mask = document.createElement('canvas');
	mask.width = W;
	mask.height = H;
	const m = mask.getContext('2d')!;
	m.setTransform(dpr, 0, 0, dpr, 0, 0);

	let frame = 0;
	let stopped = false;
	const t0 = performance.now();
	const ease = (x: number) => x * x * (3 - 2 * x);
	const tick = (now: number) => {
		if (stopped) return;
		const t = (now - t0) / 1000;
		m.clearRect(0, 0, rect.w, rect.h);
		let done = true;
		bands.forEach((b, i) => {
			const { t0: a, t1: z } = timeline[i];
			if (t <= a) {
				done = false;
				return;
			}
			const k = Math.min(1, (t - a) / (z - a));
			if (k < 1) done = false;
			const x = b.start - feather + (b.end - b.start + feather * 2) * ease(k);
			m.fillStyle = '#000';
			m.fillRect(0, b.top, Math.max(0, x), b.bottom - b.top);
			const g = m.createLinearGradient(x, 0, x + feather, 0);
			g.addColorStop(0, 'rgba(0,0,0,1)');
			g.addColorStop(1, 'rgba(0,0,0,0)');
			m.fillStyle = g;
			m.fillRect(x, b.top, feather, b.bottom - b.top);
		});
		show();
		ctx.globalCompositeOperation = 'destination-in';
		ctx.drawImage(mask, 0, 0);
		if (done) {
			show();
			return;
		}
		frame = requestAnimationFrame(tick);
	};
	frame = requestAnimationFrame(tick);
	return () => {
		stopped = true;
		cancelAnimationFrame(frame);
	};
}

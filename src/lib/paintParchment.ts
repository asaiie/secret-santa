/**
 * The wishlist's paper: a large version of Amit's scroll, painted at the panel's
 * real size (CSS px) with the same brushes. A sheet, plus a roll for each end.
 */

import { brushes, type Pt } from './paintProps.ts';

const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

/** Radius of a roll, and how far the rolls overhang the sheet on each side. */
export const ROLL_R = 12;
export const ROLL_OVERHANG = 14;

/** The sheet, filling a w×h canvas between the rolls' overhangs. */
export function paintSheet(canvas: HTMLCanvasElement, w: number, h: number, seed: number) {
	const { wash, underlay, circ, grain, rnd, R } = brushes(canvas, { w, h }, seed, dpr());
	const x0 = ROLL_OVERHANG;
	const x1 = w - ROLL_OVERHANG;
	const y0 = ROLL_R;
	const y1 = h - ROLL_R;
	const ph = R(6);
	const wav = (y: number, p: number) => Math.sin(y * 0.035 + p) * 2.4;
	// Edges sampled every ~20px so the paint wobbles gently rather than in big swings.
	const sheet: Pt[] = [];
	for (let x = x0; x < x1; x += 20) sheet.push([x, y0]);
	for (let y = y0; y < y1; y += 20) sheet.push([x1 + wav(y, ph), y]);
	for (let x = x1; x > x0; x -= 20) sheet.push([x, y1]);
	for (let y = y1; y > y0; y -= 20) sheet.push([x0 + wav(y, ph + 2), y]);

	// Soft shadow, opaque base, then the paper washes.
	wash(
		sheet.map(([x, y]) => [x + 4, y + 6] as Pt),
		[30, 25, 45],
		{ layers: 12, alpha: 0.03, v: 0.01, edge: 0 }
	);
	underlay(sheet.map(([x, y]) => [x + (x < w / 2 ? 1 : -1), y] as Pt), 0.96);
	wash(sheet, [40, 20, 97], { layers: 18, alpha: 0.045, v: 0.01, edge: 0.5 });
	// A few faint age stains near the edges.
	for (let k = 0; k < 6; k++) {
		const left = rnd() < 0.5;
		const x = left ? R(x0 + 6, x0 + 40) : R(x1 - 40, x1 - 6);
		wash(circ(x, R(y0 + 30, y1 - 30), R(14, 34), 10), [32, 22, 88], { layers: 6, alpha: 0.016, v: 0.25, edge: 0.5 });
	}
	grain(14);
}

/** One roll, `w` wide (the full panel width). Canvas height is ROLL_R * 2 + 10. */
export function paintRoll(canvas: HTMLCanvasElement, w: number, seed: number) {
	const RR = ROLL_R;
	const h = RR * 2 + 10;
	const { ctx, wash, underlay, ellipse, rect, dense, stroke, grain } = brushes(canvas, { w, h }, seed, dpr());
	const cy = RR + 2;
	const rx0 = 7;
	const rw = w - 14;
	wash(dense(rect(rx0 + 2, cy - RR + 5, rw, RR * 2), 30), [30, 25, 45], { layers: 8, alpha: 0.035, v: 0.02, edge: 0 });
	underlay(rect(rx0 + 0.5, cy - RR + 0.5, rw - 1, RR * 2 - 1));
	wash(dense(rect(rx0, cy - RR, rw, RR * 2), 30), [36, 18, 93], { layers: 14, alpha: 0.06, v: 0.012, edge: 0.5 });
	wash(dense(rect(rx0 + 3, cy + 1, rw - 6, RR - 2), 30), [32, 14, 82], { layers: 6, alpha: 0.045, v: 0.02, edge: 0.2 });
	ctx.save();
	ctx.globalCompositeOperation = 'source-over';
	ctx.strokeStyle = 'rgba(255,250,236,0.65)';
	ctx.lineWidth = 2;
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(rx0 + 9, cy - RR * 0.45);
	ctx.lineTo(rx0 + rw - 9, cy - RR * 0.45);
	ctx.stroke();
	ctx.restore();
	// Curled ends with a spiral.
	for (const ex of [rx0, rx0 + rw]) {
		underlay(ellipse(ex, cy, 5.5, RR - 1, 14));
		wash(ellipse(ex, cy, 6, RR, 14), [36, 16, 88], { layers: 7, alpha: 0.08, v: 0.04, edge: 0.7 });
		const sp: Pt[] = [];
		for (let a = 0; a < Math.PI * 5; a += 0.2) {
			const k = 1 - a / (Math.PI * 5.4);
			sp.push([ex + Math.cos(a) * 5 * k, cy + Math.sin(a) * RR * 0.85 * k]);
		}
		stroke(sp, 'hsla(28,40%,38%,0.45)', 0.6);
	}
	grain(14);
}

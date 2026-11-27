/**
 * Watercolor background and Christmas tree, painted onto a full-screen canvas.
 *
 * Adapted from Amit's standalone painting. Two coordinate spaces:
 * - background tasks (paper, sky splotches, snow, grain) draw in screen pixels
 *   and cover the whole viewport;
 * - tree tasks draw in the original 900×1200 scene space, scaled to fit and centred.
 */

type Pt = [number, number];
type Hsl = [number, number, number];
type WashOpts = {
	layers?: number;
	alpha?: number;
	v?: number;
	edge?: number;
	jit?: number;
	depth?: number;
	baseDepth?: number;
	op?: GlobalCompositeOperation;
};

/* ---------- scene geometry (900×1200 space) ---------- */
const cx = 450;
const top = 200;
const base = 905;
const maxW = 330;
const halfAt = (y: number) => ((y - top) / (base - top)) * maxW;
// What has to stay visible: star glow at the top, gifts at the sides, ground at the bottom.
const BOUNDS = { x0: 140, x1: 780, y0: 30, y1: 1100 };

const GREENS: Hsl[] = [
	[150, 48, 24],
	[140, 42, 30],
	[160, 45, 22],
	[128, 38, 34],
	[170, 40, 26],
	[110, 40, 36]
];
const BAUBLES: Hsl[] = [
	[352, 72, 40],
	[348, 65, 34],
	[44, 80, 52],
	[38, 75, 46],
	[212, 60, 40],
	[275, 38, 42],
	[8, 70, 46],
	[190, 50, 38]
];

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
 * - live: one wash at a time, so you watch it being painted
 * - quick: as fast as possible without freezing the page (for a hidden canvas)
 * - instant: all at once
 */
export type PaintMode = 'live' | 'quick' | 'instant';
export type PaintOptions = { seed: number; mode: PaintMode; tree: boolean };

/**
 * Paints the background (paper, splotches, snow, grain), plus the tree if `tree` is set.
 * The background uses its own random stream, so the same seed gives identical splotches
 * with or without the tree. Returns a function that stops an in-progress paint.
 */
export function paintTree(canvas: HTMLCanvasElement, { seed, mode, tree }: PaintOptions): () => void {
	const ctx = canvas.getContext('2d')!;
	const bgRnd = mulberry(seed);
	const treeRnd = mulberry(seed ^ 0x5bd1e995);
	let rnd = bgRnd;
	const R = (a = 1, b?: number) => (b === undefined ? rnd() * a : a + rnd() * (b - a));
	const gauss = () => {
		let u = 0;
		let v = 0;
		while (!u) u = rnd();
		while (!v) v = rnd();
		return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
	};
	const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
	const hsla = (h: number, s: number, l: number, a: number) => `hsla(${h},${s}%,${l}%,${a})`;

	/* ---------- canvas + transforms ---------- */
	const dpr = Math.min(window.devicePixelRatio || 1, 2);
	const VW = window.innerWidth;
	const VH = window.innerHeight;
	canvas.width = Math.round(VW * dpr);
	canvas.height = Math.round(VH * dpr);

	const sw = BOUNDS.x1 - BOUNDS.x0;
	const sh = BOUNDS.y1 - BOUNDS.y0;
	const s = Math.min((VW * 0.92) / sw, (VH * 0.92) / sh);
	const ox = VW / 2 - cx * s;
	const oy = VH / 2 - (BOUNDS.y0 + sh / 2) * s + VH * 0.02;

	const tasks: (() => void)[] = [];
	const screen = () => ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	const scene = () => ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
	const bg = (fn: () => void) => tasks.push(() => (screen(), (rnd = bgRnd), fn()));
	const t = (fn: () => void) => tasks.push(() => (scene(), (rnd = treeRnd), fn()));

	/* ---------- watercolor core ---------- */
	// Recursive midpoint displacement: the Tyler Hobbs technique for paint-like edges.
	function deform(pts: Pt[], depth: number, v: number): Pt[] {
		let out = pts;
		for (let d = 0; d < depth; d++) {
			const n: Pt[] = [];
			for (let i = 0; i < out.length; i++) {
				const a = out[i];
				const b = out[(i + 1) % out.length];
				n.push(a);
				const dx = b[0] - a[0];
				const dy = b[1] - a[1];
				const len = Math.hypot(dx, dy);
				const tt = 0.5 + gauss() * 0.12;
				const mag = gauss() * len * v;
				n.push([a[0] + dx * tt - (dy / len) * mag || a[0], a[1] + dy * tt + (dx / len) * mag || a[1]]);
			}
			out = n;
			v *= 0.65;
		}
		return out;
	}
	function path(p: Pt[]) {
		ctx.beginPath();
		ctx.moveTo(p[0][0], p[0][1]);
		for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
		ctx.closePath();
	}
	// A wash: many low-alpha, slightly different deformations of one shape, multiplied like pigment.
	function wash(poly: Pt[], c: Hsl, o: WashOpts = {}) {
		const layers = o.layers ?? 28;
		const alpha = o.alpha ?? 0.045;
		const v = o.v ?? 0.18;
		const edge = o.edge ?? 0.5;
		const jit = o.jit ?? 6;
		const shape = deform(poly, o.baseDepth ?? 2, v);
		ctx.save();
		ctx.globalCompositeOperation = o.op || 'multiply';
		for (let i = 0; i < layers; i++) {
			path(deform(shape, o.depth ?? 3, v * 0.75));
			ctx.fillStyle = hsla(c[0] + gauss() * jit * 0.5, c[1] + gauss() * jit, c[2] + gauss() * jit * 0.6, alpha);
			ctx.fill();
			if (edge > 0) {
				// Pigment pools and dries darker at the rim.
				ctx.strokeStyle = hsla(c[0], c[1], Math.max(c[2] - 18, 4), alpha * edge);
				ctx.lineWidth = R(0.6, 1.6);
				ctx.stroke();
			}
		}
		ctx.restore();
	}
	const circ = (x: number, y: number, r: number, n = 14): Pt[] =>
		Array.from({ length: n }, (_, i) => {
			const a = (i / n) * Math.PI * 2;
			return [x + Math.cos(a) * r, y + Math.sin(a) * r];
		});
	const rect = (x: number, y: number, w: number, h: number): Pt[] => [
		[x, y],
		[x + w, y],
		[x + w, y + h],
		[x, y + h]
	];

	/* ---------- painting steps ---------- */
	function paper() {
		screen();
		ctx.globalCompositeOperation = 'source-over';
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, VW, VH);
	}
	function sky() {
		// Soft splotches spread over the whole screen, scaled to its size.
		const n = Math.max(7, Math.min(26, Math.round((VW * VH) / 90000)));
		for (let i = 0; i < n; i++) {
			const x = R(-100, VW + 100);
			const y = R(-80, VH + 80);
			const r = R(160, 320);
			const c = pick<Hsl>([
				[210, 40, 82],
				[225, 30, 84],
				[260, 25, 86],
				[195, 35, 84],
				[40, 50, 88]
			]);
			bg(() => wash(circ(x, y, r, 10), c, { layers: 14, alpha: 0.018, v: 0.3, edge: 0.1 }));
		}
	}
	function sketch() {
		// Faint graphite underdrawing.
		t(() => {
			ctx.save();
			ctx.globalCompositeOperation = 'multiply';
			ctx.strokeStyle = 'rgba(70,65,60,0.16)';
			ctx.lineCap = 'round';
			for (let k = 0; k < 3; k++) {
				ctx.lineWidth = R(0.5, 1);
				ctx.beginPath();
				ctx.moveTo(cx - maxW + R(-6, 6), base + R(-4, 4));
				ctx.lineTo(cx + R(-3, 3), top + R(-5, 5));
				ctx.lineTo(cx + maxW + R(-6, 6), base + R(-4, 4));
				ctx.stroke();
			}
			ctx.restore();
		});
	}
	function ground() {
		t(() =>
			wash(
				circ(cx, 1010, 360, 16).map(([x, y]) => [x, 1010 + (y - 1010) * 0.28] as Pt),
				[215, 25, 84],
				{ layers: 22, alpha: 0.03, v: 0.2, edge: 0.25 }
			)
		);
		t(() =>
			wash(
				circ(cx + 30, 960, 250, 14).map(([x, y]) => [x, 960 + (y - 960) * 0.18] as Pt),
				[230, 22, 66],
				{ layers: 18, alpha: 0.03, v: 0.18, edge: 0.2 }
			)
		);
	}
	function trunk() {
		t(() =>
			wash(
				[
					[cx - 26, 850],
					[cx + 26, 850],
					[cx + 32, 975],
					[cx - 30, 975]
				],
				[24, 45, 32],
				{ layers: 24, alpha: 0.06, v: 0.06, edge: 0.6 }
			)
		);
		t(() =>
			wash(
				[
					[cx + 4, 850],
					[cx + 26, 850],
					[cx + 32, 975],
					[cx + 8, 975]
				],
				[20, 40, 20],
				{ layers: 14, alpha: 0.06, v: 0.06 }
			)
		);
	}
	function tier(i: number, n: number) {
		const t0 = i / n;
		const t1 = (i + 1) / n;
		const yt = top + (base - top) * Math.max(0, t0 - 0.13) - (i ? 0 : 18);
		const yb = top + (base - top) * t1;
		const w = halfAt(yb) * R(1.0, 1.08);
		// Scalloped, drooping bottom edge of branch tips.
		const poly: Pt[] = [
			[cx + R(-3, 3), yt],
			[cx + w, yb]
		];
		const tips = 4 + i;
		for (let k = 1; k < tips * 2; k++) {
			const x = cx + w - (2 * w * k) / (tips * 2);
			poly.push([x, yb - (k % 2 ? R(14, 26) : R(-4, 6))]);
		}
		poly.push([cx - w, yb]);
		const g = GREENS[i % GREENS.length];
		// Light wet-in-wet underlayer, body colour, shadow side, then a warm glaze.
		t(() => wash(poly, [95, 45, 58], { layers: 16, alpha: 0.04, v: 0.12, edge: 0.1 }));
		t(() => wash(poly, g, { layers: 30, alpha: 0.05, v: 0.1, edge: 0.7 }));
		const mid = (yt + yb) / 2;
		t(() =>
			wash(
				[
					[cx + R(-4, 10), yt + 12],
					[cx + w * 0.95, yb - 4],
					[cx + w * 0.2, yb - 6],
					[cx + w * 0.05, mid]
				],
				[175, 45, 16],
				{ layers: 20, alpha: 0.045, v: 0.14, edge: 0.4 }
			)
		);
		t(() =>
			wash(
				[
					[cx - w * 0.15, yt + 30],
					[cx - w * 0.25, mid],
					[cx - w * 0.8, yb - 10],
					[cx - w * 0.45, yb - 12]
				],
				[85, 50, 55],
				{ layers: 12, alpha: 0.035, v: 0.16, edge: 0.1 }
			)
		);
		t(() => needles(yt, yb, w));
	}
	function needles(yt: number, yb: number, w: number) {
		// Hundreds of tiny dry-brush strokes.
		ctx.save();
		ctx.globalCompositeOperation = 'multiply';
		ctx.lineCap = 'round';
		const N = Math.floor(w * 1.6);
		for (let k = 0; k < N; k++) {
			const y = R(yt + 10, yb - 6);
			const hw = ((y - yt) / (yb - yt)) * w * 0.98;
			const x = cx + R(-hw, hw);
			const side = Math.sign(x - cx) || 1;
			const len = R(6, 18);
			const ang = Math.PI / 2 - side * R(0.5, 1.1);
			const g = pick(GREENS);
			const l = g[2] + R(-12, 10);
			ctx.strokeStyle = hsla(g[0] + R(-10, 10), g[1], Math.max(8, l), R(0.15, 0.4));
			ctx.lineWidth = R(0.6, 1.8);
			ctx.beginPath();
			ctx.moveTo(x, y);
			ctx.quadraticCurveTo(
				x + Math.cos(ang) * len * 0.5 * side,
				y + Math.sin(ang) * len * 0.3,
				x + Math.cos(ang) * len * side,
				y + Math.sin(ang) * len
			);
			ctx.stroke();
		}
		ctx.restore();
	}
	function garlands() {
		for (let i = 0; i < 5; i++) {
			const y1 = top + (base - top) * (0.2 + i * 0.16);
			const y2 = y1 + R(40, 70);
			const w1 = halfAt(y1) * 0.95;
			const w2 = halfAt(y2) * 0.95;
			const flip = i % 2;
			const a: Pt = flip ? [cx + w1, y1] : [cx - w1, y1];
			const b: Pt = flip ? [cx - w2, y2] : [cx + w2, y2];
			const c: Pt = [(a[0] + b[0]) / 2, Math.max(y1, y2) + R(35, 60)];
			const gold = i % 2 === 0;
			t(() => {
				const pts: Pt[] = [];
				for (let tt = 0; tt <= 1.0001; tt += 0.004) {
					const u = 1 - tt;
					pts.push([
						u * u * a[0] + 2 * u * tt * c[0] + tt * tt * b[0],
						u * u * a[1] + 2 * u * tt * c[1] + tt * tt * b[1]
					]);
				}
				ctx.save();
				ctx.globalCompositeOperation = 'multiply';
				ctx.lineCap = 'round';
				// Soft ribbon wash.
				for (let L = 0; L < 10; L++) {
					ctx.strokeStyle = gold ? hsla(42, 75, 55, 0.06) : hsla(352, 65, 45, 0.06);
					ctx.lineWidth = R(4, 8);
					ctx.beginPath();
					pts.forEach((p, j) => {
						const qx = p[0] + gauss() * 1.2;
						const qy = p[1] + gauss() * 1.2;
						if (j) ctx.lineTo(qx, qy);
						else ctx.moveTo(qx, qy);
					});
					ctx.stroke();
				}
				ctx.restore();
				// Beads.
				for (let j = 0; j < pts.length; j += gold ? 7 : 10) {
					const p = pts[j];
					wash(circ(p[0], p[1], gold ? 3.2 : 3.8, 8), gold ? [40, 80, 48] : [350, 70, 40], {
						layers: 4,
						alpha: 0.22,
						v: 0.15,
						edge: 0.8,
						depth: 1,
						baseDepth: 1
					});
				}
			});
		}
	}
	type Bauble = { x: number; y: number; r: number; c: Hsl; drop: boolean };
	function baubles() {
		const placed: Bauble[] = [];
		let tries = 0;
		while (placed.length < 34 && tries++ < 3000) {
			const y = R(top + 90, base - 30);
			const hw = halfAt(y) * 0.85;
			const x = cx + R(-hw, hw);
			const r = R(10, 19) * (0.7 + (0.5 * (y - top)) / (base - top));
			if (placed.some((p) => Math.hypot(p.x - x, p.y - y) < p.r + r + 14)) continue;
			placed.push({ x, y, r, c: pick(BAUBLES), drop: rnd() < 0.18 });
		}
		placed.sort((a, b) => a.y - b.y).forEach((o) => t(() => bauble(o)));
	}
	function bauble({ x, y, r, c, drop }: Bauble) {
		// Thread.
		ctx.save();
		ctx.globalCompositeOperation = 'multiply';
		ctx.strokeStyle = 'rgba(120,90,40,0.5)';
		ctx.lineWidth = 0.8;
		ctx.beginPath();
		ctx.moveTo(x, y - r - 2);
		ctx.lineTo(x + R(-2, 2), y - r - R(8, 14));
		ctx.stroke();
		ctx.restore();
		let shape = circ(x, y, r, 16);
		if (drop) {
			shape = shape.map(([px, py]) => {
				const dy = py - y;
				return [x + (px - x) * (dy < 0 ? 0.8 : 1 - (dy / r) * 0.35), y + dy * (dy > 0 ? 1.7 : 1)] as Pt;
			});
		}
		wash(shape, [c[0], c[1], Math.min(c[2] + 12, 70)], {
			layers: 14,
			alpha: 0.12,
			v: 0.05,
			edge: 0,
			jit: 3,
			op: 'source-over'
		});
		wash(shape, c, { layers: 8, alpha: 0.09, v: 0.05, edge: 1.2, jit: 4 });
		// Shadow crescent bottom-right.
		wash(circ(x + r * 0.28, y + r * 0.3, r * 0.72, 12), [c[0], c[1], c[2] - 14], {
			layers: 10,
			alpha: 0.08,
			v: 0.08,
			edge: 0.3
		});
		// Lifted highlight: paper showing through.
		ctx.save();
		ctx.globalCompositeOperation = 'source-over';
		ctx.fillStyle = 'rgba(255,252,244,0.75)';
		path(deform(circ(x - r * 0.38, y - r * 0.38, r * 0.22, 8), 2, 0.12));
		ctx.fill();
		ctx.fillStyle = 'rgba(255,252,244,0.5)';
		path(deform(circ(x - r * 0.05, y - r * 0.55, r * 0.08, 6), 1, 0.1));
		ctx.fill();
		ctx.restore();
		// Stripe on some.
		if (!drop && rnd() < 0.4) {
			ctx.save();
			ctx.globalCompositeOperation = 'multiply';
			path(shape);
			ctx.clip();
			ctx.strokeStyle = rnd() < 0.5 ? hsla(44, 80, 50, 0.55) : 'rgba(255,250,240,0.6)';
			ctx.lineWidth = R(1.2, 2.2);
			ctx.beginPath();
			ctx.ellipse(x, y, r * 1.05, r * 0.32, R(-0.15, 0.15), 0, Math.PI * 2);
			ctx.stroke();
			ctx.restore();
		}
		// Gold cap.
		wash(rect(x - r * 0.22, y - r - 3, r * 0.44, 4.5), [40, 70, 45], {
			layers: 4,
			alpha: 0.35,
			v: 0.04,
			edge: 0.8,
			depth: 1
		});
	}
	function lights() {
		t(() => {
			ctx.save();
			for (let k = 0; k < 90; k++) {
				const y = R(top + 40, base - 10);
				const hw = halfAt(y) * 0.92;
				const x = cx + R(-hw, hw);
				const r = R(10, 20);
				const h = pick([48, 42, 36, 30, 55]);
				ctx.globalCompositeOperation = 'screen';
				const g = ctx.createRadialGradient(x, y, 0, x, y, r);
				g.addColorStop(0, hsla(h, 100, 75, 0.55));
				g.addColorStop(0.35, hsla(h, 100, 60, 0.18));
				g.addColorStop(1, hsla(h, 100, 50, 0));
				ctx.fillStyle = g;
				ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
				ctx.globalCompositeOperation = 'source-over';
				ctx.fillStyle = hsla(h, 100, 93, 0.95);
				ctx.beginPath();
				ctx.arc(x, y, R(1.2, 2.3), 0, 7);
				ctx.fill();
			}
			ctx.restore();
		});
	}
	function star() {
		const sx = cx;
		const sy = top - 22;
		const ro = 46;
		const ri = 19;
		const pts: Pt[] = [];
		for (let i = 0; i < 10; i++) {
			const a = -Math.PI / 2 + (i * Math.PI) / 5;
			const r = i % 2 ? ri : ro;
			pts.push([sx + Math.cos(a) * r, sy + Math.sin(a) * r]);
		}
		t(() => {
			ctx.save();
			ctx.globalCompositeOperation = 'screen';
			const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 150);
			g.addColorStop(0, 'rgba(255,225,140,0.55)');
			g.addColorStop(1, 'rgba(255,225,140,0)');
			ctx.fillStyle = g;
			ctx.fillRect(sx - 150, sy - 150, 300, 300);
			ctx.globalCompositeOperation = 'multiply';
			ctx.lineCap = 'round';
			for (let k = 0; k < 26; k++) {
				const a = (k / 26) * Math.PI * 2 + R(-0.05, 0.05);
				const r1 = R(56, 64);
				const r2 = R(80, k % 2 ? 110 : 150);
				ctx.strokeStyle = hsla(42, 80, 55, R(0.15, 0.35));
				ctx.lineWidth = R(0.5, 1.4);
				ctx.beginPath();
				ctx.moveTo(sx + Math.cos(a) * r1, sy + Math.sin(a) * r1);
				ctx.lineTo(sx + Math.cos(a) * r2, sy + Math.sin(a) * r2);
				ctx.stroke();
			}
			ctx.restore();
		});
		t(() => wash(pts, [44, 85, 58], { layers: 26, alpha: 0.08, v: 0.03, edge: 0.9, jit: 3 }));
		t(() =>
			wash(
				pts.map(([x, y]) => [sx + (x - sx) * 0.5 + 6, sy + (y - sy) * 0.5 + 6] as Pt),
				[34, 80, 44],
				{ layers: 10, alpha: 0.07, v: 0.05, edge: 0.3 }
			)
		);
	}
	function gifts() {
		const boxes: { x: number; w: number; h: number; c: Hsl; rb: Hsl }[] = [
			{ x: cx - 290, w: 120, h: 90, c: [352, 62, 42], rb: [44, 80, 52] },
			{ x: cx - 175, w: 95, h: 120, c: [205, 50, 45], rb: [0, 0, 96] },
			{ x: cx + 70, w: 110, h: 80, c: [44, 70, 55], rb: [352, 65, 40] },
			{ x: cx + 185, w: 130, h: 105, c: [150, 40, 32], rb: [44, 80, 52] },
			{ x: cx - 55, w: 80, h: 58, c: [275, 35, 48], rb: [44, 80, 52] }
		];
		boxes
			.sort((a, b) => b.h - a.h)
			.forEach((b) => {
				const y = 985 - b.h + (b.x > cx - 80 && b.x < cx ? 18 : 0);
				t(() => {
					wash(rect(b.x, y, b.w, b.h), b.c, { layers: 22, alpha: 0.08, v: 0.025, edge: 0.9 });
					wash(rect(b.x + b.w * 0.62, y + 2, b.w * 0.38, b.h - 2), [b.c[0], b.c[1], b.c[2] - 14], {
						layers: 10,
						alpha: 0.06,
						v: 0.03
					}); // side shade
					wash(rect(b.x - 3, y - 10, b.w + 6, 16), [b.c[0], b.c[1], b.c[2] + 6], {
						layers: 12,
						alpha: 0.08,
						v: 0.03,
						edge: 0.9
					}); // lid
					const white = b.rb[2] > 90;
					const op: GlobalCompositeOperation = white ? 'source-over' : 'multiply';
					const rc: Hsl = white ? [40, 30, 97] : b.rb;
					const ribbon = { layers: 10, alpha: white ? 0.18 : 0.12, v: 0.02, edge: white ? 0 : 0.7, op };
					wash(rect(b.x + b.w / 2 - 6, y - 10, 12, b.h + 10), rc, ribbon);
					wash(rect(b.x - 3, y + b.h * 0.45, b.w + 6, 10), rc, ribbon);
					// Bow: two loops and a knot.
					const bx = b.x + b.w / 2;
					const by = y - 12;
					for (const side of [-1, 1]) {
						const lx = bx + side * 15;
						const ly = by - 6;
						wash(
							circ(lx, ly, 13, 10).map(([px, py]) => [px, ly + (py - ly) * 0.6] as Pt),
							rc,
							{ layers: 10, alpha: white ? 0.2 : 0.13, v: 0.08, edge: white ? 0 : 0.8, op }
						);
					}
					wash(circ(bx, by - 3, 5, 8), [rc[0], rc[1], rc[2] - 12], {
						layers: 6,
						alpha: 0.25,
						v: 0.05,
						edge: 0.6,
						op
					});
				});
			});
	}
	function splatter() {
		// Pigment flicked off the brush, around the tree.
		t(() => {
			ctx.save();
			ctx.globalCompositeOperation = 'multiply';
			for (let k = 0; k < 70; k++) {
				const c = pick<Hsl>([...GREENS, ...BAUBLES, [42, 80, 50]]);
				const x = cx + gauss() * 240;
				const y = 560 + gauss() * 300;
				const r = Math.abs(gauss()) * 2.4 + 0.4;
				ctx.fillStyle = hsla(c[0], c[1], c[2] + 8, R(0.25, 0.6));
				path(deform(circ(x, y, r, 7), 1, 0.2));
				ctx.fill();
			}
			ctx.restore();
		});
	}
	function snow() {
		// White gouache snow across the whole screen.
		bg(() => {
			ctx.save();
			ctx.globalCompositeOperation = 'source-over';
			const n = Math.round((VW * VH) / 4200);
			for (let k = 0; k < n; k++) {
				const x = R(VW);
				const y = R(VH);
				const r = Math.abs(gauss()) * 1.8 + 0.5;
				ctx.fillStyle = `rgba(255,253,248,${R(0.55, 0.95)})`;
				ctx.beginPath();
				ctx.arc(x, y, r, 0, 7);
				ctx.fill();
			}
			ctx.restore();
		});
	}
	function grain() {
		// Cold-press paper tooth: fine noise + large soft blotches, multiplied over everything.
		bg(() => {
			const w = Math.ceil(VW);
			const h = Math.ceil(VH);
			const noise = document.createElement('canvas');
			noise.width = w;
			noise.height = h;
			const nc = noise.getContext('2d')!;
			const id = nc.createImageData(w, h);
			const d = id.data;
			for (let i = 0; i < d.length; i += 4) {
				const v = 255 - Math.pow(rnd(), 3) * 38;
				d[i] = v;
				d[i + 1] = v - 2;
				d[i + 2] = v - 6;
				d[i + 3] = 255;
			}
			nc.putImageData(id, 0, 0);
			const bw = Math.max(8, Math.round(w / 30));
			const bh = Math.max(8, Math.round(h / 30));
			const blot = document.createElement('canvas');
			blot.width = bw;
			blot.height = bh;
			const bc = blot.getContext('2d')!;
			const bd = bc.createImageData(bw, bh);
			for (let i = 0; i < bd.data.length; i += 4) {
				const v = 232 + rnd() * 23;
				bd.data[i] = v;
				bd.data[i + 1] = v - 1;
				bd.data[i + 2] = v - 5;
				bd.data[i + 3] = 255;
			}
			bc.putImageData(bd, 0, 0);
			ctx.save();
			ctx.globalCompositeOperation = 'multiply';
			ctx.globalAlpha = 0.55;
			ctx.drawImage(noise, 0, 0, VW, VH);
			ctx.globalAlpha = 0.6;
			ctx.imageSmoothingEnabled = true;
			ctx.drawImage(blot, 0, 0, VW, VH);
			// Soft vignette toward the screen edges.
			ctx.globalAlpha = 1;
			const m = Math.max(VW, VH);
			const v = ctx.createRadialGradient(VW / 2, VH / 2, m * 0.3, VW / 2, VH / 2, m * 0.75);
			v.addColorStop(0, 'rgba(255,255,255,0)');
			v.addColorStop(1, 'rgba(205,195,180,0.35)');
			ctx.fillStyle = v;
			ctx.fillRect(0, 0, VW, VH);
			ctx.restore();
		});
	}

	/* ---------- compose + run ---------- */
	paper();
	rnd = bgRnd;
	sky();
	if (tree) {
		rnd = treeRnd;
		sketch();
		ground();
		trunk();
		const tiers = 6;
		for (let i = 0; i < tiers; i++) tier(i, tiers);
		garlands();
		lights();
		baubles();
		star();
		gifts();
		splatter();
	}
	snow();
	grain();

	if (mode === 'instant') {
		tasks.forEach((task) => task());
		return () => {};
	}

	let i = 0;
	let stopped = false;
	let timer = 0;
	let frame = 0;
	const step = () => {
		if (stopped) return;
		if (mode === 'live') {
			// One wash at a time so the picture builds up like it's being painted.
			tasks[i++]();
			if (i < tasks.length) timer = window.setTimeout(() => (frame = requestAnimationFrame(step)), 45);
		} else {
			// A few milliseconds of work per frame keeps animations elsewhere smooth.
			const start = performance.now();
			while (i < tasks.length && performance.now() - start < 8) tasks[i++]();
			if (i < tasks.length) frame = requestAnimationFrame(step);
		}
	};
	frame = requestAnimationFrame(step);
	return () => {
		stopped = true;
		clearTimeout(timer);
		cancelAnimationFrame(frame);
	};
}

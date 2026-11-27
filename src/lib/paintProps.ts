/**
 * Watercolor props used as buttons: Amit's envelope with a red wax seal, and his
 * scroll with a quill. Ported from his standalone paintings, minus the paint-in
 * animation: each is painted at once from a fixed seed, so it looks the same
 * every time.
 *
 * Both are drawn in the tree painting's units (see paintTree.ts), so at the tree's
 * scale they're the size of the gifts under it.
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

/** Painting sizes, in tree-scene units. */
export const ENVELOPE = { w: 170, h: 130 };
export const SCROLL = { w: 150, h: 180 };

/** Pixels per unit the props are painted at; CSS scales them down to the layout. */
const RES = 4;

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

/** Sizes the canvas and returns the shared watercolor brushes bound to it. */
function brushes(canvas: HTMLCanvasElement, size: { w: number; h: number }, seed: number) {
	canvas.width = size.w * RES;
	canvas.height = size.h * RES;
	const ctx = canvas.getContext('2d')!;
	ctx.setTransform(RES, 0, 0, RES, 0, 0);
	ctx.clearRect(0, 0, size.w, size.h);
	const rnd = mulberry(seed);
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

	// Recursive midpoint displacement gives paint-like, irregular edges.
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
				const len = Math.hypot(dx, dy) || 1;
				const t = 0.5 + gauss() * 0.12;
				const mag = gauss() * len * v;
				n.push([a[0] + dx * t - (dy / len) * mag, a[1] + dy * t + (dx / len) * mag]);
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
		const base = deform(poly, o.baseDepth ?? 2, v);
		ctx.save();
		ctx.globalCompositeOperation = o.op || 'multiply';
		for (let i = 0; i < layers; i++) {
			path(deform(base, o.depth ?? 3, v * 0.75));
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
	const ellipse = (x: number, y: number, rx: number, ry: number, n = 16): Pt[] =>
		Array.from({ length: n }, (_, i) => {
			const a = (i / n) * Math.PI * 2;
			return [x + Math.cos(a) * rx, y + Math.sin(a) * ry];
		});
	const rect = (x: number, y: number, w: number, h: number): Pt[] => [
		[x, y],
		[x + w, y],
		[x + w, y + h],
		[x, y + h]
	];
	// Subdivide straight edges so long, crisp shapes still get a gently uneven paint edge.
	const dense = (pts: Pt[], step = 40): Pt[] => {
		const o: Pt[] = [];
		for (let i = 0; i < pts.length; i++) {
			const a = pts[i];
			const b = pts[(i + 1) % pts.length];
			const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
			for (let k = 0; k < n; k++) o.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
		}
		return o;
	};
	const rot = (pts: Pt[], cx: number, cy: number, a: number): Pt[] => {
		const c = Math.cos(a);
		const s = Math.sin(a);
		return pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]);
	};
	// A brush or pen line through points.
	function stroke(pts: Pt[], color: string, width: number) {
		ctx.save();
		ctx.globalCompositeOperation = 'multiply';
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.strokeStyle = color;
		ctx.lineWidth = width;
		ctx.beginPath();
		pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
		ctx.stroke();
		ctx.restore();
	}
	// Paper tooth, only where paint is.
	function grain(strength = 38) {
		const s = document.createElement('canvas');
		s.width = canvas.width;
		s.height = canvas.height;
		const sc = s.getContext('2d')!;
		const id = sc.createImageData(s.width, s.height);
		const d = id.data;
		for (let i = 0; i < d.length; i += 4) {
			d[i] = 60;
			d[i + 1] = 45;
			d[i + 2] = 30;
			d[i + 3] = Math.pow(rnd(), 3) * strength;
		}
		sc.putImageData(id, 0, 0);
		ctx.save();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.globalCompositeOperation = 'source-atop';
		ctx.drawImage(s, 0, 0);
		ctx.restore();
	}
	function splatter(cx: number, cy: number, spread: number, colors: Hsl[], n: number) {
		ctx.save();
		ctx.globalCompositeOperation = 'multiply';
		for (let k = 0; k < n; k++) {
			const c = pick(colors);
			const x = cx + gauss() * spread;
			const y = cy + gauss() * spread;
			const r = Math.abs(gauss()) * 0.7 + 0.25;
			ctx.fillStyle = hsla(c[0], c[1], c[2] + 8, R(0.3, 0.6));
			ctx.beginPath();
			ctx.arc(x, y, r, 0, 7);
			ctx.fill();
		}
		ctx.restore();
	}

	/**
	 * Opaque white under the paper, so the glow and the background don't show through
	 * the translucent washes and tint it. Slightly inset so the painted edge stays soft.
	 */
	function underlay(poly: Pt[], alpha = 0.92) {
		ctx.save();
		ctx.globalCompositeOperation = 'source-over';
		path(deform(poly, 2, 0.01));
		ctx.fillStyle = `rgba(255, 254, 251, ${alpha})`;
		ctx.fill();
		ctx.restore();
	}

	return { ctx, rnd, R, gauss, hsla, deform, path, wash, circ, ellipse, rect, dense, rot, stroke, grain, splatter, underlay };
}

/* ---------- envelope with a red wax seal ---------- */

export function paintEnvelope(canvas: HTMLCanvasElement) {
	const { ctx, R, deform, path, wash, circ, ellipse, rect, rot, stroke, grain, splatter, underlay } = brushes(
		canvas,
		ENVELOPE,
		1225
	);
	const cx = 85;
	const cy = 64;
	const EW = 128;
	const EH = 86;
	const x0 = cx - EW / 2;
	const x1 = cx + EW / 2;
	const y0 = cy - EH / 2;
	const y1 = cy + EH / 2;
	const A = R(-0.09, 0.05);
	const P = (pts: Pt[]) => rot(pts, cx, cy, A);

	// Holly leaf with a spiky edge.
	function leaf(x: number, y: number, len: number, wid: number, ang: number): Pt[] {
		const pts: Pt[] = [];
		const n = 5;
		for (let i = 0; i <= n * 2; i++) {
			const t = i / (n * 2);
			const w = Math.sin(Math.PI * t) * wid * (i % 2 ? 1 : 0.62);
			pts.push([t * len, -w]);
		}
		for (let i = n * 2 - 1; i > 0; i--) {
			const t = i / (n * 2);
			const w = Math.sin(Math.PI * t) * wid * (i % 2 ? 1 : 0.62);
			pts.push([t * len, w]);
		}
		const c = Math.cos(ang);
		const s = Math.sin(ang);
		return pts.map(([u, v]) => [x + u * c - v * s, y + u * s + v * c]);
	}

	// Shadow, body, the four flaps.
	wash(P(rect(x0 + 3, y0 + 5, EW, EH)), [30, 20, 50], { layers: 10, alpha: 0.025, v: 0.03, edge: 0 });
	underlay(P(rect(x0 + 1, y0 + 1, EW - 2, EH - 2)));
	wash(P(rect(x0, y0, EW, EH)), [42, 20, 97], { layers: 18, alpha: 0.05, v: 0.02, edge: 0.45 });
	wash(
		P([
			[x0, y0 + 2],
			[cx - 6, cy + 4],
			[x0, y1 - 2]
		]),
		[38, 14, 93],
		{ layers: 10, alpha: 0.035, v: 0.02, edge: 0.5 }
	);
	wash(
		P([
			[x1, y0 + 2],
			[cx + 6, cy + 4],
			[x1, y1 - 2]
		]),
		[38, 14, 92],
		{ layers: 10, alpha: 0.04, v: 0.02, edge: 0.5 }
	);
	wash(
		P([
			[x0 + 1, y1],
			[cx, cy - 6],
			[x1 - 1, y1]
		]),
		[40, 14, 94],
		{ layers: 12, alpha: 0.04, v: 0.02, edge: 0.5 }
	);
	wash(
		P([
			[x0, y0 + 2],
			[x1, y0 + 2],
			[cx, cy + 22]
		]),
		[30, 10, 76],
		{ layers: 8, alpha: 0.03, v: 0.03, edge: 0 }
	);
	wash(
		P([
			[x0, y0],
			[x1, y0],
			[cx, cy + 18]
		]),
		[42, 20, 97],
		{ layers: 14, alpha: 0.05, v: 0.02, edge: 0.5 }
	);
	// A whisper of graphite along the folds.
	stroke(
		P([
			[x0 + 2, y0 + 1],
			[cx, cy + 18],
			[x1 - 2, y0 + 1]
		]),
		'rgba(70,60,50,0.18)',
		0.4
	);

	// Holly sprig tucked under the seal.
	const [sx, sy] = P([[cx, cy + 18]])[0];
	(
		[
			[-2.6, 25],
			[-0.55, 23],
			[-1.6, 17]
		] as const
	).forEach(([a, len], i) => {
		const lp = leaf(sx, sy, len, 5.2, a + A);
		wash(lp, [i === 2 ? 120 : 140, 45, i === 2 ? 34 : 26], { layers: 10, alpha: 0.13, v: 0.04, edge: 0.9, depth: 2 });
		stroke(
			[
				[sx, sy],
				[sx + Math.cos(a + A) * len * 0.9, sy + Math.sin(a + A) * len * 0.9]
			],
			'rgba(20,50,30,0.45)',
			0.45
		);
	});
	(
		[
			[-9, -11],
			[-4, -14],
			[-12, -6]
		] as const
	).forEach(([dx, dy]) => {
		const [bx, by] = P([[cx + dx + 2, cy + 18 + dy + 4]])[0];
		wash(circ(bx, by, 2.3, 8), [355, 75, 42], { layers: 6, alpha: 0.25, v: 0.08, edge: 0.9, depth: 1, baseDepth: 1 });
		ctx.save();
		ctx.fillStyle = 'rgba(255,245,240,0.8)';
		ctx.beginPath();
		ctx.arc(bx - 0.7, by - 0.7, 0.6, 0, 7);
		ctx.fill();
		ctx.restore();
	});

	// The wax seal.
	const r = 15;
	wash(circ(sx + 1.6, sy + 2.2, r + 1, 12), [0, 30, 18], { layers: 8, alpha: 0.07, v: 0.1, edge: 0 });
	const drips = Array.from({ length: 3 }, () => {
		const a = R(Math.PI * 2);
		return [sx + Math.cos(a) * (r - 1.5), sy + Math.sin(a) * (r - 1.5), R(2, 3.4)] as const;
	});
	const blobs = [circ(sx, sy, r, 12), ...drips.map(([x, y, dr]) => circ(x, y, dr, 8))];
	blobs.forEach((sh) => wash(sh, [356, 72, 46], { layers: 12, alpha: 0.15, v: 0.1, edge: 0, op: 'source-over', jit: 3 }));
	blobs.forEach((sh) => wash(sh, [354, 74, 38], { layers: 5, alpha: 0.08, v: 0.1, edge: 1, jit: 3 }));

	ctx.save();
	// Pressed ring: a dark groove with a lit lip on the upper left.
	ctx.globalCompositeOperation = 'multiply';
	ctx.strokeStyle = 'hsla(352,70%,30%,0.4)';
	ctx.lineWidth = 0.8;
	ctx.beginPath();
	ctx.arc(sx + 0.4, sy + 0.5, r * 0.66, 0, 7);
	ctx.stroke();
	ctx.globalCompositeOperation = 'source-over';
	ctx.strokeStyle = 'hsla(2,85%,72%,0.55)';
	ctx.lineWidth = 0.7;
	ctx.beginPath();
	ctx.arc(sx - 0.4, sy - 0.4, r * 0.66, Math.PI * 0.9, Math.PI * 1.75);
	ctx.stroke();
	// Embossed snowflake.
	const arm = r * 0.47;
	const a0 = R(Math.PI / 3);
	const flake = (ox: number, oy: number, col: string, lw: number) => {
		ctx.strokeStyle = col;
		ctx.lineWidth = lw;
		ctx.lineCap = 'round';
		ctx.beginPath();
		for (let k = 0; k < 6; k++) {
			const a = a0 + (k * Math.PI) / 3;
			ctx.moveTo(sx + ox, sy + oy);
			ctx.lineTo(sx + ox + Math.cos(a) * arm, sy + oy + Math.sin(a) * arm);
			const mx = sx + ox + Math.cos(a) * arm * 0.58;
			const my = sy + oy + Math.sin(a) * arm * 0.58;
			for (const b of [-0.75, 0.75]) {
				ctx.moveTo(mx, my);
				ctx.lineTo(mx + Math.cos(a + b) * arm * 0.32, my + Math.sin(a + b) * arm * 0.32);
			}
		}
		ctx.stroke();
	};
	ctx.globalCompositeOperation = 'multiply';
	flake(0.4, 0.5, 'hsla(352,70%,30%,0.5)', 0.5);
	ctx.globalCompositeOperation = 'source-over';
	flake(-0.3, -0.3, 'hsla(4,90%,78%,0.55)', 0.4);
	// Glossy highlights.
	const hx = sx - r * 0.5;
	const hy = sy - r * 0.55;
	ctx.fillStyle = 'rgba(255,238,232,0.55)';
	path(deform(rot(ellipse(hx, hy, r * 0.28, r * 0.13, 8), hx, hy, -0.7), 1, 0.1));
	ctx.fill();
	ctx.fillStyle = 'rgba(255,250,248,0.85)';
	ctx.beginPath();
	ctx.arc(sx - r * 0.2, sy - r * 0.72, 0.8, 0, 7);
	ctx.fill();
	ctx.restore();

	splatter(
		cx,
		cy,
		34,
		[
			[354, 70, 40],
			[140, 45, 30],
			[40, 40, 60]
		],
		10
	);
	grain(16);
}

/* ---------- unfurled scroll with a quill ---------- */

export function paintScroll(canvas: HTMLCanvasElement) {
	const { ctx, rnd, R, wash, circ, ellipse, rect, dense, stroke, grain, splatter, underlay } = brushes(
		canvas,
		SCROLL,
		2026
	);
	const sx0 = 28;
	const sx1 = 108;
	const sy0 = 34;
	const sy1 = 146;
	const scx = (sx0 + sx1) / 2;
	const RX0 = 21;
	const RW = 94;
	const RR = 6.5;

	const wav = (y: number, ph: number) => Math.sin(y * 0.09 + ph) * 1.2;
	const ph = R(6);
	const sheet: Pt[] = [];
	for (let y = sy0; y <= sy1; y += 8) sheet.push([sx1 + wav(y, ph), y]);
	for (let y = sy1; y >= sy0; y -= 8) sheet.push([sx0 + wav(y, ph + 2), y]);

	// Shadow, parchment, age stains.
	wash(
		sheet.map(([x, y]) => [x + 3, y + 4] as Pt),
		[30, 25, 45],
		{ layers: 12, alpha: 0.035, v: 0.02, edge: 0 }
	);
	underlay(sheet.map(([x, y]) => [x + (x < scx ? 1 : -1), y] as Pt));
	wash(sheet, [40, 20, 97], { layers: 18, alpha: 0.05, v: 0.015, edge: 0.45 });
	for (let k = 0; k < 7; k++) {
		const side = rnd() < 0.5;
		const x = side ? R(sx0 + 2, sx0 + 14) : R(sx1 - 14, sx1 - 2);
		const y = R(sy0 + 8, sy1 - 8);
		wash(circ(x, y, R(5, 12), 9), [32, 22, 86], { layers: 6, alpha: 0.02, v: 0.25, edge: 0.5 });
	}
	const tx = R(sx0 + 20, sx1 - 20);
	const ty = R(sy0 + 40, sy1 - 30); // one faint ring stain
	wash(circ(tx, ty, R(7, 10), 12), [30, 18, 86], { layers: 6, alpha: 0.02, v: 0.08, edge: 1.6 });

	// Handwriting: illegible sepia script, line by line.
	const nib: Pt = [94, 131];
	for (let y = sy0 + 15, i = 0; y < sy1 - 6; y += 7.4, i++) {
		const head = i === 0;
		const last = y + 7.4 >= sy1 - 6;
		let x = head ? scx - 18 : sx0 + (i === 1 ? 13 : 7);
		const end = head ? scx + 18 : last ? nib[0] - 2 : sx1 - 7 + R(-4, 0);
		const ink = head ? 'hsla(355,55%,38%,0.7)' : 'hsla(25,45%,32%,0.5)';
		while (x < end - 4) {
			const wl = Math.min(R(5, 15), end - x);
			const pts: Pt[] = [];
			let t = R(6);
			for (let u = 0; u <= wl; u += 0.35) {
				t += R(0.55, 0.95);
				const hgt = (head ? 2.2 : 1.4) * (rnd() < 0.04 ? 2.2 : 1);
				pts.push([x + u + Math.cos(t) * 0.6, y - Math.abs(Math.sin(t)) * hgt]);
			}
			stroke(pts, ink, head ? 0.5 : 0.35);
			x += wl + R(2, 3.5);
		}
		if (head) {
			// Flourish rule under the heading.
			stroke(
				[
					[scx - 24, y + 3],
					[scx + 24, y + 3.4]
				],
				'hsla(355,55%,30%,0.35)',
				0.4
			);
		}
	}

	// The two rolls.
	for (const ry of [sy0, sy1]) {
		wash(dense(rect(RX0 + 1.5, ry - RR + 3, RW, RR * 2), 30), [30, 25, 45], {
			layers: 8,
			alpha: 0.035,
			v: 0.02,
			edge: 0
		});
		underlay(rect(RX0 + 0.5, ry - RR + 0.5, RW - 1, RR * 2 - 1));
		wash(rect(RX0, ry - RR, RW, RR * 2), [36, 18, 93], { layers: 14, alpha: 0.06, v: 0.015, edge: 0.5 });
		wash(rect(RX0 + 2, ry + 0.5, RW - 4, RR - 1), [32, 14, 82], { layers: 6, alpha: 0.045, v: 0.02, edge: 0.2 }); // underside shade
		ctx.save();
		ctx.globalCompositeOperation = 'source-over';
		ctx.strokeStyle = 'rgba(255,250,236,0.6)';
		ctx.lineWidth = 1.1;
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(RX0 + 5, ry - RR * 0.45);
		ctx.lineTo(RX0 + RW - 5, ry - RR * 0.45);
		ctx.stroke();
		ctx.restore();
		// Curled ends with a spiral.
		for (const ex of [RX0, RX0 + RW]) {
			underlay(ellipse(ex, ry, 3, RR - 0.5, 12));
			wash(ellipse(ex, ry, 3.4, RR, 12), [36, 16, 88], { layers: 7, alpha: 0.08, v: 0.04, edge: 0.7 });
			const sp: Pt[] = [];
			for (let a = 0; a < Math.PI * 5; a += 0.25) {
				const k = 1 - a / (Math.PI * 5.4);
				sp.push([ex + Math.cos(a) * 2.9 * k, ry + Math.sin(a) * RR * 0.85 * k]);
			}
			stroke(sp, 'hsla(28,40%,38%,0.45)', 0.3);
		}
	}

	// The quill.
	const T: Pt = [R(136, 142), R(18, 24)];
	const dx = T[0] - nib[0];
	const dy = T[1] - nib[1];
	const len = Math.hypot(dx, dy);
	const d: Pt = [dx / len, dy / len];
	const n: Pt = [-d[1], d[0]];
	const bend = R(3, 5);
	const S = (t: number): Pt => [
		nib[0] + dx * t + n[0] * Math.sin(Math.PI * t) * bend,
		nib[1] + dy * t + n[1] * Math.sin(Math.PI * t) * bend
	];
	const wL = (t: number) => (t < 0.26 ? 0 : 10 * Math.pow(Math.sin(Math.PI * Math.min(1, (t - 0.26) / 0.76)), 0.65));
	const wR = (t: number) => (t < 0.3 ? 0 : 6.5 * Math.pow(Math.sin(Math.PI * Math.min(1, (t - 0.3) / 0.72)), 0.7));
	const vane: Pt[] = [];
	for (let t = 0.26; t <= 1.0001; t += 0.02) {
		const p = S(t);
		vane.push([p[0] + n[0] * wL(t), p[1] + n[1] * wL(t)]);
	}
	for (let t = 1; t >= 0.3; t -= 0.02) {
		const p = S(t);
		vane.push([p[0] - n[0] * wR(t), p[1] - n[1] * wR(t)]);
	}
	wash(
		vane.map(([x, y]) => [x + 3.5, y + 4.5] as Pt),
		[30, 25, 40],
		{ layers: 10, alpha: 0.035, v: 0.03, edge: 0 }
	);
	wash(vane, [215, 18, 90], { layers: 12, alpha: 0.05, v: 0.03, edge: 0.5, jit: 3 });
	wash(dense(vane.slice(Math.floor(vane.length * 0.3), Math.floor(vane.length * 0.7)), 8), [220, 20, 75], {
		layers: 5,
		alpha: 0.035,
		v: 0.05,
		edge: 0.3
	});
	// Barbs sweeping toward the tip, then two natural splits in the vane.
	for (let t = 0.27; t < 1; t += 0.016) {
		const p = S(t);
		const q = S(Math.min(1, t + 0.07));
		for (const [w, s] of [
			[wL(t + 0.035), 1],
			[wR(t + 0.035), -1]
		]) {
			if (w < 0.5) continue;
			stroke([p, [q[0] + n[0] * w * s, q[1] + n[1] * w * s]], `hsla(215,16%,${R(55, 68)}%,${R(0.12, 0.24)})`, 0.25);
		}
	}
	ctx.save();
	ctx.globalCompositeOperation = 'destination-out';
	ctx.lineCap = 'round';
	for (const [t, s] of [
		[R(0.5, 0.6), 1],
		[R(0.7, 0.8), -1]
	]) {
		const p = S(t);
		const q = S(t + 0.08);
		const w = (s > 0 ? wL : wR)(t + 0.04);
		ctx.strokeStyle = 'rgba(0,0,0,0.9)';
		ctx.lineWidth = 0.7;
		ctx.beginPath();
		ctx.moveTo(p[0] + n[0] * s * 1.5, p[1] + n[1] * s * 1.5);
		ctx.lineTo(q[0] + n[0] * w * s * 1.05, q[1] + n[1] * w * s * 1.05);
		ctx.stroke();
	}
	ctx.restore();
	// Fluffy down near the base.
	for (let k = 0; k < 8; k++) {
		const t = R(0.24, 0.3);
		const p = S(t);
		const s = rnd() < 0.5 ? 1 : -1;
		const w = R(2, 5);
		stroke(
			[p, [p[0] + n[0] * w * s + d[0] * R(-1, 2), p[1] + n[1] * w * s + d[1] * R(-1, 2)]],
			'hsla(215,15%,70%,0.25)',
			0.25
		);
	}
	// Shaft, then the inked nib.
	const shaft: Pt[] = [];
	for (let t = 0.06; t <= 1; t += 0.02) shaft.push(S(t));
	ctx.save();
	ctx.globalCompositeOperation = 'source-over';
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	for (const [pp, c, w] of [
		[shaft.slice(0, 22), 'hsla(40,45%,80%,0.95)', 1.0],
		[shaft.slice(20), 'hsla(40,35%,84%,0.9)', 0.55]
	] as const) {
		ctx.strokeStyle = c;
		ctx.lineWidth = w;
		ctx.beginPath();
		pp.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
		ctx.stroke();
	}
	ctx.restore();
	stroke(
		shaft.map(([x, y]) => [x + n[0] * 0.5, y + n[1] * 0.5] as Pt),
		'hsla(35,30%,55%,0.35)',
		0.3
	);
	const a = S(0.11);
	wash(
		[
			[nib[0], nib[1]],
			[a[0] + n[0] * 1.5, a[1] + n[1] * 1.5],
			[a[0] - n[0] * 1.5, a[1] - n[1] * 1.5]
		],
		[25, 35, 14],
		{ layers: 6, alpha: 0.3, v: 0.03, edge: 0.6, depth: 1 }
	);
	wash(circ(nib[0] - 0.5, nib[1] + 0.8, 1.7, 8), [230, 30, 14], {
		layers: 5,
		alpha: 0.3,
		v: 0.15,
		edge: 0.8,
		depth: 1,
		baseDepth: 1
	}); // ink pooling at the tip
	splatter(
		nib[0] - 6,
		nib[1] - 2,
		7,
		[
			[230, 30, 14],
			[25, 45, 20]
		],
		9
	);
	grain(16);
}

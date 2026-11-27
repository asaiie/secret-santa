/**
 * Watercolor props used as buttons: a sealed envelope and a scroll with a quill.
 *
 * Painted with the same techniques as the tree (layered, deformed washes with
 * darker pooled edges), but from a fixed seed, so they look identical every time.
 * Everything is drawn in a 200×200 design space and scaled to the canvas.
 */

type Pt = [number, number];
type Hsl = [number, number, number];

const DESIGN = 200;

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

function kit(canvas: HTMLCanvasElement, seed: number) {
	const ctx = canvas.getContext('2d')!;
	const k = canvas.width / DESIGN;
	ctx.setTransform(k, 0, 0, k, 0, 0);
	ctx.clearRect(0, 0, DESIGN, DESIGN);
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	const rnd = mulberry(seed);
	const R = (a: number, b: number) => a + rnd() * (b - a);
	const gauss = () => {
		let u = 0;
		let v = 0;
		while (!u) u = rnd();
		while (!v) v = rnd();
		return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
	};
	const hsla = (c: Hsl, a: number, dl = 0) => `hsla(${c[0]},${c[1]}%,${c[2] + dl}%,${a})`;

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
				const mag = gauss() * len * v;
				n.push([a[0] + dx / 2 - (dy / len) * mag, a[1] + dy / 2 + (dx / len) * mag]);
			}
			out = n;
			v *= 0.6;
		}
		return out;
	}
	function path(p: Pt[], close = true) {
		ctx.beginPath();
		ctx.moveTo(p[0][0], p[0][1]);
		for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
		if (close) ctx.closePath();
	}
	/**
	 * Body colour, built from many translucent, slightly different layers (like the
	 * tree's baubles) so it reads solid over the background but has soft edges.
	 */
	function base(poly: Pt[], c: Hsl, a = 0.97) {
		const shape = deform(poly, 2, 0.025);
		const layers = 14;
		const per = 1 - Math.pow(1 - a, 1 / layers);
		ctx.save();
		ctx.globalCompositeOperation = 'source-over';
		for (let i = 0; i < layers; i++) {
			path(deform(shape, 2, 0.03));
			ctx.fillStyle = hsla(c, per, gauss() * 0.8);
			ctx.fill();
		}
		ctx.restore();
	}
	/** Translucent wash with a darker, pooled rim. */
	function wash(poly: Pt[], c: Hsl, o: { layers?: number; alpha?: number; v?: number; edge?: number } = {}) {
		const layers = o.layers ?? 14;
		const alpha = o.alpha ?? 0.06;
		const v = o.v ?? 0.06;
		const edge = o.edge ?? 0.6;
		const shape = deform(poly, 2, v);
		ctx.save();
		ctx.globalCompositeOperation = 'multiply';
		for (let i = 0; i < layers; i++) {
			path(deform(shape, 2, v * 0.7));
			ctx.fillStyle = hsla(c, alpha);
			ctx.fill();
			if (edge > 0) {
				ctx.strokeStyle = hsla(c, alpha * edge, -20);
				ctx.lineWidth = R(0.4, 1);
				ctx.stroke();
			}
		}
		ctx.restore();
	}
	/** A soft brush stroke: several wobbly, translucent, slightly blurred passes. */
	function line(pts: Pt[], c: Hsl, a: number, w: number, close = false) {
		ctx.save();
		ctx.globalCompositeOperation = 'multiply';
		ctx.shadowColor = hsla(c, a * 0.5);
		ctx.shadowBlur = 1.6 * k;
		const passes = 4;
		for (let p = 0; p < passes; p++) {
			const j = pts.map(([x, y]) => [x + gauss() * 0.6, y + gauss() * 0.6] as Pt);
			path(j, close);
			ctx.strokeStyle = hsla(c, (a * 0.45) / (1 + p * 0.3));
			ctx.lineWidth = w * (1.3 - p * 0.18);
			ctx.stroke();
		}
		ctx.restore();
	}
	/** Paper tooth: tiny specks knocked out of the paint, as on the snowflakes. */
	function grain() {
		ctx.save();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.globalCompositeOperation = 'destination-out';
		const W = canvas.width;
		const n = (W * W) / 6;
		for (let i = 0; i < n; i++) {
			ctx.fillStyle = `rgba(0,0,0,${rnd() * 0.22})`;
			ctx.fillRect(rnd() * W, rnd() * W, 1, 1);
		}
		ctx.restore();
	}
	const ellipse = (x: number, y: number, rx: number, ry: number, n = 20): Pt[] =>
		Array.from({ length: n }, (_, i) => {
			const a = (i / n) * Math.PI * 2;
			return [x + Math.cos(a) * rx, y + Math.sin(a) * ry];
		});
	return { ctx, R, gauss, hsla, deform, path, base, wash, line, ellipse, grain };
}

/* ------------------------------------------------------------------ */

export function paintEnvelope(canvas: HTMLCanvasElement) {
	const { ctx, base, wash, line, ellipse, deform, path, hsla, R, grain } = kit(canvas, 1225);
	const paper: Hsl = [40, 38, 95];
	const pencil: Hsl = [28, 16, 52];
	const wax: Hsl = [356, 72, 38];

	// Soft shadow on the ground.
	wash(ellipse(104, 152, 74, 9), [230, 12, 72], { layers: 12, alpha: 0.05, v: 0.1, edge: 0 });

	ctx.save();
	ctx.translate(100, 100);
	ctx.rotate(-0.09);
	ctx.translate(-100, -100);

	const L = 28;
	const Rt = 172;
	const T = 56;
	const B = 142;
	const tip: Pt = [100, 110];
	const body: Pt[] = [
		[L, T],
		[Rt, T],
		[Rt, B],
		[L, B]
	];
	base(body, paper);
	wash(body, [36, 28, 86], { layers: 16, alpha: 0.05, edge: 1.6 });
	// Bottom pocket: folds from the lower corners, a touch of shadow.
	wash(
		[
			[L, B],
			[100, 104],
			[Rt, B]
		],
		[34, 22, 86],
		{ layers: 8, alpha: 0.045, edge: 0.3 }
	);
	// Side flaps, slightly cooler.
	wash(
		[
			[L, T],
			[86, 100],
			[L, B]
		],
		[220, 15, 90],
		{ layers: 6, alpha: 0.035, edge: 0.2 }
	);
	wash(
		[
			[Rt, T],
			[114, 100],
			[Rt, B]
		],
		[220, 15, 90],
		{ layers: 6, alpha: 0.035, edge: 0.2 }
	);
	line([[L, B], [100, 103], [Rt, B]], pencil, 0.35, 1.4);
	// Top flap, closed, casting a soft shadow below its edge.
	const flap: Pt[] = [[L, T], [Rt, T], tip];
	wash(
		flap.map(([x, y]) => [x + 1.5, y + 3] as Pt),
		[230, 15, 70],
		{ layers: 6, alpha: 0.04, edge: 0 }
	);
	base(flap, [41, 40, 96]);
	wash(flap, [36, 30, 86], { layers: 14, alpha: 0.05, edge: 1.5 });
	line([[L, T], tip, [Rt, T]], pencil, 0.45, 1.5);

	// Red wax seal: an irregular blob with a pressed ring and a little star.
	const [sx, sy] = [tip[0], tip[1] - 2];
	const blob = deform(
		Array.from({ length: 12 }, (_, i) => {
			const a = (i / 12) * Math.PI * 2;
			const r = 16 * (i % 3 === 0 ? R(1.08, 1.18) : R(0.95, 1.02));
			return [sx + Math.cos(a) * r, sy + Math.sin(a) * r] as Pt;
		}),
		2,
		0.06
	);
	base(blob, wax, 1);
	wash(blob, wax, { layers: 10, alpha: 0.1, v: 0.02, edge: 1.4 });
	// Pressed ring.
	wash(ellipse(sx + 0.6, sy + 0.8, 10.5, 10.5, 24), [356, 70, 30], { layers: 5, alpha: 0.1, v: 0.01, edge: 1.2 });
	ctx.save();
	ctx.globalCompositeOperation = 'multiply';
	ctx.shadowColor = hsla([356, 70, 24], 0.4);
	ctx.shadowBlur = 1.5 * (canvas.width / DESIGN);
	path(ellipse(sx, sy, 10.5, 10.5, 32));
	ctx.strokeStyle = hsla([356, 70, 24], 0.35);
	ctx.lineWidth = 1.4;
	ctx.stroke();
	// Star stamped into the wax.
	const star: Pt[] = Array.from({ length: 10 }, (_, i) => {
		const a = -Math.PI / 2 + (i * Math.PI) / 5;
		const r = i % 2 ? 2.6 : 6;
		return [sx + Math.cos(a) * r, sy + Math.sin(a) * r];
	});
	path(star);
	ctx.fillStyle = hsla([356, 72, 26], 0.4);
	ctx.fill();
	ctx.restore();
	// Shine on the wax.
	ctx.save();
	path(deform(ellipse(sx - 6, sy - 7, 4.5, 2.4, 10), 1, 0.08));
	ctx.fillStyle = 'rgba(255, 225, 225, 0.45)';
	ctx.fill();
	ctx.restore();

	ctx.restore();
	grain();
}

/* ------------------------------------------------------------------ */

export function paintScroll(canvas: HTMLCanvasElement) {
	const { ctx, base, wash, line, ellipse, hsla, R, gauss, path, grain } = kit(canvas, 2026);
	const paper: Hsl = [210, 20, 98];
	const shade: Hsl = [220, 18, 80];
	const pencil: Hsl = [220, 12, 42];

	// Soft shadow on the ground.
	wash(ellipse(96, 176, 70, 9), [230, 12, 72], { layers: 12, alpha: 0.05, v: 0.1, edge: 0 });

	ctx.save();
	ctx.translate(100, 100);
	ctx.rotate(-0.06);
	ctx.translate(-100, -100);

	// The sheet, with a gently wavy right edge.
	const sheet: Pt[] = [
		[52, 50],
		[138, 46],
		[141, 70],
		[137, 98],
		[142, 128],
		[146, 160],
		[56, 164],
		[54, 120],
		[50, 84]
	];
	base(sheet, paper);
	wash(sheet, shade, { layers: 14, alpha: 0.035, edge: 2 });
	// A cool shadow down the left where the sheet curves.
	wash(
		[
			[52, 52],
			[66, 52],
			[68, 162],
			[56, 162]
		],
		shade,
		{ layers: 8, alpha: 0.04, edge: 0 }
	);

	// Top roll: a cylinder with a spiral end on the left.
	const top: Pt[] = [
		[44, 38],
		[142, 34],
		[146, 44],
		[142, 54],
		[46, 58]
	];
	base(top, paper);
	wash(
		[
			[44, 48],
			[144, 45],
			[142, 54],
			[46, 58]
		],
		shade,
		{ layers: 12, alpha: 0.06, edge: 1 }
	);
	wash(top, shade, { layers: 8, alpha: 0.025, edge: 2 });
	base(ellipse(44, 48, 9, 10.5, 18), paper);
	wash(ellipse(44, 48, 9, 10.5, 18), shade, { layers: 8, alpha: 0.05, edge: 1.6 });
	ctx.save();
	ctx.globalCompositeOperation = 'multiply';
	ctx.beginPath();
	for (let t = 0; t < Math.PI * 3.2; t += 0.12) {
		const r = 9.5 - t * 0.85;
		const x = 44 + Math.cos(t) * r;
		const y = 48 + Math.sin(t) * r * 1.1;
		if (t === 0) ctx.moveTo(x, y);
		else ctx.lineTo(x, y);
	}
	ctx.shadowColor = hsla(pencil, 0.3);
	ctx.shadowBlur = 1.6 * (canvas.width / DESIGN);
	ctx.strokeStyle = hsla(pencil, 0.35);
	ctx.lineWidth = 1.5;
	ctx.stroke();
	ctx.restore();

	// Bottom roll, spiral on the right.
	const bottom: Pt[] = [
		[54, 156],
		[150, 152],
		[154, 162],
		[150, 172],
		[56, 174]
	];
	base(bottom, paper);
	wash(
		[
			[54, 165],
			[152, 162],
			[150, 172],
			[56, 174]
		],
		shade,
		{ layers: 12, alpha: 0.06, edge: 1 }
	);
	wash(bottom, shade, { layers: 8, alpha: 0.025, edge: 2 });
	base(ellipse(152, 162, 8, 9.5, 18), paper);
	wash(ellipse(152, 162, 8, 9.5, 18), shade, { layers: 8, alpha: 0.05, edge: 1.6 });
	ctx.save();
	ctx.globalCompositeOperation = 'multiply';
	ctx.beginPath();
	for (let t = 0; t < Math.PI * 3; t += 0.12) {
		const r = 8.5 - t * 0.85;
		const x = 152 + Math.cos(t) * r;
		const y = 162 + Math.sin(t) * r * 1.1;
		if (t === 0) ctx.moveTo(x, y);
		else ctx.lineTo(x, y);
	}
	ctx.shadowColor = hsla(pencil, 0.3);
	ctx.shadowBlur = 1.6 * (canvas.width / DESIGN);
	ctx.strokeStyle = hsla(pencil, 0.35);
	ctx.lineWidth = 1.5;
	ctx.stroke();
	ctx.restore();

	// Lines of writing.
	const rows = [74, 89, 104, 119, 134];
	const ends = [128, 120, 126, 112, 98];
	rows.forEach((y, i) => {
		const pts: Pt[] = [];
		for (let x = 66; x <= ends[i]; x += 4) pts.push([x, y + Math.sin(x * 0.4 + i) * 0.6 + gauss() * 0.25]);
		line(pts, pencil, 0.5, 1.6);
	});

	ctx.restore();

	// The quill: a black feather lying across the scroll, nib down at the lower right.
	const nib: Pt = [118, 150];
	const tip: Pt = [186, 34];
	const dx = tip[0] - nib[0];
	const dy = tip[1] - nib[1];
	const len = Math.hypot(dx, dy);
	const ux = dx / len;
	const uy = dy / len;
	const nx = -uy; // perpendicular, pointing up-left
	const ny = ux;
	const at = (t: number, off: number): Pt => [nib[0] + dx * t + nx * off, nib[1] + dy * t + ny * off];
	const vaneStart = 0.24;
	const width = (t: number) => {
		const u = (t - vaneStart) / (1 - vaneStart);
		return u <= 0 ? 0 : 17 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.92 + 0.04)), 0.75);
	};
	const left: Pt[] = [];
	const right: Pt[] = [];
	for (let t = vaneStart; t <= 1.0001; t += 0.02) {
		const w = width(t);
		left.push(at(t, w * 1.0));
		right.push(at(t, -w * 0.62));
	}
	const vane = [...left, ...right.reverse()];
	const ink: Hsl = [232, 14, 13];
	// Soft shadow of the feather on the paper.
	wash(
		vane.map(([x, y]) => [x + 3, y + 4] as Pt),
		[230, 12, 70],
		{ layers: 6, alpha: 0.04, edge: 0 }
	);
	base(vane, ink, 0.85);
	wash(vane, ink, { layers: 14, alpha: 0.08, v: 0.04, edge: 1.2 });
	// Barbs: fine strokes sweeping toward the tip, with a few lighter ones for sheen.
	ctx.save();
	for (let i = 0; i < 70; i++) {
		const t = R(vaneStart + 0.03, 0.97);
		const side = i % 2 ? 1 : -0.62;
		const w = width(t) * side;
		const [bx, by] = at(t, 0);
		const [ex, ey] = at(t + 0.06, w * R(0.85, 1));
		ctx.beginPath();
		ctx.moveTo(bx, by);
		ctx.quadraticCurveTo(bx + (ex - bx) * 0.5 + nx * w * 0.2, by + (ey - by) * 0.5 + ny * w * 0.2, ex, ey);
		const light = i % 7 === 0;
		ctx.strokeStyle = light ? 'rgba(170, 178, 195, 0.3)' : hsla([232, 12, 6], 0.22);
		ctx.lineWidth = light ? 0.9 : R(0.5, 0.9);
		ctx.stroke();
	}
	// A couple of splits in the vane, showing the paper through.
	for (const [t, side] of [
		[0.55, 1],
		[0.72, -0.62],
		[0.84, 1]
	]) {
		const w = width(t) * side;
		ctx.beginPath();
		ctx.moveTo(...at(t - 0.01, w * 0.45));
		ctx.lineTo(...at(t + 0.04, w * 1.05));
		ctx.strokeStyle = 'rgba(245, 247, 250, 0.6)';
		ctx.lineWidth = 1.3;
		ctx.stroke();
	}
	ctx.restore();
	// Shaft, pale along the vane and darkening into the barrel.
	ctx.save();
	const g = ctx.createLinearGradient(nib[0], nib[1], tip[0], tip[1]);
	g.addColorStop(0, hsla([232, 10, 20], 0.95));
	g.addColorStop(0.3, hsla([220, 10, 72], 0.95));
	g.addColorStop(1, hsla([220, 10, 82], 0.8));
	ctx.beginPath();
	ctx.moveTo(...at(0.05, 0));
	ctx.quadraticCurveTo(...at(0.5, 1.2), ...at(1, 0));
	ctx.shadowColor = 'rgba(200, 205, 215, 0.6)';
	ctx.shadowBlur = 1.2 * (canvas.width / DESIGN);
	ctx.strokeStyle = g;
	ctx.lineWidth = 1.7;
	ctx.stroke();
	ctx.shadowBlur = 0;
	// Nib.
	path([at(0, 0), at(0.07, 2.2), at(0.07, -2.2)]);
	ctx.fillStyle = hsla([232, 14, 10], 0.95);
	ctx.fill();
	ctx.restore();
	// A drop of ink at the nib.
	wash(ellipse(nib[0] - 1, nib[1] + 2, 2.6, 1.6, 10), ink, { layers: 4, alpha: 0.3, v: 0.05, edge: 1 });
	grain();
}

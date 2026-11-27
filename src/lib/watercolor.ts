/**
 * Procedural watercolor snowflakes. Each flake is painted once into an offscreen
 * canvas ("sprite"); the animation then just moves those sprites around.
 *
 * Techniques:
 * - Wash: many very faint fills of a slightly re-deformed polygon, which gives the
 *   soft, bleeding edges of wet paint.
 * - Edge darkening: a faint darker rim where pigment pools as a wash dries.
 * - Brush strokes: tapered, wobbly outlines filled in a few translucent passes.
 * - Paper grain: tiny specks knocked out of the paint.
 */

export type Sprite = { canvas: HTMLCanvasElement; size: number; radius: number };

type Pt = [number, number];
type Hsl = { h: number; s: number; l: number };

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function gauss() {
	let u = 0;
	let v = 0;
	while (!u) u = Math.random();
	while (!v) v = Math.random();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const hsla = ({ h, s, l }: Hsl, a: number, dl = 0) => `hsla(${h}, ${s}%, ${l + dl}%, ${a})`;

/** Recursive midpoint displacement: turns a clean polygon into an organic one. */
function deform(poly: Pt[], depth: number, variance: number): Pt[] {
	let pts = poly;
	let v = variance;
	for (let d = 0; d < depth; d++) {
		const next: Pt[] = [];
		for (let i = 0; i < pts.length; i++) {
			const a = pts[i];
			const b = pts[(i + 1) % pts.length];
			const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
			next.push(a, [
				(a[0] + b[0]) / 2 + gauss() * len * v,
				(a[1] + b[1]) / 2 + gauss() * len * v
			]);
		}
		pts = next;
		v /= 1.8;
	}
	return pts;
}

function trace(ctx: CanvasRenderingContext2D, poly: Pt[]) {
	ctx.beginPath();
	ctx.moveTo(poly[0][0], poly[0][1]);
	for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
	ctx.closePath();
}

function circle(cx: number, cy: number, r: number, sides = 10): Pt[] {
	return Array.from({ length: sides }, (_, i) => {
		const a = (i / sides) * Math.PI * 2;
		const rr = r * rand(0.85, 1.12);
		return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr] as Pt;
	});
}

/** A soft blot of paint. */
function wash(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, c: Hsl, strength = 1) {
	const base = deform(circle(cx, cy, r), 3, 0.22);
	const layers = 22;
	for (let i = 0; i < layers; i++) {
		trace(ctx, deform(base, 3, 0.16));
		ctx.fillStyle = hsla(c, 0.05 * strength);
		ctx.fill();
	}
	// Pigment pooling at the dried edge.
	ctx.lineJoin = 'round';
	for (let i = 0; i < 2; i++) {
		trace(ctx, deform(base, 2, 0.05));
		ctx.strokeStyle = hsla(c, 0.09 * strength, -10);
		ctx.lineWidth = Math.max(0.8, r * 0.07);
		ctx.stroke();
	}
}

/** A tapered brush stroke from (x, y) heading in `angle`. */
function stroke(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	angle: number,
	len: number,
	width: number,
	c: Hsl,
	passes = 6
) {
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(angle);
	const steps = 14;
	for (let p = 0; p < passes; p++) {
		const left: Pt[] = [];
		const right: Pt[] = [];
		const bend = gauss() * width * 0.15; // each pass drifts a little, like a re-wetted stroke
		for (let i = 0; i <= steps; i++) {
			const t = i / steps;
			const w = (width / 2) * (1 - t * 0.82) * (1 + gauss() * 0.1);
			const off = Math.sin(t * Math.PI) * bend + gauss() * width * 0.04;
			left.push([t * len, off - w]);
			right.push([t * len, off + w]);
		}
		trace(ctx, deform([...left, ...right.reverse()], 1, 0.03));
		ctx.fillStyle = hsla(c, p === passes - 1 ? 0.14 : 0.08, p === passes - 1 ? -6 : 0);
		ctx.fill();
	}
	ctx.restore();
}

/** Knock tiny specks out of the paint so it reads as pigment on paper. */
function grain(ctx: CanvasRenderingContext2D, size: number) {
	ctx.save();
	ctx.globalCompositeOperation = 'destination-out';
	const specks = (size * size) / 5;
	for (let i = 0; i < specks; i++) {
		ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.3})`;
		const s = Math.random() < 0.85 ? 1 : 2;
		ctx.fillRect(Math.random() * size, Math.random() * size, s, s);
	}
	ctx.restore();
}

function palette(): Hsl {
	// Pale cool blues, the odd periwinkle.
	return Math.random() < 0.2
		? { h: rand(232, 252), s: rand(22, 34), l: rand(66, 74) }
		: { h: rand(198, 222), s: rand(30, 46), l: rand(62, 72) };
}

function makeCanvas(size: number) {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = size;
	return { canvas, ctx: canvas.getContext('2d')! };
}

export type CrystalStyle = 'star' | 'branched' | 'fern' | 'plate';

/** Side branches per arm as [position along arm, branch length], both relative. */
const BRANCHES: Record<CrystalStyle, [number, number][]> = {
	star: [[0.78, 0.2]], // bold plain arms with a fork at the tip; reads well when tiny
	branched: [
		[0.42, 0.34],
		[0.68, 0.22]
	],
	fern: [
		[0.35, 0.22],
		[0.55, 0.2],
		[0.75, 0.15]
	],
	plate: [[0.72, 0.22]] // short arms around a hexagonal wash
};

/** A six-armed crystal painted with brush strokes. */
export function paintCrystal(style: CrystalStyle): Sprite {
	const radius = 46;
	const size = Math.ceil(radius * 2.5);
	const { canvas, ctx } = makeCanvas(size);
	const c = palette();
	const mid = size / 2;
	const tilt = Math.random() * Math.PI;

	// Faint halo wash behind the arms.
	wash(ctx, mid, mid, radius * rand(0.4, 0.55), c, 0.22);

	if (style === 'plate') {
		const hex: Pt[] = Array.from({ length: 6 }, (_, i) => {
			const a = tilt + (i * Math.PI) / 3;
			return [mid + Math.cos(a) * radius * 0.42, mid + Math.sin(a) * radius * 0.42];
		});
		const base = deform(hex, 2, 0.04);
		for (let i = 0; i < 16; i++) {
			trace(ctx, deform(base, 2, 0.05));
			ctx.fillStyle = hsla(c, 0.04);
			ctx.fill();
		}
		trace(ctx, base);
		ctx.strokeStyle = hsla(c, 0.18, -8);
		ctx.lineWidth = 1.4;
		ctx.stroke();
	}

	const w = radius * (style === 'star' ? rand(0.2, 0.24) : rand(0.13, 0.17));
	for (let i = 0; i < 6; i++) {
		const a = tilt + (i * Math.PI) / 3 + gauss() * 0.03;
		const len = radius * (style === 'plate' ? rand(0.8, 0.92) : rand(0.85, 1));
		stroke(ctx, mid, mid, a, len, w, c);
		for (const [t, bl] of BRANCHES[style]) {
			const bx = mid + Math.cos(a) * len * t;
			const by = mid + Math.sin(a) * len * t;
			for (const side of [-1, 1]) {
				stroke(ctx, bx, by, a + side * rand(0.9, 1.05), radius * bl * rand(0.85, 1.1), w * 0.6, c, 4);
			}
		}
	}
	wash(ctx, mid, mid, radius * 0.12, c, 0.9);
	grain(ctx, size);
	return { canvas, size, radius };
}

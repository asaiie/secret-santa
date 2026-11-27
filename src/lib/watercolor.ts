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
		ctx.strokeStyle = hsla(c, 0.12 * strength, -14);
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
		ctx.fillStyle = hsla(c, p === passes - 1 ? 0.2 : 0.11, p === passes - 1 ? -10 : 0);
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
	// Mostly cool blues, the odd periwinkle.
	return Math.random() < 0.2
		? { h: rand(235, 255), s: rand(28, 42), l: rand(58, 66) }
		: { h: rand(198, 225), s: rand(38, 58), l: rand(52, 64) };
}

function makeCanvas(size: number) {
	const canvas = document.createElement('canvas');
	canvas.width = canvas.height = size;
	return { canvas, ctx: canvas.getContext('2d')! };
}

/** A round dab of snow. */
export function paintDot(): Sprite {
	const radius = 22;
	const size = Math.ceil(radius * 2.8);
	const { canvas, ctx } = makeCanvas(size);
	const c = palette();
	wash(ctx, size / 2, size / 2, radius, c, rand(1, 1.5));
	// Occasionally a second, offset bloom of wetter pigment.
	if (Math.random() < 0.5) {
		wash(ctx, size / 2 + gauss() * 4, size / 2 + gauss() * 4, radius * rand(0.4, 0.6), c, 0.8);
	}
	grain(ctx, size);
	return { canvas, size, radius };
}

/** A six-armed crystal painted with brush strokes. */
export function paintCrystal(): Sprite {
	const radius = 46;
	const size = Math.ceil(radius * 2.5);
	const { canvas, ctx } = makeCanvas(size);
	const c = palette();
	const mid = size / 2;

	// Faint halo wash behind the arms.
	wash(ctx, mid, mid, radius * rand(0.45, 0.6), c, 0.35);

	const tilt = Math.random() * Math.PI;
	const w = radius * rand(0.13, 0.18);
	for (let i = 0; i < 6; i++) {
		const a = tilt + (i * Math.PI) / 3 + gauss() * 0.04;
		const len = radius * rand(0.82, 1);
		stroke(ctx, mid, mid, a, len, w, c);
		// Two pairs of side branches.
		for (const [t, bl] of [
			[0.42, 0.34],
			[0.68, 0.22]
		]) {
			const bx = mid + Math.cos(a) * len * t;
			const by = mid + Math.sin(a) * len * t;
			for (const side of [-1, 1]) {
				stroke(ctx, bx, by, a + side * rand(0.85, 1.05), radius * bl * rand(0.8, 1.1), w * 0.6, c, 4);
			}
		}
	}
	wash(ctx, mid, mid, radius * 0.16, c, 1.4);
	grain(ctx, size);
	return { canvas, size, radius };
}

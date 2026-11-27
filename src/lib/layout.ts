/**
 * Where the tree and the calligraphy title go, for a given viewport.
 *
 * - Wide screens: title written on three lines to the left, tree right of centre.
 * - Tall/narrow screens (phones): title on two lines across the top, tree below it.
 */

/** The tree scene's own coordinate space (see paintTree.ts). */
export const SCENE = { cx: 450, x0: 140, x1: 780, y0: 30, y1: 1100 };

export type Rect = { x: number; y: number; w: number; h: number };
export type Layout = {
	/** Tree transform: screen = scene * s + (ox, oy). */
	s: number;
	ox: number;
	oy: number;
	/** Box the title must fit inside, and how it breaks into lines. */
	title: Rect & { lines: string[] };
};

export function computeLayout(VW: number, VH: number): Layout {
	const sw = SCENE.x1 - SCENE.x0;
	const sh = SCENE.y1 - SCENE.y0;
	const midY = SCENE.y0 + sh / 2;
	const wide = VW >= 820 && VW / VH >= 1.15;

	if (wide) {
		const s = Math.min((VH * 0.9) / sh, (VW * 0.5 * 0.95) / sw);
		const treeX = VW * 0.64;
		const ox = treeX - SCENE.cx * s;
		const oy = VH / 2 - midY * s + VH * 0.02;
		const treeLeft = ox + SCENE.x0 * s;
		const x = VW * 0.05;
		const w = Math.max(200, treeLeft - x - VW * 0.03);
		const h = Math.min(VH * 0.55, 440);
		return {
			s,
			ox,
			oy,
			title: { x, y: VH * 0.46 - h / 2, w, h, lines: ['AJ Rhabdo', 'Secret Santa', '2026'] }
		};
	}

	// Leave room for the account controls in the top-right corner.
	const top = 64;
	const titleW = VW * 0.9;
	// The title is width-limited here, so its height tracks the screen width.
	const titleH = Math.min(Math.max(VW * 0.3, 110), 200);
	const s = Math.min((VW * 0.94) / sw, ((VH - top - titleH) * 0.96) / sh);
	// Centre title + tree together, leaning slightly toward the top.
	const free = Math.max(0, VH - top - titleH - sh * s);
	const titleY = top + free * 0.35;
	const ox = VW / 2 - SCENE.cx * s;
	const oy = titleY + titleH - SCENE.y0 * s;
	return {
		s,
		ox,
		oy,
		title: { x: (VW - titleW) / 2, y: titleY, w: titleW, h: titleH, lines: ['AJ Rhabdo', 'Secret Santa 2026'] }
	};
}

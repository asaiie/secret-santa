/**
 * Where the tree and the title go, for a given viewport: the title on one line
 * across the top, the tree centred below it.
 */

/** The tree scene's own coordinate space (see paintTree.ts). */
export const SCENE = { cx: 450, x0: 140, x1: 780, y0: 30, y1: 1100 };

export type Layout = {
	/** Tree transform: screen = scene * s + (ox, oy). */
	s: number;
	ox: number;
	oy: number;
	/** The band the title sits in, in viewport px. */
	titleY: number;
	titleH: number;
};

const TOP = 64; // clear of the account controls in the top-right corner
const TITLE_H = 56;

export function computeLayout(VW: number, VH: number): Layout {
	const sw = SCENE.x1 - SCENE.x0;
	const sh = SCENE.y1 - SCENE.y0;
	const s = Math.min((VW * 0.92) / sw, ((VH - TOP - TITLE_H) * 0.94) / sh);
	// Centre title + tree together, leaning slightly toward the top.
	const free = Math.max(0, VH - TOP - TITLE_H - sh * s);
	const titleY = TOP + free * 0.4;
	return {
		s,
		ox: VW / 2 - SCENE.cx * s,
		oy: titleY + TITLE_H - SCENE.y0 * s,
		titleY,
		titleH: TITLE_H
	};
}

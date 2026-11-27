/**
 * Where the tree and the title go, for a given viewport: the title on one line
 * across the top, the tree centred below it.
 */

/** The tree scene's own coordinate space (see paintTree.ts). */
// y0 sits just above the star; its faint rays may reach up behind the title.
export const SCENE = { cx: 450, x0: 140, x1: 780, y0: 105, y1: 1100 };

export type Layout = {
	/** Tree transform: screen = scene * s + (ox, oy). */
	s: number;
	ox: number;
	oy: number;
	/** The band the title sits in, in viewport px. */
	titleY: number;
	titleH: number;
};

/** Height of the notch / status bar inset, from the --safe-top CSS variable. */
export function safeTop(): number {
	return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-top')) || 0;
}

export function computeLayout(VW: number, VH: number, insetTop = 0): Layout {
	// Wide enough that a centred title clears the account controls on the right:
	// line it up with them in the header row. Otherwise sit just below them.
	const inHeader = VW >= 760;
	const top = (inHeader ? 26 : 62) + insetTop;
	const titleH = inHeader ? 36 : 40;
	const sw = SCENE.x1 - SCENE.x0;
	const sh = SCENE.y1 - SCENE.y0;
	const s = Math.min((VW * 0.92) / sw, ((VH - top - titleH) * 0.96) / sh);
	// Any spare height mostly goes below, keeping everything near the top.
	const free = Math.max(0, VH - top - titleH - sh * s);
	const titleY = top + free * 0.12;
	return {
		s,
		ox: VW / 2 - SCENE.cx * s,
		oy: titleY + titleH - SCENE.y0 * s,
		titleY,
		titleH
	};
}

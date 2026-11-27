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
	/** The envelope (left) and scroll (right) buttons: centre and size in viewport px. */
	envelope: Prop;
	scroll: Prop;
};

export type Prop = { x: number; y: number; size: number };

/**
 * Props sit beside the lowest green tier, their inner edge just overlapping the
 * branches. Scene coords; see paintTree.ts (tree spans y 200–905, widest at the base).
 */
const PROP_Y = 800;
const PROP_DX = 345; // from the trunk to each prop's centre
const PROP_SIZE = 180;

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
	const ox = VW / 2 - SCENE.cx * s;
	const oy = titleY + titleH - SCENE.y0 * s;
	// On narrow screens the tree fills the width, so props tuck in over the branches
	// rather than running off the edge.
	const size = Math.min(PROP_SIZE * s, VW * 0.24, 170);
	const prop = (dx: number): Prop => {
		const margin = size / 2 + 6;
		const x = Math.min(VW - margin, Math.max(margin, ox + (SCENE.cx + dx) * s));
		return { x, y: oy + PROP_Y * s, size };
	};
	return { s, ox, oy, titleY, titleH, envelope: prop(-PROP_DX), scroll: prop(PROP_DX) };
}

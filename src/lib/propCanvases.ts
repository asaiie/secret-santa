import type { PropOptions } from './paintProps.ts';

export type Painter = (canvas: HTMLCanvasElement, options: PropOptions) => () => void;

const cache = new Map<string, { canvas: HTMLCanvasElement; seed: number }>();

/**
 * The canvas for a prop, for this page load. The first call paints it (live or at
 * once) with a fresh random seed; later calls, e.g. after navigating away and back,
 * get the same canvas element, so it's never repainted or re-randomised.
 */
export function propCanvas(key: string, paint: Painter, animate: boolean): HTMLCanvasElement {
	let entry = cache.get(key);
	if (!entry) {
		const canvas = document.createElement('canvas');
		canvas.setAttribute('aria-hidden', 'true');
		entry = { canvas, seed: Math.floor(Math.random() * 2 ** 31) };
		cache.set(key, entry);
		paint(canvas, { seed: entry.seed, animate });
	}
	return entry.canvas;
}

/** The seed a prop was painted with this page load (undefined if not painted yet). */
export const propSeed = (key: string) => cache.get(key)?.seed;

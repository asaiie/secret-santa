import type { PropOptions } from './paintProps.ts';

export type Painter = (canvas: HTMLCanvasElement, options: PropOptions) => () => void;

const cache = new Map<string, HTMLCanvasElement>();

/**
 * The canvas for a prop, for this page load. The first call paints it (live or at
 * once) with a fresh random seed; later calls, e.g. after navigating away and back,
 * get the same canvas element, so it's never repainted or re-randomised.
 */
export function propCanvas(key: string, paint: Painter, animate: boolean): HTMLCanvasElement {
	let canvas = cache.get(key);
	if (!canvas) {
		canvas = document.createElement('canvas');
		canvas.setAttribute('aria-hidden', 'true');
		cache.set(key, canvas);
		paint(canvas, { seed: Math.floor(Math.random() * 2 ** 31), animate });
	}
	return canvas;
}

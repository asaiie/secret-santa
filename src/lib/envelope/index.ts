import { createEnvelope } from './envelopeArt.js';

/** The envelope painting's box, in tree-scene units (it leaves room above for an open flap). */
export const ENVELOPE_BOX = { w: 170, h: 180 };

export type Opening = { textArea: HTMLElement; skip(): void; destroy(): void };

type Envelope = {
	paintEnvelope(canvas: HTMLCanvasElement, seed: number): void;
	paintOpenedEnvelope(canvas: HTMLCanvasElement, seed: number): void;
	playEnvelopeOpening(
		container: HTMLElement,
		opts: { seed: number; quick?: boolean; onDone?: () => void }
	): Opening;
};

// Created on first use: the module touches window/document, which don't exist while prerendering.
let lib: Envelope | null = null;
const get = () => (lib ??= createEnvelope(window) as Envelope);

/** Pixels per scene unit the envelope prop is painted at; CSS scales it to the layout. */
const PROP_RES = 3; // sharp enough to stay crisp as it grows into the opening animation

/**
 * Paints the closed envelope for the prop button (Painter signature, see propCanvases.ts).
 * It draws all at once; when `animate` is set it fades in instead of painting in.
 */
export function paintEnvelopeProp(canvas: HTMLCanvasElement, { seed, animate }: { seed: number; animate: boolean }) {
	// Off-DOM canvases are sized from their attributes (as CSS px) by the painter.
	canvas.width = ENVELOPE_BOX.w * PROP_RES;
	canvas.height = ENVELOPE_BOX.h * PROP_RES;
	get().paintEnvelope(canvas, seed);
	if (animate) canvas.style.animation = 'prop-fade-in 900ms ease-out both';
	return () => {};
}

/**
 * Where the envelope's centre sits and how many CSS px one scene unit is, in the prop canvas
 * (the painter centres a 170×180 box with the envelope at (85, 64 + 50)) and in the opening
 * animation's first frame (a 440×620 stage, scaled to fit, envelope 340px wide at (220, 400)).
 */
export function propEnvelopeAnchor(rect: DOMRect) {
	const unit = Math.min(rect.width / 170, rect.height / 180);
	const x = rect.left + rect.width / 2;
	const y = rect.top + (rect.height - 180 * unit) / 2 + 114 * unit;
	return { x, y, unit };
}
export function openingEnvelopeAnchor(rect: DOMRect) {
	const s = Math.min(1, rect.width / 440, rect.height / 620);
	const ox = (rect.width - 440 * s) / 2;
	const oy = (rect.height - 620 * s) / 2;
	return { x: rect.left + ox + 220 * s, y: rect.top + oy + 400 * s, unit: (340 / 128) * s };
}

export const playEnvelopeOpening: Envelope['playEnvelopeOpening'] = (container, opts) =>
	get().playEnvelopeOpening(container, opts);

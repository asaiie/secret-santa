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
const PROP_RES = 2;

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

export const playEnvelopeOpening: Envelope['playEnvelopeOpening'] = (container, opts) =>
	get().playEnvelopeOpening(container, opts);

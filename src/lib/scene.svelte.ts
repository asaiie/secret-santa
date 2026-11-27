import type { Prop } from './layout.ts';

/**
 * Shared state from the painted background, for pages that place things over it.
 * `treeDone`: the tree has finished painting. Prop positions follow the layout.
 */
export const scene = $state<{ treeDone: boolean; envelope: Prop | null; scroll: Prop | null }>({
	treeDone: false,
	envelope: null,
	scroll: null
});

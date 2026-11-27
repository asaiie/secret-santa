import type { Prop } from './layout.ts';

/**
 * Shared state from the painted background, for pages that place things over it.
 * `treeDone`: the tree has finished painting. `treeLive`: it was painted on screen,
 * wash by wash (so props should paint in too). Prop positions follow the layout.
 */
export const scene = $state<{ treeDone: boolean; treeLive: boolean; envelope: Prop | null; scroll: Prop | null }>({
	treeDone: false,
	treeLive: false,
	envelope: null,
	scroll: null
});

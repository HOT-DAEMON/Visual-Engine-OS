/** Barrel de la géométrie de l'œil (fonctions pures, sans SVG) — voir chaque fichier pour le détail. */
export type { Vec, Cubic } from './primitives';
export { cubicAt } from './primitives';
export type { OpeningGeometry, Frame } from './opening';
export { openingGeometry, upperFrame, lowerFrame } from './opening';
export { creaseCurve, cubicTopY } from './crease';
export type { Lash } from './lashes';
export { upperLashes, lowerLashes } from './lashes';
export type { BrowGeometry, Hair } from './eyebrow';
export { browGeometry, browHairs } from './eyebrow';
export type { Caruncle, FoldGeometry } from './canthi-fold';
export { caruncleOf, foldGeometry } from './canthi-fold';
export { linerGeometry, linerTopOffset, type LinerGeometry, type LinerSpec } from './liner';

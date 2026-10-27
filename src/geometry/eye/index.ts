/** Barrel de la géométrie de l'œil (fonctions pures, sans SVG) — voir chaque fichier pour le détail. */
export type { Vec, Cubic } from './primitives';
export { cubicAt } from './primitives';
export type { OpeningGeometry, Frame } from './opening';
export { openingGeometry, upperFrame, lowerFrame } from './opening';
export { creaseCurve, cubicTopY } from './crease';
export { pupilContours, effectivePupilSize, pupilResponseFactor, isLegacyPupil, baseRadii, unitProfile, chaikin, IRIS_FIT, type Contour, type PupilContours } from './pupil-shape';
export type { Lash } from './lashes';
export { upperLashes, lowerLashes } from './lashes';
export type { BrowGeometry, Hair } from './eyebrow';
export { browGeometry, browHairs } from './eyebrow';
export type { Caruncle, FoldGeometry } from './canthi-fold';
export { caruncleOf, foldGeometry } from './canthi-fold';
export { linerGeometry, linerTopOffset, type LinerGeometry, type LinerSpec } from './liner';
export { placeHighlights, hasDetailedHighlights, type PlacedHighlight, type PlaceCtx } from './highlights';
export { polar, wobble, angularRange, radialRange, zoneOutline, angularCells, blendColor, type AngularCell } from './iris-layers';
export { microLod, scleraVessels, scleraMarks, type Lod, type Vessel } from './micro-detail';
export { turnOpening, turnPoint, jacobianAtCenter, facingOf, type TurnParams, type TurnedOpening, type Jacobian } from './turn3d';
export { openingPolygon } from './opening-polygon';

/**
 * Sous-moteur d'ombres de contact et de lumières de contour (contrat : `types.ts`, doc : `docs/CONTACT-RIM.md`).
 *   relations(components)                         → parent / enfants / frères ;
 *   compileContact(...)                           → ombre de contact de chaque composant + mesures ;
 *   resolveRims(components, specs, ra) + renderRim → lumière de contour de chaque composant, propagée parent/enfants/frères.
 */
export type { FaceComponent, ComponentId, ComponentKind, Receivers } from './types';
export { polyD, polysD } from './types';
export { relations, type Relations } from './graph';
export { compileContact, MAX_PEAK, MIN_CONTACT, type ContactMetric, type ContactOut } from './shadow';
export { resolveRims, renderRim, sideVector, type ResolvedRim } from './rim';

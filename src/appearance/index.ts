/**
 * Moteur d'apparence PARTAGÉ : contrat dans `schema/appearance.ts`, documentation dans `docs/APPEARANCE.md`.
 *   resolveAppearance(base, spec) → couleurs résolues (ombre / lumière / contour / dégradé / cel) ;
 *   compileEffects(id, spec, resolved, box) → un filtre SVG (réfraction, grain, glow, bloom, émission).
 */
export { resolveAppearance, type ResolvedAppearance } from './resolve';
export { compileEffects, type EffectResult, type FilterBox } from './effects';
export { toHsl, fromHsl, grade, pullHue, hueDelta, type Hsl, type Grade } from './hsl';

import { renderHead, refView, defaultFrame } from './render';
import { REF_SPEC } from './spec';
import { layerOf, reportOf, type LayerReport, type TurnReport } from './verify-types';
import { verifyAnatomy } from './verify-anat';
import { verifyGeometry, type RenderAt, type RotationMeasures } from './verify-geo';
import { verifyStyle } from './verify-style';
import { engineAnatomy, engineGeometry, engineStyle } from './verify-engines';
import type { HeadTurnSpec, TurnRender } from './types';

/** Rendu mémoïsé par lacet (les trois couches réutilisent les mêmes images). */
export function cachedRenderer(spec: HeadTurnSpec = REF_SPEC, heightPx = 520): RenderAt {
  const cache = new Map<number, TurnRender>();
  return (yaw) => { let r = cache.get(yaw); if (!r) { r = renderHead(refView(yaw), spec, { frame: defaultFrame(heightPx), ss: 2 }); cache.set(yaw, r); } return r; };
}

/** Vérification complète d'une tête : géométrie (contre les mesures de la planche), anatomie (proportions du modèle), style (palette, trait, aplats). */
export function verifyHeadTurn(m: RotationMeasures, spec: HeadTurnSpec = REF_SPEC, at: RenderAt = cachedRenderer(spec)): TurnReport {
  const plus = (l: LayerReport, more: LayerReport['checks']): LayerReport => layerOf(l.layer, [...l.checks, ...more]);
  return reportOf([plus(verifyGeometry(m, at, spec), engineGeometry(spec)), plus(verifyAnatomy(spec), engineAnatomy(spec)), plus(verifyStyle(spec, at), engineStyle(spec, at))]);
}
export { verifyGeometry, verifyAnatomy, verifyStyle };
export type { RotationMeasures, RenderAt };

import { faceLandmarks, noseGeometry, inPoly, type NoseGeometry } from '../face';
import { noseView, type NoseView } from '../face/nose/underview';
import { check, type Check } from './types';
import type { RandomFace } from '../generation/random-face';

/**
 * VÉRIFICATION DE LA VUE DE DESSOUS DU NEZ (`src/face/nose/underview.ts`), trois couches chiffrées.
 *  geometry : sommets finis ; l'enveloppe contient le lobule et les deux ailes (le lobule ferme bien la silhouette) ; enveloppe convexe.
 *  anatomy  : vu de dessous, la pointe est AU-DESSUS du sous-nez à l'écran ; les narines sont dans l'enveloppe ; le sommet du triangle est sous sa base.
 *  style    : rapport d'axes de l'ellipse dans la plage MESURÉE sur references/nez/04.jpg (0,34–0,93, marge de 0,04) ; `warn`, jamais bloquant.
 * Pure : `noseViewChecks` prend la vue en entrée pour qu'un test puisse lui injecter un défaut et constater qu'il est détecté.
 */
export const NOSE_VIEW_LIMITS = { axisRatioMin: 0.30, axisRatioMax: 0.97, pitchDeg: 40 } as const;

const centroid = (p: readonly { x: number; y: number }[]) => ({ x: p.reduce((s, q) => s + q.x, 0) / p.length, y: p.reduce((s, q) => s + q.y, 0) / p.length });

export function noseViewChecks(view: NoseView): Check[] {
  const all = [...view.envelope, ...view.lobule, ...view.alae.left, ...view.alae.right, ...view.nostrils.left, ...view.nostrils.right, view.triangle.apex, view.triangle.baseL, view.triangle.baseR];
  const finite = all.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y));
  // Tolérance : un sommet de l'enveloppe est sur le bord ; on teste donc des points légèrement rentrés vers le centre.
  const c = view.ellipse.c, inside = (q: { x: number; y: number }): boolean => inPoly(view.envelope, c.x + (q.x - c.x) * 0.999, c.y + (q.y - c.y) * 0.999);
  const covered = [...view.lobule, ...view.alae.left, ...view.alae.right].filter((q) => !inside(q)).length;
  const e = view.envelope; let turn = 0;
  for (let i = 0; i < e.length; i++) { const a = e[i]!, b = e[(i + 1) % e.length]!, d = e[(i + 2) % e.length]!; const k = (b.x - a.x) * (d.y - b.y) - (b.y - a.y) * (d.x - b.x); if (k < -1e-6) turn++; }
  const out: Check[] = [];
  out.push(check('geometry', 'nose-view-finite', '==', Number(finite), 1, 'la vue du nez contient une valeur non finie'));
  out.push(check('geometry', 'nose-view-envelope-covers', '<=', covered, 0, 'le lobule ou une aile sort de l\'enveloppe de la vue'));
  out.push(check('geometry', 'nose-view-envelope-convex', '<=', turn, 0, 'l\'enveloppe de la vue n\'est pas convexe'));
  const nin = [view.nostrils.left, view.nostrils.right].filter((n) => !inPoly(view.envelope, centroid(n).x, centroid(n).y)).length;
  out.push(check('anatomy', 'nose-view-nostrils-inside', '<=', nin, 0, 'une narine est hors de l\'enveloppe lobule + ailes'));
  // Les narines s'ouvrent vers le bas : d'en haut elles sont cachées, d'en bas elles se voient (défaut trouvé sur la planche 02 des artefacts).
  if (view.pitchDeg <= -10) out.push(check('anatomy', 'nose-view-nostrils-hidden-from-above', '<=', view.nostrilVisibility, 0.05, 'les narines sont visibles alors que la caméra est au-dessus du nez'));
  if (view.pitchDeg >= 20) out.push(check('anatomy', 'nose-view-nostrils-visible-from-below', '>=', view.nostrilVisibility, 0.95, 'les narines sont cachées alors que la caméra est sous le nez'));
  if (view.pitchDeg > 5) {
    out.push(check('anatomy', 'nose-view-tip-above-subnasale', '<=', view.tip.y, view.triangle.apex.y, 'vu de dessous, la pointe doit être au-dessus du sous-nez à l\'écran'));
    out.push(check('anatomy', 'nose-view-apex-below-base', '>=', view.triangle.apex.y, (view.triangle.baseL.y + view.triangle.baseR.y) / 2, 'le sommet du triangle (columelle) doit être sous sa base'));
  }
  out.push(check('style', 'nose-view-axis-ratio-min', '>=', view.ellipse.axisRatio, NOSE_VIEW_LIMITS.axisRatioMin, 'ellipse du nez plus aplatie que toute référence mesurée', 'warn'));
  out.push(check('style', 'nose-view-axis-ratio-max', '<=', view.ellipse.axisRatio, NOSE_VIEW_LIMITS.axisRatioMax, 'ellipse du nez plus ronde que toute référence mesurée', 'warn'));
  return out;
}

export function checkNoseView(face: RandomFace, pitchDeg: number = NOSE_VIEW_LIMITS.pitchDeg): Check[] {
  const nose: NoseGeometry = noseGeometry(face.params, faceLandmarks(face.params, face.width, face.height));
  return noseViewChecks(noseView(nose, pitchDeg));
}

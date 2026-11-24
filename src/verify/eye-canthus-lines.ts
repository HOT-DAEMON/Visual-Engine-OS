import { CANTHUS_FAN_MAX_DEG, CANTHUS_MAX_LENGTH, canthusLines, canthusOutline, canthusPoint, microLod, type OpeningGeometry, type Vec } from '../geometry/eye';
import { signedDepth } from '../geometry/eye/lash-clearance';
import type { EyeSpec } from '../schema';
import { check, type Check } from './types';

/**
 * COUCHE « PLIS DES CANTHI » (EYE-07G) de la vérification d'un œil — calculée sur les rides RÉELLEMENT dessinées (`canthusLines`, même appel que le rendu).
 *   geometry : coordonnées finies ; aucune ride n'entre dans l'ouverture (ce sont des plis de peau, jamais de la sclère) ; contour effilé non dégénéré ;
 *   anatomy  : longueur ≤ 22 % de la largeur d'enveloppe ; éventail externe ≤ 70° de la direction du bord supérieur ; rides externes du côté externe, internes du côté du nez ;
 *   style    : visibilité — une ride dont l'opacité × la largeur ne se verrait pas au LOD courant est un paramètre orphelin (avertissement) ; fini `flat` : force externe ≤ 0,7 (le trait plat ne se nuance pas).
 * Retourne [] quand `microdetail.canthusLines` est absent. `contour` = contour réel de l'ouverture (tracé perturbé si le bord est irrégulier).
 */
export function checkCanthusLines(eye: EyeSpec, g: OpeningGeometry, th: number, contour: readonly Vec[], flat: boolean): Check[] {
  const o = eye.microdetail?.canthusLines; if (!o) return [];
  const fine = microLod(eye.microdetail?.lod.eyePixels ?? null).fine;
  const strokes = canthusLines(g, o, eye.seed, th, fine);
  const out: Check[] = [];
  const finite = strokes.every((s) => [s.root, s.ctrl, s.tip].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)) && Number.isFinite(s.width) && Number.isFinite(s.alpha));
  out.push(check('geometry', 'canthus-lines-finite', '==', Number(finite), 1, 'une ride de canthus a une coordonnée non finie'));
  let worstIn = 0; let worstLen = 0; let worstAngle = 0; let sideBad = 0; let thin = 0;
  for (const s of strokes) {
    for (let i = 0; i <= 8; i++) worstIn = Math.max(worstIn, signedDepth(canthusPoint(s, i / 8), contour));
    worstLen = Math.max(worstLen, Math.hypot(s.tip.x - s.root.x, s.tip.y - s.root.y) / g.w);
    if (s.side === 'outer') worstAngle = Math.max(worstAngle, Math.abs(s.angleDeg));
    const dx = (s.tip.x - s.root.x) * g.s; if ((s.side === 'outer' && dx < 0) || (s.side === 'inner' && dx > 0)) sideBad++;
    if (canthusOutline(s).length < 8) thin++;
  }
  out.push(check('geometry', 'canthus-lines-outside-opening', '<=', worstIn / Math.max(g.w, 1), 0.002, 'une ride de canthus entre dans l’ouverture (un pli de peau ne traverse pas la sclère)'));
  out.push(check('geometry', 'canthus-lines-outline', '==', thin, 0, 'le contour effilé d’une ride est dégénéré'));
  out.push(check('anatomy', 'canthus-line-length', '<=', worstLen, CANTHUS_MAX_LENGTH, 'une ride de canthus dépasse 22 % de la largeur de l’œil'));
  out.push(check('anatomy', 'canthus-fan-angle', '<=', worstAngle, CANTHUS_FAN_MAX_DEG, 'l’éventail des rides externes s’écarte trop de la direction du bord supérieur'));
  out.push(check('anatomy', 'canthus-side', '==', sideBad, 0, 'une ride externe pointe vers le nez ou une ride interne vers l’extérieur'));
  // visibilité : opacité × largeur de racine en pixels (px/unité = eyePixels / largeur) — sous 0,06 la ride est invisible
  const ppu = (eye.microdetail?.lod.eyePixels ?? null) === null ? 1 : (eye.microdetail!.lod.eyePixels as number) / eye.shape.width;
  const weakest = strokes.length ? Math.min(...strokes.map((s) => (flat ? 1 : s.alpha) * s.width * ppu)) : 1;
  out.push(check('style', 'canthus-lines-visible', '>=', weakest, 0.06, 'une ride de canthus est trop fine ou trop transparente pour se voir à cette taille (paramètre orphelin)', 'warn'));
  if (flat) out.push(check('style', 'canthus-flat-subtle', '<=', o.outer, 0.7, 'fini plat : des rides trop fortes lourdissent le trait (encre pleine, sans nuance)', 'warn'));
  return out;
}

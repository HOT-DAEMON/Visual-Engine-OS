import { sectionAt } from './sections';
import { check, layerOf, type Check, type LayerReport } from './verify-types';
import type { HeadTurnSpec } from './types';

/**
 * COUCHE ANATOMIQUE : proportions du visage et de la tête, lues sur le MODÈLE (pas sur l'image). Les bornes sont celles du canon
 * (règle des cinq yeux, tiers du visage, oreille entre sourcil et base du nez, crâne plus long que large…) ÉLARGIES pour le dessin
 * stylisé de la planche ; un écart au canon assumé par la planche est rapporté `info` (jamais bloquant) avec sa valeur de canon.
 */
export function verifyAnatomy(s: HeadTurnSpec): LayerReport {
  const c: Check[] = [], A = 'anatomy' as const, last = s.rows[s.rows.length - 1]!, hT = last.y;
  const cr = s.rows.filter((r) => r.y <= 0.6), W = 2 * Math.max(...cr.map((r) => r.a)), D = Math.max(...s.rows.filter((r) => r.y <= 0.5).map((r) => r.zf - r.zb));
  const e = s.eye, gap = 2 * e.x - e.w, mid = s.brow.yMid, base = s.nose.baseY, chinHalf = sectionAt(s, 1.0).a;
  const surfZ = ((): number => { const q = sectionAt(s, e.y); return q.zc + q.b * Math.sqrt(Math.max(0, 1 - (e.x / q.a) ** 2)); })();
  c.push(check(A, 'eye.line', 'Ligne des yeux / hauteur de tête (canon 0,50 ; planche stylisée plus bas)', e.y / hT, 0.45, 0.65, 'hard', 'canon 0,50'));
  c.push(check(A, 'eye.spacing', 'Écart entre les yeux en largeurs d\'œil (canon : 1,0 — règle des cinq yeux)', gap / e.w, 0.8, 1.3));
  c.push(check(A, 'nose.width', 'Largeur du nez / écart entre les yeux (canon réaliste 1,0 ; dessin animé plus étroit)', (2 * s.nose.alaX) / gap, 0.4, 1.1, 'hard', 'canon 1,0'));
  c.push(check(A, 'mouth.width', 'Largeur de bouche / écart des pupilles (canon 0,7 – 1,0)', (2 * s.mouth.halfW) / (2 * e.x), 0.45, 1.1));
  c.push(check(A, 'thirds.lower', 'Tiers : base du nez → menton / sourcil → base du nez (canon 1,0 ; menton court sur la planche)', (hT - base) / (base - mid), 0.55, 1.2));
  c.push(check(A, 'mouth.third', 'Bouche dans le tiers inférieur : (bouche − base du nez) / (menton − base du nez) (canon 0,33)', (s.mouth.y - base) / (hT - base), 0.2, 0.5));
  c.push(check(A, 'ear.top', 'Haut de l\'oreille vs sourcil : écart en U (canon : à la hauteur du sourcil)', Math.abs(s.ear.y0 - mid), 0, 0.12));
  c.push(check(A, 'ear.bottom', 'Bas de l\'oreille vs base du nez : écart en U (canon : à la hauteur de la base du nez)', Math.abs(s.ear.y1 - base), 0, 0.1));
  c.push(check(A, 'ear.z', 'Oreille au milieu de la profondeur du crâne : z de l\'attache − centre du crâne (U)', Math.abs(s.ear.z), 0, 0.12));
  c.push(check(A, 'skull.ratio', 'Crâne : longueur (avant-arrière) / largeur (canon 1,1 – 1,4)', D / W, 1.0, 1.4));
  c.push(check(A, 'neck.ratio', 'Cou : largeur / largeur du crâne (canon 0,35 – 0,55)', (2 * s.neck.a) / W, 0.3, 0.6));
  c.push(check(A, 'neck.behind', 'Le cou est sous l\'arrière du visage : z du cou − z du centre du crâne (U, ≤ 0,02)', s.neck.zc - sectionAt(s, 0.6).zc, -0.2, 0.02));
  c.push(check(A, 'chin.narrow', 'Menton plus étroit que le crâne : demi-largeur du menton / demi-largeur du crâne', chinHalf / (W / 2), 0.1, 0.6));
  c.push(check(A, 'brow.eye', 'Sourcil au-dessus de l\'œil : écart / hauteur d\'œil (canon 1,0 – 1,5)', (e.y - mid) / (e.hUp + e.hLo), 0.6, 1.6));
  c.push(check(A, 'eye.on.face', 'Œil posé sur la surface du visage : |z œil − z surface| (U)', Math.abs(e.z - surfZ), 0, 0.05));
  c.push(check(A, 'iris.ratio', 'Iris / largeur d\'œil (réaliste 0,45 ; planche et animation 0,6 – 0,8)', (2 * e.irisR) / e.w, 0.55, 0.85));
  c.push(check(A, 'eye.aspect', 'Hauteur / largeur de l\'œil (réaliste 0,35 – 0,45 ; planche ronde)', (e.hUp + e.hLo) / e.w, 0.6, 1.0, 'info', 'canon 0,40 : écart de style assumé'));
  c.push(check(A, 'hair.front', 'Lisière avant des cheveux au-dessus du sourcil (U de marge, ≥ 0,1)', mid - s.hairline.knots[0]![1], 0.1, 0.5));
  const side = s.hairline.knots.find((k) => k[0] >= 85)![1];
  c.push(check(A, 'hair.sideburn', 'Pattes : la lisière à 85° descend au haut de l\'oreille (écart en U)', Math.abs(side - s.ear.y0), 0, 0.08));
  return layerOf(A, c);
}

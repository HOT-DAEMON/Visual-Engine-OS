import type { Vec } from '../geometry/eye/primitives';
import { faceLandmarks, halfWidthAt } from '../face';
import { hairGeometry, type HairGeometry, type HairLock } from '../face/hair';
import { FACING, STRAND_SCALE, facing, poseHair, rootOf } from '../face/pose';
import { skullOf } from '../face/pose/skull';
import type { RandomFace } from '../generation/random-face';
import { selfCrossings } from './hair-boundary';
import { checkHairPoseExtra } from './hair-pose-extra';
import { check, type Check } from './types';

/**
 * CHEVEUX SOUS POSE : couche de vérification de la rotation 2D (`docs/ROTATION-HAIR-VERIFY.md`). Lit la même `HairGeometry` posée que le rendu (`poseHair`) ; `override` = géométrie posée à contrôler à la place
 * (contrôles négatifs : un défaut injecté doit être vu). Chaque contrôle compare la géométrie POSÉE à la géométrie de FACE de la même graine : rien n'est jugé dans l'absolu.
 *
 *  GÉOMÉTRIE  — la forme posée est saine :
 *    `pose.identity`        à lacet nul la géométrie est l'objet d'origine (références de régression à 0° inchangées) ;
 *    `pose.finite`          aucune coordonnée non finie (masses, mèches, lisière, raie, zones rasées, ombres, attaches) ;
 *    `pose.layers`          mêmes nombres de mèches et de calques `front` / `back` / `over` (le rendu en lit la structure) ;
 *    `pose.root-glued`      la racine de chaque mèche ordinaire est EXACTEMENT sur la projection de la masse (elle ne se décolle pas de la coque) ;
 *    `pose.strand-scale`    la LARGEUR de chaque mèche ordinaire, à sept ordonnées de sa hauteur, est multipliée par un facteur dans [0,45 ; 1] : jamais étirée (2,2× à 30° avant la tranche 2), jamais réduite à un trait ;
 *    `pose.shell-bound`     l'avance de la coque sur la silhouette posée du crâne, rangée par rangée (enveloppe du polygone), ne dépasse pas celle de face : la coque ne s'envole pas ;
 *  ANATOMIE   — la forme obéit à la tête :
 *    `pose.hairline-on-skull` chaque point de l'implantation posée est dans la silhouette posée du crâne ;
 *    `pose.hairline-cross`    l'implantation posée ne se coupe pas elle-même (une courbe qui longe un crâne qui s'élargit peut reculer en x sans se replier : « x croissant » était un faux critère) ;
 *    `pose.hairline-brow`     elle reste au-dessus de la limite des sourcils (lacet seul : ordonnées intactes) ;
 *    `pose.over-fade`         une mèche devant le visage est opaque face à la caméra, invisible dos à elle, entre les deux selon la formule de visibilité (`FACING`) ;
 *    `pose.ties-glued`        la racine d'une queue ou d'un chignon reste à moins de 1 px de son attache posée (rapport à la distance de face) ;
 *  STYLE      — le trait reste celui du dessin :
 *    `pose.hairline-smooth`   la courbure maximale de l'implantation posée ne dépasse pas celle de face de plus de 35 % (+ 0,05 rad) : pas d'angle nouveau ;
 *    `pose.edge-step`         le plus grand pas entre points voisins de la lisière posée ≤ 3,2× celui de face (bande du limbe lointain dépliée, bornée par la pente de la projection).
 *  Règles ajoutées (`hair-pose-extra.ts`, `docs/ROTATION-HAIR-VERIFY-2.md`) : `pose.hairline-front-peak`, `pose.hairline-corner`, `pose.mass-thickness`.
 */
type Face = Pick<RandomFace, 'params' | 'width' | 'height'>;
const pts = (g: HairGeometry): Vec[] => [
  ...g.base.flat(), ...g.front.flat(), ...g.back.flat(), ...g.over.flat(), ...g.tierMasses.flatMap((m) => m.poly), ...(g.backBase ?? []), ...(g.simMass ?? []),
  ...g.locks.flatMap((l) => [...l.poly, ...(l.spine ?? [])]), ...g.hairline, ...g.scalp, ...(g.bare.part ?? []), ...g.bare.thin.flat(), ...(g.shaved ?? []).flat(), ...(g.skinShadows ?? []).flat(),
  ...g.ties.map((t) => t.at), ...(g.fringeBottom ?? []), ...g.boundary.loop.map((q) => q.p), ...g.sides.left.earZone, ...g.sides.right.earZone,
];
const extent = (a: readonly Vec[]): number => { let lo = Infinity, hi = -Infinity; for (const q of a) { if (q.x < lo) lo = q.x; if (q.x > hi) hi = q.x; } return hi - lo; };
const maxTurn = (line: readonly Vec[]): number => {
  let m = 0;
  for (let i = 1; i + 1 < line.length; i++) {
    const a = line[i - 1] as Vec, b = line[i] as Vec, c = line[i + 1] as Vec;
    const t = Math.abs(Math.atan2((c.y - b.y) * (b.x - a.x) - (c.x - b.x) * (b.y - a.y), (c.x - b.x) * (b.x - a.x) + (c.y - b.y) * (b.y - a.y)));
    if (Number.isFinite(t) && t > m) m = t;
  }
  return m;
};
const maxStep = (line: readonly Vec[]): number => { let m = 0; for (let i = 0; i + 1 < line.length; i++) m = Math.max(m, Math.hypot((line[i + 1] as Vec).x - (line[i] as Vec).x, (line[i + 1] as Vec).y - (line[i] as Vec).y)); return m; };
/** Étendue horizontale d'un polygone à l'ordonnée y (plus petit et plus grand x des intersections), ou null. */
export function spanAt(poly: readonly Vec[], y: number): { lo: number; hi: number } | null {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i] as Vec, b = poly[(i + 1) % poly.length] as Vec;
    if ((a.y - y) * (b.y - y) > 0 || a.y === b.y) continue;
    const x = a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y);
    if (x < lo) lo = x;
    if (x > hi) hi = x;
  }
  return hi >= lo ? { lo, hi } : null;
}
/** Part de la largeur maximale d'une mèche sous laquelle une rangée n'est pas mesurée : près d'une pointe les arêtes sont presque horizontales et l'intersection dépend du sommet voisin. */
export const TIP_SHARE = 0.3;
/** Marge absolue de mesure (fraction de W, ≈ 0,75 px) : le contour posé est interpolé entre des sommets d'ordonnées voisines et la carte n'est pas affine en y. Excès MESURÉ sur 253 000 rangées (10 coiffures × 3 graines × 4 lacets) : p99,9 = 0,08 px, maximum 0,655 px. */
export const WIDTH_SLACK = 0.002;
/** Bornes (posée / de face) de la largeur d'une mèche sur sept ordonnées de sa hauteur : `hi` = max de (w1 − marge) / w0, `lo` = min de (w1 + marge) / w0. Les rangées de moins de `minW` ou de moins de `TIP_SHARE` de la largeur maximale sont ignorées ; `n` = rangées mesurées. */
export function widthBounds(a: readonly Vec[], b: readonly Vec[], minW: number, slack: number): { lo: number; hi: number; n: number } {
  const ys = a.map((q) => q.y), y0 = Math.min(...ys), y1 = Math.max(...ys), rows: { w0: number; w1: number }[] = [];
  for (let k = 1; k <= 7; k++) {
    const y = y0 + ((y1 - y0) * k) / 8, s0 = spanAt(a, y), s1 = spanAt(b, y);
    if (s0 && s1) rows.push({ w0: s0.hi - s0.lo, w1: s1.hi - s1.lo });
  }
  const wmax = Math.max(0, ...rows.map((r) => r.w0)), kept = rows.filter((r) => r.w0 >= minW && r.w0 >= TIP_SHARE * wmax);
  return { lo: Math.min(Infinity, ...kept.map((r) => (r.w1 + slack) / r.w0)), hi: Math.max(-Infinity, ...kept.map((r) => (r.w1 - slack) / r.w0)), n: kept.length };
}
const isTied = (l: HairLock): boolean => l.part === 'tail' || l.part === 'bun';

export function checkHairPose(face: Face, yawDeg: number, override?: HairGeometry): Check[] {
  const p = face.params;
  if (p.hair.style === 'bald') return [];
  const lm = faceLandmarks(p, face.width, face.height), g0 = hairGeometry(p, lm);
  if (!g0) return [];
  const skull = skullOf(lm), g = override ?? poseHair(g0, skull, yawDeg, lm.W), out: Check[] = [];
  const same = poseHair(g0, skull, 0, lm.W) === g0;
  out.push(check('geometry', 'pose.identity', '==', same ? 1 : 0, 1, 'à lacet nul la géométrie n\'est pas l\'objet d\'origine : les références de régression à 0° bougeraient'));
  const bad = pts(g).filter((q) => !Number.isFinite(q.x) || !Number.isFinite(q.y)).length;
  out.push(check('geometry', 'pose.finite', '==', bad, 0, 'coordonnée non finie dans la chevelure posée'));
  const layers = Math.abs(g.locks.length - g0.locks.length) + Math.abs(g.front.length - g0.front.length) + Math.abs(g.back.length - g0.back.length) + Math.abs(g.over.length - g0.over.length) + Math.abs(g.base.length - g0.base.length);
  out.push(check('geometry', 'pose.layers', '==', layers, 0, 'nombre de mèches ou de calques modifié par la pose'));
  out.push(...checkHairPoseExtra(g0, g, lm, skull, yawDeg, spanAt));   // lisière de face, coin sur fenêtre d'arc fixe, épaisseur des masses : `hair-pose-extra.ts`
  if (yawDeg === 0) return out;

  const ord = g0.locks.map((l, i) => ({ l0: l, l1: g.locks[i] as HairLock })).filter(({ l0, l1 }) => l1 && !isTied(l0) && extent(l0.poly) > 0.008 * lm.W);
  let glue = 0, lo = Infinity, hi = 0;
  for (const { l0, l1 } of ord) {
    const r0 = rootOf(l0), r1 = rootOf(l1);
    if (l0.spine?.length) glue = Math.max(glue, Math.abs(r1.x - skull.projectX(r0.x, r0.y, yawDeg)));   // racine = début de la ligne médiane
    const wb = widthBounds(l0.poly, l1.poly, 0.006 * lm.W, WIDTH_SLACK * lm.W);
    if (wb.n) { lo = Math.min(lo, wb.lo); hi = Math.max(hi, wb.hi); }
  }
  out.push(check('geometry', 'pose.root-glued', '<=', glue, 1e-6 * lm.W, 'racine de mèche décollée de la projection de la masse'));
  if (Number.isFinite(lo)) {
    out.push(check('geometry', 'pose.strand-scale.max', '<=', hi, STRAND_SCALE.max + 1e-6, 'mèche étirée au-delà de sa largeur de face (bande du limbe dépliée)'));
    out.push(check('geometry', 'pose.strand-scale.min', '>=', lo, STRAND_SCALE.min - 1e-6, 'mèche réduite à un trait'));
  }
  const archY = Math.min(g0.boundary.marks.earTopY.left, g0.boundary.marks.earTopY.right) - 0.03 * lm.H;
  // Avance de la coque sur la silhouette du crâne, comparée RANGÉE PAR RANGÉE par l'enveloppe horizontale du polygone (`spanAt`) : face et posé lus à la MÊME ordonnée bornée [haut + 2 % H, bas du menton − 2 % H]
  // (aux pointes la largeur est nulle : un côté non borné fabriquait 58 px d'excès fictifs au sommet) ; indépendant des sommets voisins (la coque a de longues arêtes).
  const yc = (y: number): number => Math.min(lm.chinY - 0.02 * lm.H, Math.max(skull.topY + 0.02 * lm.H, y));
  const b0 = g0.base[0] ?? [], b1 = g.base[0] ?? [], yTop = skull.topY + 0.02 * lm.H, yBot = Math.min(lm.jawY, archY);
  let excess = 0;
  for (let k = 0; k <= 48; k++) {
    const y = yTop + ((yBot - yTop) * k) / 48, s0 = spanAt(b0, y), s1 = spanAt(b1, y);
    if (!s0 || !s1) continue;
    const a0 = Math.max(s0.hi, -s0.lo) - halfWidthAt(lm.outline, yc(y)), a1 = Math.max(s1.hi, -s1.lo) - skull.halfAt(yc(y), yawDeg);
    excess = Math.max(excess, a1 - Math.max(0, a0));
  }
  out.push(check('geometry', 'pose.shell-bound', '<=', Math.max(0, excess), 0.5 + 0.004 * lm.W, 'la coque posée s\'éloigne de la silhouette posée du crâne plus que de face'));

  let onSkull = 0;
  const hl = g.hairline;
  hl.forEach((q) => { onSkull = Math.max(onSkull, Math.abs(q.x) - skull.halfAt(yc(q.y), yawDeg)); });
  out.push(check('anatomy', 'pose.hairline-on-skull', '<=', Math.max(0, onSkull), 0.25, 'point d\'implantation hors de la silhouette posée du crâne'));
  out.push(check('anatomy', 'pose.hairline-cross', '==', selfCrossings(hl), selfCrossings(g0.hairline), 'implantation posée auto-sécante (repli de la ligne)'));
  out.push(check('anatomy', 'pose.hairline-brow', '<=', Math.max(...hl.map((q) => q.y)), lm.browLimitY + 1e-9, 'implantation posée sous la limite des sourcils'));

  let fadeErr = 0;
  g0.locks.forEach((l0, i) => {
    const l1 = g.locks[i];
    if (!l1 || l0.layer !== 'over') return;
    const r = rootOf(l0), want = Math.min(1, Math.max(0, facing(skull, r.x, r.y, yawDeg) / FACING.full)), a = l1.alpha ?? 1, t = want * want * (3 - 2 * want);
    fadeErr = Math.max(fadeErr, Math.abs(a - t));
  });
  out.push(check('anatomy', 'pose.over-fade', '<=', fadeErr, 1e-6, 'opacité d\'une mèche de devant incohérente avec sa visibilité'));

  let tieErr = 0;
  g0.locks.forEach((l0, i) => {
    const l1 = g.locks[i];
    if (!l1 || !isTied(l0) || !g0.ties.length) return;
    const r0 = rootOf(l0), r1 = rootOf(l1);
    let j = 0, bd = Infinity;
    g0.ties.forEach((t, k) => { const d = Math.hypot(t.at.x - r0.x, t.at.y - r0.y); if (d < bd) { bd = d; j = k; } });
    const t1 = g.ties[j];
    if (t1) tieErr = Math.max(tieErr, Math.hypot(t1.at.x - r1.x, t1.at.y - r1.y) - bd);
  });
  out.push(check('anatomy', 'pose.ties-glued', '<=', Math.max(0, tieErr), 1, 'pièce attachée décollée de son attache'));

  out.push(check('style', 'pose.hairline-smooth', '<=', maxTurn(hl), 1.35 * maxTurn(g0.hairline) + 0.05, 'angle nouveau dans l\'implantation posée', 'warn'));
  const edge = (q: HairGeometry): Vec[] => q.boundary.loop.filter((k) => k.kind === 'front').map((k) => k.p);
  const s0 = maxStep(edge(g0)), s1 = maxStep(edge(g));
  out.push(check('style', 'pose.edge-step', '<=', s0 > 0 ? s1 / s0 : 1, 3.2, 'lisière posée étirée entre deux points voisins', 'warn'));
  return out;
}

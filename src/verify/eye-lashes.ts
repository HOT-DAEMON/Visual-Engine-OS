import { cubicAt, type Lash, type OpeningGeometry, type Vec } from '../geometry/eye';
import { openingPolygon } from '../geometry/eye';
import { dominantColor } from '../materials';
import type { EyeSpec } from '../schema';
import { check, type Check } from './types';

/**
 * COUCHE « CILS » de la vérification d'un œil (rattachée à `verifyEye`) : trois familles de contrôles chiffrées, calculées sur les cils RÉELLEMENT dessinés
 * (`eyeLashSet`, le même appel que le rendu).
 *   geometry : coordonnées finies ; racines sur le bord palpébral (ou sur le liner qui le porte) ; cils entièrement dans la zone du dessin ; aucune pointe de cil du haut dans l'ouverture ;
 *   anatomy  : cils qui s'éloignent de l'œil (haut vers le haut, bas vers le bas) ; cils de la moitié externe qui ne penchent pas vers le nez ; longueur maximale bornée par la largeur de l'œil ;
 *   style    : position médiane des cils dans la plage mesurée sur les références 12 à 16 ; encre sombre et opaque pour les styles tracés (cel) ; cils effilés (largeur de base > 0).
 * Les bornes viennent de references/eyes/measures-lashes.json (`summary`) et de l'examen des 148 yeux de la galerie (voir docs/EYES-LASHES-VERIFY.md) ; chaque contrôle porte sa source.
 */
export const LASH_VERIFY_BOUNDS = {
  /** Distance maximale racine -> bord palpébral, en épaisseurs de bord (le liner porte les racines un peu au-dessus). */
  rootDistThickness: 3.2,
  /** Zone du dessin : un cil ne dépasse pas l'ouverture de plus de cette fraction de la plus grande dimension de l'œil (même contrat que tests/eye-lash-families : 0,55). */
  zoneFraction: 0.55,
  /** Longueur maximale d'un cil / largeur de l'œil (références : P90 des traits latéraux 0,19–0,6 L ; aile maximale mesurée 0,62 L). */
  maxLengthOverWidth: 0.7,
  /** Position médiane des cils du haut le long du bord (0 interne, 1 externe) : références 0,31 (P10) à 0,9 (P90) pour les pointes, médianes 0,65–0,83. */
  medianPosition: [0.3, 0.97] as const,
  /** Part minimale des cils qui s'éloignent de l'œil (produit scalaire avec la normale du bord > 0). */
  outwardShare: 0.9,
};

const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);
const inside = (p: Vec, poly: readonly Vec[]): boolean => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i] as Vec; const b = poly[j] as Vec;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
};
const lum = (hex: string): number => {
  const m = /^#([0-9a-f]{6})/i.exec(hex); if (!m) return 0.5;
  const c = [0, 2, 4].map((i) => { const v = parseInt((m[1] as string).slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * (c[0] as number) + 0.7152 * (c[1] as number) + 0.0722 * (c[2] as number);
};
const median = (v: number[]): number => { const s = [...v].sort((a, b) => a - b); return s.length ? ((s[Math.floor((s.length - 1) / 2)] as number) + (s[Math.ceil((s.length - 1) / 2)] as number)) / 2 : 0; };
const lashPts = (l: Lash): Vec[] => (l.ctrl2 ? [l.base, l.ctrl, l.ctrl2, l.tip] : [l.base, l.ctrl, l.tip]);
/** Points échantillonnés le long du cil (cubique ou quadratique), pour les contrôles de zone. */
function sample(l: Lash): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; i <= 8; i++) {
    const s = i / 8;
    if (l.ctrl2) out.push(cubicAt(l.base, l.ctrl, l.ctrl2, l.tip, s));
    else { const u = 1 - s; out.push({ x: u * u * l.base.x + 2 * u * s * l.ctrl.x + s * s * l.tip.x, y: u * u * l.base.y + 2 * u * s * l.ctrl.y + s * s * l.tip.y }); }
  }
  return out;
}

export interface LashMetrics { readonly upperCount: number; readonly lowerCount: number; readonly medianPosition: number; readonly maxLengthOverWidth: number; readonly outwardShare: number; readonly worstRootDist: number }

export function checkEyeLashes(
  eye: EyeSpec,
  g: OpeningGeometry,
  th: number,
  lashes: { upper: readonly Lash[]; lower: readonly Lash[] },
  upperEdge: (t: number) => { pos: Vec; N: Vec },
  lowerEdge: (t: number) => { pos: Vec; N: Vec },
): { checks: Check[]; metrics: LashMetrics } {
  const B = LASH_VERIFY_BOUNDS;
  const out: Check[] = [];
  const all = [...lashes.upper, ...lashes.lower];
  if (all.length === 0) return { checks: [], metrics: { upperCount: 0, lowerCount: 0, medianPosition: 0, maxLengthOverWidth: 0, outwardShare: 1, worstRootDist: 0 } };

  // ---- geometry ----
  const finite = all.every((l) => lashPts(l).every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)) && Number.isFinite(l.baseWidth));
  out.push(check('geometry', 'lashes-finite', '==', Number(finite), 1, 'une coordonnée ou une largeur de cil n’est pas finie'));
  const edgeSamples = (edge: (t: number) => { pos: Vec }): Vec[] => Array.from({ length: 65 }, (_, i) => edge(i / 64).pos);
  const upE = edgeSamples(upperEdge); const loE = edgeSamples(lowerEdge);
  const rootDist = (l: Lash, e: Vec[]): number => Math.min(...e.map((p) => dist(p, l.base))) / Math.max(th, 1e-6);
  const worstRoot = Math.max(...lashes.upper.map((l) => rootDist(l, upE)), ...lashes.lower.map((l) => rootDist(l, loE)), 0);
  out.push(check('geometry', 'lash-roots-on-lid', '<=', worstRoot, B.rootDistThickness, 'un cil est planté loin du bord palpébral (racine flottante)'));
  const bb = g.bbox; const beyond = (p: Vec): number => Math.hypot(Math.max(bb.x - p.x, p.x - (bb.x + bb.w), 0), Math.max(bb.y - p.y, p.y - (bb.y + bb.h), 0));
  const worstZone = Math.max(...all.flatMap((l) => sample(l).map(beyond)));
  out.push(check('geometry', 'lashes-in-zone', '<=', worstZone / Math.max(g.w, g.h), B.zoneFraction, 'un cil dépasse de l’ouverture de plus de la fraction autorisée de la plus grande dimension de l’œil'));
  const poly = openingPolygon(g);
  const tipsInOpening = lashes.upper.filter((l) => inside(l.tip, poly)).length;
  out.push(check('geometry', 'upper-lash-tips-outside-opening', '==', tipsInOpening, 0, 'la pointe d’un cil du haut retombe dans l’ouverture (sur l’iris ou la sclère)', 'warn'));

  // ---- anatomy ----
  // « s'éloigne de l'œil » : la pointe est plus loin du centre de l'ouverture que la racine (robuste aux canthi pointus où la normale du bord n'est pas définie).
  const ctr: Vec = { x: g.bbox.x + g.bbox.w / 2, y: g.bbox.y + g.bbox.h / 2 };
  const away = (l: Lash): boolean => dist(l.tip, ctr) > dist(l.base, ctr);
  const up = lashes.upper.map(away); const lo = lashes.lower.map(away);
  const share = [...up, ...lo].filter(Boolean).length / (up.length + lo.length || 1);
  out.push(check('anatomy', 'lashes-point-away-from-eye', '>=', share, B.outwardShare, 'des cils pointent vers l’intérieur de l’œil (haut vers le bas, bas vers le haut)'));
  const maxLen = Math.max(...all.map((l) => dist(l.base, l.tip))) / g.w;
  out.push(check('anatomy', 'lash-max-length', '<=', maxLen, B.maxLengthOverWidth, 'un cil est plus long que 0,7 fois la largeur de l’œil (hors mesures des références)', 'warn'));
  // cils de la moitié externe : ne penchent pas vers le canthus interne (angle mesuré sur 66 yeux : toujours vers l'externe)
  const T = { x: (g.po.x - g.pi.x) / (dist(g.po, g.pi) || 1), y: (g.po.y - g.pi.y) / (dist(g.po, g.pi) || 1) };
  const outerHalf = lashes.upper.filter((l) => (l.base.x - g.pi.x) * T.x + (l.base.y - g.pi.y) * T.y > 0.55 * dist(g.po, g.pi));
  const lean = outerHalf.length ? outerHalf.reduce((a, l) => a + ((l.tip.x - l.base.x) * T.x + (l.tip.y - l.base.y) * T.y) / (dist(l.base, l.tip) || 1), 0) / outerHalf.length : 0;
  out.push(check('anatomy', 'outer-lashes-lean-outward', '>=', lean, 0, 'les cils de la moitié externe penchent vers le nez'));

  // ---- style ----
  const pos = lashes.upper.map((l) => { let best = 0; let d = Infinity; for (let i = 0; i <= 64; i++) { const k = dist(upE[i] as Vec, l.base); if (k < d) { d = k; best = i / 64; } } return best; });
  const med = lashes.upper.length >= 3 ? median(pos) : 0.8;
  out.push(check('style', 'lash-median-position', '>=', med, B.medianPosition[0], 'cils concentrés côté interne : hors de la plage mesurée sur les références', 'warn'));
  out.push(check('style', 'lash-median-position-max', '<=', med, B.medianPosition[1], 'cils tous ramassés au canthus externe', 'warn'));
  const col = eye.lashes.upper.material ? dominantColor(eye.lashes.upper.material.base) : null;
  if (col && /^#[0-9a-f]{6}/i.test(col) && eye.lashes.upper.opacity >= 0.9) out.push(check('style', 'lash-ink-dark', '<=', lum(col), 0.25, 'cils tracés clairs sur une sclère claire (les références sont en encre sombre)', 'warn'));
  out.push(check('style', 'lash-tapered', '>=', Math.min(...all.map((l) => l.baseWidth)), 0.01, 'un cil a une largeur de base nulle'));
  return { checks: out, metrics: { upperCount: lashes.upper.length, lowerCount: lashes.lower.length, medianPosition: med, maxLengthOverWidth: maxLen, outwardShare: share, worstRootDist: worstRoot } };
}

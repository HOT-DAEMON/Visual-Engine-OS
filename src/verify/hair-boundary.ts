import { faceLandmarks } from '../face';
import { hairGeometry, type HairGeometry } from '../face/hair';
import { edgeStyle } from '../face/hair/boundary/edge-style';
import { coverageOf } from '../face/hair/sides';
import { resolveTexture } from '../face/hair/texture';
import { earGeometry } from '../face/ears-geometry';
import { inPoly } from '../face/poly';
import type { RandomFace } from '../generation/random-face';
import { check, type Check } from './types';

/**
 * VÉRIFICATION DE LA LISIÈRE (3 couches), active pour toute coiffure non chauve. Toutes les mesures sont lues sur `HairGeometry.boundary`
 * et sur la même géométrie d'oreille que le rendu.
 *  - géométrie : nombres finis, points sur ou dans le contour, cohérence avec la projection de face, parcours sans croisement, pas de trou ;
 *  - anatomie  : implantation au-dessus des sourcils, pattes au-dessus des yeux, oreille contournée, nuque sous les oreilles, la coque ne
 *                recouvre ni la peau du visage ni une oreille « libre » ;
 *  - style     : implantation lisse, équilibre gauche / droite proportionné à l'irrégularité demandée, bord lisible (contraste + ombre).
 */
type P = { x: number; y: number };
const cross = (a: P, b: P, c: P): number => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const crosses = (a: P, b: P, c: P, d: P): boolean => cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;

/** Nombre de croisements entre segments NON adjacents d'une polyligne. */
export function selfCrossings(pts: P[]): number {
  let n = 0;
  for (let i = 0; i < pts.length - 1; i++) for (let j = i + 2; j < pts.length - 1; j++) if (crosses(pts[i] as P, pts[i + 1] as P, pts[j] as P, pts[j + 1] as P)) n++;
  return n;
}

/** `override` : géométrie à contrôler à la place de celle du visage (contrôles négatifs des tests : une lisière sabotée doit être détectée). */
export function checkHairBoundary(face: RandomFace, override?: HairGeometry): Check[] {
  const p = face.params;
  if (p.hair.style === 'bald') return [];
  const lm = faceLandmarks(p, face.width, face.height);
  const geo = override ?? hairGeometry(p, lm);
  if (!geo) return [];
  const { H } = lm;
  const b = geo.boundary;
  const S = b.skull;
  const m = b.marks;
  const out: Check[] = [];
  const front = b.loop.filter((q) => q.kind === 'front');
  const visible = b.loop.filter((q) => Math.abs(q.az) <= Math.PI / 2);
  // Le parcours fermé traverse la nuque (cachée de face) : la vue de face est faite de tronçons contigus, jamais d'un saut d'un côté à l'autre.
  const hidden0 = b.loop.findIndex((q) => Math.abs(q.az) > Math.PI / 2);
  const runs: P[][] = [];
  for (let k = 0; k < b.loop.length; k++) {
    const q = b.loop[(hidden0 + k) % b.loop.length] as (typeof b.loop)[number];
    if (Math.abs(q.az) > Math.PI / 2) {
      runs.push([]);
      continue;
    }
    if (runs.length === 0) runs.push([]);
    (runs[runs.length - 1] as P[]).push(q.p);
  }

  // --- géométrie ---
  out.push(check('geometry', 'boundary-finite', '==', b.loop.every((q) => Number.isFinite(q.y) && Number.isFinite(q.az) && Number.isFinite(q.p.x) && Number.isFinite(q.p.y)) ? 1 : 0, 1, 'un point de la lisière n\'est pas un nombre fini'));
  out.push(check('geometry', 'boundary-inside-contour', '<=', Math.max(...front.map((q) => Math.abs(q.p.x) / Math.max(1e-6, S.a(q.y)))), 1 + 1e-6, 'un point de l\'implantation est hors du contour du crâne'));
  const dProj = Math.max(...visible.map((q) => Math.abs(S.project(q.y, q.az, 0, 0).x - q.p.x)));
  out.push(check('geometry', 'boundary-matches-face-projection', '<=', dProj / lm.W, 1e-6, 'la lisière sur la surface du crâne ne se projette pas de face sur la lisière dessinée'));
  out.push(check('geometry', 'boundary-no-self-crossing', '<=', runs.reduce((a, r) => a + selfCrossings(r), 0), 0, 'le parcours de la lisière (vue de face) se croise lui-même'));
  let gap = 0;
  for (let i = 0; i < b.loop.length; i++) {
    const a = S.point((b.loop[i] as { y: number }).y, (b.loop[i] as { az: number }).az);
    const c = S.point((b.loop[(i + 1) % b.loop.length] as { y: number }).y, (b.loop[(i + 1) % b.loop.length] as { az: number }).az);
    gap = Math.max(gap, Math.hypot(a.x - c.x, a.y - c.y, a.z - c.z));
  }
  out.push(check('geometry', 'boundary-closed-no-hole', '<=', gap / H, 0.12, 'trou dans le parcours fermé de la lisière (écart 3D entre deux points voisins)'));

  // --- anatomie ---
  out.push(check('anatomy', 'boundary-above-brows', '<=', Math.max(...front.map((q) => q.y)), lm.browLimitY - 0.03 * H + 1e-9, 'l\'implantation descend sous la limite des sourcils'));
  out.push(check('anatomy', 'boundary-sideburn-above-eyes', '<=', m.tipY, lm.eyeY - 0.03 * H + 1e-9, 'la pointe de la patte descend au niveau des yeux'));
  const ears = earGeometry(p, lm);
  const inEar = visible.filter((q) => q.kind !== 'front' && ears.some((e) => inPoly(e.poly, q.p.x, q.p.y))).length;
  out.push(check('anatomy', 'boundary-clears-ear', '<=', inEar, 0, 'la lisière traverse une oreille dessinée'));
  out.push(check('anatomy', 'boundary-nape-below-ears', '>=', m.napeY - Math.max(m.earBottomY.left, m.earBottomY.right), 0.02 * H - 1e-9, 'la ligne de la nuque remonte au niveau des oreilles'));
  // Coque : jamais sur la peau du visage (grille 28 × 28 des points `isFace`).
  const base = geo.base[0];
  if (base) {
    let n = 0;
    let c = 0;
    for (let i = 0; i < 28; i++) for (let j = 0; j < 28; j++) {
      const x = -lm.W / 2 + (lm.W * (i + 0.5)) / 28;
      const y = -H / 2 + ((lm.chinY + H / 2) * (j + 0.5)) / 28;
      if (!b.isFace(x, y)) continue;
      n++;
      if (inPoly(base, x, y)) c++;
    }
    out.push(check('anatomy', 'shell-off-face-skin', '<=', n ? c / n : 0, 0.02, 'la coque des cheveux recouvre la peau du visage'));
    for (const side of ['left', 'right'] as const) {
      const info = geo.sides[side];
      if (info.ear === 'covered') continue;
      out.push(check('anatomy', `shell-clears-free-ear-${side}`, '<=', coverageOf([base], info.earZone), 0.25, `la coque recouvre l'oreille ${side === 'left' ? 'gauche' : 'droite'} alors qu'elle doit rester dégagée`));
    }
  }

  // --- style ---
  let step = 0;
  for (let i = 0; i < front.length - 1; i++) step = Math.max(step, Math.abs((front[i + 1] as { y: number }).y - (front[i] as { y: number }).y));
  out.push(check('style', 'hairline-smooth', '<=', step / H, 0.05, 'implantation en dents de scie (saut vertical entre deux points voisins)', 'warn'));
  const nF = front.length;
  let asym = 0;
  for (let i = 0; i < nF; i++) asym += Math.abs((front[i] as { y: number }).y - (front[nF - 1 - i] as { y: number }).y);
  const allowed = 0.02 + 0.12 * p.hair.irregularity + (p.hair.hairlineShape === 'widow' ? 0.05 : 0) + 0.03 * Math.abs(p.hair.part) + 0.05 * p.hair.recession;
  out.push(check('style', 'hairline-balance', '<=', asym / nF / H, allowed, 'implantation plus dissymétrique que l\'irrégularité, la raie et le recul demandés ne l\'expliquent', 'warn'));
  const es = edgeStyle(p.hair.style, resolveTexture(p.hair.style, p.hair.texture), p.hair.color, (face.objects[0] as { material: { color: string } }).material.color, p.hair.irregularity);
  out.push(check('style', 'hairline-edge-readable', '>=', es.contrast + es.shadowAlpha, 0.1, 'bord peau / cheveux illisible (contraste faible ET ombre de transition faible)', 'warn'));
  return out;
}

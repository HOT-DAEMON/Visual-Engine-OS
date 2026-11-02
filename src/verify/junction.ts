import type { BodyInput, NeckAnchor } from '../body';
import { bodyFrame } from '../body/frame';
import { legFrame } from '../body/lower/frame';
import { LegParams } from '../body/lower/types';
import { ringPoint } from '../body/volume/loft';
import type { Volume, VolumeSet } from '../body/volume';
import { BodyParams } from '../body/types';
import { junctionRenderChecks } from './junction-render';
import type { VCheck, VReport } from './volume';

const chk = (id: string, layer: VCheck['layer'], ok: boolean, detail: string): VCheck => ({ id, layer, ok, detail });

/** Abscisse latérale extrême (x > 0 ou x < 0 selon `side`) d'un ensemble de volumes à la hauteur `y` (±`tol`), par échantillonnage des anneaux. NaN si le volume n'atteint pas cette hauteur. */
export function rowExtent(vs: readonly Volume[], y: number, tol: number, side: 1 | -1 = 1): number {
  let best = NaN;
  for (const v of vs) for (let i = 0; i < v.stations.length - 1; i++) {
    const A = v.stations[i]!, B = v.stations[i + 1]!;
    for (let k = 0; k <= 6; k++) for (let q = 0; q < 24; q++) {
      const t = k / 6, th = (q / 24) * 2 * Math.PI, pa = ringPoint(A, th).p, pb = ringPoint(B, th).p, yy = pa.y + (pb.y - pa.y) * t, xx = (pa.x + (pb.x - pa.x) * t) * side;
      if (Math.abs(yy - y) <= tol && xx > 0) best = Number.isNaN(best) ? xx : Math.max(best, xx);
    }
  }
  return best;
}
const topOf = (v: Volume): number => { let y = Infinity; for (const s of v.stations) for (let q = 0; q < 24; q++) y = Math.min(y, ringPoint(s, (q / 24) * 2 * Math.PI).p.y); return y; };

/**
 * VÉRIFICATION DES RACCORDS (itération 05) en 3 couches : épaule ↔ bras (pente du trapèze, deltoïde) et haut ↔ bas du corps (bassin, hanche, jambes).
 *  GÉOMÉTRIE : aucun muscle ne dépasse de la peau sur la pente d'épaule (muscle − peau ≤ 0,04 h) ; la hanche se raccorde (écart cuisse/tronc ≤ 0,10 h) ; le bassin est fermé ; jambes symétriques.
 *  ANATOMIE  : largeur de la pente à 0,3 / 0,6 / 0,9 de la chute d'acromion dans la bande mesurée sur ref-02 et ref-04 ; sommet du deltoïde à la hauteur de l'acromion ; cuisse > genou, mollet > cheville.
 *  STYLE     : toutes les enveloppes qui se rencontrent sont de la peau (même tampon de profondeur, aucune rainure entre elles) ; rendu sans trou ni cran (voir `junction-render.ts`).
 */
export function verifyJunctions(set: VolumeSet, raw: BodyInput, a: NeckAnchor): VReport {
  const C: VCheck[] = [], H = set.measures.h as number, f = bodyFrame(BodyParams.parse(raw), a), lf = legFrame(f, LegParams.parse({})), by = set.byId;
  const trunk = by.get('trunk')!, neck = by.get('neck')!;
  const relief = (side: 'L' | 'R'): Volume[] => set.volumes.filter((v) => (v.kind === 'muscle' || v.kind === 'bone') && v.layer >= 3 && !v.hidden && (v.group === 'back' || v.group === 'chest') && v.side === side);
  // ── Géométrie ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const drop = f.y.acr - f.y.base, rows = [0.3, 0.6, 0.9].map((k) => f.y.base + k * drop), sd = [['L', 1], ['R', -1]] as const;
  const over = sd.map(([n, s]) => rows.map((y) => { const q = rowExtent(relief(n), y, 0.006 * H, s) - rowExtent([trunk], y, 0.006 * H, s); return Number.isFinite(q) ? q : 0; })), worst = Math.max(...over.flat());
  const asym = Math.max(...rows.map((_, i) => Math.abs(over[0]![i]! - over[1]![i]!)));
  const fmt = (v: number[]): string => v.map((q) => (q / H).toFixed(3)).join(' / ');
  C.push(chk('junction.geo.no-floating-muscle', 'geometry', worst <= 0.08 * H, `muscles et os − peau sur la pente d'épaule à 0,3 / 0,6 / 0,9 de la chute : gauche ${fmt(over[0]!)} · droite ${fmt(over[1]!)} h (borne de cohérence ≤ 0,08 h ; avant l'itération 05 : jusqu'à 0,082 h à droite — c'est la symétrie qui discrimine)`));
  C.push(chk('junction.geo.shoulder-symmetry', 'geometry', asym <= 0.05 * H, `écart gauche/droite du dépassement : ${(asym / H).toFixed(3)} h (≤ 0,05 h ; avant l'itération 05 : 0,05–0,07 h, la pose ne s'appliquait qu'au centre des sections de peau)`));
  const legL = by.get('leg.env.L'), legR = by.get('leg.env.R');
  const cx = (v: Volume | undefined): number => (v ? v.stations[2]!.c.x : NaN);
  C.push(chk('junction.geo.legs-symmetric', 'geometry', !!legL && !!legR && Math.abs(cx(legL) + cx(legR)) <= 0.08 * H, `axes des cuisses : G ${(cx(legL) / H).toFixed(3)} h · D ${(cx(legR) / H).toFixed(3)} h (somme ≤ 0,08 h : le contrapposto décale le bassin)`));
  const yc = lf.y.crotch, gap = Math.abs(rowExtent([legL!], yc, 0.006 * H) - rowExtent([trunk], yc, 0.006 * H));
  C.push(chk('junction.geo.hip-flow', 'geometry', gap <= 0.12 * H, `écart entre la paroi externe de la cuisse et celle du bassin à la fourche : ${(gap / H).toFixed(3)} h (≤ 0,12 h ; la marche visible est mesurée sur l'image par hip-wall-step)`));
  const last = trunk.stations[trunk.stations.length - 1]!, at = trunk.stations.reduce((p, s) => (Math.abs(s.c.y - yc) < Math.abs(p.c.y - yc) ? s : p));
  C.push(chk('junction.geo.pelvis-closed', 'geometry', last.a < 0.35 * at.a && last.c.y > yc, `bassin refermé sous la fourche : dernière section ${(last.a / at.a).toFixed(2)} × la section de la fourche (< 0,35) et plus bas qu'elle`));
  // ── Anatomie ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const bands: readonly (readonly [number, number])[] = [[0.5, 0.8], [0.68, 1.0], [0.82, 1.1]], xs = rows.map((y) => rowExtent([trunk], y, 0.006 * H) / f.x.acr);
  C.push(chk('junction.ana.slope-width', 'anatomy', xs.every((q, i) => q >= bands[i]![0] && q <= bands[i]![1]), `demi-largeur de la peau × x.acr à 0,3 / 0,6 / 0,9 de la chute : ${xs.map((q) => q.toFixed(2)).join(' / ')} (bandes 0,50–0,80 · 0,68–1,00 · 0,82–1,10 : paroi de ref-02/ref-04 moins ≤ 0,06 h, les muscles portent le reste de la silhouette)`));
  const dl = by.get('deltoid.L'), dTop = dl ? topOf(dl) : NaN;
  C.push(chk('junction.ana.deltoid-top', 'anatomy', !!dl && Math.abs(dTop - f.y.acr) <= 0.06 * H, `sommet du deltoïde à ${((dTop - f.y.acr) / H).toFixed(3)} h de l'acromion (≤ 0,06 h : la masse prolonge la pente du trapèze)`));
  const wAt = (v: Volume, y: number): number => v.stations.reduce((p, s) => (Math.abs(s.c.y - y) < Math.abs(p.c.y - y) ? s : p)).a;
  if (legL) C.push(chk('junction.ana.leg-taper', 'anatomy', wAt(legL, lf.y.knee) < wAt(legL, (yc + lf.y.knee) / 2) && wAt(legL, lf.y.ankle) < wAt(legL, lf.y.knee + 0.25 * (lf.y.ankle - lf.y.knee)), `genou ${(wAt(legL, lf.y.knee) / H).toFixed(3)} h < mi-cuisse ${(wAt(legL, (yc + lf.y.knee) / 2) / H).toFixed(3)} h ; cheville < mollet`));
  else C.push(chk('junction.ana.leg-taper', 'anatomy', false, 'jambe 3D absente'));
  // ── Style ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const env = [trunk, neck, by.get('arm.env.L'), by.get('arm.env.R'), by.get('forearm.env.L'), legL, legR], bad = env.filter((v) => !v || v.kind !== 'skin' || v.level !== 0).map((v) => v?.id ?? 'manquant');
  C.push(chk('junction.sty.skin-merge', 'style', bad.length === 0, bad.length ? `enveloppes non fusionnées : ${bad.join(',')}` : 'tronc, cou, bras, avant-bras et jambes sont de la peau de niveau 0 : un seul tampon de profondeur, aucune rainure entre elles'));
  C.push(...junctionRenderChecks(set, raw, a));
  const failures = C.filter((c) => !c.ok);
  return { ok: failures.length === 0, checks: C, failures };
}

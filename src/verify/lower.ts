import { LOWER_CONTRACTS } from '../body/lower/contracts';
import type { LegGeo } from '../body/lower/geometry';
import { canonAt, stageOf } from '../body/canon';
import type { BodyMarkup } from '../body/render';
import { area, box, centroid, inPoly } from '../body/shape';
import { check, report, type Check, type Report } from './types';

/**
 * VÉRIFICATION DU BAS DU CORPS — mêmes trois couches que `verifyBody` : géométrique (finitude, hiérarchie, confinement, symétrie, attaches),
 * anatomique (bandes de proportions par âge, orteils, garde-fou) et style (sans filtre, trait, poids). Bandes = CONVENTIONS D'ATELIER (`lower/canon.ts`).
 */
export function verifyLegs(geo: LegGeo, markup?: BodyMarkup): Report {
  const f = geo.frame, h = f.body.h, A = geo.atoms, m = geo.measures, M = (k: string): number => m[k] as number, C: Check[] = [];
  const p = geo.body.params, st = stageOf(p.age), lp = geo.params;
  C.push(check('geometry', 'lower.finite', '==', A.filter((a) => a.poly.some((q) => !Number.isFinite(q.x) || !Number.isFinite(q.y))).length, 0, 'tous les points du bas du corps sont finis'));
  C.push(check('geometry', 'lower.nondegenerate', '==', A.filter((a) => !a.open && a.kind !== 'line' && Math.abs(area(a.poly)) < 1e-6 * h * h).length, 0, 'aucun atome fermé d’aire nulle'));
  C.push(check('geometry', 'lower.unique-ids', '==', new Set(geo.byId.keys()).size, geo.body.atoms.length + A.length, 'identifiants uniques sur toute la figure (haut + bas)'));
  C.push(check('geometry', 'lower.parents-exist', '==', A.filter((a) => a.parent !== null && !geo.byId.has(a.parent)).length, 0, 'chaque parent existe (le tronc est ancêtre du bassin)'));
  C.push(check('anatomy', 'lower.level-monotonic', '==', A.filter((a) => { const q = a.parent === null ? undefined : geo.byId.get(a.parent); return q !== undefined && q.level > a.level; }).length, 0, 'un enfant n’est jamais d’un niveau plus grossier que son parent'));
  C.push(check('geometry', 'lower.parts-in-contracts', '==', [...new Set(A.map((a) => a.part))].filter((x) => !(x in LOWER_CONTRACTS)).length, 0, 'chaque atome appartient à un composant du contrat'));
  const outside = A.filter((a) => (a.kind === 'muscle' || a.kind === 'fat') && !a.open && a.level >= 1 && a.view === 'front').filter((a) => {
    const c = centroid(a.poly);
    for (let q = a.parent === null ? undefined : geo.byId.get(a.parent); q; q = q.parent === null ? undefined : geo.byId.get(q.parent)) if (!q.open && inPoly(q.poly, c.x, c.y)) return false;
    return true;
  }).length;
  C.push(check('geometry', 'lower.containment', '==', outside, 0, 'muscles et masses visibles : barycentre dans l’enveloppe'));
  const pl = lp.pose.left, pr = lp.pose.right;
  if (JSON.stringify(pl) === JSON.stringify(pr)) {
    let worst = 0;
    for (const a of A) if (a.id.endsWith('.L')) { const r = geo.byId.get(`${a.id.slice(0, -2)}.R`); if (!r) { worst = Infinity; continue; } const b1 = box(a.poly), b2 = box(r.poly); worst = Math.max(worst, Math.abs(b1.x0 + b2.x1), Math.abs(b1.x1 + b2.x0), Math.abs(b1.y0 - b2.y0), Math.abs(b1.y1 - b2.y1)); }
    C.push(check('geometry', 'lower.symmetry', '<=', worst / h, 1e-6, 'poses identiques ⇒ gauche et droite sont des miroirs exacts'));
  }
  const tor = box(geo.byId.get('torso.shell')!.poly), pel = box(geo.byId.get('pelvis.shell')!.poly), th = box(geo.byId.get('leg.thigh.L')!.poly);
  C.push(check('geometry', 'lower.pelvis-attached', '>=', Math.min(tor.y1, pel.y1) - Math.max(tor.y0, pel.y0), 0.03 * h, 'le bassin recouvre le bas du tronc'));
  C.push(check('geometry', 'lower.thigh-attached', '>=', Math.min(pel.y1, th.y1) - Math.max(pel.y0, th.y0), 0.1 * h, 'la cuisse recouvre le bassin (attache de la hanche)'));
  const sh = box(geo.byId.get('leg.shin.L')!.poly), ft = box(geo.byId.get('foot.dorsum.L')!.poly);
  C.push(check('geometry', 'lower.foot-attached', '>=', Math.min(sh.y1, ft.y1) - Math.max(sh.y0, ft.y0), 0.01 * h, 'le pied recouvre le bas de la jambe'));
  if (pl.kneeFlex === 0 && pr.kneeFlex === 0) {
    const low = Math.max(...A.filter((a) => a.id.startsWith('foot.toe.')).flatMap((a) => a.poly.map((q) => q.y)));
    C.push(check('geometry', 'lower.on-ground', '<=', Math.abs(low - f.y.sole) / h, 0.1, 'jambes tendues : les orteils touchent la ligne du sol (±0,1 h)'));
  }
  // anatomie
  const ct = canonAt(p.age);
  C.push(check('anatomy', 'lower.heads-canon', '<=', Math.abs(M('heads') - ct.heads), 0.3, 'hauteur totale (tête → sol) = canon de l’âge ± 0,3 tête'));
  const band: Record<string, [number, number]> = { baby: [0.3, 0.47], child: [0.4, 0.54], teen: [0.44, 0.57], adult: [0.45, 0.57], elder: [0.43, 0.56] };
  const [bl, bh] = band[st] as [number, number];
  C.push(check('anatomy', 'lower.leg-share-min', '>=', M('crotchHeight'), bl, `jambes ≥ ${bl} de la hauteur au stade « ${st} »`));
  C.push(check('anatomy', 'lower.leg-share-max', '<=', M('crotchHeight'), bh, `jambes ≤ ${bh} de la hauteur au stade « ${st} »`));
  C.push(check('anatomy', 'lower.thigh-shin-min', '>=', M('thighToShin'), 0.9, 'cuisse ≥ 0,9 × jambe'));
  C.push(check('anatomy', 'lower.thigh-shin-max', '<=', M('thighToShin'), 1.4, 'cuisse ≤ 1,4 × jambe'));
  C.push(check('anatomy', 'lower.foot-head-min', '>=', M('footToHead'), 0.5, 'pied ≥ 0,5 tête'));
  C.push(check('anatomy', 'lower.foot-head-max', '<=', M('footToHead'), 1.2, 'pied ≤ 1,2 tête'));
  C.push(check('anatomy', 'lower.taper-knee', '<=', M('kneeWidth'), M('thighWidth') / 1.04, 'genou plus étroit que la mi-cuisse'));
  C.push(check('anatomy', 'lower.taper-ankle', '<=', M('ankleWidth'), M('calfWidth') / 1.25, 'cheville plus fine que le mollet'));
  C.push(check('anatomy', 'lower.foot-wider-ankle', '>=', M('footWidth'), M('ankleWidth') * 1.2, 'le pied est plus large que la cheville'));
  for (const s of ['L', 'R'] as const) {
    C.push(check('anatomy', `lower.toes.${s}`, '==', A.filter((a) => /^foot\.toe\.[1-5]\./.test(a.id) && a.side === s).length, 5, `pied ${s} : 5 orteils`));
    C.push(check('anatomy', `lower.phalanges.${s}`, '==', A.filter((a) => /^toe\.\w+\.(prox|mid|dist)\./.test(a.id) && a.side === s).length, 14, `pied ${s} : 14 phalanges (2 + 4 × 3)`));
  }
  C.push(check('anatomy', 'lower.neutral-pelvis', '==', A.filter((a) => /genit|penis|vulva|scrot|labia/.test(a.id)).length, 0, 'garde-fou : aucun atome génital (contour neutre à la fourche)'));
  C.push(check('anatomy', 'lower.level-coverage', '>=', new Set(A.map((a) => a.level)).size, 4, 'les 4 niveaux de présentation sont peuplés'));
  if (f.body.pub > 0.95 && f.body.dim < -0.6 && p.adiposity < 0.6) C.push(check('anatomy', 'lower.female-pelvis', '>=', M('hipToThigh'), 1.1, 'silhouette féminine adulte : bassin ≥ 1,1 × mi-cuisse', 'warn'));
  if (markup) {
    const svg = markup.back + markup.front;
    C.push(check('style', 'lower.no-filter', '==', (svg.match(/<filter/g) ?? []).length, 0, 'aucun filtre SVG'));
    C.push(check('style', 'lower.stroke-budget', '<=', new Set([...svg.matchAll(/stroke-width="([^"]+)"/g)].map((x) => x[1])).size, 16, 'épaisseurs de trait en nombre limité', 'warn'));
    C.push(check('style', 'lower.svg-weight', '<=', svg.length, 600_000, 'poids du SVG de la figure ≤ 600 Ko', 'warn'));
  }
  return report(C);
}

import { luminance, darken } from '../core/color';
import { BODY_CONTRACTS } from '../body/contracts';
import { canonAt, stageOf } from '../body/canon';
import type { BodyGeo } from '../body/geometry';
import type { BodyMarkup } from '../body/render';
import { area, box, centroid, inPoly } from '../body/shape';
import type { Atom } from '../body/types';
import { check, report, type Check, type Report } from './types';

/**
 * VÉRIFICATION DU RENDU DU CORPS — les trois couches demandées, toutes chiffrées :
 *  - `geometry` : cohérence géométrique (finitude, non-dégénérescence, hiérarchie, confinement, symétrie, attaches) ;
 *  - `anatomy`  : cohérence anatomique (bandes de proportions PAR ÂGE, dimorphisme gaté par la puberté, segments, doigts, garde-fou mineurs) ;
 *  - `style`    : style artistique (sans filtre, contraste du trait, budget de traits et de poids).
 * Les bandes sont des CONVENTIONS D'ATELIER (canon.ts), pas des mesures de population : un contrôle hors bande est un défaut de dessin, pas de biologie.
 */
export function verifyBody(geo: BodyGeo, markup?: BodyMarkup, skin = '#c99a76'): Report {
  const f = geo.frame, h = f.h, p = geo.params, m = geo.measures, A = geo.atoms;
  const C: Check[] = [];
  const bad = A.filter((a) => a.poly.some((q) => !Number.isFinite(q.x) || !Number.isFinite(q.y))).length;
  C.push(check('geometry', 'body.finite', '==', bad, 0, 'tous les points de tous les atomes sont finis'));
  const degenerate = A.filter((a) => !a.open && a.kind !== 'line' && Math.abs(area(a.poly)) < 1e-6 * h * h).length;
  C.push(check('geometry', 'body.nondegenerate', '==', degenerate, 0, 'aucun atome fermé d’aire nulle'));
  const ids = new Set(A.map((a) => a.id));
  C.push(check('geometry', 'body.unique-ids', '==', ids.size, A.length, 'identifiants d’atomes uniques'));
  const orphans = A.filter((a) => a.parent !== null && !geo.byId.has(a.parent)).length;
  C.push(check('geometry', 'body.parents-exist', '==', orphans, 0, 'chaque parent d’atome existe'));
  const depth = (a: Atom): number => { let d = 0, c: Atom | undefined = a; while (c && c.parent !== null && d < 30) { c = geo.byId.get(c.parent); d++; } return d; };
  C.push(check('geometry', 'body.acyclic', '<=', Math.max(...A.map(depth)), 20, 'hiérarchie sans cycle, profondeur ≤ 20'));
  const levelViol = A.filter((a) => { const q = a.parent === null ? undefined : geo.byId.get(a.parent); return q !== undefined && q.level > a.level; }).length;
  C.push(check('anatomy', 'body.level-monotonic', '==', levelViol, 0, 'hiérarchie de présentation : un enfant n’est jamais d’un niveau plus grossier que son parent'));
  const parts = new Set(A.map((a) => a.part));
  const unknown = [...parts].filter((x) => !(x in BODY_CONTRACTS)).length;
  C.push(check('geometry', 'body.parts-in-contracts', '==', unknown, 0, 'chaque atome appartient à un composant du contrat'));
  // Confinement : le barycentre d'un muscle / d'une masse tombe dans son plus proche ancêtre « peau » ou masse (le dessin ne sort pas de son enveloppe).
  const outside = A.filter((a) => (a.kind === 'muscle' || a.kind === 'fat') && !a.open && a.level >= 1 && a.view === 'front').filter((a) => {
    const c = centroid(a.poly);
    for (let q = a.parent === null ? undefined : geo.byId.get(a.parent); q; q = q.parent === null ? undefined : geo.byId.get(q.parent)) if (!q.open && inPoly(q.poly, c.x, c.y)) return false;
    return true;
  }).length;
  C.push(check('geometry', 'body.containment', '==', outside, 0, 'les muscles et masses visibles restent dans leur enveloppe'));
  const sym = p.pose.left.abduction === p.pose.right.abduction && JSON.stringify({ ...p.pose.left }) === JSON.stringify({ ...p.pose.right });
  if (sym) {
    let worst = 0;
    for (const a of A) if (a.id.endsWith('.L')) {
      const r = geo.byId.get(`${a.id.slice(0, -2)}.R`);
      if (!r) { worst = Infinity; continue; }
      const b1 = box(a.poly), b2 = box(r.poly);
      worst = Math.max(worst, Math.abs(b1.x0 + b2.x1), Math.abs(b1.x1 + b2.x0), Math.abs(b1.y0 - b2.y0), Math.abs(b1.y1 - b2.y1));
    }
    C.push(check('geometry', 'body.symmetry', '<=', worst / h, 1e-6, 'pose symétrique ⇒ gauche et droite sont des miroirs exacts'));
  }
  const tor = geo.byId.get('torso.shell')!, ua = geo.byId.get('arm.upper.L')!, tb = box(tor.poly), ub = box(ua.poly);
  C.push(check('geometry', 'body.arm-attached', '>=', Math.min(tb.x1, ub.x1) - Math.max(tb.x0, ub.x0), 0.05 * h, 'le bras recouvre le tronc (attache à l’épaule)'));
  C.push(check('geometry', 'body.neck-join', '>=', box(tor.poly).x1 - f.a.baseHalf, 0, 'le tronc est plus large que la base du cou'));

  const st = stageOf(p.age), lo: Record<string, [number, number]> = { baby: [1.0, 1.8], child: [1.2, 2.1], teen: [1.5, 2.4], adult: [1.6, 2.7], elder: [1.5, 2.6] };
  const [sl, sh] = lo[st] as [number, number];
  const M = (k: string): number => m[k] as number;
  C.push(check('anatomy', 'body.shoulder-band', '>=', M('shoulderWidth'), sl, `largeur d’épaules ≥ ${sl} h au stade « ${st} »`));
  C.push(check('anatomy', 'body.shoulder-band-max', '<=', M('shoulderWidth'), sh, `largeur d’épaules ≤ ${sh} h au stade « ${st} »`));
  C.push(check('anatomy', 'body.prepubertal-neutral', '<=', p.age <= 10 ? Math.abs(f.dim) : 0, 1e-9, 'avant 10 ans le sexe n’a AUCUN effet sur la silhouette'));
  if (f.pub > 0.95 && f.dim > 0.6 && p.adiposity < 0.6) C.push(check('anatomy', 'body.male-taper', '<=', M('hipToShoulder'), 0.78, 'silhouette masculine adulte non obèse : hanches ≤ 0,78 × épaules (le V s’efface avec l’adiposité, comme la bande féminine)', 'warn'));
  if (f.pub > 0.95 && f.dim < -0.6 && p.adiposity < 0.6) C.push(check('anatomy', 'body.female-hip', '>=', M('hipToShoulder'), 0.56, 'silhouette féminine adulte : hanches ≥ 0,56 × épaules', 'warn'));
  C.push(check('anatomy', 'body.upper-fore-ratio', '>=', M('upperToFore'), 1.0, 'bras ≥ avant-bras'));
  C.push(check('anatomy', 'body.upper-fore-ratio-max', '<=', M('upperToFore'), 1.6, 'bras ≤ 1,6 × avant-bras'));
  C.push(check('anatomy', 'body.hand-fore-ratio', '>=', M('handToFore'), 0.5, 'main ≥ 0,5 × avant-bras'));
  C.push(check('anatomy', 'body.hand-fore-ratio-max', '<=', M('handToFore'), 0.95, 'main ≤ 0,95 × avant-bras'));
  C.push(check('anatomy', 'body.limb-taper', '<=', M('wristWidth'), M('foreWidth') * 0.9, 'poignet ≤ 0,9 × avant-bras'));
  C.push(check('anatomy', 'body.limb-taper-2', '<=', M('foreWidth'), M('armWidth') * 1.02, 'avant-bras ≤ bras'));
  C.push(check('anatomy', 'body.shoulder-gt-neck', '>=', M('shoulderToNeck'), 1.9, 'épaules ≥ 1,9 × demi-largeur du cou'));
  for (const s of ['L', 'R'] as const) {
    const segs = A.filter((a) => a.id.startsWith('finger.') && /\.(prox|mid|dist|meta)\.[LR]$/.test(a.id) && a.side === s).length;
    C.push(check('anatomy', `body.fingers.${s}`, '==', segs, 15, `main ${s} : 5 doigts × 3 segments`));
  }
  const minorBreast = p.age < 18 ? A.filter((a) => a.id.startsWith('breast')).length : 0;
  C.push(check('anatomy', 'body.minor-no-breast', '==', minorBreast, 0, 'garde-fou : aucun atome de sein avant 18 ans'));
  C.push(check('anatomy', 'body.level-coverage', '>=', new Set(A.map((a) => a.level)).size, 4, 'les 4 niveaux de présentation sont peuplés'));
  const ct = canonAt(p.age);
  C.push(check('anatomy', 'body.heads-canon', '==', M('heads'), ct.heads, 'nombre de têtes = canon de l’âge'));

  if (markup) {
    const svg = markup.back + markup.front;
    C.push(check('style', 'body.no-filter', '==', (svg.match(/<filter/g) ?? []).length, 0, 'aucun filtre SVG : le coût d’un corps est ses chemins'));
    const widths = new Set([...svg.matchAll(/stroke-width="([^"]+)"/g)].map((x) => x[1]));
    C.push(check('style', 'body.stroke-budget', '<=', widths.size, 12, 'épaisseurs de trait en nombre limité (trait homogène)', 'warn'));
    const ink = darken(skin, 0.62);
    C.push(check('style', 'body.ink-contrast', '>=', Math.abs(luminance(skin) - luminance(ink)), 0.2, 'contraste trait / peau suffisant'));
    C.push(check('style', 'body.svg-weight', '<=', svg.length, 400_000, 'poids du SVG du corps ≤ 400 Ko', 'warn'));
  }
  return report(C);
}

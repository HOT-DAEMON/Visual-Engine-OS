import { joinGap } from './branch';
import { emergenceContinuity } from './emerge';
import { analyzeComposition, type Composition } from './compose';
import { landmarks, project, type HeadSpec, type View } from './head';
import { allowedCrossings, coversEye, coversFace, spineCrossings, visibleMarks, type Defect } from './lock-check';
import type { LockSpec } from './lock';
import { paintLock, type PaintedLock } from './paint';
import type { Check, Report } from './verify';
import { headOutline, misLayeredLocks, visibility, type Visibility } from './visibility';
import { v3, type V2 } from './vec';

export type { Defect };

/**
 * COUCHE DE VÉRIFICATION DU RENDU — trois couches indépendantes (géométrie · anatomie · style) qui, en plus des mesures de `verify.ts`,
 * LOCALISENT chaque défaut : quelle mèche, quelle famille, quelle gravité. Cette localisation nourrit le cycle de réparation (`repair.ts`).
 * Les seuils sont des garde-fous calibrés sur les coiffures de la grammaire, pas des preuves de ressemblance.
 */
export interface Verdict { readonly reports: Report[]; readonly defects: Defect[]; readonly ok: boolean; readonly score: number; readonly composition: Composition; /** Visibilité par ordre de peinture (seulement si `opts.visibility`). */ readonly visibility?: Visibility }

const chk = (name: string, value: number, min: number, max: number): Check => ({ name, value, min, max, ok: Number.isFinite(value) && value >= min && value <= max });

/**
 * Options de vérification dérivées de l'INTENTION. Un vent fort (`wind`, 0–1) impose une coiffure asymétrique et une calotte en partie découverte :
 * les seuils d'équilibre G/D et de calotte, justes sans vent, y seraient de faux défauts qu'aucune mèche ne peut corriger sans détruire l'intention.
 * Relâchement borné et proportionnel au vent ; sans vent, les seuils sont ceux d'origine (0,4 et 0,7).
 */
export interface VerifyOpts { readonly wind?: number; /** Mesure aussi la part visible de chaque lame (trame d'ordre de peinture, ≈ 15 ms) et la rapporte dans `Verdict.visibility`. */ readonly visibility?: boolean }
export const balanceLimit = (wind = 0): number => 0.4 + 0.35 * Math.min(1, Math.max(0, wind));
export const domeLimit = (wind = 0): number => 0.7 - 0.25 * Math.min(1, Math.max(0, wind));

export function verifyComposed(h: HeadSpec, specs: readonly LockSpec[], view: View, painted: readonly PaintedLock[] = specs.map((L) => paintLock(h, L, view)), comp: Composition = analyzeComposition(h, specs, view, painted), opts: VerifyOpts = {}): Verdict {
  const D: Defect[] = []; const G: Check[] = []; const A: Check[] = []; const S: Check[] = [];
  const byId = new Map(specs.map((s) => [s.id, s]));
  // ── Géométrie : finitude, lames dégénérées, auto-intersection de l'axe, continuité d'émergence.
  let bad = 0; let deg = 0; let selfX = 0; let emBad = 0;
  painted.forEach((p) => {
    const pts = [...p.blade.spine, ...p.blade.left, ...p.blade.right];
    if (pts.some((q) => !Number.isFinite(q.x) || !Number.isFinite(q.y))) { bad++; D.push({ code: 'geom.finite', layer: 'geometry', lock: p.spec.id, family: p.spec.family, severity: 3, detail: 'point non fini' }); return; }
    const first = p.blade.spine[0] as V2; const last = p.blade.spine.at(-1) as V2;
    if (Math.hypot(last.x - first.x, last.y - first.y) < 0.05 * view.s) { deg++; D.push({ code: 'geom.degenerate', layer: 'geometry', lock: p.spec.id, family: p.spec.family, severity: 2, detail: 'axe plus court que 5 % de la hauteur de tête' }); }
    const x = spineCrossings(p.blade.spine);
    if (x > allowedCrossings(p.spec)) { selfX++; D.push({ code: 'geom.self', layer: 'geometry', lock: p.spec.id, family: p.spec.family, severity: p.layer === 'back' ? 0.25 : 1, detail: `${x} auto-intersection(s) de l'axe` }); }
    const par = p.spec.parent && byId.get(p.spec.parent.id);
    if (par) { const c = emergenceContinuity(h, par, p.spec); if (c.gap > 0.01 || c.angleDeg > 12 || c.widthRatio > 0.5) { emBad++; D.push({ code: 'geom.emerge', layer: 'geometry', lock: p.spec.id, family: p.spec.family, severity: 2, detail: `jonction : écart ${c.gap.toFixed(3)}, angle ${c.angleDeg.toFixed(0)}°, largeur ${c.widthRatio.toFixed(2)}` }); } }
  });
  // Cohérence d'étagement : une mèche peinte AU-DESSUS du visage alors qu'elle est derrière le crâne (voir `visibility.ts`).
  const mis = misLayeredLocks(painted, headOutline(h, view));
  for (const i of mis) { const p = painted[i] as PaintedLock; D.push({ code: 'geom.layer', layer: 'geometry', lock: p.spec.id, family: p.spec.family, severity: 1, detail: 'peinte devant le visage alors qu\'elle est derrière le crâne' }); }
  // Jonctions : la pointe d'une mèche qui en REJOINT une autre doit arriver sur elle (écart ≤ 0,02 H).
  let joinBad = 0;
  for (const p of painted) { const tg = p.spec.join && byId.get(p.spec.join.id); if (!tg || !p.spec.join) continue; const gap = joinGap(h, p.spec, tg, p.spec.join.t); if (gap > 0.02) { joinBad++; D.push({ code: 'geom.join', layer: 'geometry', lock: p.spec.id, family: p.spec.family, severity: 1, detail: `la pointe manque sa cible de ${gap.toFixed(3)} H` }); } }
  G.push(chk('jonctions manquées (pointe ≠ cible)', joinBad, 0, 0));
  G.push(chk('mèches non finies', bad, 0, 0), chk('lames dégénérées', deg, 0, 0), chk('axes qui se coupent (sans programme)', selfX, 0, 0), chk('émergences discontinues', emBad, 0, 0), chk('mèches peintes devant alors qu\'elles sont derrière', mis.length, 0, 0));
  const vis = opts.visibility ? visibility(h, view, painted) : undefined;
  if (vis) { const front = painted.filter((p) => p.layer !== 'back').length; const burFront = vis.buried.filter((i) => (painted[i] as PaintedLock).layer !== 'back'); G.push(chk('part des mèches de devant entièrement enfouies', front ? burFront.length / front : 0, 0, 0.3)); }
  // ── Anatomie : yeux, nez et bouche non recouverts, calotte couverte, proportions, équilibre.
  // Seuls les repères VISIBLES comptent : au-delà de ≈ 55° de lacet l'œil lointain est caché par la tête (mesuré : sans ce filtre, `anat.eye` passait de
  // 0,75 à 2 défauts par coiffure entre 0° et 75°, presque tous sur un œil que personne ne voit).
  const lm = landmarks(h); const marks = visibleMarks(h, view);
  let eyeHit = 0;
  for (const e of marks.eyes) { const cov = painted.filter((p) => coversEye(p, e)); if (cov.length) { eyeHit++; for (const w of cov) D.push({ code: 'anat.eye', layer: 'anatomy', lock: w.spec.id, family: w.spec.family, severity: 2, detail: 'recouvre le centre d\'un œil' }); } }
  A.push(chk('yeux recouverts', eyeHit, 0, 0));
  // UN défaut par mèche qui recouvre le repère (et non seulement la dernière) : sinon, quand deux mèches le couvrent, corriger l'une ne baisse pas le score
  // et le cycle de réparation, qui exige une baisse stricte, abandonne sans jamais essayer l'autre (observé à ±75°).
  // Nez et bouche : une mèche de devant qui recouvre le bout du nez ou le centre de la bouche est une erreur d'anatomie (une frange couvre le front, pas le visage).
  let faceHit = 0;
  for (const { name, q } of marks.face) {
    const cov = painted.filter((p) => coversFace(p, q));
    if (cov.length) { faceHit++; for (const w of cov) D.push({ code: 'anat.face', layer: 'anatomy', lock: w.spec.id, family: w.spec.family, severity: 2, detail: `recouvre ${name}` }); }
  }
  A.push(chk('nez / bouche recouverts', faceHit, 0, 0));
  const c0 = project(view, v3(0, 0, h.cz)); const rx = h.rx * view.s; const ry = h.ry * view.s; const eyeY = project(view, lm.eyeR).y; let dome = 0; let domeCov = 0;
  const g = comp.grid;
  for (let y = 0; y < g.ny; y++) for (let x = 0; x < g.nx; x++) { const px = (x + 0.5) * g.cell; const py = (y + 0.5) * g.cell; if (py > eyeY - 0.12 * view.s) continue; if (((px - c0.x) / rx) ** 2 + ((py - c0.y) / ry) ** 2 > 0.8) continue; dome++; if (g.data[y * g.nx + x]) domeCov++; }
  const domeRatio = dome ? domeCov / dome : 1;
  const dLim = domeLimit(opts.wind); const bLim = balanceLimit(opts.wind);
  if (domeRatio < dLim) D.push({ code: 'anat.dome', layer: 'anatomy', severity: 2, detail: `calotte couverte à ${(domeRatio * 100).toFixed(0)} %` });
  A.push(chk('calotte couverte', domeRatio, dLim, 1));
  let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; for (const p of painted) for (const q of [...p.blade.left, ...p.blade.right]) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); }
  A.push(chk('largeur cheveux / largeur tête', (x1 - x0) / (2 * rx), 0.9, 2.6), chk('hauteur du volume au-dessus du crâne (H)', (c0.y - ry - y0) / view.s, -0.1, 0.5));
  if (Math.abs(comp.balance.moment) > bLim) D.push({ code: 'anat.balance', layer: 'anatomy', severity: 1, detail: `moment G/D ${comp.balance.moment.toFixed(2)}` });
  A.push(chk('équilibre G/D (moment)', comp.balance.moment, -bLim, bLim));
  // ── Style : lisibilité de la direction, hiérarchie, espaces négatifs intentionnels, variété, croisements.
  S.push(chk('cohérence de lecture', comp.reading.coherence, 0.3, 1), chk('part de la masse dominante', comp.hierarchy.dominantShare, 0.25, 0.8), chk('rapport dominante / seconde', comp.hierarchy.ratio, 1.15, 50));
  if (comp.reading.coherence < 0.3) D.push({ code: 'style.coherence', layer: 'style', severity: 1, detail: 'direction de lecture illisible' });
  if (comp.hierarchy.dominantShare < 0.25) D.push({ code: 'style.hierarchy', layer: 'style', severity: 1, detail: 'aucune masse ne domine' });
  const small = comp.negative.gaps.filter((b) => b.cells < 4); S.push(chk('trous parasites (part des espaces négatifs)', comp.negative.speckle, 0, 0.85));
  if (comp.negative.speckle > 0.85 && small[0]) { let best: PaintedLock | null = null; let bd = Infinity; for (const p of painted) { const t = p.blade.spine.at(-1) as V2; const d = Math.hypot(t.x - (small[0] as { cx: number }).cx, t.y - (small[0] as { cy: number }).cy); if (d < bd) { bd = d; best = p; } } D.push({ code: 'style.speckle', layer: 'style', ...(best ? { lock: best.spec.id, family: best.spec.family } : {}), severity: 1, detail: 'trop de petits trous' }); }
  const widths = painted.map((p) => p.spec.width); const mw = widths.reduce((a, b) => a + b, 0) / Math.max(1, widths.length); const cv = Math.sqrt(widths.reduce((a, b) => a + (b - mw) ** 2, 0) / Math.max(1, widths.length)) / Math.max(1e-9, mw);
  S.push(chk('variété des largeurs (CV)', cv, 0.1, 0.9));
  const crossPer = comp.relations.filter((e) => e.kind === 'cross').reduce((a, e) => a + e.weight, 0) / Math.max(1, painted.length); S.push(chk('croisements francs par mèche', crossPer, 0, 3));
  const reports: Report[] = [{ layer: 'geometry', checks: G, ok: G.every((c) => c.ok) }, { layer: 'anatomy', checks: A, ok: A.every((c) => c.ok) }, { layer: 'style', checks: S, ok: S.every((c) => c.ok) }];
  return { reports, defects: D, ok: reports.every((r) => r.ok), score: D.reduce((s, d) => s + d.severity, 0), composition: comp, ...(vis ? { visibility: vis } : {}) };
}

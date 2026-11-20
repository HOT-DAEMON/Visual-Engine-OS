import { emergenceContinuity } from './emerge';
import { analyzeComposition, type Composition } from './compose';
import { landmarks, project, type HeadSpec, type View } from './head';
import type { LockSpec } from './lock';
import { paintLock, type PaintedLock } from './paint';
import { bladeOutline } from './blade';
import { inPoly } from '../face/poly';
import type { Check, Report } from './verify';
import { v3, type V2 } from './vec';

/**
 * COUCHE DE VÉRIFICATION DU RENDU — trois couches indépendantes (géométrie · anatomie · style) qui, en plus des mesures de `verify.ts`,
 * LOCALISENT chaque défaut : quelle mèche, quelle famille, quelle gravité. Cette localisation nourrit le cycle de réparation (`repair.ts`).
 * Les seuils sont des garde-fous calibrés sur les coiffures de la grammaire, pas des preuves de ressemblance.
 */
export interface Defect { readonly code: string; readonly layer: Report['layer']; readonly lock?: string; readonly family?: string; readonly severity: number; readonly detail: string }
export interface Verdict { readonly reports: Report[]; readonly defects: Defect[]; readonly ok: boolean; readonly score: number; readonly composition: Composition }

const chk = (name: string, value: number, min: number, max: number): Check => ({ name, value, min, max, ok: Number.isFinite(value) && value >= min && value <= max });
const segHit = (a: V2, b: V2, c: V2, d: V2): boolean => { const o = (p: V2, q: V2, r: V2): number => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };

export function verifyComposed(h: HeadSpec, specs: readonly LockSpec[], view: View, painted: readonly PaintedLock[] = specs.map((L) => paintLock(h, L, view)), comp: Composition = analyzeComposition(h, specs, view, painted)): Verdict {
  const D: Defect[] = []; const G: Check[] = []; const A: Check[] = []; const S: Check[] = [];
  const byId = new Map(specs.map((s) => [s.id, s]));
  // ── Géométrie : finitude, lames dégénérées, auto-intersection de l'axe, continuité d'émergence.
  let bad = 0; let deg = 0; let selfX = 0; let emBad = 0;
  painted.forEach((p) => {
    const pts = [...p.blade.spine, ...p.blade.left, ...p.blade.right];
    if (pts.some((q) => !Number.isFinite(q.x) || !Number.isFinite(q.y))) { bad++; D.push({ code: 'geom.finite', layer: 'geometry', lock: p.spec.id, family: p.spec.family, severity: 3, detail: 'point non fini' }); return; }
    const first = p.blade.spine[0] as V2; const last = p.blade.spine.at(-1) as V2;
    if (Math.hypot(last.x - first.x, last.y - first.y) < 0.05 * view.s) { deg++; D.push({ code: 'geom.degenerate', layer: 'geometry', lock: p.spec.id, family: p.spec.family, severity: 2, detail: 'axe plus court que 5 % de la hauteur de tête' }); }
    let x = 0; const sp = p.blade.spine; for (let i = 0; i < sp.length - 1; i++) for (let j = i + 2; j < sp.length - 1; j++) if (segHit(sp[i] as V2, sp[i + 1] as V2, sp[j] as V2, sp[j + 1] as V2)) x++;
    if (x > 0 && !p.spec.program) { selfX++; D.push({ code: 'geom.self', layer: 'geometry', lock: p.spec.id, family: p.spec.family, severity: p.layer === 'back' ? 0.25 : 1, detail: `${x} auto-intersection(s) de l'axe` }); }
    const par = p.spec.parent && byId.get(p.spec.parent.id);
    if (par) { const c = emergenceContinuity(h, par, p.spec); if (c.gap > 0.01 || c.angleDeg > 12 || c.widthRatio > 0.5) { emBad++; D.push({ code: 'geom.emerge', layer: 'geometry', lock: p.spec.id, family: p.spec.family, severity: 2, detail: `jonction : écart ${c.gap.toFixed(3)}, angle ${c.angleDeg.toFixed(0)}°, largeur ${c.widthRatio.toFixed(2)}` }); } }
  });
  G.push(chk('mèches non finies', bad, 0, 0), chk('lames dégénérées', deg, 0, 0), chk('axes qui se coupent (sans programme)', selfX, 0, 0), chk('émergences discontinues', emBad, 0, 0));
  // ── Anatomie : yeux non recouverts, calotte couverte, proportions, équilibre.
  const lm = landmarks(h); const eyes = [lm.eyeR, lm.eyeL].map((e) => project(view, e) as V2);
  let eyeHit = 0;
  for (const e of eyes) { const cov = painted.filter((p) => p.spec.family !== 'back' && inPoly(bladeOutline(p.blade), e.x, e.y)); if (cov.length) { eyeHit++; const w = cov[cov.length - 1] as PaintedLock; D.push({ code: 'anat.eye', layer: 'anatomy', lock: w.spec.id, family: w.spec.family, severity: 2, detail: 'recouvre le centre d\'un œil' }); } }
  A.push(chk('yeux recouverts', eyeHit, 0, 0));
  const c0 = project(view, v3(0, 0, h.cz)); const rx = h.rx * view.s; const ry = h.ry * view.s; const eyeY = project(view, lm.eyeR).y; let dome = 0; let domeCov = 0;
  const g = comp.grid;
  for (let y = 0; y < g.ny; y++) for (let x = 0; x < g.nx; x++) { const px = (x + 0.5) * g.cell; const py = (y + 0.5) * g.cell; if (py > eyeY - 0.12 * view.s) continue; if (((px - c0.x) / rx) ** 2 + ((py - c0.y) / ry) ** 2 > 0.8) continue; dome++; if (g.data[y * g.nx + x]) domeCov++; }
  const domeRatio = dome ? domeCov / dome : 1;
  if (domeRatio < 0.7) D.push({ code: 'anat.dome', layer: 'anatomy', severity: 2, detail: `calotte couverte à ${(domeRatio * 100).toFixed(0)} %` });
  A.push(chk('calotte couverte', domeRatio, 0.7, 1));
  let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; for (const p of painted) for (const q of [...p.blade.left, ...p.blade.right]) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); }
  A.push(chk('largeur cheveux / largeur tête', (x1 - x0) / (2 * rx), 0.9, 2.6), chk('hauteur du volume au-dessus du crâne (H)', (c0.y - ry - y0) / view.s, -0.1, 0.5));
  if (Math.abs(comp.balance.moment) > 0.4) D.push({ code: 'anat.balance', layer: 'anatomy', severity: 1, detail: `moment G/D ${comp.balance.moment.toFixed(2)}` });
  A.push(chk('équilibre G/D (moment)', comp.balance.moment, -0.4, 0.4));
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
  return { reports, defects: D, ok: reports.every((r) => r.ok), score: D.reduce((s, d) => s + d.severity, 0), composition: comp };
}

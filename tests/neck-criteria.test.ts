import { describe, expect, it } from 'vitest';
import { generateRandomFace, SceneSpec } from '../src';
import { anchorFromFace } from '../src/body/anchor';
import { faceLandmarks } from '../src/face';
import { neckModelFor, frontSilhouette, secondaryStep, secondaryTrack, SECONDARY_DEFAULT } from '../src/neck';
import { sectionPoint } from '../src/neck/geometry';
import { detailGain, effectiveStyle } from '../src/neck/style';
import { engineHead } from '../src/head-turntable/engines/face-model';
import { ENGINE_FIT } from '../src/head-turntable/engines/engine-fit';
import { neckSection, neckTopY } from '../src/head-turntable/engines/neck3d';
import { FaceParams } from '../src/schema';
import { cellSvg } from '../scripts/lib/board';
import { neckPatch } from '../scripts/lib/neck-cases';
import { checkNeckModel } from '../src/verify/neck';
import { rasterPng } from '../scripts/lib/raster';
import { decodePng } from '../src/regression/png';

/** Critères de réussite du TODO §10, un test par critère (les critères visuels sont dans artefacts/neck). */
function build(neck: Record<string, unknown> = {}, face: Record<string, unknown> = {}, yaw = 0) {
  const f = generateRandomFace(321, { id: 'f', neck: { visible: true } } as never);
  const host = (SceneSpec.parse({ width: 800, height: 800, background: null, objects: f.objects }) as { objects: { face?: Record<string, unknown> }[] }).objects[0]!;
  const raw = host.face as Record<string, unknown>;
  const p = FaceParams.parse({ ...raw, ...face, neck: { ...(raw.neck as object), visible: true, ...neck } });
  const lm = faceLandmarks(p, 400, 520);
  return { p, lm, m: neckModelFor(p, lm, yaw) };
}
const sys = (s: Record<string, unknown>, flat: Record<string, unknown> = {}) => ({ ...flat, system: s });
const errors = (m: ReturnType<typeof build>['m']) => checkNeckModel(m).filter((c) => !c.ok && c.severity === 'error').map((c) => c.id);

describe('critères §10 — longueur, largeur, rotation, compression', () => {
  it('changement de longueur : les ancrages restent, la surface reste continue (pas de marche entre stations)', () => {
    for (const length of [0.06, 0.2, 0.5, 1.2]) {
      const { m, lm } = build({ length });
      expect(m.stations[0]!.y).toBeCloseTo(lm.neck.topY, 6);
      expect(m.stations.at(-1)!.y).toBeCloseTo(lm.H / 2 + length * lm.H, 6);
      // Continuité = pente bornée (|Δa/Δy| ≤ 2,5), pas un pas fixe : un cou très court a un évasement plus raide mais jamais discontinu.
      for (let i = 1; i < m.stations.length; i++) expect(Math.abs(m.stations[i]!.aR - m.stations[i - 1]!.aR) / (m.stations[i]!.y - m.stations[i - 1]!.y)).toBeLessThan(2.5);
      expect(errors(m), `length ${length}`).toEqual([]);
    }
  });
  it('changement de largeur : topWidth change la largeur SEULE (profondeur intacte) ; FaceNeck.width entraîne la profondeur — contrainte explicite', () => {
    const a = build().m.stations[0]!, b = build(sys({ dimensions: { topWidth: 0.7 } })).m.stations[0]!;
    expect(b.aR).toBeLessThan(a.aR * 0.8);
    expect(b.bF).toBeCloseTo(a.bF, 6); expect(b.bB).toBeCloseTo(a.bB, 6);
    const c = build({ width: 0.55 }).m.stations[0]!;
    expect(c.aR).toBeGreaterThan(a.aR); expect(c.bF).toBeGreaterThan(a.bF);
    const d = build(sys({ dimensions: { depthRatio: 1.4 } })).m.stations[0]!;
    expect(d.bF).toBeGreaterThan(a.bF * 1.5); expect(d.aR).toBeCloseTo(a.aR, 6);
  });
  it('rotation de la tête : balayage 0→80° sans rupture (largeur projetée continue, valeurs finies, aucune erreur de vérification)', () => {
    let prev: number | null = null;
    for (let yaw = 0; yaw <= 80; yaw += 10) {
      const { m } = build({}, {}, yaw), s = frontSilhouette(m), i = Math.floor(m.stations.length / 4);
      const w = s.right[i]!.x - s.left[i]!.x;
      expect(Number.isFinite(w)).toBe(true);
      if (prev !== null) expect(Math.abs(w - prev) / m.composition.morphology.aTop).toBeLessThan(0.1);
      prev = w;
      expect(errors(m), `yaw ${yaw}`).toEqual([]);
    }
  });
  it('compression extrême : plis et volumes réagissent selon la stratégie, la base remonte avec le corps', () => {
    const n = build(), c = build(sys({ pose: { compression: 1 }, operators: [{ op: 'local_compression', amount: 1, at: 0.5, span: 0.6, side: 0 }] }));
    expect(Math.max(...c.m.fields.fold)).toBeGreaterThan(Math.max(...n.m.fields.fold) * 2);
    expect(c.m.fields.compression.reduce((s, v) => s + v, 0) / c.m.fields.compression.length).toBeGreaterThan(0.5);
    expect(c.m.stations.at(-1)!.y).toBeLessThan(n.m.stations.at(-1)!.y - 30);
    expect(errors(c.m)).toEqual([]);
  });
});

describe('critères §10 — raccord cou-torse, style, matériau, accessoires', () => {
  it('transition cou-torse : l\'ancre du corps a EXACTEMENT la largeur de la dernière section du cou, y compris avec évasement, trapèzes et cône exagérés', () => {
    for (const neck of [{}, { flare: 0.6 }, sys({ musculature: { trapezius: 1 }, profile: { taper: 0.8 }, modifiers: { mass: 0.9 } })]) {
      const { p, m } = build(neck), a = anchorFromFace(p, 400, 520), last = m.stations.at(-1)!;
      expect(a.baseHalf).toBeCloseTo((last.aL + last.aR) / 2, 9);
    }
    const { p, lm } = build(), old = lm.neck.half * (1 + p.neck.flare);
    expect(Math.abs(anchorFromFace(p, 400, 520).baseHalf - old) / old).toBeLessThan(0.005);
    const w = build(sys({ musculature: { trapezius: 1 }, profile: { taper: 0.8 } })), oldW = w.lm.neck.half * (1 + w.p.neck.flare);
    expect(Math.abs(anchorFromFace(w.p, 400, 520).baseHalf - oldW) / oldW).toBeGreaterThan(0.05);
  });
  it('passage au style caricatural : l\'écart aux proportions de référence est AMPLIFIÉ (même signe, monotone) et les détails s\'effacent devant la silhouette', () => {
    for (const length of [0.15, 0.5]) {
      const lens = [0, 0.25, 0.5, 0.75, 1].map((e) => build({ length }, {}).m.composition.morphology.lengthPx && build({ length, ...sys({ style: { exaggeration: e } }) }).m.composition.morphology.lengthPx);
      const ref = build({ length: 0.2 }).m.composition.morphology.lengthPx, dev = lens.map((l) => (l as number) - ref);
      expect(Math.sign(dev[0]!)).toBe(Math.sign(dev[4]!));
      for (let i = 1; i < 5; i++) expect(Math.abs(dev[i]!)).toBeGreaterThan(Math.abs(dev[i - 1]!));
    }
    // Plancher : la base du cou ne remonte jamais au-dessus de H/2 + 0,02 H, même à exagération maximale (saturation voulue).
    const floor = build({ length: 0.06, ...sys({ style: { exaggeration: 1 } }) });
    expect(floor.m.stations.at(-1)!.y).toBeCloseTo(floor.lm.H / 2 + 0.02 * floor.lm.H, 6);
    expect(detailGain(effectiveStyle({ mode: 'caricature', exaggeration: 0, simplification: 0, angularity: 0, silhouettePriority: 0.8 }))).toBeLessThan(detailGain(effectiveStyle({ mode: 'realistic', exaggeration: 0, simplification: 0, angularity: 0, silhouettePriority: 0.3 })));
  });
  it('remplacement du matériau : géométrie, rig et pile restent IDENTIQUES', () => {
    const ref = build(sys({ surface: { pattern: 'smooth' } })).m;
    for (const surface of [{ pattern: 'scales' }, { pattern: 'plates' }, { pattern: 'feathers', elementColor: '#d9d2c3' }, { pattern: 'scales', elementColor: '#2f8f4e', layout: 'spiral' }]) {
      const m = build(sys({ surface })).m;
      expect(JSON.stringify(m.stations)).toBe(JSON.stringify(ref.stations));
      expect(JSON.stringify(m.composition.rig)).toBe(JSON.stringify(ref.composition.rig));
      expect(JSON.stringify(m.composition.stack)).toBe(JSON.stringify(ref.composition.stack));
      expect(m.composition.surface.pattern).toBe((surface as { pattern: string }).pattern);
    }
  });
  it('distribution des écailles : les éléments suivent la surface (dans le contour), changent avec la disposition et réagissent à la déformation', () => {
    const origins = (extra: Record<string, unknown>): { pts: [number, number][]; box: [number, number, number, number] } => {
      const c = cellSvg({ seed: 321, patch: neckPatch(sys({ surface: { pattern: 'scales', size: 0.13 }, ...extra })), focus: 'neck' }, 260, 380);
      const pts = [...c.svg.matchAll(/<path d="M(-?[\d.]+) (-?[\d.]+)Q[^"]*" fill="#[0-9a-f]{6}" stroke="#[0-9a-f]{6}" stroke-width="[\d.]+" stroke-opacity="0\.\d+"/g)].map((m) => [+m[1]!, +m[2]!] as [number, number]);
      const m = neckModelFor(c.meta.params, c.meta.lm), s = frontSilhouette(m);
      const x = Math.max(...s.right.map((p) => p.x)) * 1.05, y0 = m.stations[0]!.y, y1 = m.stations.at(-1)!.y;
      return { pts, box: [-x, x, y0, y1 + 2] };
    };
    const rows = origins({}), spiral = origins({ surface: { pattern: 'scales', size: 0.13, layout: 'spiral' } }), bulged = origins({ operators: [{ op: 'local_bulge', amount: 1, at: 0.55, span: 0.4, side: 0 }] });
    expect(rows.pts.length).toBeGreaterThan(40);
    for (const [x, y] of rows.pts) { expect(Math.abs(x)).toBeLessThanOrEqual(rows.box[1] + 1); expect(y).toBeGreaterThanOrEqual(rows.box[2] - 20); expect(y).toBeLessThanOrEqual(rows.box[3] + 20); }
    const key = (o: typeof rows) => o.pts.map((q) => q.map((v) => v.toFixed(1)).join(',')).join('|');
    expect(key(spiral)).not.toBe(key(rows));
    expect(key(bulged)).not.toBe(key(rows));
  });
  it('ajout d\'accessoires : ancrés sur la surface (hors du cou), deux bandes qui se recouvrent sont séparées explicitement', () => {
    const one = build(sys({ attachments: [{ kind: 'collar', at: 0.7, size: 0.5, count: 1, color: '#884422' }] })).m;
    const st = one.stations[Math.round(0.7 * (one.stations.length - 1))]!;
    for (let k = 0; k < 24; k++) { const psi = (k / 24) * 2 * Math.PI - Math.PI, p0 = sectionPoint(st, psi, 0), p1 = sectionPoint(st, psi, 3); expect(Math.hypot(p1.x - st.x, p1.z - st.z)).toBeGreaterThan(Math.hypot(p0.x - st.x, p0.z - st.z)); }
    const two = build(sys({ attachments: [{ kind: 'collar', at: 0.6, size: 0.5, count: 1, color: '#884422' }, { kind: 'scarf', at: 0.6, size: 0.5, count: 1, color: '#2f6fa8' }] })).m;
    const [a, b] = two.composition.graph.attachments;
    expect(b!.at).toBeGreaterThan(a!.at + 0.02);
    expect(two.corrections.some((c) => c.id === 'attachment-collision')).toBe(true);
    expect(JSON.stringify(two.stations.map((s) => s.y))).toBe(JSON.stringify(one.stations.map((s) => s.y)));
  });
  it('reproductibilité du RENDU : même configuration, même graine → même SVG', () => {
    const cfg = neckPatch(sys({ asymmetry: { localVariation: 0.7, seed: 4 }, surface: { pattern: 'scales', variation: 0.6 } }));
    expect(cellSvg({ seed: 321, patch: cfg, focus: 'neck' }, 200, 300).svg).toBe(cellSvg({ seed: 321, patch: cfg, focus: 'neck' }, 200, 300).svg);
  });
});

describe('lumière', () => {
  it('l\'ombrage du cou suit la lumière : l\'écart de luminance droite−gauche change de signe avec l\'azimut', () => {
    const rl = (az: number): number => {
      const c = cellSvg({ seed: 321, patch: neckPatch({ length: 0.5 }), focus: 'neck', light: { azimuthDeg: az, elevationDeg: 50 } } as never, 260, 380), img = decodePng(rasterPng(c.svg)), lm = c.meta.lm;
      const [x0, y0] = c.meta.px(-lm.neck.half * 0.9, lm.chinY + 0.3 * (lm.neck.bottomY - lm.chinY)), [x1, y1] = c.meta.px(lm.neck.half * 0.9, lm.neck.bottomY - 8), mid = (x0 + x1) / 2;
      let L = 0, R = 0, nL = 0, nR = 0;
      for (let y = Math.floor(y0); y < y1; y++) for (let x = Math.floor(x0); x < x1; x++) { const i = (y * img.width + x) * 4, v = 0.3 * img.data[i]! + 0.59 * img.data[i + 1]! + 0.11 * img.data[i + 2]!; if (x < mid) { L += v; nL++; } else { R += v; nR++; } }
      return R / nR - L / nL;
    };
    expect(rl(40)).toBeGreaterThan(10);
    expect(rl(220)).toBeLessThan(-10);
  });
});

describe('critères §10 — rendu 3D, cas limites, mouvement secondaire', () => {
  it('rendu 3D : le backend de la planche tournante lit le même cadre (largeur, exagération, compression passent du contrat commun au maillage)', () => {
    const top = (patch: Record<string, unknown>): number => { const e = engineHead(ENGINE_FIT, patch); return neckSection(e, neckTopY(e) + 0.05, 1.2).a; };
    const base = top({});
    expect(top({ neck: { system: { dimensions: { topWidth: 0.7 } } } })).toBeLessThan(base * 0.8);
    expect(top({ neck: { system: { style: { exaggeration: 1 } }, width: 0.55 } })).not.toBeCloseTo(base, 3);
    expect(top({ neck: { width: 0.5 } })).toBeGreaterThan(base);
  });
  it('cas limites : très court, très fin, courbure maximale, asymétrie extrême, successions de poses — aucune erreur, aucun NaN dans le SVG', () => {
    const cases: Record<string, unknown>[] = [
      { length: 0.06 }, { width: 0.2 }, sys({ species: 'fantasy', profile: { curvature: 1, sCurve: 1 } }), sys({ asymmetry: { leftRightBias: 1, frontBackBias: -1, localVariation: 1 } }),
      sys({ pose: { compression: 1 }, operators: [{ op: 'local_compression', amount: 1, at: 0.3, span: 1, side: 0 }] }),
      sys({ attachments: [{ kind: 'collar', at: 0.5, size: 1, count: 1, color: '#884422' }, { kind: 'scarf', at: 0.52, size: 1, count: 1, color: '#2f6fa8' }, { kind: 'spikes', at: 0.5, size: 1, count: 24, color: '#d6c27a' }] }),
      ...(['fear', 'pride', 'shame', 'defiance', 'fatigue', 'curiosity', 'anger', 'relaxed'] as const).map((e) => sys({ pose: { bodyLanguage: e, bodyLanguageAmount: 1 } })),
    ];
    for (const [i, neck] of cases.entries()) {
      const { m } = build(neck as Record<string, unknown>);
      expect(errors(m), `cas ${i}`).toEqual([]);
      expect(cellSvg({ seed: 321, patch: neckPatch(neck as Record<string, unknown>), focus: 'neck' }, 200, 300).svg, `cas ${i}`).not.toMatch(/NaN|Infinity|undefined/);
    }
  });
  it('M09 : le tissu est un ressort amorti — réponse à une accélération, retour au repos, bornes, déterminisme', () => {
    let s = { x: 0, v: 0 }, peak = 0;
    s = secondaryStep(s, 10, 1 / 60);
    for (let i = 0; i < 240; i++) { s = secondaryStep(s, 0, 1 / 60); peak = Math.max(peak, Math.abs(s.x)); }
    expect(peak).toBeGreaterThan(0.01);
    expect(Math.abs(s.x)).toBeLessThan(peak * 0.2 + 1e-9);
    const step = Array.from({ length: 120 }, (_, i) => (i < 20 ? 0 : 20));
    const a = secondaryTrack(step, 1 / 60), b = secondaryTrack(step, 1 / 60);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(Math.max(...a.map(Math.abs))).toBeGreaterThan(0.01);
    expect(a.every((v) => v >= -1 && v <= 1)).toBe(true);
    expect(Math.abs(a.at(-1)!)).toBeLessThan(0.05);
    expect(SECONDARY_DEFAULT.zeta).toBeLessThan(1);
  });
});

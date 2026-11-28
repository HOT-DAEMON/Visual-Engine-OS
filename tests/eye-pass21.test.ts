import { describe, expect, it } from 'vitest';
import { compileScene, lightVector } from '../src';
import { EyeSpec } from '../src/schema';
import { clearHighlightOfPupil, pupilKeepOut, pupilLightLevel } from '../src/geometry/eye';
import { resolveEye } from '../src/render/eye/eye';
import { highlightOffsets, irisRadii } from '../src/render/eye/helpers';
import { halfVectorXY, toLocal } from '../src/lighting/light';
import { verifyEye } from '../src/verify/eye';

/** PASSE 21 — (1) pli palpébral du fini `cel` rattaché à la paupière ; (2) reflet primaire dégagé des pupilles NON rondes, pupille ronde inchangée. */
const PLAIN = { kind: 'eye', id: 'e', shape: { width: 240, height: 130 } } as Record<string, unknown>;
const svgOf = (finish: string): string => {
  const r = compileScene({ width: 400, height: 280, background: '#ffffff', objects: [{ transform: { x: 200, y: 140 }, ...PLAIN, finish }] } as never) as { ok: boolean; svg: string; issues?: string[] };
  if (!r.ok) throw new Error((r.issues ?? []).join('\n')); return r.svg;
};
const LIGHT = lightVector({ azimuthDeg: 330, elevationDeg: 55, color: '#ffffff', intensity: 1 });
const SHAPES = ['slit_vertical', 'slit_horizontal', 'star', 'diamond', 'polygon', 'cross', 'keyhole'] as const;
const eyeWith = (shape: string, size = 0.34) => EyeSpec.parse({ ...PLAIN, pupil: { shape, size } });

describe('pli de paupière du fini cel (passe 21)', () => {
  it('cel : aplat plein sur la zone du pli (opacité ∝ profondeur) ; flat : aucun remplissage ; shaded : dégradé inchangé', () => {
    const cel = svgOf('cel'), flat = svgOf('flat'), shaded = svgOf('shaded');
    const m = /<path id="[^"]*-crease-fill"[^>]*>/.exec(cel);
    expect(m, 'cel doit émettre -crease-fill').not.toBeNull();
    expect(m![0]).toMatch(/fill="#[0-9a-f]{6}"/i);
    expect(m![0]).not.toMatch(/url\(/);
    const a = Number(/fill-opacity="([\d.]+)"/.exec(m![0])![1]);
    expect(a).toBeGreaterThan(0.1); expect(a).toBeLessThan(0.4);
    expect(flat).not.toMatch(/-crease-fill/);
    expect(shaded).toMatch(/-crease-fill"[^>]*fill="url\(/);
  });
  it('un pli plus profond donne un aplat plus opaque ; sans pli, aucun aplat', () => {
    const at = (crease: object) => {
      const r = compileScene({ width: 400, height: 280, background: '#ffffff', objects: [{ transform: { x: 200, y: 140 }, ...PLAIN, finish: 'cel', lids: { crease } }] } as never) as { svg: string };
      const m = /<path id="[^"]*-crease-fill"[^>]*fill-opacity="([\d.]+)"/.exec(r.svg); return m ? Number(m[1]) : null;
    };
    expect(at({ height: 0.25, depth: 0.9 })!).toBeGreaterThan(at({ height: 0.25, depth: 0.1 })!);
    expect(at({ height: 0, depth: 0.5 })).toBeNull();
  });
});

describe('reflet primaire hors de la pupille non ronde (passe 21)', () => {
  it('pupille ronde simple : aucun dégagement (pupilKeepOut = null) et position historique exacte', () => {
    const e = EyeSpec.parse(PLAIN); expect(pupilKeepOut(e, 100, 100)).toBeNull();
    const { rx, ry } = irisRadii(e), H = halfVectorXY(toLocal(LIGHT, e.transform.rotationDeg));
    const o = highlightOffsets(e, LIGHT).primary;
    expect(o.x).toBeCloseTo(H.x * rx * 0.85, 12); expect(o.y).toBeCloseTo(H.y * ry * 0.85, 12);
  });
  for (const shape of SHAPES) {
    it(`${shape} : le disque primaire ne recouvre plus la pupille, reste dans l'iris et du côté de la lumière`, () => {
      const e = eyeWith(shape), { rx, ry } = irisRadii(e), H = halfVectorXY(toLocal(LIGHT, e.transform.rotationDeg));
      const R = e.highlights.primary.size * rx, o = highlightOffsets(e, LIGHT).primary;
      const keep = pupilKeepOut(e, rx, ry)!; expect(keep).not.toBeNull();
      const d = Math.hypot(o.x, o.y), u = { x: o.x / d, y: o.y / d };
      let reach = 0; for (const c of keep) for (const q of c) reach = Math.max(reach, q.x * u.x + q.y * u.y);
      expect(d).toBeGreaterThanOrEqual(reach + R - 1e-6);                          // ne recouvre pas la pupille (appui dans la direction du reflet)
      expect(Math.hypot(o.x / rx, o.y / ry)).toBeLessThanOrEqual(1 + 1e-9);          // centre dans l'iris
      expect(o.x * H.x + o.y * H.y).toBeGreaterThan(0);                              // côté lumière
      expect(verifyEye({ ...PLAIN, pupil: { shape, size: 0.34 } }).checks.filter((c) => !c.ok && c.severity !== 'warn')).toEqual([]);
    });
  }
  it('clearHighlightOfPupil ne rapproche jamais le reflet du centre et ne bouge pas un reflet déjà dégagé', () => {
    const sq = [{ x: -10, y: -10 }, { x: 10, y: -10 }, { x: 10, y: 10 }, { x: -10, y: 10 }];
    const far = { x: 70, y: 0 }; expect(clearHighlightOfPupil(far, 10, [sq], 100, 100)).toEqual(far);
    const near = { x: 5, y: 5 }, q = clearHighlightOfPupil(near, 10, [sq], 100, 100);
    expect(Math.hypot(q.x, q.y)).toBeGreaterThan(Math.hypot(near.x, near.y));
    expect(clearHighlightOfPupil(near, 10, null, 100, 100)).toEqual(near);
  });
});

describe('lumière de la pupille liée à l’intensité de scène (passe 21)', () => {
  const sceneSvg = (intensity: number, response: object): string => {
    const r = compileScene({ width: 400, height: 280, background: '#ffffff', light: { azimuthDeg: 330, elevationDeg: 55, color: '#ffffff', intensity }, objects: [{ transform: { x: 200, y: 140 }, ...PLAIN, pupil: { size: 0.34, response } }] } as never) as { ok: boolean; svg: string; issues?: string[] };
    if (!r.ok) throw new Error((r.issues ?? []).join('\n')); return r.svg;
  };
  const eyeAt = (i: number, follow: number) => resolveEye(EyeSpec.parse({ ...PLAIN, pupil: { size: 0.34, response: { model: 'circular', light: 0.5, follow } } }), i);
  it('follow = 0 : la taille effective de la pupille ignore l’intensité de scène (valeur historique, avec ou sans intensité)', () => {
    const e = EyeSpec.parse({ ...PLAIN, pupil: { size: 0.34, response: { model: 'circular', light: 0.3, follow: 0 } } });
    expect(resolveEye(e, 0.1).pupil.size).toBe(resolveEye(e, 1).pupil.size);
    expect(resolveEye(e, 0.1).pupil.size).toBe(resolveEye(e).pupil.size);
  });
  it('follow = 1 : scène sombre → pupille dilatée, scène vive → pupille contractée, monotone', () => {
    const s = [0, 0.25, 0.5, 0.75, 1].map((i) => eyeAt(i, 1).pupil.size);
    for (let k = 1; k < s.length; k++) expect(s[k]!).toBeLessThan(s[k - 1]!);
    expect(s[0]!).toBeGreaterThan(0.34); expect(s[4]!).toBeLessThan(0.34);
  });
  it('follow = 0,5 : mélange à mi-chemin du niveau de lumière ; modèle fixed : jamais de réaction', () => {
    expect(pupilLightLevel(EyeSpec.parse({ ...PLAIN, pupil: { response: { model: 'circular', light: 0.2, follow: 0.5 } } }).pupil, 1)).toBeCloseTo(0.6, 12);
    expect(eyeAt(0, 1).pupil.size).toBeCloseTo(0.34 * 1.45, 9);
    const fixed = (i: number) => resolveEye(EyeSpec.parse({ ...PLAIN, pupil: { size: 0.34, response: { model: 'fixed', follow: 1 } } }), i).pupil.size;
    expect(fixed(0)).toBe(fixed(1));
  });
  it('en pixels : l’iris reste, la pupille change ; un autre SVG entre scène sombre et vive', () => {
    const r = { model: 'circular', light: 0.5, follow: 1 };
    expect(sceneSvg(0.1, r)).not.toBe(sceneSvg(1, r));
  });
});

describe('vérification G/A/S de la passe 21', () => {
  const ids = (input: object, re: RegExp) => verifyEye({ ...PLAIN, ...input } as never).checks.filter((c) => re.test(c.id));
  it('pupille ronde : silence ; pupille fente / croix : reflet dégagé (géométrie + anatomie OK)', () => {
    expect(ids({}, /highlight-clear|highlight-keeps/)).toEqual([]);
    for (const shape of ['slit_vertical', 'cross', 'keyhole']) {
      const c = ids({ pupil: { shape, size: 0.34 } }, /highlight-clear|highlight-keeps/);
      expect(c.map((x) => x.id).sort()).toEqual(['highlight-clear-of-pupil', 'highlight-keeps-light-side']);
      expect(c.every((x) => x.ok), shape).toBe(true);
    }
  });
  it('pupille presque aussi grande que l’iris : pas de place → avertissement géométrique, jamais erreur', () => {
    const c = ids({ pupil: { shape: 'star', size: 0.7 } }, /highlight-clear-of-pupil/)[0]!;
    expect(c.ok).toBe(false); expect(c.severity).toBe('warn'); expect(c.layer).toBe('geometry');
  });
  it('cel : pli lisible en gros plan, avertissement à 20 px de large ; shaded : aucun contrôle de ce pli', () => {
    const big = ids({ finish: 'cel' }, /cel-crease-readable/)[0]!; expect(big.ok).toBe(true); expect(big.layer).toBe('style');
    const tiny = ids({ finish: 'cel', shape: { width: 20, height: 10 }, lids: { crease: { height: 0.05, depth: 0.5 } } }, /cel-crease-readable/)[0]!;
    expect(tiny.ok).toBe(false); expect(tiny.severity).toBe('warn');
    expect(ids({ finish: 'shaded' }, /cel-crease-readable/)).toEqual([]);
  });
});

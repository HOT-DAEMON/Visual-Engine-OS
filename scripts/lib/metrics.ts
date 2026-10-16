import { expandScene, generateRandomFace, SceneSpec } from '../../src';
import { compose } from '../../src/composition/anchors';
import { faceLandmarks, facialHairGeometry, hairGeometry, inPoly, type Poly } from '../../src/face';
import { openingGeometry } from '../../src/geometry/eye';
import { FaceParams } from '../../src/schema';

const grid = (b: { minX: number; maxX: number; minY: number; maxY: number }): { x: number; y: number }[] =>
  Array.from({ length: 121 }, (_, k) => ({ x: b.minX + ((b.maxX - b.minX) * (k % 11)) / 10, y: b.minY + ((b.maxY - b.minY) * Math.floor(k / 11)) / 10 }));
const hit = (polys: Poly[], pts: { x: number; y: number }[]): boolean => pts.some((q) => polys.some((p) => inPoly(p, q.x, q.y)));

/** Invariants mesurés sur `n` visages aléatoires (graines consécutives) : tout doit valoir 0 sauf les maxima d'asymétrie. */
export function measure(n: number): Record<string, number> {
  const r = { faces: n, hairOnEye: 0, mustacheOnEye: 0, beardOnMouth: 0, maxAnchorErrorPx: 0, maxEyeRollDeg: 0, maxEyeScaleDiff: 0, maxCanthusDyPctH: 0, withHair: 0, withMustache: 0, withBeard: 0 };
  for (let i = 0; i < n; i++) {
    const f = generateRandomFace(20000 + i * 17, { transform: { x: 250, y: 300 } });
    const lm = faceLandmarks(f.params, f.width, f.height);
    const hg = hairGeometry(f.params, lm);
    const fh = facialHairGeometry(f.params, lm);
    r.withHair += hg ? 1 : 0;
    r.withMustache += fh.mustache ? 1 : 0;
    r.withBeard += fh.beard ? 1 : 0;
    for (const s of ['left', 'right'] as const) {
      const b = f.fits[s].footprint;
      if (hg && hit(hg.front, grid(b))) r.hairOnEye++;
      if (fh.mustache && hit([fh.mustache], grid(b))) r.mustacheOnEye++;
    }
    const mouth = [{ x: 0, y: lm.mouthY }, { x: lm.lips.half * 0.9, y: lm.lips.cornerY }, { x: -lm.lips.half * 0.9, y: lm.lips.cornerY }, { x: 0, y: lm.lips.bottomY }];
    if (fh.beard && hit([fh.beard], mouth)) r.beardOnMouth++;
    const scene = SceneSpec.parse({ width: 500, height: 600, background: '#333333', objects: f.objects });
    const host = scene.objects[0];
    if (host?.kind !== 'host') continue;
    for (const e of expandScene(scene)) {
      if (e.kind !== 'eye') continue;
      const g = openingGeometry(e.shape, e.canthi);
      const w = compose({ ...e.transform }, { x: g.pi.x, y: g.pi.y, rotationDeg: 0, scale: 1 });
      const P = e.shape.outerSide === 'left' ? lm.innerCanthus.left : lm.innerCanthus.right;
      const t = compose(host.transform, { x: P.x, y: P.y, rotationDeg: 0, scale: 1 });
      r.maxAnchorErrorPx = Math.max(r.maxAnchorErrorPx, Math.hypot(w.x - t.x, w.y - t.y));
    }
    const a = FaceParams.parse(f.params).asymmetry;
    r.maxEyeRollDeg = Math.max(r.maxEyeRollDeg, Math.abs(a.eyeRollDeg));
    r.maxEyeScaleDiff = Math.max(r.maxEyeScaleDiff, Math.abs(a.eyeScale));
    r.maxCanthusDyPctH = Math.max(r.maxCanthusDyPctH, Math.abs(lm.innerCanthus.left.y - lm.innerCanthus.right.y) / lm.H * 100);
  }
  r.maxAnchorErrorPx = Number(r.maxAnchorErrorPx.toExponential(2));
  return r;
}

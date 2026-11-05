import { generateRandomFace, SceneSpec } from '../src';
import { placedEyesByHost } from '../src/anatomy/placed';
import { publishedOrbits, orbitRatio, openingInHost, sideOf } from '../src/anatomy/orbit';
import { hostFace } from '../src/render/face';
import { halfWidthAt, rightSamples } from '../src/face';
import type { HostSpec } from '../src/schema';

/** Mesure l'orbite a priori vs publiée sur N visages (docs/ORBIT-PUBLISH.md). Usage : tsx scripts/orbit-measure.ts [N] */
const N = Number(process.argv[2] ?? 80);
let priorOverlap = 0, eyes = 0, outPrior = 0, outPub = 0, worstPrior = 0, worstPub = 0, grown = 0, maxGrowth = 1, outsideHead = 0, overlap = 0, worstHead = 0;
for (let seed = 1; seed <= N; seed++) {
  const g = generateRandomFace(seed, { id: 'f0', transform: { x: 0, y: 0, scale: 1 } });
  const scene = SceneSpec.parse({ width: 640, height: 900, objects: g.objects });
  const host = scene.objects.find((o) => o.kind === 'host') as HostSpec;
  const lm = hostFace(host).lm;
  const placed = placedEyesByHost(scene).get('f0') ?? [];
  const pub = publishedOrbits(lm, placed);
  for (const pe of placed) {
    const pts = openingInHost(pe), s = sideOf(pe);
    const rp = orbitRatio(lm.orbit[s], pts), rq = orbitRatio(pub[s], pts);
    eyes++; if (rp > 1) outPrior++; if (rq > 1 + 1e-9) outPub++;
    worstPrior = Math.max(worstPrior, rp); worstPub = Math.max(worstPub, rq);
  }
  for (const s of ['left', 'right'] as const) {
    const o = pub[s]; if (o.grown) { grown++; maxGrowth = Math.max(maxGrowth, o.growth); }
    const rs = rightSamples(lm.outline);
    // Dépassement du crâne : sur 24 points de l'ellipse, |x| - demi-largeur du contour à y.
    let bad = -Infinity;
    for (let i = 0; i < 48; i++) { const t = (i / 48) * 2 * Math.PI, x = o.cx + o.rx * Math.cos(t), y = o.cy + o.ry * Math.sin(t); bad = Math.max(bad, Math.abs(x) - halfWidthAt(lm.outline, y, rs)); }
    if (bad > 0) outsideHead++; worstHead = Math.max(worstHead, bad);
  }
  if (pub.right.cx - pub.right.rx < pub.left.cx + pub.left.rx) overlap++;
  if (lm.orbit.right.cx - lm.orbit.right.rx < lm.orbit.left.cx + lm.orbit.left.rx) priorOverlap++;
}
console.log(JSON.stringify({ faces: N, eyes, outPrior, worstPrior: +worstPrior.toFixed(3), outPub, worstPub: +worstPub.toFixed(3), orbitsGrown: grown, maxGrowth: +maxGrowth.toFixed(2), orbitsOutsideHead: outsideHead, worstHeadOverflowPx: +worstHead.toFixed(2), facesWithOrbitOverlap: overlap, facesWithPriorOrbitOverlap: priorOverlap }, null, 1));

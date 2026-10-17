import { generateRandomFace, type RandomFace } from '../../src';
import { faceLandmarks, facialHairGeometry, hairGeometry, inPoly, type Poly } from '../../src/face';
import { buildHairline } from '../../src/face/hair/hairline';
import { HAIR_TEXTURES } from '../../src/schema';

const grid = (b: { minX: number; maxX: number; minY: number; maxY: number }): { x: number; y: number }[] =>
  Array.from({ length: 121 }, (_, k) => ({ x: b.minX + ((b.maxX - b.minX) * (k % 11)) / 10, y: b.minY + ((b.maxY - b.minY) * Math.floor(k / 11)) / 10 }));
const hit = (polys: Poly[], pts: { x: number; y: number }[]): boolean => pts.some((q) => polys.some((p) => inPoly(p, q.x, q.y)));
const light = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255) as [number, number, number];
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
};

/** Mesures du système capillaire / pilosité / axes indépendants sur `n` visages aléatoires (graines consécutives). */
export function measureHair(n: number): Record<string, unknown> {
  const styles: Record<string, number> = {};
  const textures: Record<string, number> = Object.fromEntries(HAIR_TEXTURES.map((t) => [t, 0]));
  const r = { faces: n, hairOnEye: 0, sideburnOnEye: 0, hairlineBelowBrowLimit: 0, minHairlineMarginPctH: 100, meanLocks: 0, withTie: 0, withThinning: 0, withRecession: 0, monolid: 0, browDiffersFromHair: 0, coilyOnLightSkin: 0, straightOnDarkSkin: 0, lightSkin: 0, darkSkin: 0 };
  const faces: RandomFace[] = [];
  for (let i = 0; i < n; i++) {
    const f = generateRandomFace(90000 + i * 19, { transform: { x: 250, y: 300 } });
    faces.push(f);
    const lm = faceLandmarks(f.params, f.width, f.height);
    const h = f.params.hair;
    styles[h.style] = (styles[h.style] ?? 0) + 1;
    textures[h.texture] = (textures[h.texture] ?? 0) + 1;
    for (const q of buildHairline(f.params, lm).pts) {
      if (q.y > lm.browLimitY - 0.03 * lm.H + 1e-9) r.hairlineBelowBrowLimit++;
      r.minHairlineMarginPctH = Math.min(r.minHairlineMarginPctH, ((lm.browLimitY - q.y) / lm.H) * 100);
    }
    const g = hairGeometry(f.params, lm);
    const fh = facialHairGeometry(f.params, lm);
    r.meanLocks += g?.locks.length ?? 0;
    r.withTie += g && g.ties.length > 0 ? 1 : 0;
    r.withThinning += h.thinning > 0.03 ? 1 : 0;
    r.withRecession += h.recession > 0.3 ? 1 : 0;
    for (const s of ['left', 'right'] as const) {
      const b = grid(f.fits[s].footprint);
      if (g && hit(g.front, b)) r.hairOnEye++;
      if (hit(fh.sideburns, b)) r.sideburnOnEye++;
    }
    const skin = light((f.objects[0] as { material: { color: string } }).material.color);
    r.monolid += f.axes.fold.crease === 0 ? 1 : 0;
    r.browDiffersFromHair += f.axes.browLash.browColor.toLowerCase() !== h.color.toLowerCase() ? 1 : 0;
    r.lightSkin += skin > 0.65 ? 1 : 0;
    r.darkSkin += skin < 0.4 ? 1 : 0;
    r.coilyOnLightSkin += h.texture === 'coily' && skin > 0.65 ? 1 : 0;
    r.straightOnDarkSkin += h.texture === 'straight' && skin < 0.4 ? 1 : 0;
  }
  r.meanLocks = Math.round(r.meanLocks / n);
  r.minHairlineMarginPctH = Number(r.minHairlineMarginPctH.toFixed(2));
  return { ...r, styles, textures };
}

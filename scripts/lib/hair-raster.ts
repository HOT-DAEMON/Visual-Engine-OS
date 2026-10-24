import { Resvg } from '@resvg/resvg-js';
import { compileScene, type RandomFace } from '../../src';
import { faceLandmarks, hairGeometry } from '../../src/face';
import { inPoly } from '../../src/face/poly';
import { rightSamples } from '../../src/face/outline';

/**
 * Mesures SUR LE RASTER (pas seulement la géométrie) : on rend le visage avec et sans cheveux ; les pixels qui diffèrent
 * forment le masque exact des cheveux tels que dessinés (filtres, ombres, dégradés compris).
 */
export interface RasterHair {
  readonly px: number;
  /** Aire du masque de cheveux / aire de la tête (contour). */
  readonly areaRatio: number;
  /** Dépassement du masque au-dessus du crâne (fraction de H) et sur les côtés (fraction de W). */
  readonly riseAbove: number;
  readonly overhang: number;
  /** Part du cuir chevelu (polygone) recouverte par des pixels de cheveux. */
  readonly scalpCoverage: number;
  /** Part de l'empreinte de chaque œil recouverte par des cheveux. */
  readonly eyeOcclusion: number;
  /** Part du front (entre implantation et sourcils) laissée en peau. */
  readonly foreheadSkin: number;
  readonly mask: Uint8Array;
  readonly w: number;
  readonly h: number;
}

const pixels = (face: RandomFace, objects: RandomFace['objects'], px: number): { rgba: Buffer; w: number; h: number } => {
  const r = compileScene({ width: Math.ceil(face.width * 1.6), height: Math.ceil(face.height * 1.9), background: '#ffffff', objects });
  if (!r.ok) throw new Error(r.issues.join('\n'));
  const img = new Resvg(r.svg, { fitTo: { mode: 'width', value: px } }).render();
  return { rgba: Buffer.from(img.pixels), w: img.width, h: img.height };
};

export function rasterHair(face: RandomFace, withHair: RandomFace['objects'], bald: RandomFace['objects'], px = 220): RasterHair {
  const a = pixels(face, withHair, px);
  const b = pixels(face, bald, px);
  const mask = new Uint8Array(a.w * a.h);
  for (let i = 0; i < mask.length; i++) {
    const d = Math.abs((a.rgba[i * 4] as number) - (b.rgba[i * 4] as number)) + Math.abs((a.rgba[i * 4 + 1] as number) - (b.rgba[i * 4 + 1] as number)) + Math.abs((a.rgba[i * 4 + 2] as number) - (b.rgba[i * 4 + 2] as number));
    mask[i] = d > 90 ? 1 : 0; // 90 : un simple ombre portée sur la peau (écart ≈ 30–60) ne compte pas comme cheveu
  }
  const lm = faceLandmarks(face.params, face.width, face.height);
  const geo = hairGeometry(face.params, lm);
  const s = a.w / Math.ceil(face.width * 1.6);
  // Repère hôte → pixels : l'hôte est centré horizontalement ; l'origine verticale est le centre de la tête (même convention que `compose`).
  const host = face.objects[0] as { transform: { x: number; y: number; scale?: number } };
  const sc = host.transform.scale ?? 1;
  const toPx = (x: number, y: number): [number, number] => [(host.transform.x + sc * x) * s, (host.transform.y + sc * y) * s];
  const rs = rightSamples(lm.outline);
  const headPoly = [...rs, ...[...rs].reverse().map((q) => ({ x: -q.x, y: q.y }))];
  let headArea = 0;
  let hairArea = 0;
  let scalpIn = 0;
  let scalpHair = 0;
  let minY = a.h;
  let maxOver = 0;
  for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) {
    const lx = ((x + 0.5) / s - host.transform.x) / sc;
    const ly = ((y + 0.5) / s - host.transform.y) / sc;
    const inHead = inPoly(headPoly, lx, ly);
    if (inHead) headArea++;
    if (mask[y * a.w + x]) {
      hairArea++;
      if (y < minY) minY = y;
      const over = Math.abs(lx) - lm.W / 2;
      if (over > maxOver) maxOver = over;
    }
    if (geo && inPoly(geo.scalp, lx, ly)) { scalpIn++; if (mask[y * a.w + x]) scalpHair++; }
  }
  const [, topPy] = toPx(0, -lm.H / 2);
  let eyeIn = 0;
  let eyeHair = 0;
  for (const side of ['left', 'right'] as const) {
    const f = face.fits[side].footprint;
    const [x0, y0] = toPx(f.minX, f.minY);
    const [x1, y1] = toPx(f.maxX, f.maxY);
    for (let y = Math.floor(y0); y < Math.ceil(y1); y++) for (let x = Math.floor(x0); x < Math.ceil(x1); x++) { eyeIn++; if (mask[y * a.w + x]) eyeHair++; }
  }
  const [, yT] = toPx(0, lm.hair.templeY);
  const [, yB] = toPx(0, lm.browLimitY);
  let fIn = 0;
  let fSkin = 0;
  const [cx] = toPx(0, 0);
  for (let y = Math.floor(yT); y < Math.ceil(yB); y++) for (let x = Math.floor(cx - 0.2 * face.width * s); x < Math.ceil(cx + 0.2 * face.width * s); x++) { fIn++; if (!mask[y * a.w + x]) fSkin++; }
  return { px, areaRatio: hairArea / Math.max(1, headArea), riseAbove: Math.max(0, (topPy - minY) / s / sc / lm.H), overhang: maxOver / lm.W, scalpCoverage: scalpIn ? scalpHair / scalpIn : 0, eyeOcclusion: eyeIn ? eyeHair / eyeIn : 0, foreheadSkin: fIn ? fSkin / fIn : 0, mask, w: a.w, h: a.h };
}

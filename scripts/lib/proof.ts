import { Resvg } from '@resvg/resvg-js';
import { compileScene, generateRandomFace, type RandomFace, type RandomFaceOptions } from '../../src';
import { faceLandmarks, facialHairGeometry, hairGeometry, type FaceLandmarks, type Poly } from '../../src/face';
import type { SceneInput } from '../../src/schema';

export interface Cell { readonly face: RandomFace; readonly lm: FaceLandmarks; readonly tx: number; readonly ty: number; readonly s: number; readonly rot: number }

/** Passe un point du repère local de l'hôte au repère de la scène (même convention que `compose`). */
export const toWorld = (c: Cell, x: number, y: number): [number, number] => {
  const t = (c.rot * Math.PI) / 180;
  return [c.tx + c.s * (x * Math.cos(t) - y * Math.sin(t)), c.ty + c.s * (x * Math.sin(t) + y * Math.cos(t))];
};

/** Place `n` visages en grille ; `make(i)` donne seed + options. Retourne les cellules et les objets de scène. */
export function layout(n: number, cols: number, cw: number, ch: number, s: number, make: (i: number) => { seed: number; opts?: RandomFaceOptions }): { cells: Cell[]; objects: SceneInput['objects'] } {
  const cells: Cell[] = [];
  const objects: SceneInput['objects'] = [];
  for (let i = 0; i < n; i++) {
    const { seed, opts } = make(i);
    const tx = cw / 2 + (i % cols) * cw;
    const ty = ch * 0.42 + Math.floor(i / cols) * ch;
    const face = generateRandomFace(seed, { ...opts, id: `c${i}`, transform: { x: tx, y: ty, scale: s } });
    const host = face.objects[0] as { transform: { rotationDeg: number } };
    cells.push({ face, lm: faceLandmarks(face.params, face.width, face.height), tx, ty, s, rot: host.transform.rotationDeg });
    objects.push(...face.objects);
  }
  return { cells, objects };
}

export function render(objects: SceneInput['objects'], w: number, h: number, overlay = '', bg = '#3b4157', px = w): Buffer {
  const r = compileScene({ width: w, height: h, background: bg, objects });
  if (!r.ok) throw new Error(r.issues.join('\n'));
  const svg = overlay ? r.svg.replace(/<\/svg>\s*$/, `${overlay}</svg>`) : r.svg;
  return new Resvg(svg, { font: { loadSystemFonts: false }, fitTo: { mode: 'width', value: px } }).render().asPng();
}

const pathOf = (c: Cell, p: Poly): string => `M${p.map((q) => toWorld(c, q.x, q.y).map((v) => v.toFixed(1)).join(' ')).join('L')}Z`;
const line = (c: Cell, a: [number, number], b: [number, number], col: string, dash = ''): string => {
  const [x1, y1] = toWorld(c, ...a);
  const [x2, y2] = toWorld(c, ...b);
  return `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${col}" stroke-width="1.2" fill="none" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
};

/** Surcouche de PREUVE (hors moteur) : repères du visage, empreintes d'yeux, contours des cheveux/pilosité. */
export function proofOverlay(c: Cell): string {
  const { lm, face } = c;
  const hw = lm.W / 2;
  const out: string[] = [];
  out.push(line(c, [-hw, lm.browLimitY], [hw, lm.browLimitY], '#ffd24a', '6 4'));
  out.push(line(c, [-hw, lm.noseBaseY], [hw, lm.noseBaseY], '#66e0ff', '6 4'));
  out.push(line(c, [-hw, lm.mouthY], [hw, lm.mouthY], '#9cff8a', '6 4'));
  out.push(line(c, [0, -lm.H / 2 - 20], [0, lm.neck.bottomY], '#ffffff', '2 5'));
  for (const side of ['left', 'right'] as const) {
    const b = face.fits[side].footprint;
    out.push(`<path d="${pathOf(c, [{ x: b.minX, y: b.minY }, { x: b.maxX, y: b.minY }, { x: b.maxX, y: b.maxY }, { x: b.minX, y: b.maxY }])}" stroke="#ff5ad1" stroke-width="1.4" fill="none"/>`);
    const [ax, ay] = toWorld(c, face.fits[side].anchor.x, face.fits[side].anchor.y);
    out.push(`<path d="M${ax - 6} ${ay}H${ax + 6}M${ax} ${ay - 6}V${ay + 6}" stroke="#ff2d2d" stroke-width="2"/>`);
  }
  const hair = hairGeometry(face.params, lm);
  for (const p of hair?.front ?? []) out.push(`<path d="${pathOf(c, p)}" stroke="#ff9d2e" stroke-width="1.2" fill="none"/>`);
  const fh = facialHairGeometry(face.params, lm);
  for (const p of [fh.mustache, fh.beard]) if (p) out.push(`<path d="${pathOf(c, p)}" stroke="#a78bff" stroke-width="1.2" fill="none"/>`);
  return out.join('');
}

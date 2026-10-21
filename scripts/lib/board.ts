import { rasterPng } from './raster';
import { applyStylization } from '../../src/face/stylize';
import { compileSceneCached as compileScene, generateRandomFace, type RandomFace, type RandomFaceOptions } from '../../src';
import { deepMerge } from '../../src/generation/random-face-anatomy';
import { FaceParams } from '../../src/schema';
import { faceLandmarks, noseGeometry, type FaceLandmarks, type NoseGeometry } from '../../src/face';
import type { LightSpec, SceneInput } from '../../src/schema';

/**
 * Outillage des artefacts du moteur de visage. Chaque CELLULE est une scène rendue seule (visage centré sur un point d'intérêt,
 * à l'échelle voulue : le gros plan est un simple recadrage du canevas) ; un PLANCHE assemble des cellules PNG avec des légendes.
 */
export type Focus = 'face' | 'nose' | 'lower' | 'chin' | 'eyes';

export interface CellSpec {
  readonly seed?: number;
  readonly opts?: RandomFaceOptions;
  /** Surcharge profonde des `FaceParams` de l'hôte (par-dessus les tirages), ex. `{ mouth: { open: 1 } }`. */
  readonly patch?: Record<string, unknown>;
  readonly light?: Partial<LightSpec>;
  readonly focus?: Focus;
  readonly label?: string;
  /** Couleur de fond de la scène (défaut : gris-bleu des planches). */
  readonly background?: string;
  /** Surcouche de preuve en coordonnées de la CELLULE (px). */
  readonly overlay?: (m: CellMeta) => string;
}

export interface CellMeta {
  readonly face: RandomFace;
  /** `FaceParams` FINAUX (après surcharge `patch`) : c'est eux qui sont rendus. */
  readonly params: FaceParams;
  readonly lm: FaceLandmarks;
  readonly nose: NoseGeometry;
  readonly s: number;
  readonly w: number;
  readonly h: number;
  /** Repère local de l'hôte → pixels de la cellule. */
  readonly px: (x: number, y: number) => [number, number];
}

export const BASE_OPTS: RandomFaceOptions = { identity: 3, hairEngine: 'classic', hair: { style: 'bald', sideburns: 0 } as never, facialHair: { mustache: 'none', beard: 'none', sideburns: 'none' }, neck: { visible: true } as never, expression: { kind: 'neutral', intensity: 0.4 }, eyeSize: 1 };

/** Point d'intérêt (repère local de l'hôte) et échelle de chaque cadrage, pour une cellule de `w` px de large. */
function framing(f: Focus, lm: FaceLandmarks, nose: NoseGeometry, w: number): { fx: number; fy: number; s: number } {
  switch (f) {
    case 'nose': return { fx: 0, fy: (nose.root.y + nose.baseY) / 2 + 0.035 * lm.H, s: w / (lm.W * 0.5) };
    case 'lower': return { fx: 0, fy: (lm.mouthY + lm.chinY) / 2 + 0.02 * lm.H, s: w / (lm.W * 0.95) };
    case 'chin': return { fx: 0, fy: (lm.lips.bottomY + lm.chinY) / 2 + 0.03 * lm.H, s: w / (lm.W * 0.7) };
    case 'eyes': return { fx: 0, fy: lm.eyeY, s: w / (lm.W * 1.1) };
    default: return { fx: 0, fy: (lm.neck.bottomY - lm.H / 2) / 2 * 0.9, s: Math.min(w / (lm.W * 1.18), (w * 1.3) / (lm.neck.bottomY + lm.H / 2) / 1.1) };
  }
}

/** Rendu SANS rastérisation : le SVG et les métadonnées (rapide ; utilisé par les tests qui n'ont besoin que du balisage). */
export function cellSvg(spec: CellSpec, w: number, h: number): { svg: string; meta: CellMeta } {
  const seed = spec.seed ?? 321;
  const f0 = generateRandomFace(seed, { ...BASE_OPTS, ...spec.opts, anatomy: { ...(BASE_OPTS.anatomy ?? {}), ...(spec.opts?.anatomy ?? {}) } });
  const host0 = f0.objects[0] as { face: FaceParams };
  // Surcharge profonde puis re-validation : le visage rendu est toujours un `FaceParams` valide.
  // Le profil de stylisation est appliqué ICI (idempotent) : les repères et les surcouches lisent la géométrie stylisée, comme le rendu.
  const params = applyStylization(FaceParams.parse(spec.patch ? deepMerge(host0.face, spec.patch) : host0.face));
  // Les repères sont recalculés avec les paramètres FINAUX (après surcharge) : cadrage et surcouches suivent le visage réellement rendu.
  const lm = faceLandmarks(params, f0.width, f0.height);
  const nose = noseGeometry(params, lm);
  const fr = framing(spec.focus ?? 'face', lm, nose, w);
  const tx = w / 2 - fr.fx * fr.s;
  const ty = h / 2 - fr.fy * fr.s;
  const host = { ...f0.objects[0], face: params, transform: { x: tx, y: ty, scale: fr.s, rotationDeg: 0 } } as never;
  const objects = [host, ...f0.objects.slice(1)] as SceneInput['objects'];
  const r = compileScene({ width: w, height: h, background: spec.background ?? '#3b4157', ...(spec.light ? { light: { azimuthDeg: 330, elevationDeg: 55, color: '#ffffff', intensity: 1, ...spec.light } } : {}), objects } as never);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  const meta: CellMeta = { face: f0, params, lm, nose, s: fr.s, w, h, px: (x, y) => [tx + x * fr.s, ty + y * fr.s] };
  const svg = spec.overlay ? r.svg.replace(/<\/svg>\s*$/, `${spec.overlay(meta)}</svg>`) : r.svg;
  return { svg, meta };
}

/** Rendu rastérisé (PNG) d'une cellule, avec son SVG. */
export function cell(spec: CellSpec, w: number, h: number): { png: Buffer; meta: CellMeta; svg: string } {
  const { svg, meta } = cellSvg(spec, w, h);
  return { png: rasterPng(svg, svg.includes('<text') ? { fonts: true } : {}), meta, svg };
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Assemble des cellules PNG (déjà rendues) en une planche légendée. */
export function board(title: string, cells: { png: Buffer; label?: string }[], cols: number, w: number, h: number): Buffer {
  const rows = Math.ceil(cells.length / cols);
  const top = 46;
  const lab = 34;
  const W = cols * w;
  const H = top + rows * (h + lab);
  const parts = cells.map((c, i) => {
    const x = (i % cols) * w;
    const y = top + Math.floor(i / cols) * (h + lab);
    return `<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${c.png.toString('base64')}"/><text x="${x + 8}" y="${y + h + 22}" fill="#e8ecf5" font-size="14" font-family="DejaVu Sans, sans-serif">${esc(c.label ?? '')}</text>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#1b1f2e"/><text x="12" y="30" fill="#ffffff" font-size="22" font-weight="bold" font-family="DejaVu Sans, sans-serif">${esc(title)}</text>${parts.join('')}</svg>`;
  return rasterPng(svg, { fonts: true });
}

/** Rastérise un SVG complet en PNG (utilisé pour les scènes post-traitées, ex. l'encrage global). */
export function rasterize(svg: string): Buffer {
  return rasterPng(svg, { fonts: true });
}

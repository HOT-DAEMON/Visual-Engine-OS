import { lightVector } from '../lighting/light';
import { compileEye } from '../render/eye/eye';
import { deepMerge } from '../generation/random-face-anatomy';
import { SceneSpec } from '../schema';

/**
 * PLACE D'ŒIL — branche le VRAI moteur d'yeux (`compileEye`, rotation 3D de la tête `headTurn.model = 'sphere'`) dans une cellule au trait.
 * L'œil du moteur est compilé tel quel puis (1) converti en gris d'encre (le style de la cellule est noir et blanc),
 * (2) posé en pixels de cellule, (3) borné par un cadre qui retire ce que la cellule cache (le sourcil est sous la frange).
 * Il est dessiné AVANT l'encre des cheveux : la frange le recouvre comme dans la référence.
 */
export interface EyeSlot {
  /** Centre de l'ouverture, pixels de cellule. */ readonly cx: number; readonly cy: number;
  /** Échelle du moteur (le moteur dessine un œil de `shapeW` unités de large). */ readonly scale: number;
  readonly shapeW: number; readonly shapeH: number; readonly seed: number;
  readonly yawDeg: number; readonly pitchDeg: number; readonly azimuthDeg: number;
  /** Rotation dans le plan (degrés). */ readonly rollDeg: number;
  /** Surcharges du moteur (fusion profonde sur l'objet œil) : épaisseur de paupière, cils, regard, iris… */ readonly engine?: Record<string, unknown>;
  /** Cadre de découpe [x0, y0, x1, y1] en pixels de cellule. */ readonly clip: readonly [number, number, number, number];
}
export interface EyeInk { readonly defs: string; readonly markup: string }

const hex2 = (n: number): string => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
/** Passe toute couleur `#rrggbb` / `#rgb` / `rgb(r,g,b)` du SVG en gris (luminance Rec. 601). */
export function grayscaleSvg(s: string): string {
  const g = (r: number, gg: number, b: number): string => { const y = hex2(0.299 * r + 0.587 * gg + 0.114 * b); return `#${y}${y}${y}`; };
  return s
    .replace(/#([0-9a-fA-F]{6})\b/g, (_m, h: string) => g(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)))
    .replace(/#([0-9a-fA-F]{3})\b/g, (_m, h: string) => g(parseInt((h[0] as string).repeat(2), 16), parseInt((h[1] as string).repeat(2), 16), parseInt((h[2] as string).repeat(2), 16)))
    .replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/g, (_m, r: string, gg: string, b: string, a?: string) => { const y = hex2(0.299 * Number(r) + 0.587 * Number(gg) + 0.114 * Number(b)); return a === undefined ? `rgb(${parseInt(y, 16)},${parseInt(y, 16)},${parseInt(y, 16)})` : `rgba(${parseInt(y, 16)},${parseInt(y, 16)},${parseInt(y, 16)},${a})`; });
}

/** Le fragment est une fonction pure de la place d'œil : on le calcule une fois (la compilation du moteur d'yeux domine le coût de construction de la scène). */
const CACHE = new Map<string, EyeInk>();
export function eyeInk(s: EyeSlot): EyeInk {
  const key = JSON.stringify(s);
  const hit = CACHE.get(key);
  if (hit) return hit;
  const out = eyeInkUncached(s);
  if (CACHE.size >= 32) CACHE.clear();
  CACHE.set(key, out);
  return out;
}

function eyeInkUncached(s: EyeSlot): EyeInk {
  const scene = SceneSpec.parse({
    width: 64, height: 64, light: { azimuthDeg: 330, elevationDeg: 55 },
    objects: [deepMerge({ kind: 'eye', id: 'eyeslot', seed: s.seed, shape: { width: s.shapeW, height: s.shapeH },
      eyebrow: { gap: 1, thickness: 0.02, hairs: 0, length: 0.6 },
      transform: { x: s.cx, y: s.cy, scale: s.scale, rotationDeg: s.rollDeg },
      headTurn: { yawDeg: s.yawDeg, pitchDeg: s.pitchDeg, model: 'sphere', azimuthDeg: s.azimuthDeg } }, s.engine ?? {})],
  });
  const obj = scene.objects[0];
  if (!obj || obj.kind !== 'eye') throw new Error('eye-slot : objet œil attendu');
  const c = compileEye(obj, lightVector(scene.light));
  const [x0, y0, x1, y1] = s.clip;
  const clipId = 'eyeslot-clip';
  return {
    defs: grayscaleSvg(`${c.defs.join('')}<clipPath id="${clipId}"><rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}"/></clipPath>`),
    markup: `<g clip-path="url(#${clipId})">${grayscaleSvg(c.markup)}</g>`,
  };
}

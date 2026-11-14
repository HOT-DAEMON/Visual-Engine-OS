import { Resvg } from '@resvg/resvg-js';
import { compileScene } from '../../src';

/**
 * PREUVE VISUELLE de consommation des paramètres : pour chaque paramètre exposé par l'œil (enveloppe, canthi, pli, iris, pupille, reflets, cils, sourcil, regard…),
 * on rend l'œil de base avec la valeur BASSE puis HAUTE et on compte les pixels qui changent réellement (rastérisation resvg). Un paramètre lu par le code
 * mais sans effet visible aurait un compte nul : tests/eye-params-consumed.test.ts échoue alors. `region` documente OÙ l'effet doit apparaître.
 */
export type Spec = Record<string, unknown>;
export interface Sweep { readonly path: string; readonly lo: unknown; readonly hi: unknown; readonly region: string; readonly minPixels?: number }

export const BASE: Spec = {
  seed: 7,
  shape: { width: 300, height: 170, tiltDeg: 6, upperFraction: 0.62, openness: 1, style: 'almond', outerSide: 'right' },
  canthi: { inner: { roundness: 0.4, caruncle: 0.5 }, outer: { roundness: 0.2 } },
  epicanthicFold: { amount: 0, reach: 0.6 },
  lids: { crease: { height: 0.3, depth: 0.6 } },
  iris: { radius: 0.42, aspect: 1, fibers: 48, limbalRing: 0.5 },
  pupil: { shape: 'round', size: 0.36 },
  highlights: { primary: { size: 0.22, opacity: 1 }, secondary: { size: 0.1, opacity: 0.7 } },
  lashes: { upper: { count: 18, length: 0.24, curl: 0.5, sweep: 24 }, lower: { count: 6 } },
  eyebrow: { gap: 0.3, thickness: 0.12, arch: 0.5, tiltDeg: 4, length: 1.1, taper: 0.6, hairs: 60 },
  gaze: { yawDeg: 0, pitchDeg: 0, travel: 1 },
  expression: { kind: 'neutral', intensity: 1 },
};

export const SWEEPS: readonly Sweep[] = [
  { path: 'shape.width', lo: 240, hi: 340, region: 'toute l’ouverture' },
  { path: 'shape.height', lo: 120, hi: 220, region: 'toute l’ouverture' },
  { path: 'shape.tiltDeg', lo: -8, hi: 18, region: 'canthi, cils, pli' },
  { path: 'shape.upperFraction', lo: 0.45, hi: 0.78, region: 'paupière haute / basse' },
  { path: 'shape.openness', lo: 0.45, hi: 1.1, region: 'hauteur d’ouverture' },
  { path: 'shape.style', lo: 'almond', hi: 'chibi', region: 'silhouette' },
  { path: 'canthi.inner.roundness', lo: 0, hi: 1, region: 'canthus interne' },
  { path: 'canthi.inner.caruncle', lo: 0, hi: 1, region: 'caroncule', minPixels: 20 },
  { path: 'canthi.outer.roundness', lo: 0, hi: 1, region: 'canthus externe' },
  { path: 'epicanthicFold.amount', lo: 0, hi: 1, region: 'pli épicanthique', minPixels: 40 },
  { path: 'lids.crease.height', lo: 0, hi: 0.5, region: 'pli palpébral' },
  { path: 'iris.radius', lo: 0.3, hi: 0.5, region: 'iris' },
  { path: 'iris.aspect', lo: 0.9, hi: 1.25, region: 'iris' },
  { path: 'iris.fibers', lo: 20, hi: 90, region: 'texture de l’iris', minPixels: 60 },
  { path: 'iris.limbalRing', lo: 0, hi: 1, region: 'limbe', minPixels: 60 },
  // Détail atomique de l'iris (facettes de gemme, bulles de cristal) : `iris.detail` absent de BASE, créé par le chemin ; `lo: undefined` = brique absente.
  { path: 'iris.detail.facets', lo: undefined, hi: { count: 20, rings: 3, contrast: 0.8 }, region: 'facettes d’iris (présence)', minPixels: 1500 },
  { path: 'iris.detail.facets.count', lo: 8, hi: 34, region: 'facettes d’iris', minPixels: 1500 },
  { path: 'iris.detail.facets.rings', lo: 1, hi: 4, region: 'facettes d’iris', minPixels: 1500 },
  { path: 'iris.detail.facets.contrast', lo: 0.05, hi: 1, region: 'facettes d’iris (ton, biseau)', minPixels: 1500 },
  { path: 'iris.detail.bubbles', lo: undefined, hi: { count: 12, size: 0.09, opacity: 0.9, zone: 'lower' }, region: 'bulles d’iris (présence)', minPixels: 300 },
  { path: 'iris.detail.bubbles.count', lo: 2, hi: 24, region: 'bulles d’iris', minPixels: 300 },
  { path: 'iris.detail.bubbles.size', lo: 0.03, hi: 0.18, region: 'bulles d’iris', minPixels: 300 },
  { path: 'iris.detail.bubbles.opacity', lo: 0.1, hi: 1, region: 'bulles d’iris', minPixels: 300 },
  { path: 'iris.detail.bubbles.zone', lo: 'lower', hi: 'all', region: 'bulles d’iris (zone)', minPixels: 300 },
  { path: 'pupil.size', lo: 0.2, hi: 0.5, region: 'pupille' },
  { path: 'pupil.shape', lo: 'round', hi: 'slit_vertical', region: 'pupille' },
  { path: 'highlights.primary.size', lo: 0.1, hi: 0.3, region: 'reflet principal' },
  { path: 'highlights.secondary.size', lo: 0.05, hi: 0.18, region: 'reflet secondaire', minPixels: 30 },
  { path: 'lashes.upper.count', lo: 8, hi: 30, region: 'cils hauts' },
  { path: 'lashes.upper.length', lo: 0.12, hi: 0.34, region: 'cils hauts' },
  { path: 'lashes.upper.curl', lo: 0.1, hi: 0.95, region: 'cils hauts' },
  { path: 'lashes.upper.sweep', lo: 5, hi: 45, region: 'cils hauts' },
  { path: 'lashes.lower.count', lo: 0, hi: 12, region: 'cils bas', minPixels: 40 },
  { path: 'eyebrow.thickness', lo: 0.06, hi: 0.2, region: 'sourcil' },
  { path: 'eyebrow.arch', lo: 0.1, hi: 0.9, region: 'sourcil' },
  { path: 'eyebrow.tiltDeg', lo: -6, hi: 14, region: 'sourcil' },
  { path: 'eyebrow.gap', lo: 0.15, hi: 0.55, region: 'sourcil' },
  { path: 'gaze.yawDeg', lo: -25, hi: 25, region: 'iris + pupille + reflets (suivent le regard)' },
  { path: 'gaze.pitchDeg', lo: -18, hi: 18, region: 'iris + pupille + reflets' },
  { path: 'expression.kind', lo: 'neutral', hi: 'angry', region: 'paupières, sourcil' },
];

const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o)) as T;
export function withPath(base: Spec, path: string, value: unknown): Spec {
  const out = clone(base);
  const keys = path.split('.');
  let cur = out as Record<string, unknown>;
  for (const k of keys.slice(0, -1)) cur = (cur[k] ??= {}) as Record<string, unknown>;
  cur[keys[keys.length - 1] as string] = value;
  return out;
}

export const W = 460, H = 380;
export function renderEyeRgba(eye: Spec): Uint8Array {
  const r = compileScene({ width: W, height: H, background: '#d9b8a0', objects: [{ kind: 'eye', id: 'e', transform: { x: W / 2, y: H - 100 }, ...eye }] } as never);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return new Resvg(r.svg, { fitTo: { mode: 'width', value: W } }).render().pixels as unknown as Uint8Array;
}

/** Nombre de pixels dont l'écart cumulé (R+G+B) dépasse `thr`. */
export function changedPixels(a: Uint8Array, b: Uint8Array, thr = 24): number {
  let n = 0;
  for (let i = 0; i < a.length; i += 4) if (Math.abs((a[i] as number) - (b[i] as number)) + Math.abs((a[i + 1] as number) - (b[i + 1] as number)) + Math.abs((a[i + 2] as number) - (b[i + 2] as number)) > thr) n++;
  return n;
}

export function sweepResult(s: Sweep, base: Spec = BASE): { changed: number; lo: Uint8Array; hi: Uint8Array } {
  const lo = renderEyeRgba(withPath(base, s.path, s.lo));
  const hi = renderEyeRgba(withPath(base, s.path, s.hi));
  return { changed: changedPixels(lo, hi), lo, hi };
}

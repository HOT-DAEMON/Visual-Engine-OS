import { generateRandomProfile } from '../generation/random-skull';
import { lightModelOf, type LightModel } from '../relief';
import { SkullParams } from '../skull/types';
import type { VaultView } from '../skull/vault-registry-types';
import { headSpecFromProfile } from './engines/from-face';
import { defaultFrame, renderHead } from './index';
import type { Frame } from './raster';
import { topRow } from './silhouette';
import type { HeadTurnSpec, TurnRender, View } from './types';

/**
 * BANC D'ESSAI DE LA VOÛTE CRÂNIENNE : la même graine, la même caméra, le même éclairage et le même rendu pour toutes les valeurs d'un paramètre ; seule la valeur change.
 * La tête est CHAUVE (sans cheveux le relief de la voûte est visible) et éclairée de côté (rasante : les plans et les creux se lisent). `perceptible` est la preuve :
 * une différence de pixels mesurée entre deux rendus, pas une valeur différente dans un JSON. Les seuils ci-dessous sont des CONVENTIONS fixées avant toute mesure
 * (docs/SKULL-VAULT-VALIDATION.md) : 0,4 % de la surface de l'union des silhouettes, ou 0,5 % des pixels dont la luminance change de plus de 0,05.
 */
export const VAULT_VIEWS = {
  face: { yaw: 0, pitch: 0 }, trois_quarts: { yaw: 45, pitch: 0 }, profil: { yaw: 90, pitch: 0 }, trois_quarts_arriere: { yaw: 135, pitch: 0 }, dos: { yaw: 180, pitch: 0 }, dessus: { yaw: 0, pitch: -75 },
} as const satisfies Record<VaultView, View>;
export type VaultViewId = VaultView;
export const VAULT_THRESHOLD = { xor: 0.004, shadeFrac: 0.005, dL: 0.05 } as const;

const BALD = { knots: [[0, -1], [180, -1]] as [number, number][] };
export const VAULT_LIGHT: LightModel = lightModelOf({ azimuthDeg: 300, elevationDeg: 40, shadowHardness: 0.6, sourceSize: 0.3 }, { style: 'soft' });
export const VAULT_SEED = 3;

/** Spec d'une tête chauve de la graine, dont le crâne est surchargé par `ov` (valeurs ABSOLUES des paramètres). */
export function vaultSpec(ov: Partial<SkullParams> = {}, seed = VAULT_SEED, bald = true, faceOv?: (p: ReturnType<typeof generateRandomProfile>) => ReturnType<typeof generateRandomProfile>, caricature = false): HeadTurnSpec {
  const p0 = generateRandomProfile(seed), p = faceOv ? faceOv(p0) : p0;
  return headSpecFromProfile({ ...p, skull: SkullParams.parse({ ...p.skull, ...ov }), caricature }, undefined, bald ? BALD : undefined);
}
/** Cadre d'une vue : celui des planches ; pour la vue de DESSUS le pivot est recentré (la profondeur de la tête s'étale verticalement dans l'image, le cadre horizontal la coupait). Identique pour toutes les valeurs d'un paramètre. */
export const vaultFrame = (view: VaultViewId, H: number): Frame => { const f = defaultFrame(H); return view === 'dessus' ? { ...f, oy: 0.8 * f.ppu } : f; };
export const vaultRender = (spec: HeadTurnSpec, view: VaultViewId, H = 360, lit = true): TurnRender => renderHead(VAULT_VIEWS[view], spec, { frame: vaultFrame(view, H), ss: 2, ...(lit ? { light: VAULT_LIGHT } : {}) });

const luma = (r: TurnRender, i: number): number => (0.2126 * r.rgba[i * 4]! + 0.7152 * r.rgba[i * 4 + 1]! + 0.0722 * r.rgba[i * 4 + 2]!) / 255;
export interface Diff { readonly xor: number; readonly shadeFrac: number; readonly perceptible: boolean }
/** Différence perceptible entre deux rendus de même cadre : écart de silhouette (XOR / union) et part des pixels dont la luminance change de plus de `dL`. */
export function renderDiff(a: TurnRender, b: TurnRender): Diff {
  let u = 0, x = 0, s = 0;
  for (let i = 0; i < a.ids.length; i++) {
    const ia = a.ids[i] !== 0, ib = b.ids[i] !== 0;
    if (ia || ib) u++; if (ia !== ib) x++;
    if (ia && ib && Math.abs(luma(a, i) - luma(b, i)) > VAULT_THRESHOLD.dL) s++;
  }
  const xor = u ? x / u : 0, shadeFrac = u ? s / u : 0;
  return { xor, shadeFrac, perceptible: xor >= VAULT_THRESHOLD.xor || shadeFrac >= VAULT_THRESHOLD.shadeFrac };
}
/** Hauteur du sommet de la silhouette (U, repère tête : y vers le bas, 0 = ancien sommet) et demi-largeur (U) à la hauteur y. */
export const topU = (r: TurnRender): number => (topRow(r) - r.originY) / r.ppu;
export function widthU(r: TurnRender, y: number): number {
  const row = Math.round(r.originY + y * r.ppu); let l = -1, rr = -1;
  for (let x = 0; x < r.w; x++) if (r.ids[row * r.w + x] !== 0) { if (l < 0) l = x; rr = x; }
  return l < 0 ? 0 : (rr + 1 - l) / r.ppu;
}
/** Dissymétrie gauche / droite de la silhouette : XOR entre le masque et son miroir autour de l'axe image du pivot (0 = symétrique). */
export function mirrorXor(r: TurnRender): number {
  let u = 0, x = 0;
  for (let y = 0; y < r.h; y++) for (let px = 0; px < r.w; px++) {
    const mx = Math.round(2 * r.originX - 1 - px); if (mx < 0 || mx >= r.w) continue;
    const a = r.ids[y * r.w + px] !== 0, b = r.ids[y * r.w + mx] !== 0;
    if (a || b) u++; if (a !== b) x++;
  }
  return u ? x / u : 0;
}

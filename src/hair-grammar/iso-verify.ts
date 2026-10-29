import { rasterize } from './render-fast';
import { ribbonScene } from './ribbon-scene';
import { toCell, type RibbonProfile } from './ribbon';
import type { Check, Report } from './verify';

/**
 * VÉRIFICATION DES BANDES ISO-TONS en trois couches (même contrat que `verify.ts`) — elle juge le RENDU, pas seulement les données :
 *  - GÉOMÉTRIQUE : seuils et gris strictement décroissants, chemins bien formés (un `M` ↔ un `z`), coordonnées dans la cellule, budget de nœuds ;
 *  - ANATOMIQUE : (1) les cheveux (rubans de rôle `hair`) ne recouvrent pas les zones protégées (yeux, nez, bouche) ; (2) le rendu porte bien de l'encre
 *    DANS ces zones (les traits du visage n'ont pas disparu) ;
 *  - STYLE : part d'encre, nombre de niveaux de gris, pas de bruit (anneaux minuscules).
 * Les bornes sont des garde-fous mesurés sur la référence (voir docs/HAIR-GRAMMAR-03.md) : elles protègent d'une dérive, elles ne prouvent pas la ressemblance.
 */
const chk = (name: string, value: number, min: number, max: number): Check => ({ name, value, min, max, ok: Number.isFinite(value) && value >= min && value <= max });
const rep = (layer: Report['layer'], checks: Check[]): Report => ({ layer, checks, ok: checks.every((c) => c.ok) });
export interface IsoLimits { readonly nodes: number; readonly inkFraction: readonly [number, number]; readonly hairInProtect: number; readonly faceInkInProtect: readonly [number, number] }
export const ISO_LIMITS: IsoLimits = { nodes: 20000, inkFraction: [0.1, 0.2], hairInProtect: 0.05, faceInkInProtect: [0.03, 0.6] };
const PX = 2;

/** Lit un chemin relatif `M x y l dx dy … z` : renvoie le nombre de sous-chemins, le nombre de nœuds et le dépassement maximal hors cellule (px). */
export function scanPath(d: string, w: number, h: number): { rings: number; closed: number; nodes: number; overflow: number; bad: number } {
  let rings = 0; let closed = 0; let nodes = 0; let overflow = 0; let bad = 0; let x = 0; let y = 0;
  for (const m of d.matchAll(/([Mlz])([^Mlz]*)/g)) {
    const cmd = m[1] as string; const nums = (m[2] as string).trim().split(/[ ]+/).filter(Boolean).map(Number);
    if (cmd === 'z') { closed++; continue; }
    if (nums.length !== 2 || nums.some((v) => !Number.isFinite(v))) { bad++; continue; }
    if (cmd === 'M') { rings++; x = nums[0] as number; y = nums[1] as number; } else { x += nums[0] as number; y += nums[1] as number; }
    nodes++; overflow = Math.max(overflow, -x, -y, x - w, y - h);
  }
  return { rings, closed, nodes, overflow, bad };
}

/** Part d'encre (gris < 140) dans une boîte du repère de tête, sur un raster RGBA rendu à `PX` fois la cellule. */
function inkIn(rgba: Uint8Array, width: number, P: RibbonProfile, box: readonly [number, number, number, number]): number {
  const a = toCell(P.frame, box[0], box[1]); const b = toCell(P.frame, box[2], box[3]);
  const x0 = Math.max(0, Math.floor(a.x * PX)); const x1 = Math.min(width, Math.ceil(b.x * PX)); const y0 = Math.max(0, Math.floor(a.y * PX)); const y1 = Math.ceil(b.y * PX);
  let n = 0; let ink = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * width + x) * 4; n++; if (0.299 * (rgba[i] as number) + 0.587 * (rgba[i + 1] as number) + 0.114 * (rgba[i + 2] as number) < 140) ink++; }
  return n ? ink / n : NaN;
}

export function verifyIso(P: RibbonProfile, cell: { w: number; h: number }, L: IsoLimits = ISO_LIMITS): { geometry: Report; anatomy: Report; style: Report; measures: Record<string, number> } {
  const bands = P.bands ?? [];
  const scans = bands.map((b) => scanPath(b.d, cell.w, cell.h));
  const dec = (k: 'level' | 'gray'): number => bands.filter((b, i) => i > 0 && b[k] >= (bands[i - 1] as typeof b)[k]).length;
  const nodes = scans.reduce((s, q) => s + q.nodes, 0);
  const geometry = rep('geometry', [chk('bandes présentes', bands.length, 3, 12), chk('seuils non strictement décroissants', dec('level'), 0, 0), chk('gris non strictement décroissants', dec('gray'), 0, 0),
    chk('sous-chemins non fermés (M ≠ z)', scans.reduce((s, q) => s + Math.abs(q.rings - q.closed), 0), 0, 0), chk('nombres illisibles', scans.reduce((s, q) => s + q.bad, 0), 0, 0),
    chk('dépassement hors cellule (px)', Math.max(0, ...scans.map((q) => q.overflow)), 0, 1.5), chk('nœuds au total', nodes, 1, L.nodes)]);
  const view = { w: cell.w, h: cell.h, px: PX };
  const full = rasterize(ribbonScene(P, view, undefined, undefined, 'bands'), cell.w * PX, 'draft');
  const hairOnly = rasterize(ribbonScene(P, view, undefined, new Set(['hair']), 'ribbons'), cell.w * PX, 'draft');
  const measures: Record<string, number> = {}; const an: Check[] = [];
  for (const z of P.protect ?? []) {
    const hi = inkIn(hairOnly.rgba, hairOnly.width, P, z.box); const fi = inkIn(full.rgba, full.width, P, z.box);
    measures[`cheveux_dans_${z.name}`] = hi; measures[`encre_du_rendu_dans_${z.name}`] = fi;
    an.push(chk(`cheveux dans « ${z.name} » (part d'encre)`, hi, 0, L.hairInProtect), chk(`traits du visage présents dans « ${z.name} »`, fi, L.faceInkInProtect[0], L.faceInkInProtect[1]));
  }
  let ink = 0; for (let i = 0; i < full.rgba.length; i += 4) if (0.299 * (full.rgba[i] as number) + 0.587 * (full.rgba[i + 1] as number) + 0.114 * (full.rgba[i + 2] as number) < 140) ink++;
  const frac = ink / (full.rgba.length / 4); measures['part_encre'] = frac;
  const tiny = scans.reduce((s, _q, i) => s + (bands[i] as { d: string }).d.split('z').filter((r) => r.length > 0 && r.length < 14).length, 0);
  const style = rep('style', [chk('part d\'encre du rendu', frac, L.inkFraction[0], L.inkFraction[1]), chk('niveaux de gris distincts', new Set(bands.map((b) => b.gray)).size, 4, 12), chk('anneaux minuscules (bruit)', tiny, 0, 0.1 * nodes / 10 + 40)]);
  return { geometry, anatomy: rep('anatomy', an), style, measures };
}

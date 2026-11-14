import { mix, type RGB } from './color';
import { clamp, smooth } from './math';
import { regionField, signedDistance } from './hair-region';
import { hairAzimuth } from './hair-shell';
import { CELLS, h2, vnoise, wrap } from './hair-hash';
import type { HairVolume } from './hair-volume-types';
import { PART } from './mesh';
import type { HeadTurnSpec, V3 } from './types';

/**
 * DESSIN DES MÈCHES du volume 3D, calculé PAR PIXEL à partir de la position 3D (azimut, hauteur) : aucune couture de grille, aucune dépendance à la vue. Le motif tourne donc avec la tête
 * exactement comme la surface qui le porte. Les mèches sont des cellules en `N` colonnes (N entier : le motif est périodique en azimut, il se referme sans raccord à 360°) ; N étant constant
 * sur toute la hauteur, les mèches se resserrent vers le sommet et CONVERGENT sur l'épi comme de vrais cheveux. Chaque colonne est découpée en segments de longueur propre (mèches décalées, pas
 * de lignes de scan alignées), un segment a sa teinte ; le bord d'une colonne est un fin trait sombre. Boucles / crépu : cellules de Voronoï (une boucle = une cellule claire au centre, sombre au creux).
 */
export interface StrandOut { readonly c: RGB; readonly ink: number }

const step = (a: number, b: number, x: number): number => smooth((x - a) / (b - a));

/** Colonnes autour d'un tube (queue, tresse) et d'un chignon. */
const TUBE_CELLS = 7, BUN_CELLS = 20;

/** Mèches droites / ondulées : chaque colonne a une teinte propre (cœur de la mèche), qui dérive doucement le long de la mèche (reflets, mèches plus claires par endroits) ; pas de rectangles. */
function straight(N: number, u: number, v: number, seed: number, wave: number): { tone: number; edge: number } {
  const i0 = Math.floor(u), cell0 = wrap(i0, N), uu = wave ? u + wave * Math.sin(v * 22 + cell0 * 1.7) : u, i = Math.floor(uu), f = uu - i, cell = wrap(i, N);
  const base = (h2(cell, 11, seed) - 0.5) * 0.9, drift = (vnoise(cell, v + 3 * h2(cell, 5, seed), 0.22, seed + 9) - 0.5) * 0.7, gloss = vnoise(cell, v, 0.6, seed + 4) > 0.8 ? 0.25 : 0;
  // Grain fin à l'intérieur de la mèche : 2 fils par colonne, trait plus clair au centre.
  const core = 0.18 * (1 - step(0, 0.5, Math.abs(f - 0.5) * 2));
  return { tone: 1.8 * (base + drift + gloss) + core, edge: step(0.4, 0.5, Math.abs(f - 0.5)) * (0.45 + 0.45 * h2(cell, 13, seed)) };
}

/** Cellule de Voronoï la plus proche (`d1`), seconde plus proche (`d2`) et identifiant de la cellule, en cellules de côté 1 (colonnes périodiques : N entier). */
function cells(N: number, gx: number, gy: number, seed: number): { d1: number; d2: number; id: number } {
  const ix = Math.floor(gx), iy = Math.floor(gy);
  let d1 = 9, d2 = 9, id = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const cx = ix + dx, cy = iy + dy, ci = wrap(cx, N), px = cx + 0.15 + 0.7 * h2(ci, cy, seed + 1), py = cy + 0.15 + 0.7 * h2(ci, cy, seed + 2), d = Math.hypot(gx - px, gy - py);
    if (d < d1) { d2 = d1; d1 = d; id = ci * 7919 + cy; } else if (d < d2) d2 = d;
  }
  return { d1, d2, id };
}

/**
 * Boucles / crépu : une cellule = une boucle (ou un paquet de boucles), éclairée comme un petit dôme (claire au centre, sombre au creux entre deux boucles) ; chaque boucle a sa teinte ; un
 * grain fin secondaire (cellules trois fois plus petites, faible amplitude) casse l'aplat sans devenir du bruit. Les boucles font ≈ 0,045 U : lisibles à la taille d'une planche.
 */
function voronoi(N: number, u: number, v: number, seed: number, cs: number): { tone: number; edge: number } {
  const c = cells(N, u, v / cs, seed), f = cells(N * 3, u * 3, (v / cs) * 3, seed + 7);
  const dome = 0.8 * (1 - Math.min(1, c.d1 / 0.7)) ** 1.3, tone = dome - 0.28 + (h2(c.id, 5, seed) - 0.5) * 0.5 + (h2(f.id, 9, seed) - 0.5) * 0.22;
  return { tone, edge: step(0.2, 0, c.d2 - c.d1) * 0.9 };
}

function braided(u: number, v: number): { tone: number; edge: number } {
  const w = u + v * 9, f = w - Math.floor(w);
  const e = Math.min(f, Math.abs(f - 0.5), 1 - f);   // distance au bord d'une côte de la tresse
  return { tone: f < 0.5 ? 0.3 : -0.28, edge: step(0.06, 0, e) * 0.8 };
}

/** Dessin des mèches en (u, v) : `u` = colonnes (cellules), `v` = hauteur ou longueur (U). */
export function strandSample(vol: HairVolume, u: number, v: number, N: number): { tone: number; edge: number } {
  const t = vol.texture, seed = vol.seed & 0xffff;
  if (t === 'braided') return braided(u, v);
  if (t === 'curly' || t === 'coily') return voronoi(N, u, v, seed, (2 * Math.PI * 0.42) / N);
  return straight(N, u, v, seed, t === 'wavy' ? 0.3 * (0.4 + vol.curl) : 0);
}

/**
 * Couleur de base (avant éclairage) d'un pixel de cheveux : teinte de la mèche, racines assombries près de la lisière (profondeur du cuir chevelu), part d'encre des creux entre mèches.
 * `uv` = coordonnées de texture du maillage pour les pièces (queue, tresse, chignon) ; la coque les calcule de la position 3D.
 */
export function strandColor(spec: HeadTurnSpec, vol: HairVolume, id: number, p: V3, uv: readonly [number, number], hair: RGB, shade: RGB): StrandOut {
  const shell = id === PART.hair;
  let u: number, v: number, N: number, root = 0;
  if (shell) {
    const az = hairAzimuth(spec, p);
    N = CELLS[vol.texture] ?? 72; u = (az / 360) * N; v = p.y;
    const R = spec.hairline.region;
    if (R && p.y > spec.rows[0]!.y) root = 1 - smooth(signedDistance(regionField(R), az, p.y) / 0.06);
  } else {
    N = id === PART.hairBun ? BUN_CELLS : TUBE_CELLS;
    u = uv[0] * N; v = id === PART.hairBun ? uv[1] * 0.9 : uv[1];
  }
  const s = strandSample(vol, u, v, N), light = mix(hair, [255, 255, 255], 0.22);
  const base = s.tone >= 0 ? mix(hair, light, clamp(s.tone, 0, 1)) : mix(hair, shade, clamp(-s.tone, 0, 1) * 0.9);
  return { c: mix(base, shade, 0.55 * root), ink: s.edge * (shell ? 0.5 : 0.6) };
}

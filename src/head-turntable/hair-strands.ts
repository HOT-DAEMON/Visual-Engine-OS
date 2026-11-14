import { hex, mix, type RGB } from './color';
import { clamp, smooth } from './math';
import { hairAzimuth, hairEdgeDistance } from './hair-shell';
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
function straight(N: number, u0: number, v: number, seed: number, wave: number): { tone: number; edge: number } {
  // Colonnes de LARGEURS INÉGALES : déformation de u par deux sinusoïdes à nombre entier de périodes par tour (11 et 29 : sans raccord à 360°), de pente cumulée < 1 (une colonne ne s'inverse jamais). Des colonnes toutes égales = l'aspect mécanique.
  const th = (u0 / N) * 2 * Math.PI, u = u0 + 0.32 * Math.sin(11 * th + 6.28 * h2(1, 1, seed)) + 0.18 * Math.sin(29 * th + 6.28 * h2(2, 2, seed));
  const i0 = Math.floor(u), cell0 = wrap(i0, N), uu = wave ? u + wave * Math.sin(v * 22 + cell0 * 1.7) : u, i = Math.floor(uu), f = uu - i, cell = wrap(i, N);
  // Paquets : quatre colonnes voisines partagent un écart de teinte (les mèches se regroupent, N est multiple de 4).
  const clump = (h2(Math.floor(cell / 4), 31, seed) - 0.5) * 0.8;
  const base = (h2(cell, 11, seed) - 0.5) * 0.9, drift = (vnoise(cell, v + 3 * h2(cell, 5, seed), 0.22, seed + 9) - 0.5) * 0.7, gloss = vnoise(cell, v, 0.6, seed + 4) > 0.8 ? 0.25 : 0;
  // Grain fin à l'intérieur de la mèche : 2 fils par colonne, trait plus clair au centre.
  const core = 0.18 * (1 - step(0, 0.5, Math.abs(f - 0.5) * 2));
  return { tone: 1.8 * (base + drift + gloss) + clump + core, edge: step(0.4, 0.5, Math.abs(f - 0.5)) * (0.45 + 0.45 * h2(cell, 13, seed)) };
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
  // Deuxième ÉCHELLE : des PAQUETS d'environ trois boucles (cellules trois fois plus grandes, N est multiple de 3) partagent une teinte et sont séparés par un creux plus marqué ; sans elle, la masse est un tapis de boucles toutes pareilles.
  const g = cells(Math.round(N / 3), u / 3, v / cs / 3, seed + 13);
  const dome = 0.8 * (1 - Math.min(1, c.d1 / 0.7)) ** 1.3, tone = dome - 0.28 + (h2(c.id, 5, seed) - 0.5) * 0.5 + (h2(f.id, 9, seed) - 0.5) * 0.22 + (h2(g.id, 17, seed) - 0.5) * 0.4;
  return { tone, edge: Math.max(step(0.2, 0, c.d2 - c.d1) * 0.9, step(0.12, 0, g.d2 - g.d1) * 0.55) };
}

/** Chaume (`buzz`) : grain fin (cellules quatre fois plus étroites), peu contrasté, sans trait de mèche : des poils rasés, pas des mèches. */
function stubble(N: number, u: number, v: number, seed: number): { tone: number; edge: number } {
  const s = voronoi(N * 4, u * 4, v, seed + 21, (2 * Math.PI * 0.42) / (N * 4));
  return { tone: 0.22 * s.tone, edge: 0.1 * s.edge };
}

/** Décalage (en cellules) du motif des mèches selon la position : TOURBILLON autour du vertex (les mèches tournent en spirale autour de l'épi, nul sous `y = 0,55 U`) et BALAYAGE du front (les mèches de la frange partent en biais depuis l'implantation, vers le côté où la frange descend). Lisse en az et en y ; nul derrière (|az| ≥ 92°) : le motif reste périodique en azimut. */
export function flowShift(vol: HairVolume, N: number, az: number, y: number): number {
  const k = N / 72;
  return (vol.whorl ?? 0) * k * smooth(1 - y / 0.55) ** 1.5 + (vol.sweep ?? 0) * k * smooth((y - 0.1) / 0.25) * smooth((92 - Math.abs(az)) / 40);
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
  if (vol.style === 'buzz') return stubble(N, u, v, seed);
  if (t === 'curly' || t === 'coily') return voronoi(N, u, v, seed, (2 * Math.PI * 0.42) / N);
  return straight(N, u, v, seed, t === 'wavy' ? 0.3 * (0.4 + vol.curl) : 0);
}

/**
 * Couleur de base (avant éclairage) d'un pixel de cheveux : teinte de la mèche, racines assombries près de la lisière (profondeur du cuir chevelu), part d'encre des creux entre mèches.
 * `uv` = coordonnées de texture du maillage pour les pièces (queue, tresse, chignon) ; la coque les calcule de la position 3D.
 */
export function strandColor(spec: HeadTurnSpec, vol: HairVolume, id: number, p: V3, uv: readonly [number, number], hair: RGB, shade: RGB): StrandOut {
  const shell = id === PART.hair, buzz = vol.style === 'buzz';
  let u: number, v: number, N: number, root = 0;
  if (shell) {
    const az = hairAzimuth(spec, p), round = vol.texture === 'curly' || vol.texture === 'coily';
    N = CELLS[vol.texture] ?? 72; v = p.y;
    // Mèches droites / ondulées : le motif suit le flux (tourbillon du sommet, balayage de la frange) ; les boucles et le chaume n'ont pas de sens de mèche.
    u = (az / 360) * N + (round || buzz ? 0 : flowShift(vol, N, az, p.y));
    if (p.y > spec.rows[0]!.y) root = 1 - smooth(hairEdgeDistance(spec, vol, az, p.y) / (buzz ? 0.1 : 0.06));   // distance à la lisière, FRANGE comprise
  } else {
    N = id === PART.hairBun ? BUN_CELLS : TUBE_CELLS;
    u = uv[0] * N; v = id === PART.hairBun ? uv[1] * 0.9 : uv[1];
  }
  const s = strandSample(vol, u, v, N), light = mix(hair, [255, 255, 255], 0.22);
  const base = s.tone >= 0 ? mix(hair, light, clamp(s.tone, 0, 1)) : mix(hair, shade, clamp(-s.tone, 0, 1) * 0.9);
  const c = mix(base, shade, 0.55 * root);
  // Cheveux rasés : la peau transparaît (plus près de la lisière, plus la racine est fondue dans la peau) — pas de bord dur entre la peau et un casque de chaume.
  return { c: shell && buzz ? mix(c, hex(spec.palette.skin), 0.45 * root + 0.03) : c, ink: s.edge * (shell ? 0.5 : 0.6) };
}

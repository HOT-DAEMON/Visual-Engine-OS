import type { Vec } from '../../geometry/eye/primitives';
import { rotate } from '../curve';
import type { Poly } from '../poly';
import { box } from './plan-geom';
import type { EarModel, PlacedStructure } from './types';

/**
 * PROJECTION D'UN MÊME MODÈLE DANS LES QUATRE VUES. Le pavillon est un plan écarté du crâne de α (angle d'ouverture) ; un point (u, v, h) du plan
 * (u : avant → arrière, v : haut → bas, h : relief le long de la normale) est placé dans le monde (X latéral sortant, Z vers l'avant) puis projeté par
 * une caméra de lacet φ (0 = face, 90 = profil du côté de l'oreille) :
 *    X = s·(x₀(v) + sin α · u · H + cos α · h)      Z = −cos α · u · H + sin α · h + pente(v)
 *    x_écran = X cos φ − Z sin φ                     y_écran = y(v)        (la caméra tourne autour de l'axe vertical : y NE CHANGE PAS)
 * Invariant testé : la hauteur de chaque repère est IDENTIQUE dans toutes les vues ; seule l'abscisse change selon φ et le relief. C'est ce qui
 * interdit « quatre illustrations convaincantes mais quatre géométries incompatibles ».
 */
export type ViewName = 'face' | 'three-quarter' | 'profile' | 'close-up';
export const VIEW_YAW: Readonly<Record<ViewName, number>> = { face: 0, 'three-quarter': 45, profile: 90, 'close-up': 75 };

/** Placement de l'oreille dans l'hôte : taille (px), haut (y), attache au crâne, angles. */
export interface EarPlacement {
  readonly side: -1 | 1;
  /** Hauteur de l'oreille (px) et ordonnée de son sommet dans l'hôte. */
  readonly hPx: number;
  readonly topY: number;
  /** Abscisse (px, ≥ 0) de la surface du crâne à l'ordonnée y : l'oreille y est attachée par son bord antérieur. */
  readonly skullX: (y: number) => number;
  readonly openingDeg: number;
  readonly pitchDeg: number;
  readonly rotationDeg: number;
  /** Ordonnée (plan) autour de laquelle tourne l'oreille : la racine de l'hélix. */
  readonly pivotV: number;
}

/** Point (u, v, h) du plan → hôte (px), pour le lacet `yawDeg` de la caméra. `h` en px (relief × épaisseur). */
export function projectPoint(pl: EarPlacement, q: Vec, h: number, yawDeg: number, pivot: Vec): Vec {
  const s = pl.side;
  const a = (pl.openingDeg * Math.PI) / 180;
  const f = (yawDeg * Math.PI) / 180;
  // Rotation locale dans le plan, autour de la racine de l'hélix (sens miroir pour l'oreille gauche).
  const r = rotate({ x: q.x - pivot.x, y: q.y - pivot.y }, s * pl.rotationDeg);
  const u = r.x + pivot.x;
  const v = r.y + pivot.y;
  const y = pl.topY + v * pl.hPx;
  const sk = pl.skullX(y);
  const pitch = ((v - pl.pivotV) * pl.hPx * Math.sin((pl.pitchDeg * Math.PI) / 180));
  const X = s * (sk + Math.sin(a) * u * pl.hPx + Math.cos(a) * h);
  const Z = -Math.cos(a) * u * pl.hPx + Math.sin(a) * h + pitch;
  return { x: X * Math.cos(f) - Z * Math.sin(f), y };
}

/** Vrai si la face externe (concave) de l'oreille est tournée vers la caméra. */
export const faceVisible = (pl: EarPlacement, yawDeg: number): boolean => {
  const a = (pl.openingDeg * Math.PI) / 180;
  const f = (yawDeg * Math.PI) / 180;
  return pl.side * Math.cos(a) * Math.sin(f) + Math.sin(a) * Math.cos(f) > 1e-6;
};

export interface ProjectedEar {
  readonly view: ViewName | 'custom';
  readonly yawDeg: number;
  readonly visible: boolean;
  /** Contour à la plaque (h = 0) et au bord de l'hélix (h = relief de l'hélix) : la silhouette est leur réunion. */
  readonly plate: Poly;
  readonly rim: Poly;
  /** Structures projetées, triées du plus bas au plus haut relief (ordre de dessin). */
  readonly structures: { readonly s: PlacedStructure; readonly poly: Poly }[];
  /** Enveloppe de la silhouette (boîte) et surface projetée par rapport à la surface du plan (compression apparente en x). */
  readonly bbox: { x0: number; y0: number; x1: number; y1: number };
  /** Facteur de compression horizontale moyen (largeur projetée / largeur du plan) : < 1 de face, ≈ cos α de profil. */
  readonly xScale: number;
  /** Repères (plan → hôte) pour cette vue. */
  readonly landmarks: Readonly<Record<string, Vec>>;
}

export function projectEar(m: EarModel, pl: EarPlacement, yawDeg: number, view: ViewName | 'custom' = 'custom'): ProjectedEar {
  const T = m.thickness * pl.hPx;
  const pivot = m.landmarks.crus as Vec;
  const P = (q: Vec, rel: number): Vec => projectPoint(pl, q, rel * T, yawDeg, pivot);
  const helix = m.structures.find((s) => s.id === 'helix');
  const rimH = helix ? helix.relief : 0.9;
  const plate = m.outline.map((q) => P(q, 0));
  const rim = m.outline.map((q) => P(q, rimH));
  const structures = [...m.structures].sort((a, b) => a.relief - b.relief).map((s) => ({ s, poly: s.poly.map((q) => P(q, s.relief)) }));
  const b = box([...plate, ...rim]);
  // Compression horizontale PURE : mesurée avec une surface du crâne plane (la courbure du contour du visage décalerait la boîte d'un facteur étranger à la vue).
  const flat = { ...pl, skullX: () => 0 };
  const fb = box([...m.outline.map((q) => projectPoint(flat, q, 0, yawDeg, pivot)), ...m.outline.map((q) => projectPoint(flat, q, rimH * T, yawDeg, pivot))]);
  const planeW = Math.max(...m.outline.map((q) => q.x)) * pl.hPx;
  return {
    view,
    yawDeg,
    visible: faceVisible(pl, yawDeg),
    plate,
    rim,
    structures,
    bbox: b,
    xScale: (fb.x1 - fb.x0) / planeW,
    landmarks: Object.fromEntries(Object.entries(m.landmarks).map(([k, q]) => [k, P(q, 0)])),
  };
}

/** Enveloppe convexe d'un nuage de points (algorithme de la chaîne monotone) : silhouette de l'oreille pour les ombres de contact et les cheveux. */
export function hull(pts: readonly Vec[]): Poly {
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Vec, a: Vec, b: Vec): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Vec[] = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2] as Vec, lower[lower.length - 1] as Vec, q) <= 0) lower.pop(); lower.push(q); }
  const upper: Vec[] = [];
  for (const q of [...p].reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2] as Vec, upper[upper.length - 1] as Vec, q) <= 0) upper.pop(); upper.push(q); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

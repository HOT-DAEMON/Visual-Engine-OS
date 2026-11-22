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
  /** Demi-largeur RÉELLE du contour de la tête à l'ordonnée y (px) : sert à la jupe de racine (la surface d'accrochage `skullX` est plus verticale que ce contour). */
  readonly headX?: (y: number) => number;
  readonly openingDeg: number;
  readonly pitchDeg: number;
  readonly rotationDeg: number;
  /** Ordonnée (plan) autour de laquelle tourne l'oreille : la racine de l'hélix. */
  readonly pivotV: number;
}

/**
 * Point (u, v, h) du plan → monde 3D de l'hôte (X latéral sortant, y vers le bas, Z vers l'avant), AVANT toute caméra. `h` en px (relief × épaisseur).
 * C'est la seule définition du placement : `projectPoint` (vues 2D) et les moteurs 3D (`head-turntable`) l'appellent, il n'y a pas de deuxième formule.
 */
export function placeEarPoint(pl: EarPlacement, q: Vec, h: number, pivot: Vec): { X: number; y: number; Z: number } {
  const s = pl.side;
  const a = (pl.openingDeg * Math.PI) / 180;
  // Rotation locale dans le plan, autour de la racine de l'hélix (sens miroir pour l'oreille gauche).
  const r = rotate({ x: q.x - pivot.x, y: q.y - pivot.y }, s * pl.rotationDeg);
  const u = r.x + pivot.x;
  const v = r.y + pivot.y;
  const y = pl.topY + v * pl.hPx;
  const sk = pl.skullX(y);
  const pitch = ((v - pl.pivotV) * pl.hPx * Math.sin((pl.pitchDeg * Math.PI) / 180));
  return { X: s * (sk + Math.sin(a) * u * pl.hPx + Math.cos(a) * h), y, Z: -Math.cos(a) * u * pl.hPx + Math.sin(a) * h + pitch };
}

/** Point (u, v, h) du plan → hôte (px), pour le lacet `yawDeg` de la caméra. */
export function projectPoint(pl: EarPlacement, q: Vec, h: number, yawDeg: number, pivot: Vec): Vec {
  const { X, y, Z } = placeEarPoint(pl, q, h, pivot);
  const f = (yawDeg * Math.PI) / 180;
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

/**
 * ATTACHE PAR CISAILLEMENT (passe 5, remplace la « jupe de racine »). Le bord antérieur du pavillon (crus de l'hélix, tragus, jonction lobule-joue) EST la ligne d'attache : il touche la tête sur toute sa longueur.
 * Le plan du pavillon reste quasi vertical (`EAR_LEAN`), alors que le contour de la tête rentre sous l'oreille (mâchoire) ; au lieu de combler l'écart par une bande de peau (qui se lit comme une peau
 * séparant l'oreille de la tête), on cisaille le pavillon dans le plan latéral : le déplacement vaut l'écart mesuré entre la surface d'accrochage et le contour réel de la tête (moins un léger recouvrement),
 * il est maximal sur le bord antérieur (u = 0) et s'éteint vers l'arrière (u ≈ 0,45) : le rebord de l'hélix et le lobule, eux, restent libres. Seule la composante latérale X bouge (la hauteur de chaque repère
 * reste identique dans toutes les vues ; de profil, le cisaillement est invisible par construction).
 */
export const ATTACH_OVERLAP = 0.012;
export const ATTACH_REACH = 0.3;
/** Abscisse canonique du bord antérieur à la hauteur v (chaîne C06 → C05 → C04 du contour) : le cisaillement se mesure à partir de CE bord, pas de u = 0 (la jonction lobule-joue est en retrait du crus). */
const edgeCache = new WeakMap<EarModel, (v: number) => number>();
export function anteriorEdge(m: EarModel): (v: number) => number {
  const hit = edgeCache.get(m);
  if (hit) return hit;
  const pts = m.segments.filter((sg) => sg.id === 'C06' || sg.id === 'C05' || sg.id === 'C04').flatMap((sg) => Array.from({ length: sg.to - sg.from + 1 }, (_, k) => m.outline[(sg.from + k) % m.outline.length] as Vec));
  const f = (v: number): number => { let best = 0, bd = Infinity; for (const q of pts) { const d = Math.abs(q.y - v); if (d < bd) { bd = d; best = q.x; } } return bd < 0.06 ? Math.max(0, best) : 0; };
  edgeCache.set(m, f);
  return f;
}
export function attachShear(pl: EarPlacement, y: number, u: number, uEdge = 0): number {
  const hx = pl.headX;
  if (!hx) return 0;
  // Le bord antérieur est à `uEdge` du plan : il est déjà écarté de sin α · uEdge · H de la surface d'accrochage, c'est CE point qui doit toucher la tête.
  const gap = pl.skullX(y) + Math.sin((pl.openingDeg * Math.PI) / 180) * uEdge * pl.hPx - (hx(y) - ATTACH_OVERLAP * pl.hPx);
  const s = Math.max(0, u - uEdge) / ATTACH_REACH;
  const k = Math.max(0, 1 - s);
  return -Math.min(0.3 * pl.hPx, Math.max(0, gap)) * k * k;
}

/** Point (u, v, h) du plan → hôte (px) avec l'attache cisaillée. */
export function projectPlaced(m: EarModel, pl: EarPlacement, q: Vec, h: number, yawDeg: number, pivot: Vec): Vec {
  const { X, y, Z } = placeEarPoint(pl, q, h, pivot);
  const Xs = X + pl.side * attachShear(pl, y, q.x, anteriorEdge(m)(q.y));
  const f = (yawDeg * Math.PI) / 180;
  return { x: Xs * Math.cos(f) - Z * Math.sin(f), y };
}

export function projectEar(m: EarModel, pl: EarPlacement, yawDeg: number, view: ViewName | 'custom' = 'custom'): ProjectedEar {
  const T = m.thickness * pl.hPx;
  const pivot = m.landmarks.crus as Vec;
  const P = (q: Vec, rel: number): Vec => projectPlaced(m, pl, q, rel * T, yawDeg, pivot);
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

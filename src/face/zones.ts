import type { Vec } from '../geometry/eye/primitives';
import type { FaceParams } from '../schema';
import { buildHairline } from './hair/hairline';
import type { FaceLandmarks } from './landmarks';
import { halfWidthAt, rightSamples } from './outline';
import { ZONE_LIMITS } from './zones-limits';

/** Une zone verticale : repères haut/bas (px, repère de l'hôte), hauteur, fraction de H et bornes admises (si la zone en a). */
export interface ZoneBand {
  readonly id: 'scalp' | 'forehead' | 'eyes' | 'nose' | 'philtrum' | 'lips' | 'chin';
  readonly label: string;
  readonly topY: number;
  readonly bottomY: number;
  readonly heightPx: number;
  /** Hauteur / H. */
  readonly share: number;
  readonly limits: { readonly min: number; readonly max: number } | null;
}

/** Frontière d'implantation : la ligne où poussent les cheveux, rattachée au sommet du crâne et au point de tempe. */
export interface HairBoundary {
  /** Sommet du crâne (ordonnée) et centre de la ligne d'implantation. */
  readonly crownY: number;
  readonly centerY: number;
  /** Point de tempe DROIT : l'implantation rejoint le contour du crâne ici (x, y). */
  readonly temple: Vec;
  /** Ligne d'implantation, de la tempe gauche à la tempe droite. */
  readonly line: Vec[];
  /** Arc du crâne (contour au-dessus de la tempe), de la tempe gauche au sommet puis à la tempe droite : borne EXTERNE du cuir chevelu. */
  readonly crownArc: Vec[];
  /** Hauteur du cuir chevelu au centre, et du front au centre, en fraction de H. */
  readonly scalpShare: number;
  readonly foreheadShare: number;
}

export interface FaceZones {
  readonly bands: ZoneBand[];
  readonly hair: HairBoundary;
  /** Part du front dans la hauteur sommet → ligne des yeux (le front varie avec la hauteur du crâne). */
  readonly foreheadOfCranium: number;
}

/** Frontière d'implantation : ligne construite par `buildHairline` (celle que le rendu des cheveux dessine), bornée par le sommet du crâne et la tempe. */
export function hairBoundary(p: FaceParams, lm: FaceLandmarks): HairBoundary {
  // La frontière est BORNÉE au crâne : un point de la ligne ne dépasse jamais 98,5 % de la demi-largeur du contour à son ordonnée (le bruit de la ligne de cheveux peut
  // faire sortir son extrémité de quelques pixels aux tempes) — la frontière documentée est toujours dans le crâne.
  const raw = buildHairline(p, lm);
  const pts = raw.pts.map((q) => ({ x: Math.sign(q.x) * Math.min(Math.abs(q.x), halfWidthAt(lm.outline, q.y) * 0.985), y: q.y }));
  const hl = { pts };
  const top = -lm.H / 2;
  const first = pts[0] as Vec;
  const last = pts[pts.length - 1] as Vec;
  // Arc du crâne : les échantillons du contour droit au-dessus de l'ordonnée de la tempe, puis leur miroir (de gauche à droite en passant par le sommet).
  const arcR = rightSamples(lm.outline, 40).filter((q) => q.y <= last.y + 1e-6);
  const crownArc = [...[...arcR].reverse().map((q) => ({ x: -q.x, y: q.y })).reverse(), ...arcR].sort((a, b) => a.x - b.x);
  return {
    crownY: top,
    centerY: lm.hair.centerY,
    // Bornée à la demi-largeur du crâne à cette ordonnée : près du sommet, le contour est presque horizontal et deux échantillonnages différents (40 vs 48 points)
    // donnaient jusqu'à +3,8 % (défaut antérieur, révélé par la campagne : graines 35, 65, 89).
    temple: { x: Math.min(Math.max(Math.abs(first.x), Math.abs(last.x)), halfWidthAt(lm.outline, last.y)), y: last.y },
    line: hl.pts,
    crownArc,
    scalpShare: (lm.hair.centerY - top) / lm.H,
    foreheadShare: (lm.browLimitY - lm.hair.centerY) / lm.H,
  };
}

/** Largeur du crâne au niveau du point de tempe (px) : référence pour vérifier que l'implantation reste DANS le crâne. */
export const templeHalfWidth = (lm: FaceLandmarks, y: number): number => halfWidthAt(lm.outline, y);

/** Les sept zones verticales (voir `zones-limits.ts`) + la frontière d'implantation. Pure : ne lit que les repères résolus. */
export function faceZones(p: FaceParams, lm: FaceLandmarks): FaceZones {
  const H = lm.H;
  const top = -H / 2;
  const hair = hairBoundary(p, lm);
  const edges: [ZoneBand['id'], string, number, number, ZoneBand['limits']][] = [
    ['scalp', 'cuir chevelu', top, lm.hair.centerY, null],
    ['forehead', 'front', lm.hair.centerY, lm.browLimitY, ZONE_LIMITS.forehead],
    ['eyes', 'yeux', lm.browLimitY, lm.eyeY, null],
    ['nose', 'nez', lm.eyeY, lm.noseBaseY, ZONE_LIMITS.nose],
    ['philtrum', 'philtrum', lm.noseBaseY, lm.lips.topY, ZONE_LIMITS.philtrum],
    ['lips', 'lèvres', lm.lips.topY, lm.lips.bottomY, null],
    ['chin', 'menton', lm.lips.bottomY, lm.chinY, ZONE_LIMITS.chin],
  ];
  const bands = edges.map(([id, label, a, b, limits]): ZoneBand => ({ id, label, topY: a, bottomY: b, heightPx: b - a, share: (b - a) / H, limits }));
  return { bands, hair, foreheadOfCranium: (lm.browLimitY - lm.hair.centerY) / (lm.eyeY - top) };
}

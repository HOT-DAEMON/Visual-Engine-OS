import { clamp, rad } from '../core/math';
import { browGeometry, openingGeometry, type Vec } from '../geometry/eye';
import { minHalfWidth } from './outline';
import type { FaceLandmarks } from './landmarks';
import { EyeSpec, type SceneInput } from '../schema';

export type EyeInput = Extract<SceneInput['objects'][number], { kind: 'eye' }>;
export type EyeSide = 'left' | 'right';

/** Marge (fraction de W) entre le bord extérieur de l'œil et le contour du crâne (temple/oreille). */
const TEMPLE_MARGIN = 0.045;
/** Part de la demi-distance inter-canthale que l'œil peut empiéter vers la ligne médiane (sourcil/pli). */
const INNER_LIMIT = 0.92;
/** Marge de sécurité sur le sourcil (l'expression le déplace un peu) et sur le rayon du liner/des cils longs. */
const BROW_SLACK = 1.05;

/** Étendue de l'œil, en pixels de son repère local, MESURÉE depuis son canthus interne `pi`. */
export interface EyeReach {
  readonly pi: Vec;
  /** Distance maximale vers l'extérieur / vers la ligne médiane / vers le haut / vers le bas. */
  readonly out: number;
  readonly inn: number;
  readonly up: number;
  readonly down: number;
  /** Largeur de la seule fente palpébrale (canthus à canthus). */
  readonly aperture: number;
}

/**
 * Empreinte d'un œil neutre : fente palpébrale + pli + cils (longueur × (1 + allongement externe)) +
 * sourcil (géométrie exacte, 5 % de marge) + aile du liner. Les cils et l'aile sont une borne
 * volontairement généreuse : mieux vaut un œil un peu plus petit qu'un cil qui sort du visage.
 */
export function eyeReach(spec: EyeSpec): EyeReach {
  const g = openingGeometry(spec.shape, spec.canthi);
  const s = g.s;
  const b = g.bbox;
  const crease = Math.max(0, spec.lids.crease.height) * g.h;
  const upper = spec.lashes.upper;
  const lashUp = upper.length * g.h * (1 + upper.outerLength);
  const lashDown = spec.lashes.lower.count > 0 ? spec.lashes.lower.length * g.h : 0;
  const wing = (spec.lids.liner ? 0.2 : 0.08) * g.w;

  let top = b.y - Math.max(crease, lashUp);
  let minX = b.x;
  let maxX = b.x + b.w;
  if (spec.eyebrow) {
    const bb = browGeometry(g, spec.eyebrow, spec.lids.crease.height).bbox;
    top = Math.min(top, g.pi.y + (bb.y - g.pi.y) * BROW_SLACK);
    minX = Math.min(minX, bb.x);
    maxX = Math.max(maxX, bb.x + bb.w);
  }
  const bottom = b.y + b.h + lashDown;
  // Axe « vers l'extérieur » = s ; le liner/les cils longs débordent au-delà du canthus externe.
  const outward = (x: number): number => (x - g.pi.x) * s;
  const out = Math.max(outward(minX), outward(maxX)) + wing;
  const inn = Math.max(0, -Math.min(outward(minX), outward(maxX)));
  return { pi: g.pi, out, inn, up: Math.max(0, g.pi.y - top), down: Math.max(0, bottom - g.pi.y), aperture: Math.abs(g.po.x - g.pi.x) };
}

/**
 * Étendue de l'œil après rotation `deg` autour de son canthus interne : boîte englobante des 4 coins
 * (CONSERVATRICE : la vraie fente est plus petite que la boîte). `s` = sens « vers l'extérieur » (-1 : œil de gauche).
 * Rotation nulle → l'étendue d'origine, strictement.
 */
function rotateReach(r: EyeReach, s: number, deg: number): EyeReach {
  if (deg === 0) return r;
  const t = rad(deg);
  const c = Math.cos(t);
  const sn = Math.sin(t);
  const xs = s > 0 ? [-r.inn, r.out] : [-r.out, r.inn];
  const pts = xs.flatMap((x) => [-r.up, r.down].map((y): [number, number] => [x * c - y * sn, x * sn + y * c]));
  const px = pts.map((q) => q[0] * s);
  return { ...r, out: Math.max(...px), inn: Math.max(0, -Math.min(...px)), up: Math.max(0, -Math.min(...pts.map((q) => q[1]))), down: Math.max(0, Math.max(...pts.map((q) => q[1]))) };
}

export interface EyeFit {
  /** Échelle uniforme appliquée à l'œil (transform.scale). */
  readonly scale: number;
  /** Transform de l'œil, RELATIF à l'ancre du canthus interne : amène `pi` exactement sur l'ancre (même tourné). */
  readonly transform: { readonly x: number; readonly y: number; readonly rotationDeg: number; readonly scale: number };
  /** L'œil à poser : celui reçu, avec l'ouverture ajustée par l'asymétrie du visage (identique si symétrique). */
  readonly eye: EyeInput;
  /** Ancre (canthus interne) dans le repère de l'hôte. */
  readonly anchor: Vec;
  /** Boîte occupée par l'œil (fente + pli + cils + sourcil) dans le repère de l'hôte. */
  readonly footprint: { readonly minX: number; readonly maxX: number; readonly minY: number; readonly maxY: number };
  /** Contrainte qui a fixé l'échelle (diagnostic). */
  readonly limitedBy: 'target' | 'outer' | 'inner' | 'up' | 'down';
}

export interface FitOptions {
  /** Facteur de grosseur voulu (1 = proportion normale du visage) ; l'ajustement le réduit si besoin. */
  readonly size?: number;
  /** Part de l'espace temporal occupée par la fente palpébrale (0,4–1). */
  readonly fill?: number;
}

/**
 * Pose un œil sur un visage. L'ancre est le CANTHUS INTERNE, dont la place est fixée par le visage
 * (ligne des yeux, écart inter-canthal) : elle ne dépend NI de la forme, NI de la taille de l'œil.
 * La taille est ensuite bornée par l'orbite : largeur disponible jusqu'au temple, hauteur sous le
 * front nu et au-dessus du nez, ligne médiane. Un œil trop grand rétrécit ; il ne déborde jamais.
 */
export function fitEyeToFace(input: EyeInput, side: EyeSide, lm: FaceLandmarks, options: FitOptions = {}): EyeFit {
  const A = lm.asymmetry;
  const s = side === 'left' ? -1 : 1;
  // Asymétrie : l'ouverture se règle sur l'œil AVANT la mesure, pour que l'empreinte reste exacte.
  const openness = clamp((input.shape?.openness ?? 1) * (1 - (s * A.eyeOpenness) / 2), 0.05, 1.2);
  const eye: EyeInput = A.eyeOpenness === 0 ? input : { ...input, shape: { ...input.shape, openness } };
  const spec = EyeSpec.parse({ ...eye, place: undefined, shape: { ...eye.shape, outerSide: side } });
  const r = rotateReach(eyeReach(spec), s, A.eyeRollDeg);
  const P = side === 'left' ? lm.innerCanthus.left : lm.innerCanthus.right;
  const half = Math.abs(P.x);

  // 1. Taille souhaitée : la fente occupe `fill` de l'espace canthus → temple, modulée par la grosseur propre à l'œil.
  const fill = clamp(options.fill ?? 0.9, 0.4, 1);
  const rel = clamp((eye.shape?.width ?? 280) / 280, 0.8, 1.2) * (options.size ?? 1);
  const space = minHalfWidth(lm.outline, P.y - 0.08 * lm.H, P.y + 0.08 * lm.H) - half - TEMPLE_MARGIN * lm.W;
  const kTarget = (space * fill * rel) / r.aperture;

  // 2. Bornes dures.
  const kUp = r.up > 0 ? (P.y - lm.browLimitY) / r.up : Infinity;
  const kDown = r.down > 0 ? (lm.lowerLimitY - P.y) / r.down : Infinity;
  const kIn = r.inn > 0 ? (INNER_LIMIT * half) / r.inn : Infinity;
  const kVert = Math.min(kTarget, kUp, kDown, kIn);
  // La largeur disponible dépend de la hauteur occupée : on l'évalue à l'échelle provisoire `kVert`
  // (plus petite que l'échelle finale ne peut l'être → borne conservatrice, jamais optimiste).
  const avail = minHalfWidth(lm.outline, P.y - r.up * kVert, P.y + r.down * kVert) - half - TEMPLE_MARGIN * lm.W;
  const kOut = r.out > 0 ? avail / r.out : Infinity;

  const candidates: [EyeFit['limitedBy'], number][] = [['target', kTarget], ['up', kUp], ['down', kDown], ['inner', kIn], ['outer', kOut]];
  const [limitedBy, scale] = candidates.reduce((a, b) => (b[1] < a[1] ? b : a));
  // Asymétrie de taille : l'œil visé rétrécit (jamais ne grossit) → il reste dans l'orbite.
  const smaller = (A.eyeScale > 0 && side === 'right') || (A.eyeScale < 0 && side === 'left');
  const k = Math.max(0.01, scale) * (smaller ? 1 - Math.abs(A.eyeScale) : 1);

  // Le canthus interne local `pi` doit tomber sur l'ancre APRÈS rotation : x,y = -k·R(ρ)·pi.
  const t = rad(A.eyeRollDeg);
  const c = Math.cos(t);
  const sn = Math.sin(t);
  const xs = [P.x + s * r.out * k, P.x - s * r.inn * k];
  return {
    scale: k,
    transform: { x: -k * (r.pi.x * c - r.pi.y * sn), y: -k * (r.pi.x * sn + r.pi.y * c), rotationDeg: A.eyeRollDeg, scale: k },
    eye,
    anchor: P,
    footprint: { minX: Math.min(...xs), maxX: Math.max(...xs), minY: P.y - r.up * k, maxY: P.y + r.down * k },
    limitedBy,
  };
}

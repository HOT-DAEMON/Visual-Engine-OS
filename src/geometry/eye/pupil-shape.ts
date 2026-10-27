import { mulberry32 } from '../../core/prng';
import type { EyeSpec } from '../../schema';
import type { Vec } from './primitives';

/**
 * EYE-05 — Géométrie des pupilles (fonctions PURES, sans SVG, déterministes).
 * Chaîne : profil unitaire → échelle (rayons de l'iris) → déformation → rotation → centre → copies multiples.
 * Invariant garanti (testé) : tout point de tout contour reste DANS l'iris (voir `IRIS_FIT`).
 */

type Pupil = EyeSpec['pupil'];
export type Contour = readonly Vec[];

/** Fraction maximale du rayon de l'iris que la pupille (copies comprises) peut atteindre. */
export const IRIS_FIT = 0.95;
const ARC_SAMPLES = 64;
const TAU = Math.PI * 2;

/** Rayon pupillaire minimal accepté par la réponse lumineuse (évite une pupille de largeur nulle). */
const MIN_SIZE = 0.05;
const MAX_SIZE = 0.7;

// ------------------------------------------------------------------ EYE-05G : réponse lumineuse

/**
 * Facteur de taille selon le modèle d'espèce et la lumière (0 sombre → 1 éblouissant). Valeur 1 à `light` = 0,5.
 * circulaire : linéaire (1,45 → 0,55) ; fentes : exponentiel sur l'axe étroit (×2,45 → ×0,41), comme un iris à fente qui se ferme
 * sur un trait ; fixe : constant. Strictement décroissant en `light` pour tout modèle réactif (testé).
 */
export function pupilResponseFactor(model: Pupil['response']['model'], light: number): number {
  const l = Math.min(1, Math.max(0, light));
  if (model === 'fixed') return 1;
  if (model === 'circular') return 1.45 - 0.9 * l;
  return 6 ** (0.5 - l);
}

/** Taille nominale × réponse lumineuse, bornée. Identité si le modèle est `fixed` ou si `light` = 0,5. */
export function effectivePupilSize(pupil: Pupil): number {
  const f = pupilResponseFactor(pupil.response.model, pupil.response.light);
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, pupil.size * f));
}

// ------------------------------------------------------------------ Profils unitaires (rayon 1)

const ellipse = (n: number): Vec[] => Array.from({ length: n }, (_, i) => ({ x: Math.cos((i / n) * TAU), y: Math.sin((i / n) * TAU) }));

/** Étoile / polygone régulier : sommet 0 en haut (−90°), orientation reproductible. */
export function vertices(count: number, inner: number | null): Vec[] {
  const m = inner === null ? count : count * 2;
  return Array.from({ length: m }, (_, i) => {
    const a = -Math.PI / 2 + (i / m) * TAU;
    const r = inner !== null && i % 2 === 1 ? inner : 1;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  });
}

/** Croix : deux bandes de demi-épaisseur `t` ; 12 sommets. */
function cross(t: number): Vec[] {
  const a = Math.min(0.9, Math.max(0.12, t));
  return [[a, -1], [a, -a], [1, -a], [1, a], [a, a], [a, 1], [-a, 1], [-a, a], [-1, a], [-1, -a], [-a, -a], [-a, -1]].map(([x, y]) => ({ x: x as number, y: y as number }));
}

/** Trou de serrure : disque (rayon 0,62, centré en y = −0,18) ouvert vers le bas, prolongé par une fente évasée jusqu'à y = 1. */
function keyhole(): Vec[] {
  const gap = Math.asin(0.34);
  const pts: Vec[] = [];
  for (let i = 0; i <= ARC_SAMPLES; i++) {
    const a = Math.PI / 2 + gap + (i / ARC_SAMPLES) * (TAU - 2 * gap);
    pts.push({ x: 0.62 * Math.cos(a), y: -0.18 + 0.62 * Math.sin(a) });
  }
  return [...pts, { x: 0.2, y: 1 }, { x: -0.2, y: 1 }];
}

/** Coupe de coins de Chaikin : adoucit un polygone fermé, `passes` fois (chaque passe double les sommets). */
export function chaikin(pts: Contour, passes: number): Vec[] {
  let cur: Vec[] = [...pts];
  for (let k = 0; k < passes; k++) {
    const out: Vec[] = [];
    for (let i = 0; i < cur.length; i++) {
      const a = cur[i] as Vec;
      const b = cur[(i + 1) % cur.length] as Vec;
      out.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y }, { x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
    }
    cur = out;
  }
  return cur;
}

/** Profil unitaire d'une forme (rayon ≈ 1 dans les deux axes, centré sur l'origine). */
export function unitProfile(pupil: Pupil): Vec[] {
  const { shape, lobes } = pupil;
  let pts: Vec[];
  if (shape === 'star') pts = vertices(lobes.count, lobes.inner);
  else if (shape === 'polygon') pts = vertices(lobes.count, null);
  else if (shape === 'diamond') pts = vertices(4, null);
  else if (shape === 'cross') pts = cross(lobes.inner * 0.7);
  else if (shape === 'keyhole') pts = keyhole();
  else return ellipse(ARC_SAMPLES); // round, slit_* : ellipse ; les rayons portent la forme
  return lobes.rounding > 0 && shape !== 'keyhole' ? chaikin(pts, Math.round(lobes.rounding * 3)) : pts;
}

// ------------------------------------------------------------------ Rayons de base (identiques à `pupilRadii` historique)

export function baseRadii(shape: Pupil['shape'], size: number, irisRx: number, irisRy: number): { rx: number; ry: number } {
  if (shape === 'slit_vertical') return { rx: size * irisRx * 0.28, ry: irisRy * 0.82 };
  if (shape === 'slit_horizontal') return { rx: irisRx * 0.82, ry: size * irisRy * 0.28 };
  return { rx: size * irisRx, ry: size * irisRy };
}

// ------------------------------------------------------------------ EYE-05J : irrégularité (harmoniques lisses à graine)

/** Perturbation radiale lisse et reproductible : somme de 3 harmoniques (k = 2, 3, 5) de phases tirées de la graine. */
function irregularity(seed: number, amount: number): (angle: number) => number {
  const rnd = mulberry32(seed ^ 0x5bd1e995);
  const h = [2, 3, 5].map((k) => ({ k, phase: rnd() * TAU, amp: (0.5 + rnd() * 0.5) / k }));
  return (a) => 1 + amount * 0.14 * h.reduce((s, c) => s + c.amp * Math.sin(c.k * a + c.phase), 0);
}

export interface PupilContours {
  /** Un contour par pupille (1 sauf `multiple.count` > 1), repère LOCAL de l'iris : origine = centre de l'iris. */
  readonly contours: readonly Contour[];
  /** Facteur de réduction appliqué pour respecter `IRIS_FIT` (1 = aucun). Information de vérification. */
  readonly fitScale: number;
}

/** Contours finaux (déformés, tournés, décalés, multipliés), garantis à l'intérieur de l'iris. */
export function pupilContours(pupil: Pupil, size: number, irisRx: number, irisRy: number, seed: number): PupilContours {
  const { rx, ry } = baseRadii(pupil.shape, size, irisRx, irisRy);
  const { squash, skew, irregularity: irr } = pupil.deform;
  const noise = irr > 0 ? irregularity(seed, irr) : null;
  const a = (pupil.orientationDeg * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const sx = 1 + squash * 0.5; // largeur compensée : l'aire varie peu quand la pupille s'écrase
  const sy = 1 - squash;
  const unit = unitProfile(pupil);

  const one = (scale: number): Vec[] =>
    unit.map((u) => {
      const r = noise ? noise(Math.atan2(u.y, u.x)) : 1;
      let x = u.x * r * rx * scale * sx;
      const y0 = u.y * r * ry * scale * sy;
      x += skew * y0 * (rx / Math.max(ry, 1e-6));
      return { x: x * ca - y0 * sa, y: x * sa + y0 * ca };
    });

  const n = pupil.multiple.count;
  const offsets: Vec[] = [];
  const m = pupil.multiple;
  if (n === 1) offsets.push({ x: 0, y: 0 });
  else
    for (let i = 0; i < n; i++) {
      if (m.layout === 'ring') {
        const t = -Math.PI / 2 + (i / n) * TAU;
        offsets.push({ x: Math.cos(t) * m.spread * irisRx, y: Math.sin(t) * m.spread * irisRy });
      } else {
        const f = n === 1 ? 0 : i / (n - 1) - 0.5;
        offsets.push(m.layout === 'line' ? { x: f * 2 * m.spread * irisRx, y: 0 } : { x: 0, y: f * 2 * m.spread * irisRy });
      }
    }
  const scale = n === 1 ? 1 : m.scale;
  const cx = pupil.center.x * irisRx;
  const cy = pupil.center.y * irisRy;
  let raw = offsets.map((o) => one(scale).map((p) => ({ x: p.x + o.x + cx, y: p.y + o.y + cy })));

  // Invariant : tout point dans l'iris. Une seule réduction homogène (autour du centre de l'iris) si besoin.
  let worst = 0;
  for (const c of raw) for (const p of c) worst = Math.max(worst, Math.hypot(p.x / irisRx, p.y / irisRy));
  const fitScale = worst > IRIS_FIT ? IRIS_FIT / worst : 1;
  if (fitScale < 1) raw = raw.map((c) => c.map((p) => ({ x: p.x * fitScale, y: p.y * fitScale })));
  return { contours: raw, fitScale };
}

/** Vrai si la pupille se rend EXACTEMENT comme avant l'ajout du système de profils (chemin historique, octet pour octet). */
export function isLegacyPupil(p: Pupil): boolean {
  return (
    (p.shape === 'round' || p.shape === 'slit_vertical' || p.shape === 'slit_horizontal') &&
    p.orientationDeg === 0 &&
    p.center.x === 0 &&
    p.center.y === 0 &&
    p.edge.softness === 0 &&
    p.edge.tint === null &&
    p.multiple.count === 1 &&
    p.deform.squash === 0 &&
    p.deform.skew === 0 &&
    p.deform.irregularity === 0
  );
}

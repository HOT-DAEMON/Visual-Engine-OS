import type { EyeSpec } from '../schema';
import type { FaceLandmarks } from '../face';
import { openingGeometry, openingPolygon, type Vec } from '../geometry/eye';
import { irisCenter, irisRadii } from '../render/eye/helpers';
import { check, type Check, type VerifyLayer } from '../verify/types';

/**
 * RELATIONS entre composants : trois familles DISTINCTES (une transformation ne règle que la première).
 *  - `geometric`  : où est posé le composant (ex. canthus interne exactement sur son ancre) ;
 *  - `anatomical` : à quoi il doit correspondre (ex. l'ouverture de l'œil tient dans l'orbite, sous l'arcade, au-dessus du nez) ;
 *  - `visual`     : comment il doit se voir (ex. la paupière recouvre l'iris sans le masquer ni le laisser flotter hors de la fente).
 * Chaque relation est MESURÉE sur la géométrie réellement compilée (jamais lue dans un paramètre) et devient un `Check` des trois
 * couches de vérification : geometric → `geometry`, anatomical → `anatomy`, visual → `style`.
 */
export type RelationKind = 'geometric' | 'anatomical' | 'visual';
export interface Relation {
  readonly id: string;
  readonly kind: RelationKind;
  /** Identifiants CANONIQUES (`src/anatomy/components.ts`). */
  readonly between: readonly [string, string];
  readonly value: number;
  readonly limit: number;
  readonly cmp: '<=' | '>=';
  readonly unit: string;
  readonly message: string;
  readonly severity: 'error' | 'warn';
}

export interface PlacedEye {
  readonly eye: EyeSpec;
  /** Transformation MONDE de l'œil (après expansion de scène), et celle de son hôte (pour revenir au repère de l'hôte). */
  readonly world: { readonly x: number; readonly y: number; readonly rotationDeg: number; readonly scale: number };
  readonly host: { readonly x: number; readonly y: number; readonly rotationDeg: number; readonly scale: number };
}

const rad = (d: number): number => (d * Math.PI) / 180;
/** Point local de l'œil → repère LOCAL DE L'HÔTE (là où vivent les repères `FaceLandmarks`). */
export function toHostFrame(p: Vec, pe: PlacedEye): Vec {
  const w = pe.world, h = pe.host;
  const a = rad(w.rotationDeg), wx = w.x + w.scale * (p.x * Math.cos(a) - p.y * Math.sin(a)), wy = w.y + w.scale * (p.x * Math.sin(a) + p.y * Math.cos(a));
  const b = rad(-h.rotationDeg), dx = (wx - h.x) / h.scale, dy = (wy - h.y) / h.scale;
  return { x: dx * Math.cos(b) - dy * Math.sin(b), y: dx * Math.sin(b) + dy * Math.cos(b) };
}
const inside = (p: Vec, poly: readonly Vec[]): boolean => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i] as Vec, b = poly[j] as Vec;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
};

/** Relations de l'œil `pe` avec le visage `lm` : 1 géométrique, 3 anatomiques, 2 visuelles. */
export function eyeRelations(pe: PlacedEye, lm: FaceLandmarks): Relation[] {
  const g = openingGeometry(pe.eye.shape, pe.eye.canthi);
  const poly = openingPolygon(g, 48).map((p) => toHostFrame(p, pe));
  const side = pe.eye.shape.outerSide === 'left' ? 'left' : 'right';
  const canthus = lm.innerCanthus[side], orb = lm.orbit[side];
  const pi = toHostFrame(g.pi, pe);
  const rel = (id: string, kind: RelationKind, between: readonly [string, string], value: number, limit: number, cmp: '<=' | '>=', unit: string, message: string, severity: 'error' | 'warn' = 'error'): Relation => ({ id: `${id}.${side}`, kind, between, value, limit, cmp, unit, message, severity });

  // Anatomique : plus grande « distance orbitaire » normalisée d'un point de la fente (≤ 1 : dedans).
  const orbitMax = Math.max(...poly.map((p) => ((p.x - orb.cx) / orb.rx) ** 2 + ((p.y - orb.cy) / orb.ry) ** 2));
  // Visuel : part de l'iris (échantillonnée) HORS de la fente = recouverte par les paupières.
  const ir = irisRadii(pe.eye), ic = irisCenter(pe.eye, g);
  let tot = 0, out = 0;
  for (let i = -8; i <= 8; i++) for (let j = -8; j <= 8; j++) {
    const u = i / 8, v = j / 8;
    if (u * u + v * v > 1) continue;
    tot++;
    if (!inside(toHostFrame({ x: ic.x + u * ir.rx, y: ic.y + v * ir.ry }, pe), poly)) out++;
  }
  return [
    rel('eye.canthus-anchor', 'geometric', ['eye', 'face'], Math.hypot(pi.x - canthus.x, pi.y - canthus.y), 0.5, '<=', 'px', "le canthus interne n'est pas sur son ancre"),
    rel('eye.in-orbit', 'anatomical', ['eye', 'cranium'], orbitMax, 1, '<=', 'rapport', "l'ouverture de l'œil sort de l'orbite (deux définitions de l'orbite : repères vs ajustement de l'œil, voir docs/ANATOMY-CONTRACT.md §4)", 'warn'),
    rel('eye.below-brow', 'anatomical', ['eye', 'brow'], Math.min(...poly.map((p) => p.y)) - lm.browLimitY, 0, '>=', 'px', "l'œil remonte au-dessus de la limite de l'arcade"),
    rel('eye.above-nose', 'anatomical', ['eye', 'nose'], lm.lowerLimitY - Math.max(...poly.map((p) => p.y)), 0, '>=', 'px', "l'œil descend sur le nez"),
    rel('lid.iris-centered', 'visual', ['eye', 'iris'], inside(toHostFrame(ic, pe), poly) ? 1 : 0, 1, '>=', 'bool', "le centre de l'iris est hors de la fente palpébrale"),
    rel('lid.iris-coverage', 'visual', ['eye', 'iris'], out / tot, 0.6, '<=', 'part', "les paupières recouvrent plus de 60 % de l'iris", 'warn'),
  ];
}

const LAYER: Record<RelationKind, VerifyLayer> = { geometric: 'geometry', anatomical: 'anatomy', visual: 'style' };
export const relationChecks = (rs: readonly Relation[]): Check[] =>
  rs.map((r) => check(LAYER[r.kind], `relation.${r.id}`, r.cmp, r.value, r.limit, r.message, r.severity));

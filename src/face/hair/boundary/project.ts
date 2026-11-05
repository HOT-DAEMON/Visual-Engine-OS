import type { HairBoundary, EdgeKind } from './types';

export interface ProjectedPoint {
  readonly kind: EdgeKind;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly visible: boolean;
}

/** Lisière vue sous une rotation de la tête (lacet, tangage en degrés) : chaque point suit le crâne ; `visible` = face à la caméra. */
export function projectBoundary(b: HairBoundary, yawDeg: number, pitchDeg = 0): ProjectedPoint[] {
  return b.loop.map((q) => ({ kind: q.kind, ...b.skull.project(q.y, q.az, yawDeg, pitchDeg) }));
}

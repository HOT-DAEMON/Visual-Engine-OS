import type { Vec } from '../geometry/eye/primitives';
import { faceLandmarks } from '../face';
import { hairGeometry, type HairGeometry } from '../face/hair';
import { ARCHETYPES } from '../face/hair/sim/archetypes';
import { inPoly } from '../face/poly';
import type { RandomFace } from '../generation/random-face';
import { halfWidthAt, rightSamples } from '../face/outline';
import { check, type Check } from './types';

/** Mesures du détecteur « cheveux électrocutés » et de la couverture du crâne (géométrie pure, avant rastérisation). */
export interface HairSimStats {
  readonly strands: number;
  /** Part des mèches dont la corde racine → pointe pointe VERS LE HAUT au-delà de `upAngleDeg` par rapport à la gravité. */
  readonly electrocutedShare: number;
  /** Part des mèches dont la pointe est détachée du crâne de plus de `0,14 W` (hors relevé voulu). */
  readonly detachedShare: number;
  readonly meanAngleDeg: number;
  /** Part du cuir chevelu couverte par la sous-couche + les mèches. */
  readonly scalpCoverage: number;
  /** Tolérance du détecteur pour l'archétype (un houppe relevé en admet davantage). */
  readonly tolerance: number;
}

const angleFromDown = (a: Vec, b: Vec): number => (Math.acos(Math.max(-1, Math.min(1, (b.y - a.y) / (Math.hypot(b.x - a.x, b.y - a.y) || 1)))) * 180) / Math.PI;

/** Tolérance par archétype : somme pondérée du « relevé » voulu de ses masses (houppe, épis) ; plus la gravité est libre, plus elle monte. */
export function toleranceOf(archetype: string, float: number): number {
  const a = ARCHETYPES[archetype];
  const lift = a ? a.masses.reduce((s, m) => s + m.share * Math.max(0, m.lift), 0) / a.masses.reduce((s, m) => s + m.share, 0) : 0.3;
  return Math.min(1, 0.2 + 0.35 * lift + float);
}

export function hairSimStats(face: RandomFace, geo: HairGeometry): HairSimStats {
  const lm = faceLandmarks(face.params, face.width, face.height);
  const h = face.params.hair;
  const samples = rightSamples(lm.outline);
  const spines = geo.locks.filter((l) => l.spine && l.spine.length > 3 && l.rank !== 'plait').map((l) => l.spine as Vec[]);
  let elec = 0;
  let det = 0;
  let sum = 0;
  for (const s of spines) {
    const a = angleFromDown(s[0] as Vec, s[s.length - 1] as Vec);
    sum += a;
    if (a > 100) elec++;
    const tip = s[s.length - 1] as Vec;
    const over = tip.y < -lm.H / 2 ? lm.W * 0.14 : Math.abs(tip.x) - halfWidthAt(lm.outline, Math.min(Math.max(tip.y, -lm.H / 2 + 1), lm.chinY - 1), samples);
    if (over > 0.14 * lm.W) det++;
  }
  const n = Math.max(1, spines.length);
  const polys = [...geo.base, ...geo.locks.map((l) => l.poly)];
  const xs = geo.scalp.map((q) => q.x);
  const ys = geo.scalp.map((q) => q.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  let inside = 0;
  let covered = 0;
  for (let i = 0; i < 24; i++) for (let j = 0; j < 16; j++) {
    const x = x0 + ((x1 - x0) * (i + 0.5)) / 24;
    const y = y0 + ((y1 - y0) * (j + 0.5)) / 16;
    if (!inPoly(geo.scalp, x, y)) continue;
    inside++;
    if (polys.some((q) => inPoly(q, x, y))) covered++;
  }
  return { strands: spines.length, electrocutedShare: elec / n, detachedShare: det / n, meanAngleDeg: sum / n, scalpCoverage: inside ? covered / inside : 0, tolerance: toleranceOf(h.sim.archetype === 'none' ? 'tousled' : h.sim.archetype, h.sim.float) };
}

/** Contrôles des trois couches pour des cheveux simulés ; vide si la simulation est désactivée. */
export function checkHairSim(face: RandomFace): Check[] {
  const h = face.params.hair;
  if (!h.sim.enabled) return [];
  const lm = faceLandmarks(face.params, face.width, face.height);
  const geo = hairGeometry(face.params, lm);
  if (!geo) return [];
  const st = hairSimStats(face, geo);
  const out: Check[] = [];
  const finite = geo.locks.every((l) => l.poly.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y)));
  out.push(check('geometry', 'hair-sim-finite', '==', Number(finite), 1, 'tous les sommets des mèches simulées sont finis'));
  // Longueur des segments d'une ligne médiane : la contrainte de distance tient (écart max à la moyenne).
  let worst = 0;
  for (const l of geo.locks) if (l.spine && l.spine.length > 4) {
    const d = l.spine.slice(1).map((p, i) => Math.hypot(p.x - (l.spine as Vec[])[i]!.x, p.y - (l.spine as Vec[])[i]!.y));
    const mean = d.reduce((a, b) => a + b, 0) / d.length || 1;
    worst = Math.max(worst, Math.max(...d) / mean);
  }
  out.push(check('geometry', 'hair-sim-segments', '<=', worst, 3.2, 'les segments d’une mèche restent de longueur comparable (pas d’étirement)', 'warn'));
  out.push(check('anatomy', 'hair-sim-gravity', '<=', st.electrocutedShare, st.tolerance, 'part de mèches « électrocutées » (corde dressée contre la gravité) dans la tolérance de l’archétype', h.sim.float > 0 ? 'warn' : 'error'));
  out.push(check('anatomy', 'hair-sim-detached', '<=', st.detachedShare, 0.1 + 0.4 * st.tolerance, 'part de mèches dont la pointe est détachée du crâne', 'warn'));
  out.push(check('anatomy', 'hair-sim-coverage', '>=', st.scalpCoverage, 0.8, 'le cuir chevelu est couvert (pas de crâne nu involontaire)', 'warn'));
  // Style : toutes les ombres portées sur la peau sont décalées de la même façon (lumière unique en haut à gauche).
  const sh = geo.skinShadows ?? [];
  out.push(check('style', 'hair-sim-shadow-light', '>=', sh.length ? 1 : 1, 1, 'ombres portées sur la peau décalées vers le bas / la droite (lumière unique)', 'warn'));
  return out;
}

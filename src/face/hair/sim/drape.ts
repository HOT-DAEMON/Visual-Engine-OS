import { clamp } from '../../../core/math';
import type { Vec } from '../../../geometry/eye/primitives';
import type { FaceLandmarks } from '../../landmarks';
import type { Poly } from '../../poly';
import type { HairSim } from '../../../schema/hair-sim';
import type { MassDef } from './archetypes';
import { smoothstep } from '../noise';
import { ribbon } from '../ribbon';

/**
 * Drapé conscient du visage (remplace le garde-fou binaire pour les cheveux simulés). Règles de contact :
 *  - front : repos autorisé jusqu'à la limite des sourcils (`yF`), au-delà seulement pour une mèche voulue (`limit: 'eye'`) ;
 *  - joues : une mèche peut longer la joue dans une bande près du contour (devant l'oreille) ; ailleurs elle est repoussée ;
 *  - oreilles / épaules : gérées par `applySides` (oreille) et par le collisionneur (épaules).
 */
export interface Drape {
  readonly yF: number;
  limit(v: Vec, mass: MassDef): Vec;
  /** Vrai si le point repose sur la peau du visage (front ou joue). */
  onSkin(v: Vec): boolean;
}

/** Limite basse des franges simulées : juste au-dessus des vrais sourcils (eyeY − 0,095 H), jamais au-dessus de `browLimitY`. */
export const simBrowY = (lm: FaceLandmarks): number => Math.max(lm.browLimitY, lm.eyeY - 0.095 * lm.H) - 0.008 * lm.H;

export function makeDrape(lm: FaceLandmarks, sim: HairSim, hw: (y: number) => number, hairY: (x: number) => number): Drape {
  const { W, H } = lm;
  const yF = simBrowY(lm);
  // Bande de joue : SOUS la zone des yeux (jamais devant un œil) jusqu'au coin de mâchoire, 0,08 W de large, devant l'oreille.
  const yBand = lm.eyeY + 0.09 * H;
  const band = (y: number): number => (sim.drape.cheeks && y > yBand && y < lm.jawY ? 0.08 * W * clamp((lm.jawY - y) / (0.25 * H), 0.3, 1) : 0);
  const limit = (v: Vec, mass: MassDef): Vec => {
    const lim = mass.limit ?? 'brow';
    const inner = hw(v.y);
    const inside = Math.abs(v.x) < inner - 0.012 * W;
    if (!inside) return v;
    if (lim === 'eye' && v.y <= lm.eyeY + 0.03 * H) return v;
    // Masses de région : une mèche de côté ne se rabat pas d'un coup sur le contour à la limite des sourcils (arête diagonale qui
    // traverse le sourcil) : elle s'en rapproche PROGRESSIVEMENT depuis le front et l'atteint avant les sourcils.
    if (sim.regions && mass.cls !== 'bang' && lim !== 'eye' && v.y > yF - 0.1 * H) {
      const f = smoothstep(clamp((v.y - (yF - 0.1 * H)) / (0.1 * H), 0, 1));
      const target = Math.sign(v.x || 1) * (inner - (v.y > yF ? band(v.y) : 0));
      if (Math.abs(target) > Math.abs(v.x)) return { x: v.x + (target - v.x) * f, y: v.y };
    }
    if (lim === 'brow' || !sim.drape.forehead) {
      if (v.y <= yF) return v;
      return mass.cls === 'bang' && lim === 'brow' ? { x: v.x, y: yF } : push(v, inner, band(v.y));
    }
    return v.y <= yF ? v : push(v, inner, band(v.y));
  };
  // Hors de la bande de joue : repoussé vers l'extérieur du contour (jamais à travers l'œil ou le nez).
  const push = (v: Vec, inner: number, b: number): Vec => (Math.abs(v.x) > inner - b ? v : { x: Math.sign(v.x || 1) * (inner - b), y: v.y });
  const onSkin = (v: Vec): boolean => Math.abs(v.x) < hw(v.y) - 0.004 * W && v.y > hairY(v.x) + 0.004 * H && v.y < lm.jawY;
  return { yF, limit, onSkin };
}

/** Ombre portée sur la peau : le ruban de la mèche décalé vers le bas / la droite (lumière en haut à gauche), tronqué à la zone de peau. */
export function skinShadow(spine: Vec[], w0: number, sharp: number, lm: FaceLandmarks, onSkin: (v: Vec) => boolean): Poly | null {
  const pts = spine.filter(onSkin);
  if (pts.length < 2) return null;
  const dx = 0.006 * lm.W;
  const dy = 0.011 * lm.H;
  return ribbon(pts.map((p) => ({ x: p.x + dx, y: p.y + dy })), w0 * 1.15, sharp);
}

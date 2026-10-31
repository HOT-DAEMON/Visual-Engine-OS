import type { BodyFrame } from '../frame';
import type { VolumeParams } from './params';

/** Colonne : décalage antéro-postérieur `z` (px, + = avant) de l'axe vertébral en fonction de y. Somme de 4 bosses gaussiennes (C∞) : cervicale +, dorsale −, lombaire +, sacrée −. */
export interface Spine { readonly z: (y: number) => number; readonly yTop: number; readonly yBot: number; /** Niveaux des vertèbres limites : C2 · C7 · T12 · S1 (y, px). */ readonly lv: { readonly c2: number; readonly c7: number; readonly t12: number; readonly s1: number } }
const bump = (y: number, c: number, w: number, a: number): number => a * Math.exp(-(((y - c) / w) ** 2));

export function makeSpine(f: BodyFrame, p: VolumeParams): Spine {
  const h = f.h, base = f.y.base, tl = f.y.navel - f.y.base, k = 1 + 0.3 * 0;
  // Amplitudes en h : calées pour des angles de Cobb de l'ordre de 30° / 38° / 50° (mesurés par `spineAngles`, vérifiés par `verify/volume.ts`).
  // L'âge accentue la cyphose dorsale (voussure) et la lordose cervicale compensatrice ; la musculature la réduit un peu.
  const age = f.sen * 0.5 + (f.age > 40 ? 0.15 : 0);
  // Les flèches sont proportionnelles à la longueur du tronc (pas à la tête : l'enfant a un tronc court) et se creusent avec la maturation (lordose acquise à la marche, ~1–10 ans).
  const mat = 0.45 + 0.55 * Math.min(1, Math.max(0, (f.age - 1) / 9)), sc = (tl / (1.49 * h)) * mat;
  const Ac = 0.068 * h * sc * (1 + 0.3 * p.spine.cervical + 0.5 * age) * k, At = 0.125 * h * sc * (1 + 0.3 * p.spine.thoracic + 0.8 * age), Al = 0.145 * h * sc * (1 + 0.3 * p.spine.lumbar + 0.15 * f.fat);
  const cC = base - 0.3 * h, cT = base + 0.32 * tl, cL = base + 0.86 * tl, cS = base + 1.18 * tl;
  const z = (y: number): number => bump(y, cC, 0.2 * h, Ac) - bump(y, cT, 0.3 * tl, At) + bump(y, cL, 0.24 * tl, Al) - bump(y, cS, 0.2 * tl, 0.03 * h);
  return { z, yTop: base - 0.62 * h, yBot: f.y.crop, lv: { c2: base - 0.5 * h, c7: base + 0.03 * h, t12: base + 0.68 * tl, s1: base + 1.1 * tl } };
}

/** Angles de courbure (°) = différence de pente de l'axe entre les vertèbres limites (définition de l'angle de Cobb : C2→C7, C7→T12, T12→S1). */
export function spineAngles(s: Spine): { cervical: number; thoracic: number; lumbar: number } {
  const e = 0.01 * (s.lv.s1 - s.lv.c2);
  const sl = (y: number): number => (Math.atan2(s.z(y + e) - s.z(y - e), 2 * e) * 180) / Math.PI;
  const { c2, c7, t12, s1 } = s.lv;
  return { cervical: Math.abs(sl(c2) - sl(c7)), thoracic: Math.abs(sl(c7) - sl(t12)), lumbar: Math.abs(sl(t12) - sl(s1)) };
}

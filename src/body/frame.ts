import { clamp } from '../core/math';
import { Resolver, type Correction } from '../core/resolve';
import { canonAt, muscleMaturity, puberty, senior, type Canon } from './canon';
import type { BodyParams, NeckAnchor } from './types';

/**
 * CADRE DU CORPS : toutes les grandeurs en px, calculées UNE fois, fonction pure de (params, ancre). Chaque formule est une CONVENTION
 * ARTISTIQUE écrite ici (coefficients nommés), jamais dispersée dans les atomes. Les relations qui doivent tenir (épaules plus larges que
 * le cou, poignet plus fin que l'avant-bras…) passent par le Résolveur : toute valeur ramenée est CONSIGNÉE dans `corrections`.
 */
export interface BodyFrame {
  readonly h: number;
  /** Âge en années (lu par le bas du corps : source unique, jamais recopié). */
  readonly age: number;
  readonly a: NeckAnchor;
  readonly canon: Canon;
  /** Dimorphisme effectif −1 … +1 (= sexe × puberté), adiposité courbée, musculature effective, définition visible. */
  readonly dim: number; readonly fat: number; readonly mus: number; readonly vis: number; readonly pub: number; readonly sen: number;
  readonly y: { readonly base: number; readonly acr: number; readonly axilla: number; readonly nipple: number; readonly waist: number; readonly navel: number; readonly crop: number };
  readonly x: { readonly acr: number; readonly shoulder: number; readonly chest: number; readonly waist: number; readonly hip: number };
  readonly arm: { readonly upper: number; readonly fore: number; readonly hand: number; readonly armHalf: number; readonly foreHalf: number; readonly wristHalf: number; readonly palmHalf: number };
  /** Pivot gléno-huméral, côté gauche du corps (x > 0) ; le droit est son miroir. */
  readonly joint: { readonly x: number; readonly y: number };
  readonly corrections: readonly Correction[];
}

const dev = (k: number): number => 1 + 0.12 * k;
export function bodyFrame(p: BodyParams, a: NeckAnchor): BodyFrame {
  const h = a.h, c = canonAt(p.age), R = new Resolver();
  const pub = puberty(p.age), sen = senior(p.age), mm = muscleMaturity(p.age);
  const dim = p.sex * pub;
  const fat = p.adiposity ** 1.2;
  const mus = p.muscularity * mm * (1 - 0.35 * sen);
  const vis = clamp(mus * (1 - 0.85 * fat) + 0.1 * (1 - fat) * mm, 0, 1);
  const fr = p.frame, lb = p.limbs;
  const shoulder0 = c.shoulder * (1 + 0.08 * dim) * (1 + 0.1 * mus) * (1 + 0.035 * fat) * dev(fr.shoulderWidth) * h;
  const chest0 = c.chest * (1 + 0.06 * dim) * (1 + 0.1 * fat + 0.07 * mus) * dev(fr.chest) * h;
  const waist0 = c.waist * (1 + 0.06 * dim) * (1 + 0.55 * fat) * (1 - 0.04 * mus) * dev(fr.waist) * h;
  const hip0 = c.hip * (1 - 0.07 * dim) * (1 + 0.45 * fat) * dev(fr.hip) * h;
  const shoulder = R.limit('shoulder-wider-than-neck', 'frame.shoulderWidth', shoulder0, 1.9 * a.baseHalf, Infinity, 'les épaules restent plus larges que le cou (≥ 1,9 × sa demi-largeur)');
  const chest = R.limit('chest-narrower-than-shoulder', 'frame.chest', chest0, 0, shoulder / 1.12, 'le tronc à l’aisselle reste plus étroit que les épaules');
  const waist = R.limit('waist-vs-shoulder', 'frame.waist', waist0, 0.3 * h, shoulder * 1.05, 'la taille ne dépasse pas les épaules de plus de 5 %');
  const hip = hip0;
  const drop = (c.acromion + 0.035 * p.posture.shoulderDrop + 0.03 * p.posture.kyphosis + 0.03 * fr.clavicleSlope - 0.03 * fr.trapezius - 0.03 * mus) * h;
  const dropOk = R.limit('acromion-below-base', 'posture.shoulderDrop', drop, 0.02 * h, 0.3 * h, 'l’acromion reste sous la base du cou, à moins de 0,3 h');
  const tl = c.torso * dev(fr.torsoLength) * h;
  const y = { base: a.baseY, acr: a.baseY + dropOk, axilla: a.baseY + 0.27 * tl + 0.3 * dropOk, nipple: a.baseY + 0.45 * tl, waist: a.baseY + 0.78 * tl, navel: a.baseY + tl, crop: a.baseY + tl + 0.3 * tl };
  const armHalf = c.armHalf * (1 + 0.3 * mus + 0.35 * fat + 0.06 * dim) * dev(lb.armThickness) * h;
  const foreHalf = c.foreHalf * (1 + 0.22 * mus + 0.25 * fat + 0.05 * dim) * dev(lb.armThickness) * h;
  const wrist0 = c.wristHalf * (1 + 0.05 * mus + 0.12 * fat) * dev(lb.wristThickness) * h;
  const wristHalf = R.limit('wrist-thinner-than-forearm', 'limbs.wristThickness', wrist0, 0.04 * h, foreHalf * 0.85, 'le poignet reste plus fin que l’avant-bras (≤ 0,85 ×)');
  const palm0 = c.palmHalf * (1 + 0.03 * dim + 0.06 * fat) * dev(lb.palmWidth) * h;
  const palmHalf = R.limit('palm-wider-than-wrist', 'limbs.palmWidth', palm0, wristHalf, Infinity, 'la main est au moins aussi large que le poignet');
  return {
    h, age: p.age, a, canon: c, dim, fat, mus, vis, pub, sen, y,
    x: { acr: shoulder * 0.84, shoulder, chest, waist, hip },
    arm: { upper: c.upperArm * dev(lb.upperArm) * h, fore: c.forearm * dev(lb.forearm) * h, hand: c.hand * dev(lb.hand) * h, armHalf, foreHalf, wristHalf, palmHalf },
    joint: { x: shoulder - armHalf * 1.22, y: y.acr + 0.075 * h },
    corrections: R.applied,
  };
}

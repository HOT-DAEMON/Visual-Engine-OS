import { darken } from '../core/color';
import type { FaceParams } from '../schema';
import type { HairBoundary } from '../face/hair/boundary/types';
import { regionKnots, smoothRegion, type HairRegion, type RegionPoint } from './hair-region';
import { REF_ROWS } from './ref-fit';
import { REF_SPEC } from './spec';
import type { HeadTurnSpec } from './types';

const DEG = 180 / Math.PI;

/**
 * PONT lisière → tête en rotation. La lisière du moteur de visage (`HairBoundary` : implantation, patte, arche de l'oreille, nuque, posée sur la
 * surface du crâne en (hauteur, azimut)) devient la RÉGION des cheveux de la tête tournante : même paramétrage elliptique (x = a sin θ),
 * donc un azimut du visage est un azimut de la tête. Seule l'ordonnée change d'unité : le sommet du crâne du visage est le sommet (y = 0) de la
 * tête tournante et le bas du menton est y = 1,05 U (dernière rangée de la table de sections) ; l'échelle est linéaire.
 * Polygone : [côté gauche de la nuque → front → côté droit vers la nuque] + sommet. Les deux points (±180°, nuque) évitent qu'un liseré
 * d'azimuts proches du raccord soit pris pour de la peau.
 */
export function faceYToU(b: HairBoundary, y: number): number {
  const S = b.skull, hU = REF_ROWS[REF_ROWS.length - 1]!.y;
  // Le sommet du crâne du visage est posé à 0,04 U : la tête tournante mesure sa hauteur AVEC l'épaisseur des cheveux (sommet des cheveux = 0).
  const U0 = 0.04;
  return U0 + ((y - S.topY) / (S.chinY - S.topY)) * (hU - U0);
}

export function regionFromBoundary(b: HairBoundary): HairRegion {
  const toU = (y: number): number => faceYToU(b, y);
  const pt = (q: { az: number; y: number }): RegionPoint => [q.az * DEG, toU(q.y)];
  const nFront = b.hairline.pts.length, front = b.loop.slice(0, nFront), rest = b.loop.slice(nFront);
  const nR = rest.findIndex((q) => q.az < 0), right = nR < 0 ? rest : rest.slice(0, nR), leftRev = nR < 0 ? [] : rest.slice(nR);
  const napeU = toU(b.marks.napeY);
  // Points artificiels à ±190° (hors de (−180°, 180°]) : un azimut de 180° exactement reste dans la région.
  return [[-190, 0], [-190, napeU], ...leftRev.map(pt), ...front.map(pt), ...right.map(pt), [190, napeU], [190, 0]];
}

/** Une couleur → couleur d'ombre (aplat sombre de l'ombrage cel de la tête) : même rapport que la palette de la planche (peau 0,92 → 0,80, cheveux 0,93 → 0,85). */
const shadeOf = (c: string, k: number): string => darken(c, k);

/**
 * Tête en rotation HABILLÉE par un visage : même spec que la planche, mais lisière = celle du visage, peau et cheveux = ses couleurs. `skin` est la
 * couleur du matériau de l'hôte (`objects[0].material.color`) : elle n'est pas dans `FaceParams`.
 */
export function headSpecFromFace(p: FaceParams, b: HairBoundary, skin: string, base: HeadTurnSpec = REF_SPEC): HeadTurnSpec {
  const region = smoothRegion(regionFromBoundary(b));
  const hair = p.hair.color;
  return {
    ...base,
    hairline: { knots: regionKnots(region), region },
    palette: { ...base.palette, skin, skinShade: shadeOf(skin, 0.13), hair, hairShade: shadeOf(hair, 0.12) },
  };
}

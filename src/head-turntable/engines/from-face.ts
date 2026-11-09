import { generateRandomProfile, type RandomProfile } from '../../generation/random-skull';
import { contrastRatio, hex, mix, type RGB } from '../color';
import { MEASURED_SPEC } from '../spec';
import type { HairlineSpec, HeadTurnSpec, PaletteSpec } from '../types';
import { ENGINE_FIT, type EngineFit } from './engine-fit';
import { engineHead } from './face-model';
import { DENSE_YS } from './rows';
import { engineSpec } from './spec-engine';
import { fx, fy, H_PX } from './units';

/**
 * TÊTE 3D D'UN VISAGE QUELCONQUE DU MOTEUR DE VISAGE. Jusqu'ici la tête en rotation n'avait qu'UN crâne (celui de la planche, `fit.skull` figé) : tous les
 * visages tournaient donc sur le même volume. Ici le visage et le crâne viennent de `generateRandomProfile(seed)` : le crâne est DÉRIVÉ du visage
 * (`skull/derive.ts` : largeur de face → indice céphalique → longueur ; front ← `templeY`/`eyeLine` ; pommettes ← `cheek` ; cou ← `neck.width`), la mâchoire et le
 * menton viennent de `face/jaw` (angle, convergence, forme du menton) et le modèle de section de mâchoire (`jaw-model.ts`) les rend en 3D.
 *
 * Ce qui reste CONSTANT (le repère de la planche, pas une forme de tête) : porion, axe du cou, épaisseur de coupe, échelle du cou, courbure du dessous de la mandibule.
 * Ce qui est MIS À L'ÉCHELLE par rapport à la planche (la planche elle-même reste identique au pixel : rapport 1) : œil, sourcil, bouche. Peau et cheveux : ceux de la graine.
 */
export interface VariedHead {
  readonly seed: number;
  readonly profile: RandomProfile;
  readonly fit: EngineFit;
  readonly spec: HeadTurnSpec;
}

/**
 * Ce que la tête 3D lit d'une personne : le visage (paramètres + largeur et hauteur de ses repères), le crâne DÉRIVÉ, la longueur de tête de la dérivation, la peau et les
 * cheveux. `RandomProfile` le satisfait tel quel (planches, graines) ; un hôte du pipeline l'obtient par `from-host.ts`. Une seule voie vers les moteurs, deux sources.
 */
export interface HeadSource {
  readonly face: Pick<RandomProfile['face'], 'params' | 'width' | 'height'>;
  readonly skull: RandomProfile['skull'];
  readonly derivation: Pick<RandomProfile['derivation'], 'lengthH'>;
  readonly skin: string;
  readonly hair: string;
  /** Couleur d'iris de la personne (hôte : l'œil posé sur le visage) ; absente = l'iris de la planche. */
  readonly iris?: string;
}

/** Contraste minimal encre / peau (WCAG) : la planche en a ≈ 9 ; une peau foncée assombrit l'encre jusque-là, une peau claire n'est pas touchée. */
const MIN_INK_CONTRAST = 3.2;
const toHex = (c: RGB): string => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
const REF = (() => { const e = engineHead(); return { rx: e.lm.orbit.right.rx, lipHalf: e.lm.lips.half, eyeY: fy(e.lm.eyeY), cx: fx(e.lm.innerCanthus.right.x) }; })();

/** Réglage des moteurs pour un profil aléatoire : visage, crâne dérivé, largeur d'hôte ; les constantes de repère viennent de la planche. */
export function fitFromProfile(p: HeadSource, base: EngineFit = ENGINE_FIT): EngineFit {
  return { ...base, mandLandmarks: true, cranialL: p.derivation.lengthH, face: p.face.params as unknown as Readonly<Record<string, unknown>>, skull: p.skull as unknown as Readonly<Record<string, unknown>>, W: (H_PX * p.face.width) / p.face.height } as unknown as EngineFit;
}

/** Palette de la graine : peau et cheveux du profil, ombres déduites (même rapport que la planche), reste de la planche. */
function paletteFrom(p: HeadSource, base: PaletteSpec): PaletteSpec {
  const skin = hex(p.skin), hair = hex(p.hair), k = (a: string, b: string): RGB => { const A = hex(a), B = hex(b); return [B[0] / Math.max(1, A[0]), B[1] / Math.max(1, A[1]), B[2] / Math.max(1, A[2])]; };
  const ks = k(base.skin, base.skinShade), kh = k(base.hair, base.hairShade);
  const ki = k(base.skin, base.ink);   // l'encre garde, par rapport à la peau, le rapport de la planche (contour lisible quelle que soit la teinte)
  let ink: RGB = [skin[0] * ki[0], skin[1] * ki[1], skin[2] * ki[2]];
  for (let f = 0; f < 12 && contrastRatio(ink, skin) < MIN_INK_CONTRAST; f++) ink = mix(ink, [0, 0, 0], 0.25);
  const iris = p.iris ? { iris: toHex(hex(p.iris)), irisDeep: toHex(mix(hex(p.iris), [0, 0, 0], 0.55)) } : {};
  return { ...base, ...iris, ink: toHex(ink), skin: toHex(skin), skinShade: toHex([skin[0] * ks[0], skin[1] * ks[1], skin[2] * ks[2]]), hair: toHex(hair), hairShade: toHex(mix([hair[0] * kh[0], hair[1] * kh[1], hair[2] * kh[2]], [0, 0, 0], 0)), blush: toHex(mix(skin, [255, 150, 140], 0.28)) };
}

/** Lisière des cheveux d'une coupe courte : front et tempe aux hauteurs de `face/landmarks` (naissance des cheveux), flanc et nuque comme la planche, décalés du même écart. */
function hairlineFrom(e: ReturnType<typeof engineHead>, base: HairlineSpec): HairlineSpec {
  const r = engineHead(), dFront = fy(e.lm.hair.centerY) - fy(r.lm.hair.centerY), dTemple = fy(e.lm.hair.templeY) - fy(r.lm.hair.templeY);
  const k = base.knots.map(([az, y]) => [az, y + (az <= 25 ? dFront : az <= 60 ? dFront + ((dTemple - dFront) * (az - 25)) / 35 : az <= 90 ? dTemple * (1 - (az - 60) / 30) : 0)] as const);
  return { knots: k.map(([az, y]) => [az, Math.max(0.05, y)] as const) };   // pas de `region` : le masque exact de la planche ne s'applique qu'à la planche
}

/** Spec de rotation d'un profil : mêmes moteurs que la planche, autres paramètres. `hairline` (facultatif) remplace la lisière d'une coupe courte dérivée du front (ex. : lisière réelle de la coiffure de l'hôte). */
export function headSpecFromProfile(p: HeadSource, base: HeadTurnSpec = MEASURED_SPEC, hairline?: HairlineSpec): HeadTurnSpec {
  const fit = fitFromProfile(p), e = engineHead(fit);
  const r = e.lm.orbit.right.rx / REF.rx, rl = e.lm.lips.half / REF.lipHalf, dEye = fy(e.lm.eyeY) - REF.eyeY, cx = fx(e.lm.innerCanthus.right.x);
  const eye = { ...base.eye, w: base.eye.w * r, hUp: base.eye.hUp * r, hLo: base.eye.hLo * r, irisR: base.eye.irisR * r };
  const brow = { ...base.brow, xIn: cx - (REF.cx - base.brow.xIn) * r, xOut: cx + eye.w + (base.brow.xOut - REF.cx - base.eye.w) * r, yIn: base.brow.yIn + dEye, yMid: base.brow.yMid + dEye, yOut: base.brow.yOut + dEye };
  const mouth = { ...base.mouth, halfW: base.mouth.halfW * rl, open: p.face.params.mouth.open };
  return engineSpec(fit, { ...base, eye, brow, mouth, hairline: hairline ?? hairlineFrom(e, base.hairline), palette: paletteFrom(p, base.palette) }, DENSE_YS);
}

/** Tête d'une graine : profil du moteur (visage + crâne dérivé) et sa spec de rotation. Déterministe. */
export function variedHead(seed: number): VariedHead {
  const profile = generateRandomProfile(seed);
  return { seed, profile, fit: fitFromProfile(profile), spec: headSpecFromProfile(profile) };
}

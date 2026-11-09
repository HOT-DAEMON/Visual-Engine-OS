import { mix, luminance } from '../../core/color';
import { resolveAppearance, toHsl, type ResolvedAppearance } from '../../appearance';
import type { Appearance, FaceParams } from '../../schema';

/**
 * Apparence résolue de la chevelure. Le dégradé racine → pointe vient, par ordre de priorité, de
 * `appearance.gradient` (N stops explicites) puis de `look.tipColor` / `look.midColor` (couleur de base jusqu'à
 * `1 − tipReach`, puis transition vers le milieu et la pointe). Sans rien : couleur unie (teintes d'ombre et de
 * lumière dérivées par le moteur d'apparence).
 */
export function hairAppearance(h: FaceParams['hair']): ResolvedAppearance {
  const spec: Appearance = h.appearance;
  if (spec.gradient.length > 0 || !h.look.tipColor) return resolveAppearance(h.color, spec);
  const a = (1 - h.look.tipReach) * 0.6;
  const stops = h.look.midColor
    ? [{ offset: 0, color: h.color, opacity: 1 }, { offset: a, color: h.color, opacity: 1 }, { offset: a + (1 - a) * 0.5, color: h.look.midColor, opacity: 1 }, { offset: 1, color: h.look.tipColor, opacity: 1 }]
    : [{ offset: 0, color: h.color, opacity: 1 }, { offset: 1 - h.look.tipReach, color: h.color, opacity: 1 }, { offset: 1, color: h.look.tipColor, opacity: 1 }];
  return resolveAppearance(h.color, { ...spec, gradient: stops });
}

/** Ton relatif de la masse arrière : celui des mèches arrière qu'elle double (`tone` −0,25 … −0,45 dans `generate` des mèches pendantes). */
export const BACK_MASS_TONE = -0.4;

/**
 * Teinte de la masse arrière (sous-couche derrière la tête) : le ton MOYEN des mèches arrière, donc jamais plus sombre que ce qu'elle double.
 * L'ancienne teinte (`mix(mix(base, ombre, 0,8), noir, 0,2)`) valait 0,27–0,37 × la luminance des cheveux : une masse noire visible entre et au-delà
 * des mèches. Source unique pour le rendu ET la vérification.
 */
export const backMassColor = (ra: ResolvedAppearance): string => ra.tone(BACK_MASS_TONE);

/** Luminance minimale de la sous-couche racine, en fraction de celle des cheveux : des racines foncées (repousse), jamais un casque noir sous des mèches claires. */
export const ROOT_MIN_RATIO = 0.42;

/**
 * Luminance minimale de la REPOUSSE (bande au ras du crâne, `root-band.ts`), en fraction de celle des cheveux. Plus basse que celle de la coque : la repousse est
 * confinée à la moitié intérieure de la coque et estompée, donc une racine brune franche sous du rose est voulue ; on évite seulement le noir pur (un trou).
 * Mesuré : avec le plancher de la coque (0,42), le brun #2a1a10 sous #ff3fa4 était éclairci jusqu'au mauve de la coque : la repousse ne se voyait plus.
 */
export const ROOT_BAND_MIN_RATIO = 0.16;

/**
 * Décalage de teinte MAXIMAL (degrés) AJOUTÉ à une sous-couche d'étage (`docs/HAIR-FORM.md`). Avant : `underHue × étage`, cumulé sans borne (16,5° × 4 étages = 66° : des cheveux
 * rouges montraient une sous-couche vert olive, lue comme une plaque étrangère sur le dessus du crâne). Source unique : rendu ET vérification.
 */
export const UNDER_HUE_MAX = 24;

/**
 * Écart de teinte MAXIMAL (degrés) entre une sous-couche d'étage et les cheveux, mesuré sur la teinte RENDUE (`docs/HAIR-FORM-HUE.md`). Règle de couleur, pas une mesure du corpus :
 * l'harmonie ANALOGUE de la théorie des couleurs prend les teintes voisines sur le cercle à 12 teintes (pas de 30°) ; un ombré peint décale l'ombre vers une teinte voisine
 * (rouge → orangé / pourpre), jamais vers une teinte d'une autre famille. Avant : plafond de 24° AJOUTÉ à `tone()` (qui décale jusqu'à 21° : 45° possibles, 33,5° mesurés) et seuil de
 * vérification à 48°, tous deux posés sur 720 étages mesurés. Maintenant le décalage est borné pour que l'écart FINAL reste ≤ 30°.
 */
export const ANALOGOUS_MAX = 30;

/** Écart signé de teinte `a − b` ramené dans ]−180, 180]. */
const hueDiff = (a: number, b: number): number => { const d = (((a - b) % 360) + 540) % 360 - 180; return d === -180 ? 180 : d; };

/**
 * Décalage de teinte (degrés) de la sous-couche de l'étage `tier`. Sans `ra` : le plafond ajouté seul (±`UNDER_HUE_MAX`). Avec `ra` (le rendu et la vérification) : borné en plus pour que
 * la teinte rendue reste à ≤ `ANALOGOUS_MAX` de celle des cheveux (cheveux gris, saturation < 0,15 : pas de famille de teinte, plafond seul).
 */
export function tierHueShift(h: FaceParams['hair'], tier: number, ra?: ResolvedAppearance): number {
  const s = Math.max(-UNDER_HUE_MAX, Math.min(UNDER_HUE_MAX, h.tiers.underHue * tier));
  if (!ra) return s;
  const base = toHsl(ra.base);
  if (base.s < 0.15) return s;
  const d0 = hueDiff(toHsl(ra.tone(h.tiers.underTone * Math.min(1, 0.6 + 0.2 * tier))).h, base.h);
  return Math.max(-ANALOGOUS_MAX - d0, Math.min(ANALOGOUS_MAX - d0, s));
}

/** Ramène `root` vers `base` juste assez pour que sa luminance atteigne `ROOT_MIN_RATIO` × celle des cheveux (dichotomie, direction de teinte conservée). */
function liftRoot(root: string, base: string, ratio: number): string {
  const lum = luminance(base);
  if (lum < 0.02 || luminance(root) >= ratio * lum) return root;
  let lo = 0, hi = 1;
  for (let i = 0; i < 8; i++) {
    const m = (lo + hi) / 2;
    if (luminance(mix(root, base, m)) >= ratio * lum) hi = m;
    else lo = m;
  }
  return mix(root, base, hi);
}

/**
 * Teinte de la SOUS-COUCHE (la coque de la chevelure, jusqu'à son bord) : la couleur des cheveux, ombrée à 55 % (`docs/HAIR-FORM-ROOTS.md`). Avant, la coque entière
 * prenait `rootColor` : sous des cheveux teints (rose), un casque brun faisait la silhouette du dôme. La repousse n'est plus qu'une bande au ras du crâne
 * (`face/hair/root-band.ts`). Mesuré avant sur la sous-couche entière : rapport de luminance racine / cheveux jusqu'à 0,02 (#2b2320 sous #c58614) ; la teinte est ramenée
 * vers les cheveux jusqu'à `ROOT_MIN_RATIO`. Source unique pour le rendu ET la vérification (`crown-tone-not-black`).
 */
export const shellColorOf = (ra: ResolvedAppearance): string => liftRoot(mix(ra.base, ra.shadow, 0.55), ra.base, ROOT_MIN_RATIO);

/** Teinte de la REPOUSSE (bande au ras du crâne) : `rootColor` explicite (racines brunes sur cheveux teints, 15 % des visages), sinon celle de la coque (pas de bande). */
export const rootColorOf = (ra: ResolvedAppearance, h: FaceParams['hair']): string => (h.rootColor ? liftRoot(h.rootColor, ra.base, ROOT_BAND_MIN_RATIO) : shellColorOf(ra));

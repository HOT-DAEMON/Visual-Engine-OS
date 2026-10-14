import { mulberry32 } from '../core/prng';
import { generateIrisPalette, hslToHex } from './palette';
import type { ColorSource } from '../schema';
import type { z } from 'zod';
import { pick, range, maybe, type EyeInput, type RandomEyeOptions } from './random-eye-helpers';
export type { RandomEyeOptions } from './random-eye-helpers';

/**
 * Génère un œil complet et valide en tirant chaque trait indépendamment à partir d'une seed
 * (mulberry32, déterministe). Prouve que le moteur compose une quasi-infinité d'individus
 * différents à partir d'un même schéma : chaque appel avec une seed différente varie la forme de
 * l'enveloppe, l'iris (famille de couleur ET texture), la pupille, les cils, le sourcil, les canthi
 * et le pli épicanthique — indépendamment les uns des autres, donc combinatoirement.
 *
 * Ordre de tirage FIXE (même sous seed identique, même si une branche n'est pas utilisée) : c'est ce
 * qui garantit qu'ajouter un trait plus tard ne change pas la valeur des traits déjà tirés pour une
 * seed donnée. Retourne un objet à valider via `SceneSpec` (schema.ts) : il peut néanmoins être
 * rejeté par une contrainte inter-champs (capteur/ouverture — non applicable ici — ou id dupliqué
 * dans une scène), d'où l'usage de `EyeSpec.safeParse` recommandé côté appelant pour un lot.
 */
export function generateRandomEye(seed: number, options: RandomEyeOptions = {}): EyeInput {
  const rnd = mulberry32(seed >>> 0);

  // 1. Enveloppe
  const width = range(rnd, 220, 340);
  const heightRatio = range(rnd, 0.42, 0.68);
  const tiltDeg = range(rnd, -14, 14);
  const upperFraction = range(rnd, 0.55, 0.72);
  const outerSideRoll = rnd();
  const style = pick(rnd, ['almond', 'almond', 'round', 'sharp', 'drooping'] as const);
  // La plupart des seeds restent 'anime' (archetype null) : l'archétype est un accent occasionnel,
  // pas le mode principal de génération (qui doit rester la composition libre des traits).
  const archetypeRoll = rnd();
  const archetype =
    archetypeRoll < 0.75
      ? null
      : pick(rnd, ['realistic', 'reptile', 'feline', 'doll', 'alien', 'demon'] as const);

  // 2. Canthi
  const innerRoundness = range(rnd, 0.1, 0.8);
  const outerRoundness = range(rnd, 0.1, 0.7);
  const caruncle = range(rnd, 0.2, 0.8);

  // 3. Pli épicanthique (indépendant de l'ascendance choisie par l'appelant — c'est un curseur continu)
  const foldAmount = maybe(rnd, 0.4) ? range(rnd, 0.3, 1) : 0;
  const foldReach = range(rnd, 0.4, 1);

  // 4. Pli palpébral
  const creaseHeight = maybe(rnd, 0.85) ? range(rnd, 0.1, 0.5) : 0;
  const creaseDepth = range(rnd, 0.3, 1);

  // 5. Iris : famille/couleur procédurale + texture
  const irisSeed = Math.floor(rnd() * 0xffffffff);
  const irisPalette = generateIrisPalette(irisSeed, { families: options.irisFamilies });
  const irisRadius = range(rnd, 0.38, 0.5);
  const irisAspect = range(rnd, 0.95, 1.25);
  const fibers = Math.round(range(rnd, 24, 80));
  const limbalRing = range(rnd, 0.2, 0.9);
  const glowStrength = maybe(rnd, 0.5) ? range(rnd, 0.2, 0.7) : 0;

  // 6. Pupille
  const pupilShape = pick(rnd, ['round', 'round', 'round', 'slit_vertical', 'slit_horizontal'] as const);
  const pupilSize = range(rnd, 0.28, 0.44);
  // La plupart des pupilles restent un simple disque sombre (c'est le cas réaliste dominant) ;
  // un dégradé ou des contours restent des accents occasionnels, pas le mode principal.
  const pupilHasGlow = maybe(rnd, 0.15);
  const pupilFill: z.input<typeof ColorSource> = pupilHasGlow
    ? {
        type: 'radial',
        stops: [
          { offset: 0, color: '#2a2a2a', opacity: 1 },
          { offset: 1, color: '#000000', opacity: 1 },
        ],
      }
    : { type: 'solid', color: '#07090f' };
  const pupilOutlineCount = maybe(rnd, 0.2) ? 1 : 0;
  const pupilOutlineColor = `#${Math.floor(range(rnd, 0, 0xffffff)).toString(16).padStart(6, '0')}`;
  const pupilVisible = maybe(rnd, 0.97); // rarissime : une pupille absente (créature sans pupille visible)

  // 7. Reflets
  const primarySize = range(rnd, 0.16, 0.3);
  const secondarySize = maybe(rnd, 0.7) ? range(rnd, 0.06, 0.15) : null;

  // 8. Cils
  const upperLashCount = Math.round(range(rnd, 8, 28));
  const upperLashLength = range(rnd, 0.14, 0.32);
  const upperLashCurl = range(rnd, 0.2, 0.9);
  const upperLashSweep = range(rnd, 10, 40);
  const lowerLashCount = Math.round(range(rnd, 0, 12));
  // Fibres : dispersion modeste le plus souvent ; un œil « sauvage » reste un accent occasionnel.
  const lashWild = maybe(rnd, 0.2);
  const lashLengthVariation = lashWild ? range(rnd, 0.4, 0.8) : range(rnd, 0.05, 0.25);
  const lashOrientationVariation = lashWild ? range(rnd, 8, 16) : range(rnd, 1, 6);
  const lashTipSharpness = range(rnd, 0.3, 0.85);
  // Apparence : la plupart des cils restent sombres et mats (hérite de lidColor, matériau=null) ;
  // une teinte propre + une pointe de brillance restent un accent occasionnel.
  const lashHasOwnColor = maybe(rnd, 0.12);
  const lashGloss = maybe(rnd, 0.25) ? range(rnd, 0.2, 0.7) : 0;
  const lashColorVariation = range(rnd, 0.05, 0.3);

  // 9. Sourcil (peut être absent)
  const hasEyebrow = maybe(rnd, 0.9);
  const browGap = range(rnd, 0.15, 0.55);
  const browThickness = range(rnd, 0.06, 0.2);
  const browArch = range(rnd, 0.1, 0.9);
  const browTiltDeg = range(rnd, -6, 14);
  const browLength = range(rnd, 0.9, 1.3);
  const browTaper = range(rnd, 0.4, 0.9);
  const browHairs = Math.round(range(rnd, 30, 100));

  // 10. Regard 3D
  const yawDeg = range(rnd, -25, 25);
  const pitchDeg = range(rnd, -18, 18);

  // 11. Expression (sauf si imposée par l'appelant)
  const expressionKinds = [
    'neutral',
    'neutral',
    'neutral',
    'angry',
    'sad',
    'fearful',
    'melancholic',
    'drowsy',
    'surprised',
    'sulky',
    'furious',
    'joyful',
    'smiling',
    'fierce',
    'stressed',
  ] as const;
  const expression =
    options.expression !== undefined
      ? options.expression
      : { kind: pick(rnd, expressionKinds), intensity: range(rnd, 0.4, 1) };

  return {
    kind: 'eye',
    id: options.id ?? `eye-${(seed >>> 0).toString(16)}`,
    seed: Math.floor(rnd() * 0xffffffff),
    shape: {
      width,
      height: width * heightRatio,
      tiltDeg,
      upperFraction,
      outerSide: outerSideRoll < 0.34 ? 'left' : outerSideRoll < 0.67 ? 'right' : 'auto',
      style,
    },
    canthi: {
      inner: { roundness: innerRoundness, caruncle },
      outer: { roundness: outerRoundness },
    },
    epicanthicFold: { amount: foldAmount, reach: foldReach },
    lids: { crease: { height: creaseHeight, depth: creaseDepth } },
    iris: { material: { base: irisPalette, roughness: range(rnd, 0.15, 0.4), clearcoat: range(rnd, 0.1, 0.4) }, radius: irisRadius, aspect: irisAspect, fibers, limbalRing, glow: glowStrength > 0 ? { color: '#ffffff', strength: glowStrength } : null },
    pupil: {
      shape: pupilShape,
      size: pupilSize,
      visible: pupilVisible,
      fill: pupilFill,
      outlines: pupilOutlineCount > 0 ? [{ color: pupilOutlineColor, width: range(rnd, 0.04, 0.14), opacity: range(rnd, 0.5, 1) }] : [],
    },
    highlights: {
      primary: { size: primarySize, opacity: range(rnd, 0.85, 1) },
      secondary: secondarySize ? { size: secondarySize, opacity: range(rnd, 0.5, 0.85) } : null,
    },
    lashes: {
      upper: {
        count: upperLashCount,
        length: upperLashLength,
        curl: upperLashCurl,
        sweep: upperLashSweep,
        tipSharpness: lashTipSharpness,
        lengthVariation: lashLengthVariation,
        orientationVariation: lashOrientationVariation,
        gloss: lashGloss,
        colorVariation: lashColorVariation,
        material: lashHasOwnColor
          ? { base: { type: 'solid', color: hslToHex(range(rnd, 0, 360), range(rnd, 0.3, 0.7), range(rnd, 0.08, 0.2)) } }
          : null,
      },
      lower: { count: lowerLashCount, lengthVariation: lashLengthVariation, colorVariation: lashColorVariation },
    },
    eyebrow: hasEyebrow
      ? {
          gap: browGap,
          thickness: browThickness,
          arch: browArch,
          tiltDeg: browTiltDeg,
          length: browLength,
          taper: browTaper,
          hairs: browHairs,
        }
      : null,
    gaze: { yawDeg, pitchDeg, travel: range(rnd, 0.7, 1.2) },
    expression,
    archetype,
  };
}

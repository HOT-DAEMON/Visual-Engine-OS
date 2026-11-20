import { mulberry32 } from '../core/prng';
import { faceLandmarks, fitEyeToFace, PAIR_SCALE_MAX, type EyeFit, type EyeSide } from '../face';
import { FaceParams, type SceneInput } from '../schema';
import { applyEyeAxes, type BrowLash, type EyelidFold } from './random-axes';
import { LashFamilyId, applyLashFamily, lashFamilyForSeed } from './eye-lash-families';
import { EXTENDED_IDENTITIES, EXTENDED2_IDENTITIES, EXTENDED3_IDENTITIES, extended2Pair, extended3Pair, extendedPair, galleryPair, GALLERY_IDENTITIES } from './eye-pool';
import { generateRandomEye } from './random-eye';
import { drawFaceParams, drawSkin, FACE_EXPRESSIONS, mouthFor, type ExpressionKind } from './random-face-helpers';
import { drawFaceExtras, type ExtrasOverride } from './random-face-extras';
import { deepMerge, drawAnatomy, type AnatomyOverride } from './random-face-anatomy';
import { randomNeck } from './random-face-neck';
import { drawStructure, type StructureOverride } from './random-face-structure';
import { noseArchetype, NOSE_ARCHETYPE_NAMES, type NoseArchetypeName } from '../face/nose/archetypes';
import { applyStylization } from '../face/stylize';
import { pick, range, type EyeInput } from './random-eye-helpers';

export interface RandomFaceOptions extends ExtrasOverride {
  /** Amplitude du tirage du SYSTÈME de cou (masse, âge, trapèzes, tension, plis…), 0–1 ; défaut 0 = cou neutre d'avant (OPT-IN : le système change le cadre `lm.neck`, donc des visages existants bougeraient). Flux dérivé : le reste du visage ne bouge pas. */
  readonly neckVariety?: number;
  /** Preset de cou (`NECK_PRESETS`) appliqué sur les tirages et sous `neck` imposé. */
  readonly neckPreset?: string;
  /** Surcharges du nez, du menton, de la mâchoire, du matériau de peau, de l'éclairage et de l'apparence de la peau (fusion profonde sur les tirages). */
  readonly anatomy?: AnatomyOverride;
  /** Moteur de structure (T1–T13) : `true` ou un objet de surcharge active `anatomyEngine: 'structured'` et tire les axes de structure (flux dérivé : les autres tirages ne bougent pas). */
  readonly structure?: boolean | StructureOverride;
  /**
   * Archétype de nez mesuré sur references/nez/06.png (`pyramide`, `cloche-ailes`) imposé AU-DESSUS des tirages du nez ; `'random'` en tire un dans un flux
   * DÉRIVÉ (`seed ^ 0x6e6f7365`, ne bouge aucun autre tirage). OPT-IN : sans l'option, les visages sont identiques graine pour graine.
   * Étude `docs/NOSE-ARCHETYPE-WIRING.md` : la silhouette est la même en `classic` et en `structured` (écart de L/H < 0,002 sur 40 graines).
   */
  readonly noseArchetype?: NoseArchetypeName | 'random';
  /** Moteur de cheveux : 'v2' (défaut) ou 'classic' (reproduit exactement les visages d'avant la v2). */
  readonly hairEngine?: 'v2' | 'classic';
  /** Autorise des occlusions du visage par les cheveux tirées au hasard (v2) ; défaut : non. */
  readonly occlusions?: boolean;
  /** Identifiant de l'hôte ; les yeux en dérivent (`<id>-eye-left`, …). Défaut : `face-<seed hex>`. */
  readonly id?: string;
  /** 'gallery' (défaut) : paire d'yeux d'une des 48 identités des galeries ; 'extended' : une des 148 (48 + les 100 formes de `eye-gallery-ext`, identité tirée dans un flux DÉRIVÉ : les autres tirages ne bougent pas) ; 'extended2' (passe 9) : une des 248 (les 148 + les 100 de eye-gallery-ext2, 4 familles d'iris photo) ; 'random' : œil tiré de la seed du visage. */
  readonly eyeSource?: 'gallery' | 'random' | 'extended' | 'extended2' | 'extended3';
  /** Famille de cils (réfs 12–16, voir eye-lash-families.ts) : un identifiant l'impose aux deux yeux ; 'auto' en tire une d'un flux dérivé dédié (les autres tirages ne bougent pas) ; absent ou null = cils de l'identité d'origine (visages d'avant inchangés). */
  readonly lashFamily?: LashFamilyId | 'auto' | null;
  /** Identité de galerie imposée (0–47, 0–147 si eyeSource = 'extended', 0–247 si 'extended2', 0–347 si 'extended3') ; sinon tirée. Ignoré si eyeSource = 'random'. */
  readonly identity?: number;
  /** Expression imposée (yeux ET bouche) ; sinon tirée. */
  readonly expression?: { readonly kind: ExpressionKind; readonly intensity: number };
  /** Grosseur voulue des yeux (1 = normale) ; l'orbite la borne. */
  readonly eyeSize?: number;
  /** Position/échelle du visage dans la scène (les yeux, enfants de l'hôte, suivent). */
  readonly transform?: { readonly x?: number; readonly y?: number; readonly scale?: number; readonly rotationDeg?: number };
}

export interface RandomFace {
  readonly objects: SceneInput['objects'];
  /** Identité de galerie utilisée, ou null (yeux tirés). */
  readonly identity: number | null;
  readonly width: number;
  readonly height: number;
  /** Paramètres du visage (parsés) et ajustement de chaque œil : pour les tests et les artefacts de preuve. */
  readonly params: FaceParams;
  readonly fits: Record<EyeSide, EyeFit>;
  /** Axes indépendants tirés pour ce visage (pli de l'œil, sourcils/cils) : pour les tests et les artefacts. */
  readonly axes: { readonly fold: EyelidFold; readonly browLash: BrowLash };
}

/**
 * Visage complet aléatoire et déterministe : crâne/mâchoire, oreilles, nez, bouche, teinte de peau,
 * cou, cheveux (11 coiffures × 5 textures indépendantes), pilosité (moustaches, barbes, favoris), asymétrie légère, plus une PAIRE d'yeux
 * (gauche/droite) posée comme enfants du visage sur les ancres des canthi internes. Les yeux sont ajustés à l'orbite (`face/fit-eye.ts`) : leur position est
 * celle du visage, leur taille est bornée par lui, quelle que soit leur forme.
 */
export function generateRandomFace(seed: number, options: RandomFaceOptions = {}): RandomFace {
  const rnd = mulberry32(seed >>> 0);
  const width = range(rnd, 300, 380);
  const height = width * range(rnd, 1.1, 1.4);
  const skin = drawSkin(rnd);
  const kind = options.expression?.kind ?? pick(rnd, FACE_EXPRESSIONS);
  const intensity = options.expression?.intensity ?? range(rnd, 0.5, 1);
  const rollDeg = range(rnd, -4, 4);
  const drawnIdentity = Math.floor(rnd() * GALLERY_IDENTITIES);
  const base = drawFaceParams(rnd, mouthFor(kind, intensity));
  const extras = drawFaceExtras(rnd, options, { hairEngine: options.hairEngine, occlusions: options.occlusions });
  // Nouveaux axes (nez, menton, mâchoire, matériau, éclairage, apparence) : flux de tirage DÉRIVÉ, les tirages existants ne bougent pas.
  const archetype = options.noseArchetype === 'random' ? NOSE_ARCHETYPE_NAMES[Math.floor(mulberry32((seed ^ 0x6e6f7365) >>> 0)() * NOSE_ARCHETYPE_NAMES.length)] : options.noseArchetype;
  // L'archétype est une SURCHARGE du tirage : posée sous `anatomy.nose` explicite (l'utilisateur garde le dernier mot).
  const anatomyOver = archetype ? { ...(options.anatomy ?? {}), nose: deepMerge((noseArchetype(archetype) as { nose: Record<string, unknown> }).nose, options.anatomy?.nose as Record<string, unknown> | undefined) } as AnatomyOverride : options.anatomy;
  const anatomy = drawAnatomy(seed, skin, anatomyOver);
  const merged = { ...base, ...anatomy, nose: { ...(base.nose ?? {}), ...(anatomy.nose ?? {}) }, neck: randomNeck(seed, extras.neck as Record<string, unknown>, options.neck as Record<string, unknown> | undefined, { variety: options.neckVariety ?? 0, preset: options.neckPreset }), hair: extras.hair, facialHair: extras.facialHair, asymmetry: extras.asymmetry };
  // Structure (optionnelle) : axes tirés dans un flux dérivé, fusionnés en profondeur. Puis profil de stylisation appliqué UNE fois (idempotent) : les repères qui suivent
  // (ajustement des yeux) lisent déjà la géométrie stylisée.
  const withStructure = options.structure ? deepMerge(merged, drawStructure(seed, options.structure === true ? {} : options.structure)) : merged;
  const params = applyStylization(FaceParams.parse(withStructure));
  const lm = faceLandmarks(params, width, height);

  const id = options.id ?? `face-${(seed >>> 0).toString(16)}`;
  const expression = { kind, intensity };
  const source = options.eyeSource ?? 'gallery';
  const gallery = source === 'gallery' || source === 'extended' || source === 'extended2' || source === 'extended3';
  // 'extended2' (passe 9) : 248 identités (148 + les 100 de eye-gallery-ext2), même flux dérivé que 'extended' ; 'extended' et 'gallery' gardent leurs tirages.
  // 'extended3' (passe 10) : 348 identités (248 + les 100 de eye-gallery-ext3), même flux dérivé ; les autres sources gardent leurs tirages.
  const identity = source === 'extended3' ? (options.identity ?? Math.floor(mulberry32((seed ^ 0x5eed1de9) >>> 0)() * EXTENDED3_IDENTITIES)) : source === 'extended2' ? (options.identity ?? Math.floor(mulberry32((seed ^ 0x5eed1de9) >>> 0)() * EXTENDED2_IDENTITIES)) : source === 'extended' ? (options.identity ?? Math.floor(mulberry32((seed ^ 0x5eed1de9) >>> 0)() * EXTENDED_IDENTITIES)) : gallery ? (options.identity ?? drawnIdentity) : null;
  const pair0: Record<EyeSide, EyeInput> = gallery
    ? source === 'extended3' ? extended3Pair(identity as number, expression) : source === 'extended2' ? extended2Pair(identity as number, expression) : source === 'extended' ? extendedPair(identity as number, expression) : galleryPair(identity as number, expression)
    : (() => {
        const eye = generateRandomEye(seed, { expression });
        return { left: { ...eye, shape: { ...eye.shape, outerSide: 'left' } }, right: { ...eye, shape: { ...eye.shape, outerSide: 'right' } } };
      })();

  const lashFam = options.lashFamily ? (options.lashFamily === 'auto' ? lashFamilyForSeed(seed) : options.lashFamily) : null;
  const withLashes = (e: EyeInput): EyeInput => (lashFam && e.kind === 'eye' ? (applyLashFamily(e as unknown as Record<string, unknown>, lashFam) as unknown as EyeInput) : e);
  const pair: Record<EyeSide, EyeInput> = { left: withLashes(pair0.left), right: withLashes(pair0.right) };

  const sides: EyeSide[] = ['left', 'right'];
  const anchors = sides.map((side) => {
    const P = side === 'left' ? lm.innerCanthus.left : lm.innerCanthus.right;
    return { id: `canthus-${side}`, x: P.x / (width / 2), y: P.y / (height / 2) };
  });
  const t = options.transform ?? {};
  const host: SceneInput['objects'][number] = {
    kind: 'host',
    id,
    transform: { x: t.x ?? 0, y: t.y ?? 0, scale: t.scale ?? 1, rotationDeg: (t.rotationDeg ?? 0) + rollDeg },
    shape: 'face',
    width,
    height,
    material: { preset: 'matte', color: skin },
    face: params,
    anchors,
  };
  const withAxes = (e: EyeInput): EyeInput => (e.kind === 'eye' ? applyEyeAxes(e, extras.fold, extras.browLash) : e);
  const fitOpts = { size: options.eyeSize, perimeters: !!options.structure };
  const fits = { left: fitEyeToFace(withAxes(pair.left), 'left', lm, fitOpts), right: fitEyeToFace(withAxes(pair.right), 'right', lm, fitOpts) };
  // Appariement : si l'écart d'échelle dépasse la borne anatomique (yeux bridés par le sourcil + asymétrie d'ouverture), l'œil le plus grand est ramené sous `plus petit × PAIR_SCALE_MAX`.
  const [big, small] = fits.left.scale >= fits.right.scale ? (['left', 'right'] as const) : (['right', 'left'] as const);
  if (fits[big].scale > fits[small].scale * PAIR_SCALE_MAX) fits[big] = fitEyeToFace(withAxes(pair[big]), big, lm, { ...fitOpts, maxScale: fits[small].scale * PAIR_SCALE_MAX });
  const eyes = sides.map((side): SceneInput['objects'][number] => {
    const fit = fits[side];
    return { ...fit.eye, id: `${id}-eye-${side}`, place: { host: id, anchors: [`canthus-${side}`] }, transform: fit.transform };
  });
  return { objects: [host, ...eyes], identity, width, height, params, fits, axes: { fold: extras.fold, browLash: extras.browLash } };
}

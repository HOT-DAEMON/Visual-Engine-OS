import { mulberry32 } from '../core/prng';
import { faceLandmarks, fitEyeToFace, type EyeFit, type EyeSide } from '../face';
import { FaceParams, type SceneInput } from '../schema';
import { applyEyeAxes, type BrowLash, type EyelidFold } from './random-axes';
import { galleryPair, GALLERY_IDENTITIES } from './eye-pool';
import { generateRandomEye } from './random-eye';
import { drawFaceParams, drawSkin, FACE_EXPRESSIONS, mouthFor, type ExpressionKind } from './random-face-helpers';
import { drawFaceExtras, type ExtrasOverride } from './random-face-extras';
import { pick, range, type EyeInput } from './random-eye-helpers';

export interface RandomFaceOptions extends ExtrasOverride {
  /** Moteur de cheveux : 'v2' (défaut) ou 'classic' (reproduit exactement les visages d'avant la v2). */
  readonly hairEngine?: 'v2' | 'classic';
  /** Autorise des occlusions du visage par les cheveux tirées au hasard (v2) ; défaut : non. */
  readonly occlusions?: boolean;
  /** Identifiant de l'hôte ; les yeux en dérivent (`<id>-eye-left`, …). Défaut : `face-<seed hex>`. */
  readonly id?: string;
  /** 'gallery' (défaut) : paire d'yeux d'une des 48 identités des galeries ; 'random' : œil tiré de la seed du visage. */
  readonly eyeSource?: 'gallery' | 'random';
  /** Identité de galerie imposée (0–47) ; sinon tirée. Ignoré si eyeSource = 'random'. */
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
  const params = FaceParams.parse({ ...base, neck: extras.neck, hair: extras.hair, facialHair: extras.facialHair, asymmetry: extras.asymmetry });
  const lm = faceLandmarks(params, width, height);

  const id = options.id ?? `face-${(seed >>> 0).toString(16)}`;
  const expression = { kind, intensity };
  const gallery = (options.eyeSource ?? 'gallery') === 'gallery';
  const identity = gallery ? (options.identity ?? drawnIdentity) : null;
  const pair: Record<EyeSide, EyeInput> = gallery
    ? galleryPair(identity as number, expression)
    : (() => {
        const eye = generateRandomEye(seed, { expression });
        return { left: { ...eye, shape: { ...eye.shape, outerSide: 'left' } }, right: { ...eye, shape: { ...eye.shape, outerSide: 'right' } } };
      })();

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
  const fits = { left: fitEyeToFace(withAxes(pair.left), 'left', lm, { size: options.eyeSize }), right: fitEyeToFace(withAxes(pair.right), 'right', lm, { size: options.eyeSize }) };
  const eyes = sides.map((side): SceneInput['objects'][number] => {
    const fit = fits[side];
    return { ...fit.eye, id: `${id}-eye-${side}`, place: { host: id, anchors: [`canthus-${side}`] }, transform: fit.transform };
  });
  return { objects: [host, ...eyes], identity, width, height, params, fits, axes: { fold: extras.fold, browLash: extras.browLash } };
}

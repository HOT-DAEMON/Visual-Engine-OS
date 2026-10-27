import { applyArchetype } from '../../archetypes';
import { applyExpression } from '../../expressions';
import { effectivePupilSize, openingGeometry, turnOpening, type TurnedOpening } from '../../geometry/eye';
import { toLocal, type LightVector } from '../../lighting/light';
import { headTurnOf, rotateLightForHeadTurn } from '../../lighting/head-turn';
import { foreshortenTransform } from '../../lighting/gaze3d';
import { compileSurface, dominantColor, type Surface } from '../../materials';
import type { EyeSpec } from '../../schema';
import { el, num, urlRef } from '../../core/svg';
import { objectTransform, type CompiledObject } from '../object';
import { irisCenter, irisRadii, openingPath } from './helpers';
import { renderGlobeInner } from './globe-inner';
import { renderLidsAndFold } from './lids-fold';
import { renderEyebrow } from './eyebrow-render';
import { DEFAULT_SKIN } from './default-skin';
import { gradeEye, resolveEyeLook } from './look';

/**
 * Compile un œil complet : sclère, iris/pupille/regard 3D (globe-inner.ts), paupières/cils/pli
 * (lids-fold.ts), sourcil (eyebrow-render.ts). Ce fichier n'est que l'ORCHESTRATEUR : il calcule le
 * contexte partagé (géométrie de l'ouverture, lumière locale, couleurs de peau/paupière) puis
 * délègue chaque zone visuelle à sa fonction dédiée, et assemble le résultat final.
 */
/** Œil EFFECTIF : archétype, expression, réponse lumineuse de la pupille (EYE-05G), étalonnage — exactement ce que le rendu dessine (réutilisé par `verify/eye.ts`). */
export function resolveEye(rawEye: EyeSpec): EyeSpec {
  const posed = applyExpression(applyArchetype(rawEye));
  // EYE-05G : la réponse lumineuse change la taille AVANT tout le reste (iris détaillé, fibres, pupille lisent la même taille).
  const sized = posed.pupil.response.model === 'fixed' ? posed : { ...posed, pupil: { ...posed.pupil, size: effectivePupilSize(posed.pupil) } };
  return gradeEye(sized);
}

export function compileEye(rawEye: EyeSpec, worldLight: LightVector): CompiledObject {
  const eye = resolveEye(rawEye);
  const id = eye.id;
  const rot = eye.transform.rotationDeg;
  // Rotation 3D de la tête (voir lighting/head-turn.ts) : s'applique AVANT la rotation 2D dans le
  // plan (`rot`). Le reste du pipeline (highlights compris, via `renderGlobeInner`) continue de
  // recevoir une « lumière du monde » — simplement déjà corrigée pour l'orientation de la tête.
  const headLight = rotateLightForHeadTurn(worldLight, eye.headTurn.yawDeg, eye.headTurn.pitchDeg);
  const L = toLocal(headLight, rot);
  const g0 = openingGeometry(eye.shape, eye.canthi);
  // Rotation 3D : modèle `sphere` = enveloppe reprojetée point par point sur la sphère de la tête (turn3d.ts) ; `flat` = écrasement uniforme historique (headWrap).
  const ht = eye.headTurn;
  const turned: TurnedOpening | null =
    ht.model === 'sphere' ? turnOpening(g0, { yawDeg: ht.yawDeg, pitchDeg: ht.pitchDeg, azimuthDeg: ht.azimuthDeg, radius: eye.shape.width * ht.radiusFactor }, !ht.parallax) : null;
  const g = turned ? turned.g : g0;
  const { rx: irisRx, ry: irisRy } = irisRadii(eye);
  const c = irisCenter(eye, g);
  const skin = dominantColor((eye.skin ?? DEFAULT_SKIN).base);
  const lidColor = dominantColor(eye.lids.material.base);
  const look = resolveEyeLook(eye, skin);
  const th = eye.lids.thickness * eye.shape.height;
  const defs: string[] = [];
  const openD = openingPath(g);

  defs.push(el('clipPath', { id: `${id}-opening` }, [el('path', { d: openD })]));

  // Sclère : sphère vue à travers l'ouverture (l'ombrage sombre naturellement vers les coins).
  const scleraSurface: Surface = {
    bbox: g.bbox,
    curvature: 'sphere',
    draw: (a) => el('path', { d: openD, ...a }),
  };
  const sclera = compileSurface(`${id}-sclera`, scleraSurface, eye.sclera, L, rot);
  defs.push(...sclera.defs);

  const globe = renderGlobeInner(eye, g, c, L, rot, headLight, skin, id, irisRx, irisRy, turned, look);
  defs.push(...globe.defs);

  const lids = renderLidsAndFold(eye, g, L, skin, lidColor, th, globe.fold, id, look);
  defs.push(...lids.defs);

  const brow = renderEyebrow(eye, g, L, rot, id);
  defs.push(...brow.defs);

  // Raccourcissement + parallaxe de la tête entière (même physique que le regard dans l'orbite,
  // voir gaze3d.ts) : enveloppe autour de TOUT le contenu de l'œil, dans son repère local (donc
  // avant la transformation de scène `objectTransform`). Identité exacte à headTurn=0.
  const headRadius = eye.shape.width * 0.9;
  const headProj = headTurnOf(eye.headTurn.yawDeg, eye.headTurn.pitchDeg, headRadius);
  const headWrap = turned ? '' : `translate(${num(headProj.dx)} ${num(headProj.dy)}) ${foreshortenTransform(0, 0, headProj)}`;
  const content = [
    sclera.markup,
    el('g', { 'clip-path': urlRef(`${id}-opening`) }, globe.inner),
    ...lids.outside,
    ...brow.outside,
  ];

  const markup = el('g', { transform: objectTransform(eye.transform) }, [el('g', headWrap ? { transform: headWrap } : {}, content)]);
  return { defs, markup };
}

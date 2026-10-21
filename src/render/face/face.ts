import { mix } from '../../core/color';
import { el, urlRef } from '../../core/svg';
import { resolveAppearance } from '../../appearance';
import { compileContact, renderRim, resolveRims, type ContactMetric } from '../../contact';
import { faceLandmarks, noseGeometry, outlinePath, skinRegions, type FaceLandmarks, type NoseGeometry } from '../../face';
import { applyStylization } from '../../face/stylize';
import { dominantColor, spotGradient, type Surface } from '../../materials';
import { compileSkin, type CompiledSkin } from '../../skin';
import { FaceParams, type ContactSpec, type HostSpec } from '../../schema';
import type { LightVector } from '../../lighting/light';
import { renderEars } from './ears';
import { faceComponents } from './components';
import { renderFacialHair } from './facial-hair';
import { renderHair } from './hair';
import { renderChin } from './jaw';
import { renderMouth } from './mouth';
import { renderNeck } from './neck';
import { renderNose } from './nose';
import { softKit } from './soft';
import { renderStructure, type StructureLayers } from './structure';
import { inkFilter, inkThreshold } from './structure/ink-filter';

/** Surface « crâne + mâchoire » d'un hôte `shape: 'face'`, habillable par le système de matériaux. */
export function faceSurface(h: HostSpec, lm: FaceLandmarks): Surface {
  return { bbox: { x: -h.width / 2, y: -h.height / 2, w: h.width, h: h.height }, curvature: 'sphere', draw: (a) => el('path', { d: outlinePath(lm.outline), ...a }) };
}

export interface FaceParts {
  readonly lm: FaceLandmarks;
  readonly defs: string[];
  /** Peau de la tête (matériau de peau) ; `null` avec `skinMaterial.model = 'legacy'` : l'hôte utilise alors l'ancien ombrage générique. */
  readonly skin: CompiledSkin | null;
  /** Dessiné AVANT la tête : masse arrière des cheveux, cou, oreilles. */
  readonly behind: string[];
  /** Dessiné APRÈS la tête, avant les yeux : joues, nez, bouche + moustache, barbe, cheveux (cap, frange, pattes). */
  readonly front: string[];
  /** Dessiné APRÈS les yeux (mèches qui passent devant le visage). */
  readonly over: string[];
  /** Mesures des ombres de contact (vérification : ni flottant ni collé). */
  readonly contacts: ContactMetric[];
  readonly nose: NoseGeometry;
  /** Calques et géométrie du moteur de structure (`anatomyEngine: 'structured'`), sinon `null`. */
  readonly structure: StructureLayers | null;
  /** Filtre à appliquer à tout l'hôte (rendu `ink`), sinon `null`. */
  readonly filter: string | null;
}

/** Ombres de contact modulées par la mâchoire : une transition cou douce adoucit l'ombre, un tissu sous-mentonnier épais la renforce et l'étale. */
function contactSpecs(p: FaceParams, lm: FaceLandmarks): Record<string, ContactSpec> {
  const { master: _master, ...c } = p.lighting.contacts;
  void _master;
  const j = p.jaw;
  return { ...c, jaw: { ...c.jaw, softness: Math.min(1, c.jaw.softness * 0.5 + 0.5 * j.neckTransition), strength: Math.min(1, c.jaw.strength * (1 + 0.6 * lm.jaw.tissue.submentalTension)) } };
}

export function faceParts(h: HostSpec, L: LightVector, rot: number): FaceParts {
  // Profil de stylisation appliqué UNE fois (idempotent, neutre par défaut) : la géométrie lue partout ensuite est la géométrie stylisée.
  const params = applyStylization(FaceParams.parse(h.face ?? {}));
  const lm = faceLandmarks(params, h.width, h.height);
  const skin = dominantColor(h.material.base);
  // Apparence de la peau : teinte d'ombre (proche de la peau, légèrement bleutée), lumière et contour lues par TOUS les enfants.
  // Mode de rendu `anime` : aplats à bords nets (ombrage `cel`) ; la géométrie n'est pas touchée.
  const skinRa = resolveAppearance(skin, params.renderMode === 'anime' ? { ...params.skin, shading: { ...params.skin.shading, mode: 'cel' } } : params.skin);
  const g = noseGeometry(params, lm);
  const regions = skinRegions(lm, g);
  const u = lm.W / 300;
  const nose = renderNose(h.id, params, lm, skin, skinRa, L, g);
  const defs = [...nose.defs];
  const skinLayer = params.skinMaterial.model === 'skin' ? compileSkin(h.id, lm, params.skinMaterial, skinRa, L, regions, params.lighting.zones) : null;
  if (skinLayer) defs.push(...skinLayer.defs);

  // Sous-moteur : composants → ombres de contact → lumières de contour.
  const { components, receivers } = faceComponents(params, lm, g);
  const shadowColor = mix(skinRa.shadow, '#000000', 0.45);
  const ct = compileContact(h.id, components, contactSpecs(params, lm), params.lighting.contacts.master, L, shadowColor, receivers, u);
  const rims = resolveRims(components, params.lighting.rims, skinRa);
  const rimKit = softKit(`${h.id}-rim`, lm.W, lm.H);
  const rim = (cid: string): string => {
    const comp = components.find((c) => c.id === cid);
    const r = rims.get(cid);
    if (!comp || !r || !comp.rim) return '';
    const out = renderRim(h.id, comp, r, L, u, rimKit);
    defs.push(...out.defs);
    return out.markup;
  };
  const shadow = (cid: string): string => ct.markup.get(cid) ?? '';
  defs.push(...ct.defs);
  // Les filtres de flou des lumières de contour sont ajoutés APRÈS le calcul des liserés (le kit se remplit à la demande).

  const front: string[] = [];
  if (params.blush > 0.01) {
    const gid = `${h.id}-blush`;
    defs.push(spotGradient(gid, '#e0566a', 0.38 * params.blush, 0.8));
    for (const sg of [-1, 1] as const) front.push(el('ellipse', { cx: sg * lm.W * 0.2, cy: lm.eyeY + 0.12 * lm.H, rx: lm.W * 0.1, ry: lm.H * 0.05, fill: urlRef(gid) }));
  }
  const hair = renderHair(h.id, params, lm, L, rot, mix(skin, skinRa.shadow, 0.9), skin);
  const neck = renderNeck(h.id, params, lm, skin, skinRa, L);
  const chin = renderChin(h.id, params, lm, skinRa, L);
  const fh = renderFacialHair(h.id, params, lm, L, rot);
  defs.push(...hair.defs, ...neck.defs, ...chin.defs, ...fh.defs);
  // Bouche et moustache forment UN groupe : l'asymétrie les incline ensemble autour du centre de la bouche.
  const tilt = params.asymmetry.mouthTiltDeg;
  // Moteur de structure : calques peints d'après la géométrie de structure ; la bouche structurée REMPLACE la bouche classique.
  const st = params.anatomyEngine === 'structured' ? renderStructure(h.id, params, lm, g, skin, skinRa, L) : null;
  if (st) defs.push(...st.defs);
  const mouthGroup = [...(st ? st.mouth : renderMouth(params, lm, skin, skinRa, L)), ...fh.mustache];
  // Ordre : ombres de contact sur la peau (orbites, nez, ailes) → nez → contours du nez → menton → bouche (+ ombre de la lèvre) → barbe → ombre des
  // cheveux → contour de la tête et du menton → cheveux.
  front.push(
    shadow('orbitL'), shadow('orbitR'), ...(st ? st.tissue : []), shadow('nose'), shadow('alaL'), shadow('alaR'),
    ...nose.markup, ...(st ? st.noseRegions : []), rim('nose'), rim('tip'), rim('alaL'), rim('alaR'),
    ...chin.markup,
    shadow('mouth'),
    tilt === 0 ? mouthGroup.join('') : el('g', { transform: `rotate(${tilt} 0 ${lm.mouthY})` }, mouthGroup), rim('mouth'),
    ...(st ? st.after : []), ...fh.beard, shadow('hair'), rim('chin'), rim('head'), ...hair.front,
  );
  // Derrière la tête : ombre portée de la mâchoire sur le cou (dessinée juste après le cou), oreilles creusées contre la tête.
  const behind = [...hair.back, ...neck.markup, ...(st ? st.neck : []), shadow('head'), rim('neck'), ...renderEars(params, lm, skin, skinRa).flatMap((e, i) => [e, shadow(i === 0 ? 'earL' : 'earR')]), rim('earL'), rim('earR')];
  defs.push(...rimKit.defs);
  // Rendu `ink` : un filtre global (niveaux de gris + seuil) ; aucune anatomie n'est reconstruite.
  const ink = params.renderMode === 'ink' ? inkFilter(h.id, lm.W, lm.H, inkThreshold(skin)) : null;
  if (ink) defs.push(...ink.defs);
  return { lm, defs, skin: skinLayer, behind, front: front.filter((s) => s !== ''), over: hair.over, contacts: ct.metrics, nose: g, structure: st, filter: ink ? ink.ref : null };
}

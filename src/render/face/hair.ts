import { mix } from '../../core/color';
import { el, urlRef } from '../../core/svg';
import { compileEffects, toHsl, fromHsl, type ResolvedAppearance } from '../../appearance';
import type { FaceLandmarks } from '../../face';
import { outlinePath } from '../../face/outline';
import { hairGeometry, type HairLock } from '../../face/hair';
import { polyBox, type Poly } from '../../face/poly';
import { direction2D, type LightVector } from '../../lighting/light';
import { compileSurface, resolvePreset, spotGradient, type Surface } from '../../materials';
import type { FaceParams } from '../../schema';
import { hairGloss, hairlineTransition, smoothPath } from './hair-detail';
import { lockMarkup, type LockStyle } from './hair-lock';
import { hairAppearance } from './hair-look';
import { polyPath } from './path';
import { profileOf } from '../../face/hair/sim/profiles';
import { sheenBands } from '../../face/hair/sim/sheen';

export interface HairParts {
  readonly defs: string[];
  /** Queue, chignon, tresses, mèches arrière, masse arrière : dessinés AVANT le cou et la tête. */
  readonly back: string[];
  /** Cuir chevelu, sous-couche, mèches, transition : dessinés APRÈS la tête. */
  readonly front: string[];
  /** Mèches qui passent devant le visage : dessinées APRÈS les yeux (voir `compileHost`). */
  readonly over: string[];
}

/** Sous-couche : matériau « satin » du système partagé (même lumière que la peau). */
function underlayer(id: string, poly: Poly, color: string, L: LightVector, rot: number): { defs: string[]; markup: string; d: string } {
  const d = polyPath(poly);
  const surface: Surface = { bbox: polyBox(poly), curvature: 'sphere', draw: (a) => el('path', { d, ...a }) };
  const out = compileSurface(id, surface, resolvePreset({ preset: 'satin', color }), L, rot);
  return { defs: out.defs, markup: out.markup, d };
}

/** Rotation de teinte (degrés) d'une couleur : sous-couches d'étage décalées de teinte. */
const hueShift = (c: string, deg: number): string => (deg === 0 ? c : fromHsl({ ...toHsl(c), h: toHsl(c).h + deg }));

/**
 * Chevelure : cuir chevelu visible (raie, éclaircissement) sous des sous-couches d'étage et des mèches dessinées une
 * à une. Toutes les teintes viennent du moteur d'apparence partagé (`hairAppearance`) : ombre, lumière, dégradé racine →
 * pointe, ombrage cel, reflets colorés cohérents avec la couleur, effets (glow, bloom…).
 */
export function renderHair(id: string, p: FaceParams, lm: FaceLandmarks, L: LightVector, rot: number, skinShadow: string, skin: string): HairParts {
  const geo = hairGeometry(p, lm);
  if (!geo) return { defs: [], back: [], front: [], over: [] };
  const h = p.hair;
  const ra: ResolvedAppearance = hairAppearance(h);
  const ink = h.sim.enabled && h.sim.ink ? '#08080c' : undefined;
  const st: LockStyle = { id: `${id}-hl`, ra, ld: direction2D(L), W: lm.W, ink };
  const rootColor = h.rootColor ?? mix(ra.base, ra.shadow, 0.55);
  const defs: string[] = [];
  let k = 0;
  const draw = (l: HairLock, depth: number, cast: boolean): string[] => {
    const m = lockMarkup(l, k++, st, depth, cast);
    defs.push(...m.defs);
    return m.markup;
  };
  const back: string[] = [];
  if (geo.backBase) back.push(el('path', { d: smoothPath(geo.backBase), fill: ink ?? mix(mix(ra.base, ra.shadow, 0.8), '#000000', 0.2), stroke: ink, 'stroke-width': ink ? lm.W * 0.0042 : undefined, 'stroke-linejoin': 'round' }));
  for (const l of geo.locks.filter((q) => q.layer === 'back')) back.push(...draw(l, 0.12, false));
  for (const t of geo.ties) back.push(el('ellipse', { cx: t.at.x, cy: t.at.y, rx: t.rx, ry: t.rx * 0.55, fill: mix(ra.base, '#000000', 0.55), stroke: ra.light, 'stroke-width': lm.W * 0.003 }));

  const base = underlayer(`${id}-hair-base`, geo.base[0] as Poly, rootColor, L, rot);
  const clipId = `${id}-hair-base-clip`;
  defs.push(...base.defs, el('clipPath', { id: clipId }, [el('path', { d: base.d })]));
  const scalpColor = mix(skin, skinShadow, 0.55);
  const bare: string[] = [];
  if (geo.bare.part) bare.push(el('path', { d: smoothPath(geo.bare.part), fill: scalpColor, opacity: 0.85 }));
  geo.bare.thin.forEach((q, i) => {
    const b = polyBox(q);
    const gid = `${id}-hair-thin${i}`;
    defs.push(spotGradient(gid, scalpColor, 0.35 + 0.5 * h.thinning, 0.55));
    bare.push(el('ellipse', { cx: b.x + b.w / 2, cy: b.y + b.h / 2, rx: b.w / 2, ry: b.h / 2, fill: urlRef(gid) }));
  });
  const frontLocks = geo.locks.filter((q) => q.layer === 'front');
  const body: string[] = [ink ? el('path', { d: base.d, fill: ink }) : base.markup, el('g', { 'clip-path': urlRef(clipId) }, bare)];
  // Zones rasées : repousse sombre sur la peau (côtés / nuque), sous les mèches.
  for (const q of geo.shaved ?? []) body.unshift(el('path', { d: smoothPath(q), fill: mix(skin, ink ?? ra.base, ink ? 0.42 : 0.55), opacity: 0.9 }));
  const fringeBase = geo.front.slice(1, geo.front.length - frontLocks.length);
  if (fringeBase.length) body.push(el('path', { d: polyPath(...fringeBase), fill: rootColor }));
  // Sous-couches visibles par étage : silhouette plus sombre / décalée de teinte, sous les mèches de l'étage.
  // Une silhouette d'étage englobe la tête : DEVANT la tête elle est rognée par la sous-couche (jamais sur le visage),
  // et une copie est dessinée DERRIÈRE la tête pour la part qui dépasse du crâne.
  const massEl = (m: (typeof geo.tierMasses)[number]): string => el('path', { d: smoothPath(m.poly), fill: hueShift(ra.tone(h.tiers.underTone * Math.min(1, 0.6 + 0.2 * m.tier)), h.tiers.underHue * m.tier), opacity: h.tiers.underVisible });
  if (geo.tierMasses.length) body.push(el('g', { 'clip-path': urlRef(clipId) }, geo.tierMasses.map(massEl)));
  back.unshift(...geo.tierMasses.map(massEl));
  if (geo.simMass) body.push(el('path', { d: smoothPath(geo.simMass), fill: ink ?? ra.tone(-0.42), stroke: ink, 'stroke-width': ink ? lm.W * 0.0042 : undefined, 'stroke-linejoin': 'round' }));
  for (const l of frontLocks) body.push(...draw(l, 0, true));
  // Encre : bandes de brillance continues sur le dessus, rognées par la silhouette réelle des cheveux (sous la limite des sourcils).
  if (ink) {
    const cid = `${id}-hair-sheen`;
    const silh = [...geo.front, ...(geo.simMass ? [geo.simMass] : [])];
    defs.push(el('clipPath', { id: cid }, silh.map((q) => el('path', { d: polyPath(q) }))));
    body.push(el('g', { 'clip-path': urlRef(cid) }, sheenBands(geo, lm, profileOf(h.sim.archetype === 'none' ? 'tousled' : h.sim.archetype)).map((q) => el('path', { d: smoothPath(q), fill: '#ffffff' }))));
  }
  const gloss = ink ? { defs: [] as string[], markup: [] as string[] } : hairGloss(id, geo, p, lm, L, rot, ra);
  defs.push(...gloss.defs);
  body.push(...gloss.markup);
  const box = polyBox(geo.front.flat());
  const pad = lm.W * 0.3;
  const fx = compileEffects(`${id}-hair`, ra.spec, ra, { x: box.x - pad, y: box.y - pad, w: box.w + 2 * pad, h: box.h + 2 * pad });
  defs.push(...fx.defs);
  // Ombres portées des mèches simulées sur la peau : même lumière que le reste (décalage bas-droite), floutées, tronquées au contour du visage.
  const shadows: string[] = [];
  if (geo.skinShadows?.length && h.sim.skinShadow > 0) {
    const cid = `${id}-hair-skin-clip`;
    const fid = `${id}-hair-skin-blur`;
    defs.push(el('clipPath', { id: cid }, [el('path', { d: outlinePath(lm.outline) })]), el('filter', { id: fid, x: '-10%', y: '-10%', width: '120%', height: '120%' }, [el('feGaussianBlur', { stdDeviation: lm.W * 0.006 })]));
    shadows.push(el('g', { 'clip-path': urlRef(cid) }, [el('g', { filter: urlRef(fid), opacity: h.sim.skinShadow }, geo.skinShadows.map((q) => el('path', { d: polyPath(q), fill: mix(skin, '#1a0f0a', 0.55) })))]));
  }
  const front: string[] = [...hairlineTransition(geo, p, lm, skinShadow), ...shadows, fx.filter ? el('g', { filter: fx.filter }, body) : body.join('')];
  const over = geo.locks.filter((q) => q.layer === 'over').flatMap((l) => draw(l, 0, false));
  return { defs, back, front, over };
}

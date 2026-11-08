import type { ResolvedAppearance } from '../../appearance';
import { mix } from '../../core/color';
import { pathBox } from '../../core/pathbox';
import { el, num, urlRef } from '../../core/svg';
import type { FaceLandmarks, SkinRegions } from '../../face';
import { direction2D, type LightVector } from '../../lighting/light';
import { gradientStop as stop } from '../../materials';
import { sectionPoint, surfaceNormal } from '../../neck/geometry';
import type { NeckModel } from '../../neck/types';
import type { FaceLighting, SkinMaterial } from '../../schema';
import { clipDef, falloffLayer, formLayer, fresnelLayer, poreLayer, spotLayers, terminatorColorAt, terminatorPosition, wrapSkin, type Layers, type SkinShading, type SkinSurface } from '../../skin';
import { compileZones } from '../../skin/zones';

/**
 * PEAU DU COU = le moteur de peau de la tête, sur le contour du cou (aucun éclairage propre). Mêmes briques (`skin/layers.ts`), même `SkinShading`
 * (matériau × lumière × apparence), mêmes effets d'apparence (grain, glow, bloom, opacité). Ce que le cou apporte, c'est la GÉOMÉTRIE :
 *   - la coordonnée de terminateur de chaque point vient des NORMALES réelles de la section : projection de la normale sur la direction 2D de la lumière
 *     (−1 = bord côté ombre, +1 = bord côté lumière), donc le terminateur traverse TOUTE la largeur du cou exactement comme il traverse la tête ;
 *     puis la COULEUR vient de `terminatorColorAt` sur les arrêts partagés : une torsion, une asymétrie, une courbure ou un autre angle de lumière changent l'ombrage ;
 *   - zones d'épaules, reflet de la région `neck`, Fresnel, pores et atténuation : couches partagées, restreintes aux régions du cou.
 * La couleur de base est celle de l'apparence (`ra.base`, la MÊME peau que la tête et le corps) assombrie par `neck.shade` (cou à l'ombre du menton) ;
 * sous un motif de surface, la couleur des éléments la remplace (sinon des fonds de peau apparaîtraient entre les écailles).
 */
export interface NeckSkin { readonly defs: string[]; readonly markup: string }
const BANDS = 14;

/** Couleur de base du cou : peau de l'apparence (ou couleur d'éléments), légèrement assombrie vers l'ombre de l'apparence. L'ombre portée du menton, elle, est un dégradé qui s'estompe vers le bas (`chinShadowLayer`). */
export const neckBase = (ra: ResolvedAppearance, shade: number, elementColor: string | null): string => mix(elementColor ?? (ra.spec.gradient.length > 0 ? ra.ramp(1) : ra.base), ra.shadow, 0.06 + 0.14 * shade);

/** Projection d'une normale sur la direction 2D de la lumière : +1 = bord côté lumière, −1 = bord côté ombre. */
export const lightProjection = (n: { readonly x: number; readonly y: number }, L: LightVector): number => { const d = direction2D(L); return n.x * d.x + n.y * d.y; };

/** Coordonnée de terminateur (0 = lumière … 1 = ombre) d'une projection `s` : MÊME échelle que le dégradé de la tête (le terminateur traverse toute l'étendue). Mode cel : deux aplats. */
export function terminatorOffsetOf(sh: SkinShading, L: LightVector, s: number): number {
  const t0 = terminatorPosition(L);
  if (sh.cel) return s >= 0 ? 0 : 1;
  return s >= 0 ? t0 * (1 - Math.min(1, s)) : t0 + (1 - t0) * Math.min(1, -s);
}

/** UNE loi de couleur pour tout ce que le cou dessine à la lumière (peau, écailles, plaques, plumes, accessoires) : arrêts partagés du terminateur composés sur `base`. */
export const toneOfNormal = (sh: SkinShading, L: LightVector, base: string, n: { readonly x: number; readonly y: number }): string => terminatorColorAt(sh.terminator, terminatorOffsetOf(sh, L, lightProjection(n, L)), base);

/** Ombre portée de la tête sur le haut du cou (`neck.shade`) : voile de l'ombre de l'apparence, maximal sous le menton, nul vers 60 % de la longueur. */
function chinShadowLayer(id: string, s: SkinSurface, ra: ResolvedAppearance, shade: number): Layers {
  const a = 0.06 + 0.14 * shade, gid = `${id}-chin-shadow`;
  return { defs: [el('linearGradient', { id: gid, gradientUnits: 'userSpaceOnUse', x1: 0, y1: s.top, x2: 0, y2: s.bottom }, [stop(0, ra.shadow, a * 2.4), stop(0.6, ra.shadow, 0), stop(1, ra.shadow, 0)])], layers: [el('path', { d: s.d, fill: urlRef(gid) })] };
}

function volumeBands(id: string, model: NeckModel, sh: SkinShading, L: LightVector, base: string): Layers {
  const S = model.stations, dir = direction2D(L), defs: string[] = [], layers: string[] = [];
  const idx = Array.from({ length: BANDS + 1 }, (_, k) => Math.round((k / BANDS) * (S.length - 1)));
  for (let b = 0; b < BANDS; b++) {
    const i0 = idx[b]!, i1 = idx[b + 1]!, im = Math.round((i0 + i1) / 2), samples: { x: number; lit: number }[] = [];
    for (let k = 0; k <= 48; k++) {
      const psi = (k / 48) * 2 * Math.PI - Math.PI, n = surfaceNormal(model, im, psi);
      if (n.z <= 0.02) continue;
      samples.push({ x: sectionPoint(S[im]!, psi).x, lit: n.x * dir.x + n.y * dir.y });
    }
    if (samples.length < 3) continue;
    samples.sort((p, q) => p.x - q.x);
    const xl = samples[0]!.x, xr = samples[samples.length - 1]!.x, step = Math.max(1, Math.floor(samples.length / 12));
    const pick = samples.filter((_, k) => k % step === 0 || k === samples.length - 1);
    const gid = `${id}-band-${b}`;
    defs.push(el('linearGradient', { id: gid, gradientUnits: 'userSpaceOnUse', x1: xl, y1: 0, x2: xr, y2: 0 }, pick.map((s) => stop((s.x - xl) / (xr - xl || 1), terminatorColorAt(sh.terminator, terminatorOffsetOf(sh, L, s.lit), base), 1))));
    const top = S[i0]!, bot = S[i1]!, pad = b === BANDS - 1 ? 0 : 1.2;
    const w = (st: typeof top): [number, number] => { let lo = Infinity, hi = -Infinity; for (let k = 0; k < 24; k++) { const x = sectionPoint(st, (k / 24) * 2 * Math.PI - Math.PI).x; lo = Math.min(lo, x); hi = Math.max(hi, x); } return [lo - 0.5, hi + 0.5]; };
    const [tl, tr] = w(top), [bl, br] = w(bot);
    layers.push(el('path', { d: `M${num(tl)} ${num(top.y)}L${num(tr)} ${num(top.y)}L${num(br)} ${num(bot.y + pad)}L${num(bl)} ${num(bot.y + pad)}Z`, fill: urlRef(gid) }));
  }
  return { defs, layers };
}

export function compileNeckSkin(id: string, model: NeckModel, path: string, base: string, mat: SkinMaterial, sh: SkinShading, ra: ResolvedAppearance, L: LightVector, regions: SkinRegions, zones: FaceLighting['zones'], lm: FaceLandmarks, shade: number): NeckSkin {
  const box = pathBox(path) ?? { x: -model.ctx.W / 2, y: model.stations[0]!.y, w: model.ctx.W, h: model.ctx.H };
  const s: SkinSurface = { d: path, w: box.w, h: box.h, top: box.y, bottom: box.y + box.h, unit: model.ctx.W / 300 };
  const z = compileZones(id, lm, regions, zones, L, ra, sh.dir, new Set(['shoulders', 'neck']));
  const parts: Layers[] = [
    { defs: [], layers: [el('path', { d: path, fill: base })] },
    volumeBands(id, model, sh, L, base),
    chinShadowLayer(id, s, ra, shade),
    formLayer(id, s, sh, L, ra), // ombrage de forme partagé : le cou s'arrondit vers ses bords comme la tête
    falloffLayer(id, s, sh, L), // le terminateur est porté par les bandes (normales) ; l'atténuation est la couche partagée
    { defs: z.defs, layers: z.markup },
    spotLayers(id, sh, new Set(['neck'])),
    fresnelLayer(id, s, sh),
    poreLayer(id, s, mat, ra, regions, (rid) => rid === 'neck'),
  ];
  return wrapSkin(id, s, ra, [clipDef(id, s), ...parts.flatMap((p) => p.defs)], parts.flatMap((p) => p.layers));
}

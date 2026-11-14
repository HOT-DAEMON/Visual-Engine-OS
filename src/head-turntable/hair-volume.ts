import type { FaceLandmarks } from '../face/landmarks';
import { hairGeometry } from '../face/hair';
import { resolveTexture } from '../face/hair/texture';
import type { FaceParams, HairStyle } from '../schema';
import { faceYToU } from './hair-bridge';
import { sampleRows, silhouetteRows } from './hair-silhouette';
import { hairPartsOf } from './hair-parts-spec';
import type { HairVolume } from './hair-volume-types';

type Style = Exclude<HairStyle, 'bald'>;

/** Pas des rangées de la coque (U). */
export const SHELL_DY = 0.0125;
/** Profondeur reportée de l'épaisseur latérale, par coiffure : masses rondes = 1 (sphère de cheveux autour du crâne) ; longs lisses = plaqués devant, reculés derrière ; coupes courtes = coque mince uniforme. */
const DEPTH: Record<Style, { readonly kzF: number; readonly kzB: number }> = {
  buzz: { kzF: 1, kzB: 1 }, short: { kzF: 1, kzB: 1 }, spiky: { kzF: 1, kzB: 1 }, curly: { kzF: 0.9, kzB: 1 }, afro: { kzF: 0.9, kzB: 1 },
  bob: { kzF: 0.5, kzB: 0.9 }, long: { kzF: 0.5, kzB: 0.85 }, ponytail: { kzF: 0.9, kzB: 0.9 }, bun: { kzF: 0.9, kzB: 0.9 }, braids: { kzF: 0.9, kzB: 0.9 },
};
/** Ouverture du rideau (degrés d'azimut de chaque côté de la face qui restent dégagés) : le visage et le devant du cou ne sont jamais couverts par la masse arrière. */
const HANG_AZ0: Partial<Record<Style, number>> = { bob: 80, long: 78 };
/** Évasion maximale du rideau sous la nuque (U de demi-largeur par U de hauteur) : 0 = vertical ; la gravité l'emporte sur l'éventail. */
const HANG_FLARE = 0.3;
/** Croissance maximale de la demi-largeur du rideau avec la hauteur (U par U), tout au long de la chute. */
const HANG_GROW = 0.45;
/** Masses rondes : gauche et droite moyennées (le moteur de visage ne garde qu'un souffle d'asymétrie, `thickness.ts` GAIN_SPAN) : le volume 3D est centré sur le crâne, jamais penché. */
const SYMMETRIC: ReadonlySet<Style> = new Set(['afro', 'curly']);

/** Lissage [1 2 1]/4, `n` passes, bords fixes. */
function smoothCol(v: readonly number[], n: number): number[] {
  let a = v.slice();
  for (let p = 0; p < n; p++) a = a.map((x, i) => (i === 0 || i === a.length - 1 ? x : 0.25 * a[i - 1]! + 0.5 * x + 0.25 * a[i + 1]!));
  return a;
}

/**
 * Volume 3D de la coiffure d'un visage, ou `null` (chauve). La silhouette 2D (`silhouetteRows`) donne la demi-largeur absolue de la coiffure à chaque hauteur ; elle est convertie en U avec
 * LA MÊME échelle que la lisière (`faceYToU` : sommet du crâne → 0,04 U, bas du menton → 1,05 U, x à l'échelle de y), puis lissée : les boucles de la silhouette (dents, pointes) ne
 * deviennent pas des bosses de la coque (le bord de masse reste continu, `HAIR-EDGE.md`).
 */
export function hairVolumeOf(p: FaceParams, lm: FaceLandmarks): HairVolume | null {
  const style = p.hair.style;
  if (style === 'bald') return null;
  const geo = hairGeometry(p, lm);
  if (!geo) return null;
  const S = geo.boundary.skull, rows = silhouetteRows(geo, lm.W);
  if (!rows) return null;
  const kU = (faceYToU(geo.boundary, S.chinY) - faceYToU(geo.boundary, S.topY)) / (S.chinY - S.topY);
  const toU = (y: number): number => faceYToU(geo.boundary, y), fromU = (u: number): number => S.topY + (u - toU(S.topY)) / kU;
  const hangAz = HANG_AZ0[style as Style];
  const hang = hangAz !== undefined;
  const yTop = Math.min(0, toU(rows.y[0]!) - SHELL_DY), napeU = toU(geo.boundary.marks.napeY);
  const yBottomRows = toU(rows.y[rows.y.length - 1]!);
  const yEnd = hang ? Math.max(napeU + 0.1, yBottomRows) : Math.min(0.97, napeU + 0.03);
  const ys: number[] = [];
  for (let y = yTop; y < yEnd - 1e-9; y += SHELL_DY) ys.push(+y.toFixed(5));
  ys.push(+yEnd.toFixed(5));
  let rL = ys.map((y) => Math.max(0, -sampleRows(rows, 'xl', fromU(y), 0)) * kU), rR = ys.map((y) => Math.max(0, sampleRows(rows, 'xr', fromU(y), 0)) * kU);
  if (SYMMETRIC.has(style as Style)) { const m = rL.map((l, i) => 0.5 * (l + rR[i]!)); rL = m; rR = m.slice(); }
  if (hang) {
    // Les cheveux pendants tombent presque droit : sous la nuque la demi-largeur ne grandit que de `FLARE` U par U de hauteur (la silhouette 2D s'écartait à l'ourlet : cape).
    const i0 = ys.findIndex((y) => y >= napeU);
    if (i0 >= 0) for (let i = i0 + 1; i < ys.length; i++) { const cap = (k: number[]): number => k[i0]! + HANG_FLARE * (ys[i]! - ys[i0]!); rL[i] = Math.min(rL[i]!, cap(rL)); rR[i] = Math.min(rR[i]!, cap(rR)); }
  }
  if (hang) {
    // Pas de « taille » : sous la tête la masse ne peut pas s'élargir de plus de `HANG_GROW` U par U de hauteur (la silhouette 2D saute parfois de plusieurs centièmes d'U au niveau de la nuque : une marche vue de dos), puis lissage renforcé autour de la nuque.
    for (let i = 1; i < ys.length; i++) { const dy = ys[i]! - ys[i - 1]!; rL[i] = Math.min(rL[i]!, rL[i - 1]! + HANG_GROW * dy); rR[i] = Math.min(rR[i]!, rR[i - 1]! + HANG_GROW * dy); }
    rL = smoothCol(rL, 8); rR = smoothCol(rR, 8);
  }
  rL = smoothCol(rL, 3); rR = smoothCol(rR, 3);
  const { kzF, kzB } = DEPTH[style as Style];
  return {
    style, texture: resolveTexture(style, p.hair.texture), seed: p.hair.seed, curl: p.hair.curl, ys, rL, rR, kzF, kzB,
    hang: hang ? { y0: napeU, yEnd, az0: hangAz } : null,
    parts: hairPartsOf(geo, lm, kU, toU),
  };
}

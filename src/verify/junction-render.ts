import type { BodyInput, NeckAnchor } from '../body';
import { bodyFrame } from '../body/frame';
import { legFrame } from '../body/lower/frame';
import { LegParams } from '../body/lower/types';
import { renderVolumesPixel, type VolumeSet } from '../body/volume';
import { BodyParams } from '../body/types';
import type { VCheck } from './volume';

const chk = (id: string, layer: VCheck['layer'], ok: boolean, detail: string): VCheck => ({ id, layer, ok, detail });

/**
 * CONTRÔLES DE RENDU des raccords, mesurés sur l'IMAGE (rendu par pixel, face, 460 px de haut) et non sur la géométrie :
 *  · aucun pixel translucide à l'intérieur du corps (le fond ne doit jamais apparaître à travers la peau : bogue d'opacité de palier corrigé à l'itération 05) ;
 *  · contour supérieur de l'épaule sans cran : en allant du cou vers l'extérieur, le contour ne remonte jamais de plus de 0,02 h ;
 *  · hanche sans marche : la paroi externe du bassin et de la cuisse ne saute jamais de plus de 0,05 h entre deux rangées voisines.
 */
export function junctionRenderChecks(set: VolumeSet, raw: BodyInput, a: NeckAnchor): VCheck[] {
  const H = set.measures.h as number, f = bodyFrame(BodyParams.parse(raw), a);
  const m = renderVolumesPixel(set, { skin: '#c99a76', heightPx: 460, camera: { yaw: 0, pitch: 0, pivot: { x: 0, y: 0, z: 0 } }, uid: 'jr' }), { w, h, rgba } = m.pixels, b = m.bounds;
  const ppx = w / (b.x1 - b.x0), ppy = h / (b.y1 - b.y0), al = (x: number, y: number): number => (x < 0 || y < 0 || x >= w || y >= h ? 0 : rgba[(y * w + x) * 4 + 3]! / 255);
  const col = (x: number): number => Math.round((x - b.x0) * ppx);
  // 1. Pixels translucides entourés de corps (ne touchant aucun pixel vide) : le fond verrait à travers.
  let solid = 0, holes = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const q = al(x, y); if (q >= 0.9) { solid++; continue; } if (q <= 0.04) continue;
    let touchesEmpty = false; for (let dy = -2; dy <= 2 && !touchesEmpty; dy++) for (let dx = -2; dx <= 2; dx++) if (al(x + dx, y + dy) <= 0.04) { touchesEmpty = true; break; }
    if (!touchesEmpty) holes++;
  }
  const out: VCheck[] = [chk('junction.sty.no-translucent-hole', 'style', holes <= 0.001 * solid, `${holes} pixels translucides à l'intérieur du corps sur ${solid} opaques (≤ 0,1 % ; avant l'itération 05 : taches de fond sur le ventre, les côtes et les bras)`)];
  // 2. Contour supérieur de l'épaule, du cou vers l'extérieur.
  const x0 = col(0.42 * H), topY: number[] = [];
  for (let x = x0; x < w; x++) { let t = -1; for (let y = 0; y < h; y++) if (al(x, y) > 0.5) { t = y; break; } if (t < 0) break; topY.push(t); }
  let run = -Infinity, notch = 0; for (const t of topY) { run = Math.max(run, t); notch = Math.max(notch, run - t); }
  out.push(chk('junction.geo.shoulder-contour-notch', 'geometry', topY.length > 10 && notch <= 0.02 * H * ppy, `contour du dessus d'épaule : cran maximal ${(notch / ppy / H).toFixed(3)} h sur ${topY.length} colonnes (≤ 0,02 h)`));
  // 3. Paroi externe du bassin et de la cuisse (depuis un point intérieur de la cuisse vers l'extérieur) : rendu SANS les bras, qui touchent les hanches larges (obèse) et fausseraient le balayage.
  const noArms = set.volumes.filter((v) => v.group !== 'arm' && v.group !== 'forearm' && v.group !== 'hand' && !v.id.startsWith('deltoid') && !v.id.startsWith('joint.')), ms = { ...set, volumes: noArms, byId: new Map(noArms.map((v) => [v.id, v])) };
  const m2 = renderVolumesPixel(ms, { skin: '#c99a76', heightPx: 460, camera: { yaw: 0, pitch: 0, pivot: { x: 0, y: 0, z: 0 } }, uid: 'jr2' }), q2 = m2.pixels, b2 = m2.bounds, px2 = q2.w / (b2.x1 - b2.x0), py2 = q2.h / (b2.y1 - b2.y0);
  const a2 = (x: number, y: number): number => (x < 0 || y < 0 || x >= q2.w || y >= q2.h ? 0 : q2.rgba[(y * q2.w + x) * 4 + 3]! / 255), c2 = (x: number): number => Math.round((x - b2.x0) * px2), r2 = (y: number): number => Math.round((y - b2.y0) * py2);
  const lf = legFrame(f, LegParams.parse({})), yTop = f.y.crop - 0.15 * H, yBot = lf.y.crotch + 0.2 * H;
  const wall: number[] = []; for (let y = r2(yTop); y <= r2(yBot); y += Math.max(1, Math.round(0.02 * H * py2))) { let x = c2(0.3 * H); if (a2(x, y) < 0.5) continue; while (a2(x + 1, y) > 0.5) x++; wall.push(x); }
  let step = 0; for (let i = 1; i < wall.length; i++) step = Math.max(step, Math.abs(wall[i]! - wall[i - 1]!));
  out.push(chk('junction.geo.hip-wall-step', 'geometry', wall.length > 5 && step <= 0.05 * H * px2, `paroi bassin/cuisse (sans les bras) : saut maximal ${(step / px2 / H).toFixed(3)} h entre rangées voisines sur ${wall.length} rangées (≤ 0,05 h)`));
  return out;
}

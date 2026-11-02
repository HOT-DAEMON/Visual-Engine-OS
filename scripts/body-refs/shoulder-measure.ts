/**
 * MESURE DE LA PENTE D'ÉPAULE (itération 05) — reproductible : `npx tsx scripts/body-refs/shoulder-measure.ts`.
 *  1. Silhouette COMPLÈTE du moteur alignée sur l'AXE DU CORPS (x = 0 ↔ centerX de la référence), et non sur le milieu de la boîte englobante comme `fitToRef`
 *     (les bras asymétriques décalent ce milieu) : écart de paroi par rangée (têtes sous la base du cou) contre ref-02 / ref-04.
 *  2. Dépassement muscles + os − peau sur la pente, DES DEUX CÔTÉS, à 0,3 / 0,6 / 0,9 de la chute d'acromion : un écart gauche/droite est le symptôme de la
 *     pose appliquée au seul centre des sections de peau (corrigé à l'itération 05).
 */
import { Resvg } from '@resvg/resvg-js';
import { ARCHETYPES, type BodyInput } from '../../src/body';
import { bodyFrame } from '../../src/body/frame';
import { BodyParams } from '../../src/body/types';
import { bodyVolumes, renderVolumes, type Camera } from '../../src/body/volume';
import { rowExtent } from '../../src/verify/junction';
import { bodyHost } from '../lib/body-host';
import { outerWall } from './contour';
import { loadRef } from './iou';

const CAM: Camera = { yaw: 0, pitch: 0, pivot: { x: 0, y: 0, z: 0 } }, H = bodyHost(), ROWS = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.6, 0.8];
function wallError(rn: 'ref-02' | 'ref-04', arch: string): { e: number[]; mean: number; bias: number } {
  const ref = loadRef(rn), m = renderVolumes(bodyVolumes((ARCHETYPES as Record<string, unknown>)[arch] as BodyInput, H.a, {}), { skin: H.skin, camera: CAM, uid: 'sm' }), s = (ref.meas.head.height as number) / H.a.h;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ref.w}" height="${ref.h}"><g transform="translate(${ref.meas.centerX} ${ref.meas.neckBaseY - H.a.baseY * s}) scale(${s})">${m.svg}</g></svg>`;
  const px = new Resvg(svg).render().pixels, mask = new Uint8Array(ref.w * ref.h); for (let i = 0; i < mask.length; i++) mask[i] = px[i * 4 + 3]! > 40 ? 1 : 0;
  const a = outerWall(ref.m, ref, ROWS), b = outerWall(mask, ref, ROWS), e = b.map((v, i) => v - a[i]!);
  return { e, mean: e.reduce((t, v) => t + Math.abs(v), 0) / e.length, bias: e.reduce((t, v) => t + v, 0) / e.length };
}
console.log('SILHOUETTE alignée sur l\'axe du corps — écart moteur − référence (têtes) aux rangées', ROWS.join(' '));
for (const [rn, arch] of [['ref-02', 'veryMuscular'], ['ref-04', 'veryMuscular'], ['ref-04', 'muscular']] as const) { const r = wallError(rn, arch); console.log(`  ${rn} / ${arch}: |écart| moyen ${r.mean.toFixed(3)} · biais ${r.bias.toFixed(3)} · [${r.e.map((v) => v.toFixed(2)).join(' ')}]`); }
console.log('DÉPASSEMENT muscles+os − peau (h) à 0,3 / 0,6 / 0,9 de la chute, gauche | droite');
for (const n of ['adultMale', 'veryMuscular', 'adultFemale', 'child', 'obese']) {
  const raw = (ARCHETYPES as Record<string, unknown>)[n] as BodyInput, set = bodyVolumes(raw, H.a, {}), f = bodyFrame(BodyParams.parse(raw), H.a), drop = f.y.acr - f.y.base, tr = set.byId.get('trunk')!;
  const col = (side: 'L' | 'R', s: 1 | -1): string => { const rel = set.volumes.filter((v) => (v.kind === 'muscle' || v.kind === 'bone') && v.layer >= 3 && !v.hidden && (v.group === 'back' || v.group === 'chest') && v.side === side); return [0.3, 0.6, 0.9].map((k) => { const y = f.y.base + k * drop; return ((rowExtent(rel, y, 0.006 * H.a.h, s) - rowExtent([tr], y, 0.006 * H.a.h, s)) / H.a.h).toFixed(3); }).join(' / '); };
  console.log(`  ${n.padEnd(13)} G ${col('L', 1)} | D ${col('R', -1)}`);
}

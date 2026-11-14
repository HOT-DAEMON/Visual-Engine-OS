import { transmission, type VaultRegion } from '../../skull/vault-tissue';
import { vaultCurves, type VaultCurve } from '../../skull/vault-curves';
import { clamp, smooth } from '../math';
import type { EngineHead } from './face-model';
import { fromEngineY } from './rows';
import { skullWeight } from './skull-model';
import { skullOf } from './vault-model';
import { sy } from './units';

/**
 * RELIEF OSSEUX DE LA VOÛTE (déplacement radial, U, > 0 = vers l'extérieur) : creux temporal, mastoïde, glabelle, protubérance occipitale externe (inion), ligne nuchale,
 * sutures et ligne temporale (relief fin), asymétrie de LARGEUR. Chaque relief est ancré sur un repère osseux réel (`SkullGeo.bone.lm`) et atténué par les tissus de sa région
 * (`vault-tissue.ts` : transmission τ). Tout est nul quand les paramètres sont nuls (sauf l'inion, lu en écart à son nominal 0,4 : paramètre déjà existant, désormais visible en 3D).
 * Amplitudes (U ; tête de 230 mm ⇒ 1 U ≈ 230 mm) : 0,010 U ≈ 2,3 mm. Conventions d'anatomie artistique, justifiées dans `docs/SKULL-VAULT.md`.
 */
export const VAULT_RELIEF = { hollow: 0.02, mastoid: 0.03, glabella: 0.022, inion: 0.012, inionRef: 0.4, nuchal: 0.012, suture: 0.006, tline: 0.007, width: 0.04, azU: 0.0055, curveSigma: 0.012 } as const;
const D = 180 / Math.PI, g = (d: number, s: number): number => Math.exp(-0.5 * (d / s) ** 2);

interface Anchors { readonly yG: number; readonly yM: number; readonly yI: number; readonly yT: number; readonly curves: readonly { id: string; kind: VaultCurve['kind']; pts: readonly { y: number; az: number }[] }[] }
const cache = new WeakMap<EngineHead, Anchors>();
/** Repères du crâne en hauteur de tête (U), mémoïsés par tête. */
export function vaultAnchors(e: EngineHead): Anchors {
  let a = cache.get(e);
  if (!a) {
    const L = e.sk.bone.lm, Y = (id: string): number => fromEngineY(sy((L[id] ?? L.vertex!).y));
    a = { yG: Y('glabella'), yM: Y('mastoid'), yI: Y('inion'), yT: Y('pterion'), curves: vaultCurves(e.sk).map((c) => ({ id: c.id, kind: c.kind, pts: c.pts.map((p) => ({ y: fromEngineY(p.y), az: p.az })) })) };
    cache.set(e, a);
  }
  return a;
}

/** Distance (U) d'un point (y, az) à une polyligne de l'espace (y, azimut) : 1° d'azimut ≈ 0,0055 U au niveau de la largeur maximale. */
function curveDist(pts: readonly { y: number; az: number }[], y: number, az: number): number {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const ax = pts[i]!.az * VAULT_RELIEF.azU, ay = pts[i]!.y, bx = pts[i + 1]!.az * VAULT_RELIEF.azU, by = pts[i + 1]!.y, px = az * VAULT_RELIEF.azU;
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy, t = L2 > 0 ? clamp(((px - ax) * dx + (y - ay) * dy) / L2, 0, 1) : 0;
    best = Math.min(best, Math.hypot(px - (ax + t * dx), y - (ay + t * dy)));
  }
  return best;
}

/** Part de la voûte qui produit du relief pour cette tête : tout nul (hors inion, lu seulement à la nuque) → la fonction rend 0 sans rien évaluer. */
const REL_KEYS = ['temporalHollow', 'mastoid', 'glabella', 'nuchalLine', 'asymWidth', 'suturesShow'] as const;
const act = new WeakMap<EngineHead, boolean>();
const anyRelief = (e: EngineHead): boolean => { let v = act.get(e); if (v === undefined) { const k = skullOf(e); v = REL_KEYS.some((n) => k[n] !== 0); act.set(e, v); } return v; };

/** Déplacement radial osseux (U) à la hauteur SOURCE y et à l'azimut th (rad ; 0 = face, + = côté +x). */
export function vaultRelief(e: EngineHead, y: number, th: number): number {
  const k = skullOf(e), R = VAULT_RELIEF;
  if (!anyRelief(e) && (k.inion === R.inionRef || Math.cos(th) > -0.86)) return 0;   // cos(th) > −0,86 ⇔ azimut < 150° : l'inion n'agit qu'à la nuque
  const A = vaultAnchors(e), w = skullWeight(y);
  if (w <= 0) return 0;
  const az = Math.atan2(Math.abs(Math.sin(th)), Math.cos(th)) * D, side = clamp(Math.sin(th) / 0.5, -1, 1);
  const T = (r: VaultRegion): number => transmission(r, k.scalp, k.boneShow);
  let d = 0;   // un terme dont le paramètre est nul n'est pas évalué (résultat identique, coût nul : le maillage appelle cette fonction pour chaque sommet)
  if (k.temporalHollow) d -= R.hollow * k.temporalHollow * T('temporal') * g(y - (A.yT + 0.03), 0.07) * g(az - 72, 17);                 // fosse temporale
  if (k.mastoid) d += R.mastoid * k.mastoid * T('mastoid') * g(y - A.yM, 0.055) * g(az - 118, 13);                                      // processus mastoïde, derrière l'oreille
  if (k.glabella) d += R.glabella * k.glabella * T('glabella') * g(y - A.yG, 0.02) * g(az, 12);                                        // glabelle (relief médian)
  if (az > 150 && k.inion !== R.inionRef) d += R.inion * (k.inion - R.inionRef) * T('occipital') * g(y - A.yI, 0.03) * g(az - 180, 12);   // protubérance occipitale externe
  if (k.nuchalLine && az > 118) d += R.nuchal * k.nuchalLine * T('occipital') * g(y - (A.yI + 0.012), 0.022) * smooth((az - 118) / 40);   // ligne nuchale supérieure
  if (k.asymWidth) d += R.width * k.asymWidth * side * g(y - 0.3, 0.14) * g(az - 90, 35);                                              // un côté de la voûte plus large que l'autre
  if (k.suturesShow > 0) for (const c of A.curves) {
    if (c.kind === 'point') continue;
    const r = g(curveDist(c.pts, y, az), R.curveSigma);
    d += k.suturesShow * T('parietal') * (c.kind === 'suture' ? -R.suture : R.tline) * r;                              // suture : sillon fin ; ligne temporale : crête fine
  }
  return w * d;
}
/** Tolérance (U) de dépassement de la demi-largeur de la section : nécessaire seulement à l'asymétrie de largeur (le côté élargi dépasse la superellipse symétrique). */
export const vaultOver = (e: EngineHead, y: number): number => 1.15 * VAULT_RELIEF.width * Math.abs(skullOf(e).asymWidth) * g(y - 0.3, 0.14);

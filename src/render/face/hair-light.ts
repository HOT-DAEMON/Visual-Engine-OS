import type { Vec } from '../../geometry/eye/primitives';
import { clamp } from '../../core/math';

/**
 * LUMIÈRE 3D DES MÈCHES DU MOTEUR PRINCIPAL — jusqu'ici `lockMarkup` n'utilisait que `ld`, la direction 2D de la source : l'ÉLÉVATION de la lumière (`LightVector.z`) était perdue.
 * Deux grandeurs physiques en dépendent, toutes deux traitées ici sans rien inventer :
 *  - la PORTÉE de l'ombre portée : un écran à la profondeur h derrière la mèche reçoit l'ombre décalée de h·(lx, ly)/lz, soit h·cot(élévation) dans la direction de `ld`. Lumière rasante : ombre longue ;
 *    lumière de face : ombre courte. `shadowReach` donne le rapport à la portée de référence (élévation par défaut du schéma, 55°) : à 55° le rendu est IDENTIQUE à l'ancien (1,0).
 *  - l'EXPOSITION d'une mèche ronde sans `geom` (queue, chignon, tresse = `part` ; mèches simulées = `sim`) : un faisceau de cheveux est un CYLINDRE, pas un ruban. Pour un cylindre d'axe T (dans le plan image)
 *    éclairé par L, la part de la moitié VISIBLE qui est aussi éclairée vaut 1 − θ/π, θ étant l'angle entre la composante de L perpendiculaire à l'axe et la direction de vue (0,0,1) :
 *    θ = acos(lz / √(1 − (L·T)²)). Lumière de face (lz = 1) : exposition 1 ; lumière dans le dos : 0 ; lumière rasante perpendiculaire à l'axe : 0,5.
 */
export interface Light3 { readonly x: number; readonly y: number; readonly z: number }

/** Élévation de référence du schéma (`schema/light-transform.ts` : `elevationDeg` par défaut) : l'ombre portée y garde sa portée d'origine. */
const REF_ELEVATION = 55 * Math.PI / 180;
const REF_COT = Math.cos(REF_ELEVATION) / Math.sin(REF_ELEVATION);

/** Facteur de portée de l'ombre portée (1 à l'élévation de référence ; borné 0,45–2,2 : au-delà, l'ombre sortirait de la mèche voisine ou disparaîtrait). */
export function shadowReach(light: Light3 | undefined): number {
  if (!light) return 1;
  const h = Math.hypot(light.x, light.y); const z = Math.max(1e-3, light.z);
  return clamp(h / z / REF_COT, 0.45, 2.2);
}

/** Exposition (0–1) de chaque échantillon d'un faisceau cylindrique d'axe `spine` à la lumière 3D `light` (unitaire, vers la source, repère image). */
export function tubeExposure(spine: readonly Vec[], light: Light3): number[] {
  const n = Math.hypot(light.x, light.y, light.z) || 1; const lx = light.x / n; const ly = light.y / n; const lz = light.z / n;
  return spine.map((_, i) => {
    const a = spine[Math.max(0, i - 1)] as Vec; const b = spine[Math.min(spine.length - 1, i + 1)] as Vec;
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1; const tx = (b.x - a.x) / l; const ty = (b.y - a.y) / l;
    const along = lx * tx + ly * ty; const perp = Math.sqrt(Math.max(1e-9, 1 - along * along));
    return 1 - Math.acos(clamp(lz / perp, -1, 1)) / Math.PI;
  });
}

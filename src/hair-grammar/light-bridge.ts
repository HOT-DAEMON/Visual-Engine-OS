import type { LightVector } from '../lighting/light';
import { project, unprojectAt, type View } from './head';
import type { Light } from './local-geometry';
import { norm, v3 } from './vec';

/**
 * LUMIÈRE COMMUNE — le moteur principal éclaire avec UN `LightVector` (repère image : x droite, y bas, z vers l'observateur ; il pointe de la surface vers la source) ;
 * la grammaire calculait l'exposition de ses rubans avec sa PROPRE lumière 3D dans le repère de tête (`Light.dir`). Deux lumières qui ne se parlent pas :
 * une mèche pouvait être « éclairée à gauche » par `ld` et « exposée à droite » par `LockGeom.exposure`. Ce pont fait de `LightVector` la SEULE source :
 *  - `lightFromVector(v, view)` : le vecteur de l'hôte devient la lumière 3D de la tête, sous la vue courante (rotation inverse du tangage puis du lacet) ;
 *  - `lightToVector(l, view, base)` : l'inverse, pour une lumière posée dans le repère de tête ;
 * la direction 2D `direction2D(v)` (celle de `ld`) et la projection de la lumière 3D (`lightScreen`) coïncident donc à la précision machine, pour toute vue.
 * L'exposition 3D ainsi obtenue est portée par `LockGeom.exposure` → `HairLockGeom.exposure` et lue par `celBands` (gain du reflet).
 */
const unit = { tx: 0, ty: 0, s: 1 } as const;

export function lightFromVector(v: Pick<LightVector, 'x' | 'y' | 'z'>, view: View): Light {
  const p = unprojectAt({ ...view, ...unit }, v.x, v.y, v.z);
  return { dir: norm(v3(p.x, p.y, p.z)) };
}

export function lightToVector(l: Light, view: View, base: LightVector): LightVector {
  const q = project({ ...view, ...unit }, l.dir);
  const n = Math.hypot(q.x, q.y, q.d) || 1;
  return { ...base, x: q.x / n, y: q.y / n, z: q.d / n };
}

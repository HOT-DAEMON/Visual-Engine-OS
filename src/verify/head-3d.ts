import { memoPure } from '../perf';
import { head3dSubject, hostEyesOf, irisOf } from '../render/head-3d';
import type { PlacedEye } from '../anatomy/relations';
import type { HostEyes } from '../head-turntable';
import { verifyHeadSubject } from '../head-turntable/verify-head';
import type { Head3dSpec, HostSpec } from '../schema';
import type { Check } from './types';

/**
 * Vérification d'une tête 3D du pipeline : les TROIS couches de `head-turntable/verify-head.ts` (géométrie : la 3D reste fidèle au contour 2D et au profil du moteur de visage, mâchoire
 * continue ; anatomie : tiers, plan mandibulaire, oreille entre sourcil et base du nez, longueur du crâne dérivée ; style : contraste de l'encre, trait stable, contour fermé), versées dans le
 * contrat du pipeline (`hard` → `error`, `info` → `warn`). Les contrôles lisent des vues FIXES (0° – 180°, à plat et au tangage de la planche) : ils ne dépendent ni du lacet ni du
 * tangage choisis, donc ils sont mémoïsés par SUJET (un hôte et ses réglages de crâne / cheveux), pas par angle : une planche de 8 angles ne paie la vérification qu'une fois.
 */
const run = (host: HostSpec, o: Pick<Head3dSpec, 'skull' | 'variation' | 'hair' | 'hairline'>, iris?: string, eyes?: HostEyes): Check[] => {
  const { spec, lengthH } = head3dSubject(host, o, iris, eyes);
  const rep = verifyHeadSubject({ id: 'head3d', spec, lengthH });
  return rep.layers.flatMap((l) => l.checks).map((c) => ({
    layer: c.layer, id: c.id, severity: c.kind === 'hard' ? 'error' : 'warn', ok: c.ok, value: c.value,
    limit: c.ok ? c.value : c.value < c.min ? c.min : c.max, message: `${c.label} [${c.min} ; ${c.max}]`,
  } as Check));
};
const memo = memoPure('head-3d-verify', 'geometry', run, 16);

/** `eyes` : les yeux POSÉS de l'hôte (comme `compileHead3d`) : la tête vérifiée est celle qui est rendue, avec ses yeux. */
export const checkHead3d = (o: Head3dSpec, host: HostSpec, eyes: readonly PlacedEye[] = []): Check[] => memo(host, { skull: o.skull, variation: o.variation, hair: o.hair, hairline: o.hairline }, irisOf(eyes), hostEyesOf(host, eyes)).map((c) => ({ ...c, id: `head3d.${o.id}.${c.id}` }));

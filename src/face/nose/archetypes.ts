import { NOSE_FIT } from './archetypes.generated';

/**
 * ARCHÉTYPES DE NEZ tirés des silhouettes MESURÉES de `references/nez/06.png` (voir `scripts/nose-refs/` et `docs/NOSE-REFS.md`).
 * Les valeurs viennent de `archetypes.generated.ts` (ajustement par synthèse sur le profil de largeur) ; ce fichier ne fait que les mettre en forme
 * de patch `FaceParams`. Seuls les archétypes que la silhouette de FACE du moteur reproduit réellement (résidu ≤ `REPRODUCIBLE_MAX`) sont exportés :
 * deux formes de la planche restent hors de portée (ellipse large, losange : leur L/H de référence, 1,60 et 1,52, dépasse le
 * plafond 1,399 de la silhouette de face, `docs/NOSE-ASPECT-CEILING.md`) ; elles sont documentées (`docs/NOSE-PLATE06-GLOBAL.md`), jamais « approchées » en silence.
 */
export const REPRODUCIBLE_MAX = 0.15;
export type NoseArchetypeName = 'pyramide' | 'cloche-ailes' | 'plat-trapeze';
export const NOSE_ARCHETYPE_NAMES: readonly NoseArchetypeName[] = ['pyramide', 'cloche-ailes', 'plat-trapeze'];

/** Transforme `{ 'nose.tip.width': 0.4 }` en `{ nose: { tip: { width: 0.4 } } }`. */
function nest(flat: Readonly<Record<string, number>>): Record<string, unknown> {
  const out: Record<string, any> = {};
  for (const [path, v] of Object.entries(flat)) { const ks = path.split('.'); let c = out; for (const k of ks.slice(0, -1)) c = (c[k] ??= {}); c[ks[ks.length - 1]!] = v; }
  return out;
}

/** Patch `FaceParams` d'un archétype (à fusionner par-dessus un visage). */
export const noseArchetype = (name: NoseArchetypeName): Record<string, unknown> => nest(NOSE_FIT[name].params);
/** Résidu mesuré à l'ajustement (RMS du profil de largeur sur les 72 % du haut + écart de rapport L/H). */
export const noseArchetypeResidual = (name: keyof typeof NOSE_FIT): number => NOSE_FIT[name].residual;

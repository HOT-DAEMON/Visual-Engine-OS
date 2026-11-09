import type { SceneObject } from '../composition/expand';
import type { LightVector } from '../lighting/light';
import type { PublishedOrbits } from '../anatomy/orbit';
import type { PlacedEye } from '../anatomy/relations';
import type { HostSpec, LightSpec } from '../schema';
import { compileBody, compileHead3d, compileHeadProfile, compileHeadLit, compileCompoundEye, compileEye, compileGemEye, compileHost, compilePanel, compileRobotEye, type CompiledObject } from './index';

/** Ce que tout compilateur d'objet peut lire de la scène : la lumière MONDE et les hôtes (pour les enfants qui en dépendent, ex. le corps). */
export interface CompileCtx {
  readonly light: LightVector;
  /** Lumière de la scène telle que déclarée (azimut, élévation, couleur, taille de source…) : l'éclairage par relief la lit. */
  readonly lightSpec: LightSpec;
  readonly hosts: ReadonlyMap<string, HostSpec>;
  /** Orbites publiées par les yeux posés, par hôte `face` (consommées par les ombres de contact). */
  readonly orbits: ReadonlyMap<string, PublishedOrbits>;
  /** Yeux posés par hôte `face` (la tête 3D en lit la couleur d'iris : la même personne que le visage de face). */
  readonly eyes: ReadonlyMap<string, readonly PlacedEye[]>;
}

export type ObjectKind = SceneObject['kind'];
export type ObjectCompiler<K extends ObjectKind> = (o: Extract<SceneObject, { kind: K }>, ctx: CompileCtx) => CompiledObject;

/**
 * REGISTRE des compilateurs : un par `kind`. Le type mappé est EXHAUSTIF : ajouter un `kind` à `SceneSpec` sans l'inscrire ici
 * ne compile pas (même garantie que l'ancien `switch … never`), mais ajouter un composant ne modifie plus `compile.ts`.
 * Ajouter un objet = 1 schéma + 1 entrée ici (+ 1 ligne dans l'union de `schema/scene.ts`).
 */
export const COMPILERS: { readonly [K in ObjectKind]: ObjectCompiler<K> } = {
  eye: (o, c) => compileEye(o, c.light),
  robot_eye: (o, c) => compileRobotEye(o, c.light),
  panel: (o, c) => compilePanel(o, c.light),
  host: (o, c) => compileHost(o, c.light, c.orbits.get(o.id)),
  compound_eye: (o, c) => compileCompoundEye(o, c.light),
  gem_eye: (o, c) => compileGemEye(o, c.light),
  head_lit: (o, c) => {
    const host = c.hosts.get(o.host);
    if (!host) throw new Error(`Hôte introuvable : ${o.host}`); // jamais atteint après validation du schéma
    return compileHeadLit(o, host, c.lightSpec);
  },
  head_profile: (o, c) => {
    const host = c.hosts.get(o.host);
    if (!host) throw new Error(`Hôte introuvable : ${o.host}`); // jamais atteint après validation du schéma
    return compileHeadProfile(o, host);
  },
  head_3d: (o, c) => {
    const host = c.hosts.get(o.host);
    if (!host) throw new Error(`Hôte introuvable : ${o.host}`); // jamais atteint après validation du schéma
    return compileHead3d(o, host, c.eyes.get(o.host) ?? []);
  },
  body: (o, c) => {
    const host = c.hosts.get(o.host);
    if (!host) throw new Error(`Hôte introuvable : ${o.host}`); // jamais atteint après validation du schéma
    return compileBody(o, host);
  },
};

export function compileObject(obj: SceneObject, ctx: CompileCtx): CompiledObject {
  const compile = COMPILERS[obj.kind] as (o: SceneObject, c: CompileCtx) => CompiledObject;
  return compile(obj, ctx);
}

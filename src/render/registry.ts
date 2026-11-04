import type { SceneObject } from '../composition/expand';
import type { LightVector } from '../lighting/light';
import type { HostSpec } from '../schema';
import { compileBody, compileCompoundEye, compileEye, compileGemEye, compileHost, compilePanel, compileRobotEye, type CompiledObject } from './index';

/** Ce que tout compilateur d'objet peut lire de la scène : la lumière MONDE et les hôtes (pour les enfants qui en dépendent, ex. le corps). */
export interface CompileCtx {
  readonly light: LightVector;
  readonly hosts: ReadonlyMap<string, HostSpec>;
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
  host: (o, c) => compileHost(o, c.light),
  compound_eye: (o, c) => compileCompoundEye(o, c.light),
  gem_eye: (o, c) => compileGemEye(o, c.light),
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

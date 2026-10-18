import type { z } from 'zod';
import {
  compileCompoundEye,
  compileEye,
  compileGemEye,
  compileHost,
  compilePanel,
  compileRobotEye,
  type CompiledObject,
} from './render';
import { expandScene, type SceneObject } from './composition/expand';
import { lightVector, type LightVector } from './lighting/light';
import { SceneSpec } from './schema';
import { el } from './core/svg';

function compileObject(obj: SceneObject, light: LightVector): CompiledObject {
  switch (obj.kind) {
    case 'eye':
      return compileEye(obj, light);
    case 'robot_eye':
      return compileRobotEye(obj, light);
    case 'panel':
      return compilePanel(obj, light);
    case 'host':
      return compileHost(obj, light);
    case 'compound_eye':
      return compileCompoundEye(obj, light);
    case 'gem_eye':
      return compileGemEye(obj, light);
    default: {
      const unreachable: never = obj;
      throw new Error(`Type d'objet non géré : ${JSON.stringify(unreachable)}`);
    }
  }
}

/** Compile une scène DÉJÀ validée en SVG. Pure et déterministe : même scène => même chaîne. */
export function renderScene(scene: SceneSpec): string {
  const light = lightVector(scene.light);
  const defs: string[] = [];
  const body: string[] = [];
  const overlays: string[] = [];
  for (const obj of expandScene(scene)) {
    const out = compileObject(obj, light);
    defs.push(...out.defs);
    body.push(out.markup);
    if (out.overlay) overlays.push(out.overlay);
  }
  // Calque final : ce qui passe DEVANT les enfants posés sur l'hôte (cheveux devant les yeux).
  body.push(...overlays);
  const background = scene.background
    ? [el('rect', { x: 0, y: 0, width: scene.width, height: scene.height, fill: scene.background })]
    : [];
  return el(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: `0 0 ${scene.width} ${scene.height}`,
      width: scene.width,
      height: scene.height,
      role: 'img',
      'aria-label': scene.label,
    },
    [el('defs', {}, defs), ...background, ...body],
  );
}

export type CompileResult =
  | { readonly ok: true; readonly svg: string; readonly scene: SceneSpec }
  | { readonly ok: false; readonly issues: readonly string[] };

/** Dans une union, ne garde que la branche la plus proche de l'entrée (celle avec le moins d'erreurs). */
function flatten(issue: z.ZodIssue): string[] {
  if (issue.code === 'invalid_union') {
    const best = [...issue.unionErrors].sort((a, b) => a.issues.length - b.issues.length)[0];
    return best ? best.issues.flatMap(flatten) : [];
  }
  return [`${issue.path.join('.') || '(racine)'} : ${issue.message}`];
}

/** Point d'entrée : valide (strict), puis compile. N'émet jamais de SVG pour une entrée invalide. */
export function compileScene(input: unknown): CompileResult {
  const parsed = SceneSpec.safeParse(input);
  if (!parsed.success) return { ok: false, issues: [...new Set(parsed.error.issues.flatMap(flatten))] };
  return { ok: true, svg: renderScene(parsed.data), scene: parsed.data };
}

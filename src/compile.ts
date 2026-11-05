import { getNoiseMode } from './noise';
import { clock } from './perf/clock';
import { ContentCache, canonical, type CacheStats } from './perf/content-cache';
import type { z } from 'zod';
import { compileObject } from './render/registry';
import { expandPlacements } from './composition/expand';
import { placedEyesOf } from './anatomy/placed';
import { publishedOrbits, type PublishedOrbits } from './anatomy/orbit';
import { hostFace } from './render/face';
import { lightVector } from './lighting/light';
import { SceneSpec, type HostSpec } from './schema';
import { el } from './core/svg';

/** Compile une scène DÉJÀ validée en SVG. Pure et déterministe : même scène => même chaîne. */
export function renderScene(scene: SceneSpec): string {
  // Étape `svg` (durée EXCLUSIVE : le calcul géométrique imbriqué est compté dans `geometry`).
  return clock.time('svg', () => renderSceneUntimed(scene));
}

function renderSceneUntimed(scene: SceneSpec): string {
  const light = lightVector(scene.light);
  const hosts = new Map<string, HostSpec>();
  for (const o of scene.objects) if (o.kind === 'host') hosts.set(o.id, o);
  const expanded = expandPlacements(scene);
  // Orbites PUBLIÉES par les yeux posés (docs/ORBIT-PUBLISH.md) : les ombres de contact du visage les consomment à la place de l'a priori des repères.
  const placed = placedEyesOf(expanded, hosts);
  const orbits = new Map<string, PublishedOrbits>();
  for (const h of hosts.values()) if (h.shape === 'face') orbits.set(h.id, publishedOrbits(hostFace(h).lm, placed.get(h.id) ?? []));
  const ctx = { light, lightSpec: scene.light, hosts, orbits };
  const defs: string[] = [];
  const underlays: string[] = [];
  const body: string[] = [];
  const overlays: string[] = [];
  const tops: string[] = [];
  for (const { obj } of expanded) {
    const out = compileObject(obj, ctx);
    defs.push(...out.defs);
    if (out.underlay) underlays.push(out.underlay);
    body.push(out.markup);
    if (out.overlay) overlays.push(out.overlay);
    if (out.top) tops.push(out.top);
  }
  // Calque sous la scène : ce qui passe DERRIÈRE les hôtes (corps derrière le visage), juste après le fond.
  body.unshift(...underlays);
  // Calque final : ce qui passe DEVANT les enfants posés sur l'hôte (cheveux devant les yeux).
  body.push(...overlays);
  // Calque tout au-dessus : l'éclairage par relief (multiplie et éclaire tout ce qui est dessiné dessous).
  body.push(...tops);
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

/**
 * `compileScene` avec cache par contenu : même entrée (sérialisation canonique) → même résultat sans recalcul.
 * Sûr parce que `compileScene` est pure et déterministe (même scène ⇒ même chaîne, voir `renderScene`). Le résultat rendu est partagé : ne pas le muter.
 */
const sceneCache = new ContentCache<CompileResult>('compileScene', 128);
export const compileSceneCached = (input: unknown): CompileResult => {
  // Le mode de bruit change le SVG émis pour une MÊME scène : il fait partie de la clé (sinon un cache chaud rendrait le SVG de l'autre mode).
  const key = `${getNoiseMode()}|${canonical(input)}`;
  const hit = sceneCache.get(key);
  if (hit) return hit;
  const r = compileScene(input);
  if (r.ok) sceneCache.set(key, r);
  return r;
};
export const sceneCacheStats = (): CacheStats => sceneCache.stats();

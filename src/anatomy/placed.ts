import { expandPlacements, type ExpandedObject } from '../composition/expand';
import type { HostSpec, SceneSpec } from '../schema';
import type { PlacedEye } from './relations';

/**
 * Yeux POSÉS de chaque hôte `shape: 'face'` : transformation monde de l'œil (après expansion) et transformation de son hôte.
 * Le lien œil → hôte vient de `expandPlacements` (source unique), jamais d'une déduction par préfixe d'identifiant.
 */
export function placedEyesOf(expanded: readonly ExpandedObject[], hosts: ReadonlyMap<string, HostSpec>): Map<string, PlacedEye[]> {
  const out = new Map<string, PlacedEye[]>();
  for (const { obj, hostId } of expanded) {
    const host = hostId ? hosts.get(hostId) : undefined;
    if (obj.kind !== 'eye' || !host || host.shape !== 'face') continue;
    const list = out.get(host.id) ?? [];
    list.push({ eye: obj, world: obj.transform, host: host.transform });
    out.set(host.id, list);
  }
  return out;
}

/** Même chose depuis une scène validée (vérification, tests, scripts). */
export function placedEyesByHost(scene: SceneSpec): Map<string, PlacedEye[]> {
  const hosts = new Map<string, HostSpec>();
  for (const o of scene.objects) if (o.kind === 'host') hosts.set(o.id, o);
  return placedEyesOf(expandPlacements(scene), hosts);
}

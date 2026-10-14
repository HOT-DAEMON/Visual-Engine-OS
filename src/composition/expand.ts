import { compose, selectAnchors, type ResolvedAnchor, type Similarity } from './anchors';
import type { HostSpec, SceneSpec } from '../schema';

export type SceneObject = SceneSpec['objects'][number];

const sideFor = (anchorX: number): 'left' | 'right' => (anchorX < -1e-9 ? 'left' : 'right');

/**
 * Résout les placements : chaque objet posé sur un hôte devient N exemplaires autonomes dont la
 * `transform` est la transformation MONDE (hôte ∘ ancre ∘ transform de l'objet). Ensuite, le reste du
 * moteur n'a plus à connaître les hôtes : la lumière est projetée dans le repère local à partir de la
 * rotation monde totale, donc les reflets restent cohérents quelle que soit la profondeur d'imbrication.
 * Résout aussi `outerSide: 'auto'` et l'héritage de la peau (matériau de l'hôte).
 * Suppose une scène déjà validée (références d'hôte et d'ancres existantes).
 */
export function expandScene(scene: SceneSpec): SceneObject[] {
  const hosts = new Map<string, HostSpec>();
  for (const o of scene.objects) if (o.kind === 'host') hosts.set(o.id, o);

  const out: SceneObject[] = [];
  for (const o of scene.objects) {
    if ('place' in o && o.place) {
      const host = hosts.get(o.place.host);
      if (!host) throw new Error(`Hôte introuvable : ${o.place.host}`);
      const { anchors } = selectAnchors(host, o.place);
      const hostT: Similarity = host.transform;
      anchors.forEach((a: ResolvedAnchor, i: number) => {
        const anchorT: Similarity = { x: a.x, y: a.y, rotationDeg: a.rotationDeg, scale: a.scale };
        const world = compose(compose(hostT, anchorT), o.transform);
        if (o.kind === 'eye') {
          out.push({
            ...o,
            id: `${o.id}-${a.id}`,
            place: undefined,
            transform: world,
            seed: o.place?.variation === 'vary' ? (o.seed + i * 7919) >>> 0 : o.seed,
            skin: o.skin ?? host.material,
            shape: { ...o.shape, outerSide: o.shape.outerSide === 'auto' ? sideFor(a.x) : o.shape.outerSide },
          });
        } else {
          out.push({ ...o, id: `${o.id}-${a.id}`, place: undefined, transform: world });
        }
      });
    } else if (o.kind === 'eye') {
      out.push({ ...o, shape: { ...o.shape, outerSide: o.shape.outerSide === 'auto' ? 'right' : o.shape.outerSide } });
    } else {
      out.push(o);
    }
  }
  return out;
}

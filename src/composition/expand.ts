import { compose, selectAnchors, type ResolvedAnchor, type Similarity } from './anchors';
import type { HostSpec, SceneSpec } from '../schema';
import { eyePoseOf } from '../face/pose/eye-pose';

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
  return expandPlacements(scene).map((e) => e.obj);
}

/** Un objet expansé et l'hôte sur lequel il était posé (`null` : objet libre). Source UNIQUE du lien enfant → hôte (plus de déduction par préfixe d'identifiant). */
export interface ExpandedObject {
  readonly obj: SceneObject;
  readonly hostId: string | null;
}

/** Même expansion que `expandScene`, en conservant l'hôte d'origine de chaque exemplaire. */
export function expandPlacements(scene: SceneSpec): ExpandedObject[] {
  const hosts = new Map<string, HostSpec>();
  for (const o of scene.objects) if (o.kind === 'host') hosts.set(o.id, o);

  const out: ExpandedObject[] = [];
  for (const o of scene.objects) {
    if ('place' in o && o.place) {
      const host = hosts.get(o.place.host);
      if (!host) throw new Error(`Hôte introuvable : ${o.place.host}`);
      const { anchors } = selectAnchors(host, o.place);
      const hostT: Similarity = host.transform;
      anchors.forEach((a: ResolvedAnchor, i: number) => {
        // Visage hôte tourné (`face.headPose.yawDeg`) : l'œil suit son nœud de pose et reçoit la rotation de tête du moteur d'yeux (identité à 0°).
        const ep = o.kind === 'eye' ? eyePoseOf(host, a.x) : null;
        const anchorT: Similarity = { x: a.x + (ep ? ep.dx : 0), y: a.y + (ep ? ep.dy : 0), rotationDeg: a.rotationDeg, scale: a.scale };
        const world = compose(compose(hostT, anchorT), o.transform);
        if (o.kind === 'eye') {
          out.push({
            hostId: host.id,
            obj: {
              ...o,
              id: `${o.id}-${a.id}`,
              place: undefined,
              transform: world,
              ...(ep ? { headTurn: { ...o.headTurn, ...ep.headTurn } } : {}),
              seed: o.place?.variation === 'vary' ? (o.seed + i * 7919) >>> 0 : o.seed,
              skin: o.skin ?? host.material,
              shape: { ...o.shape, outerSide: o.shape.outerSide === 'auto' ? sideFor(a.x) : o.shape.outerSide },
            },
          });
        } else {
          out.push({ hostId: host.id, obj: { ...o, id: `${o.id}-${a.id}`, place: undefined, transform: world } });
        }
      });
    } else if (o.kind === 'eye') {
      out.push({ hostId: null, obj: { ...o, shape: { ...o.shape, outerSide: o.shape.outerSide === 'auto' ? 'right' : o.shape.outerSide } } });
    } else {
      out.push({ hostId: null, obj: o });
    }
  }
  return out;
}

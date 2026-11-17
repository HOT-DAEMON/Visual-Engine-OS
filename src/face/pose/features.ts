import type { FaceLandmarks } from '../landmarks';
import { faceNodes, posedFace, type PosedFace } from './index';
import type { Posed } from './tree';

/**
 * TRAITS DU VISAGE POSÉS (yeux, sourcils, nez, bouche, oreilles, joues) : position projetée de chaque nœud de l'arbre de pose comparée à sa
 * position NEUTRE (yaw 0) → décalage + raccourcissement horizontal, appliqués comme transformation SVG PAR COMPOSANT (jamais une rotation
 * globale de l'image). Un composant garde son dessin de face ; il se déplace sur le crâne et se raccourcit de cos(azimut + yaw) / cos(azimut).
 */
export interface PosedFeatures extends PosedFace {
  /** Positions des nœuds à la pose neutre. */
  readonly neutral: Map<string, Posed>;
  /** Azimut (degrés) de chaque nœud à la pose neutre. */
  readonly azimuth: Map<string, number>;
}

/** Raccourcissement maximal d'un composant plus étroit que large vu de face (oreille qui tourne vers la caméra : elle s'élargit, jamais plus de ×). */
const MAX_WIDEN = 1.8;
/** Raccourcissement minimal d'un composant encore visible. */
const MIN_SCALE = 0.12;

export function poseFaceFeatures(lm: FaceLandmarks, yawDeg: number, pitchDeg = 0): PosedFeatures {
  const posed = posedFace(lm, yawDeg, pitchDeg);
  const neutral = posedFace(lm, 0, 0).nodes;
  const azimuth = new Map(faceNodes(lm, posed.skull, posed.neck).map((n) => [n.id, n.azimuth] as const));
  return { ...posed, neutral, azimuth };
}

/** Transformation SVG d'un composant : décalage du nœud + raccourcissement horizontal autour de son centre neutre ; `null` = identité. */
export function featureTransform(f: PosedFeatures, id: string): string | null {
  const n = f.nodes.get(id);
  const o = f.neutral.get(id);
  if (!n || !o) return null;
  const s = Math.max(MIN_SCALE, Math.min(MAX_WIDEN, n.scaleX));
  const r = (v: number): string => (Math.round(v * 1000) / 1000).toString();
  return `translate(${r(n.x - o.x)} ${r(n.y - o.y)}) translate(${r(o.x)} ${r(o.y)}) scale(${r(s)} 1) translate(${r(-o.x)} ${r(-o.y)})`;
}

/** Vrai si le composant fait face à la caméra (oreille et joue cachées de l'autre côté du crâne : jamais dessinées par-dessus la peau). */
export function featureVisible(f: PosedFeatures, id: string): boolean {
  return f.nodes.get(id)?.visible ?? true;
}

type Ell = { readonly cx: number; readonly cy: number; readonly rx: number; readonly ry: number };

/**
 * Régions de peau posées (`face/regions.ts`) : le matériau de peau éclaire des ellipses nommées ; si elles restaient de face, la lumière du dos du nez
 * ou des joues resterait au centre de l'image alors que le nez a tourné. Nez, pointe et ailes suivent le nœud `nose` (il dépasse du crâne) ;
 * les autres régions suivent la surface du crâne (même `projectX` que les cheveux), largeur réduite par la pente locale de la projection. Cou inchangé.
 */
export function poseRegions<R extends Readonly<Record<string, Ell | readonly Ell[] | undefined>>>(regions: R, f: PosedFeatures): R {
  const nose = f.nodes.get('nose');
  const nose0 = f.neutral.get('nose');
  const dxNose = nose && nose0 ? nose.x - nose0.x : 0;
  const sNose = nose ? Math.max(MIN_SCALE, Math.min(MAX_WIDEN, nose.scaleX)) : 1;
  const onSkull = (e: Ell): Ell => ({ cx: f.skull.projectX(e.cx, e.cy, f.yaw), cy: e.cy, rx: Math.max(1e-3, e.rx * f.skull.slopeX(e.cx, e.cy, f.yaw)), ry: e.ry });
  const onNose = (e: Ell): Ell => ({ cx: e.cx + dxNose, cy: e.cy, rx: e.rx * sNose, ry: e.ry });
  const out: Record<string, Ell | readonly Ell[] | undefined> = {};
  for (const [k, v] of Object.entries(regions)) {
    if (!v || k === 'neck' || k === 'shoulders') { out[k] = v; continue; }
    const m = k === 'nose' || k === 'noseTip' || k === 'noseAlae' ? onNose : onSkull;
    out[k] = Array.isArray(v) ? (v as readonly Ell[]).map(m) : m(v as Ell);
  }
  return out as unknown as R;
}

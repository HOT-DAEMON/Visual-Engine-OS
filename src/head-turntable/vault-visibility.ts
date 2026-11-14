import { VAULT_STRUCTURES } from '../skull/vault-registry';
import type { VaultAnchor, VaultStructure } from '../skull/vault-registry-types';
import { boneDepthU } from '../skull/vault-tissue';
import { headRelief } from './engines/head-relief';
import { fromEngineY } from './engines/rows';
import { sy } from './engines/units';
import { unwarpY, vaultRise } from './engines/vault-model';
import { dirToCam, mul, norm, cross, sub, project, toCam, v3, type Cam } from './math';
import { PART, skullSurfacePoint } from './mesh';
import { sectionAt } from './sections';
import type { HeadTurnSpec, TurnRender, V3, View } from './types';
import { REGION } from './types';

/**
 * POSITION, VISIBILITÉ ET OCCLUSION d'une structure de la voûte. Rien n'est déclaré à la main : la position est celle du maillage de la tête (peau, relief compris) à l'ancre
 * du registre ; la profondeur de l'os est celle de ses tissus ; la visibilité est le test de face (normale · direction de la caméra) PUIS la lecture de l'image rendue au pixel
 * projeté (même projection que le rendu) ; l'occluseur est la partie ou la région peinte trouvée à ce pixel (oreille, nez, cou, cheveux, sourcil…) ou la tête elle-même (face cachée).
 */
export interface Placement {
  readonly id: string; readonly side: -1 | 0 | 1;
  /** Repère de la TÊTE (U, y vers le bas) : point de la peau et point de l'os (sous la peau, le long de la normale). */
  readonly local: V3; readonly bone: V3; readonly depthU: number; readonly normal: V3;
  /** Repère GLOBAL (caméra, U) puis pixel du rendu. */
  readonly global: Cam; readonly px: number; readonly py: number;
  /** `facing` = normale · direction de la caméra (> 0 : tournée vers elle) ; `grazing` : |facing| < 0,05, la structure est sur le contour (ni vue ni cachée). */
  readonly facing: number; readonly grazing: boolean; readonly visible: boolean; readonly occludedBy: string | null;
}

const D = Math.PI / 180;
/** Hauteur de maillage (U) d'une ancre du registre, d'après les repères osseux de la tête. */
export function anchorY(spec: HeadTurnSpec, a: VaultAnchor): number {
  const e = spec.engine!, L = e.sk.bone.lm, Y = (id: string): number => fromEngineY(sy((L[id] ?? L.vertex!).y));
  const ySrc = a.yU ?? (a.from ? Y(a.from) + (a.to ? (a.t ?? 0) * (Y(a.to) - Y(a.from)) : 0) : 0.3) + (a.dy ?? 0);
  return unwarpY(ySrc, vaultRise(e));
}
/** Point de la peau (repère tête) : LE point du maillage de la tête, relief compris (`skullSurfacePoint`, même fonction que le maillage et le volume des cheveux). */
export const skinPoint = (spec: HeadTurnSpec, y: number, th: number): V3 => skullSurfacePoint(spec, headRelief(spec.engine), y, th);
const OCCLUDER: Record<number, string> = { [PART.ear]: 'ear', [PART.earBack]: 'ear', [PART.bump]: 'nose', [PART.neck]: 'neck', [PART.neckCut]: 'neck' };

/** Point de la peau et normale SORTANTE (repère tête) à la hauteur y et à l'azimut th. Aux pôles la section s'effondre : la normale du sommet est verticale (y vers le bas : vers le haut = −y). */
export function surfaceFrame(spec: HeadTurnSpec, y: number, th: number): { P: V3; n: V3 } {
  const P = skinPoint(spec, y, th), s = sectionAt(spec, y);
  if (s.a < 0.05) return { P, n: v3(0, -1, 0) };
  const n = norm(cross(sub(skinPoint(spec, y, th + 0.02), P), sub(skinPoint(spec, y + 0.004, th), P)));
  return { P, n: n.x * P.x + n.z * (P.z - s.zc) < 0 ? mul(n, -1) : n };
}

export function place(spec: HeadTurnSpec, st: VaultStructure, side: -1 | 0 | 1, view: View, r?: TurnRender): Placement {
  const y = anchorY(spec, st.anchor), th = (st.anchor.az * D) * (side < 0 ? -1 : 1), { P, n } = surfaceFrame(spec, y, th);
  const depthU = boneDepthU(st.region), bone = sub(P, mul(n, depthU)), cam = toCam(P, view, 'head'), pr = project(cam, view);
  const px = r ? Math.round(r.originX + pr.x * r.ppu) : 0, py = r ? Math.round(r.originY + pr.y * r.ppu) : 0, facing = dirToCam(n, view, 'head', y).z;
  const grazing = Math.abs(facing) <= 0.05;
  let visible = facing > 0.05, occ: string | null = facing > 0.05 ? null : grazing ? 'contour' : 'head';
  if (r && visible && px >= 0 && py >= 0 && px < r.w && py < r.h) {
    // Lecture sur le pixel et ses 8 voisins : un point sur le contour tombe parfois sur le fond sans être occulté ; on retient l'occluseur MAJORITAIRE (≥ 5 pixels sur 9), sinon visible.
    const votes = new Map<string, number>();
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = px + dx, y = py + dy; if (x < 0 || y < 0 || x >= r.w || y >= r.h) continue;
      const i = y * r.w + x, id = r.ids[i]!, reg = r.regions[i]!;
      const k = id === 0 ? 'bg' : id !== PART.head ? (OCCLUDER[id] ?? 'other') : reg === REGION.hair ? 'hair' : reg === REGION.brow ? 'brow' : reg === REGION.ear ? 'ear' : 'ok';
      votes.set(k, (votes.get(k) ?? 0) + 1);
    }
    const top = [...votes.entries()].filter(([k]) => k !== 'ok' && k !== 'bg').sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 5) { visible = false; occ = top[0]; }
  }
  return { id: st.id, side, local: P, bone, depthU, normal: n, global: pr, px, py, facing, grazing, visible, occludedBy: occ };
}
/** Toutes les structures (les deux côtés pour les structures latérales) sous une vue, avec leur visibilité et leur occluseur. */
export function placeAll(spec: HeadTurnSpec, view: View, r?: TurnRender): Placement[] {
  return VAULT_STRUCTURES.flatMap((st) => (st.anchor.side === 0 ? [place(spec, st, 0, view, r)] : ([1, -1] as const).map((s) => place(spec, st, s, view, r))));
}

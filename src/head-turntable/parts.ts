import { bumpMesh, ellipsoid, headMesh, neckMeshes, PART, type Mesh } from './mesh';
import { rad, v3 } from './math';
import { sectionAt, surfaceZ } from './sections';
import { ALA_CONTOUR_BOUNDS, ALA_Z_LIFT, alaOverflow, type AlaEllipsoid } from './nose-contour';
import type { BumpKnots, HeadTurnSpec } from './types';
import { earMesh, earRig } from './engines/ear3d';
import { engineHead } from './engines/face-model';
import { noseLandmarks } from './engines/nose-mouth';
import { hairShellMesh } from './hair-shell';
import { hairPartMeshes } from './hair-parts';

/** Largeur d'ailes (U) et décalage hauteur ↔ base du nez de la planche : les ailes des autres têtes sont posées et dimensionnées par rapport à ces valeurs. */
const REF_ALA = ((): number => noseLandmarks(engineHead()).crestX)();
/** Demi-axe horizontal de l'aile (U, à l'échelle de la planche). */
export const ALA_EX = 0.026;
/**
 * Ancrage du BORD EXTERNE de l'aile sur la crête alaire `alaX` (1 = bord externe = crête, 0 = ancien comportement : centre sur la crête).
 * Mesuré contre la planche de rotation (docs/NOSE-WIDTH-3D.md) : largeur du nez de face 0,093–0,113 U, silhouette 2D 0,103 U, ancien 3D 0,155 U (1,51 ×).
 */
export const ALA_OUTER_ANCHOR = 1;
const ALA_ABOVE_BASE = 0.0147;   // les ailes sont centrées 0,0147 U au-dessus de la base du nez (planche : base 0,7897 → y = 0,775, comme avant)

/** Interpolation linéaire d'une colonne (1 = z, 2 = demi-largeur) des nœuds d'une bosse à la hauteur y. */
function knotAt(k: BumpKnots, y: number, col: 1 | 2): number {
  if (y <= k[0]![0]) return k[0]![col];
  for (let i = 0; i + 1 < k.length; i++) { const a = k[i]!, b = k[i + 1]!; if (y <= b[0]) return a[col] + (b[col] - a[col]) * ((y - a[0]) / (b[0] - a[0] || 1)); }
  return k[k.length - 1]![col];
}

/** Bosse construite sur un profil de face : hauteur = z du profil − face avant de la table de sections (jamais négative). */
function bumpOf(spec: HeadTurnSpec, k: BumpKnots): Mesh {
  const y0 = k[0]![0], y1 = k[k.length - 1]![0];
  return bumpMesh(spec, y0, y1, (y) => knotAt(k, y, 1) - sectionAt(spec, y).zf, (y) => knotAt(k, y, 2));
}

/**
 * Aile posée sur la joue : centre décalé de `pull` (U) vers l'axe et enfoncé de `embed` (fraction de `ALA_Z_LIFT`, 0 = posée, 1 = centre sur la surface) ; centre et demi-axes. z = surface de la joue À L'ABSCISSE de l'aile (comme la bosse centrale, `bumpMesh`),
 * pas l'avant de l'axe `zf` : la joue recule vers les côtés, une aile large posée sur `zf` flottait devant elle. L'enfoncement ne change pas x : la silhouette de face est celle de `pull` seul.
 */
export function alaSeated(spec: HeadTurnSpec, sg: 1 | -1, pull: number, embed = 0): AlaEllipsoid {
  const ys = spec.nose.baseY - ALA_ABOVE_BASE, sa = sectionAt(spec, ys), ka = spec.engine ? spec.nose.alaX / REF_ALA : 1, ex = ALA_EX * ka, x = sg * (spec.nose.alaX - ex * ALA_OUTER_ANCHOR - pull);
  return { c: v3(x, ys, surfaceZ(sa, x, true) + ALA_Z_LIFT * ka * (1 - embed)), ex, ey: 0.024 * ka, ez: 0.026 * ka };
}

/**
 * Contrainte « l'aile reste dans le contour de la joue » (`ALA_CONTOUR_BOUNDS` : 30°, 45°, 60°, 70°, docs/NOSE-ALAR-SEAT.md, NOSE-YAW45.md, NOSE-YAW-BOUNDS.md), à la manière de `face/nose/constraints.ts` : valeurs ramenées aux plus proches admissibles, jamais de réglage global.
 * Retourne `{ pull, embed }` : rappel vers l'axe (U) et enfoncement (fraction de `ALA_Z_LIFT`). (0, 0) pour tout nez qui ne déborde pas (nez de la planche et nez libres étroits : inchangés).
 * Pour chaque borne en excès : ENFONCER d'abord (abaisser z de Δ lève x' de Δ·sin(lacet), sans toucher la silhouette de face), puis RAPPELER pour le reste (excès / cos du lacet), chacun plafonné à SA limite par borne ; on retient pour chaque levier le plus grand demandé, jamais moins que l'acquis.
 * Point fixe en 8 itérations : rapprocher ou enfoncer l'aile relève la surface de la joue sous elle, donc le recalcul.
 */
export function alaSeat(spec: HeadTurnSpec): { pull: number; embed: number } {
  const alaX = spec.nose.alaX, ka = spec.engine ? alaX / REF_ALA : 1, lift = ALA_Z_LIFT * ka;
  let pull = 0, embed = 0;
  for (let it = 0; it < 8; it++) {
    const a = alaSeated(spec, -1, pull, embed);
    let np = pull, ne = embed;
    for (const b of ALA_CONTOUR_BOUNDS) {
      const ex = alaOverflow(spec, a, b.yaw) - b.tol;
      if (ex <= 1e-5) continue;
      const th = rad(b.yaw), e2 = Math.min(b.maxEmbed, embed + ex / (Math.sin(th) * lift) + 1e-3), left = ex - (e2 - embed) * lift * Math.sin(th);
      ne = Math.max(ne, e2);
      if (left > 1e-5) np = Math.max(np, Math.min(b.maxPull * alaX, pull + left / Math.cos(th) + 1e-4));
    }
    if (np - pull <= 1e-9 && ne - embed <= 1e-9) break;
    pull = np; embed = ne;
  }
  return { pull, embed };
}
/** Rappel latéral seul (U) de `alaSeat` : conservé pour les mesures et règles qui le lisent. */
export function alaPull(spec: HeadTurnSpec): number { return alaSeat(spec).pull; }
/** Enfoncement seul de `alaSeat` (fraction de `ALA_Z_LIFT`). */
export function alaEmbed(spec: HeadTurnSpec): number { return alaSeat(spec).embed; }

/** Aile du nez (ellipsoïde posé sur la face, côté `sg`) : centre et demi-axes. Source UNIQUE : le maillage (`buildParts`) et l'adoucissement des normales à l'éclairage (`nose-light.ts`) la lisent. */
export function alaOf(spec: HeadTurnSpec, sg: 1 | -1): AlaEllipsoid { const { pull, embed } = alaSeat(spec); return alaSeated(spec, sg, pull, embed); }

/** Toutes les pièces du modèle, dans le repère de la tête. Les oreilles viennent du moteur d'oreille (`src/face/ear`) : modèle, relief, placement. */
export function buildParts(spec: HeadTurnSpec): Mesh[] {
  const meshes: Mesh[] = [headMesh(spec), ...neckMeshes(spec), bumpOf(spec, spec.nose.knots), bumpOf(spec, spec.mouth.knots)];
  const ax = v3(1, 0, 0), ay = v3(0, 1, 0), az = v3(0, 0, 1);
  for (const sg of [1, -1] as const) {
    const a = alaOf(spec, sg);
    meshes.push(ellipsoid(PART.bump, a.c, ax, ay, az, a.ex, a.ey, a.ez, 10, 16));
    meshes.push(...earMesh(earRig(spec, sg)));
  }
  if (spec.hairVolume) meshes.push(hairShellMesh(spec, spec.hairVolume), ...hairPartMeshes(spec, spec.hairVolume));
  return meshes;
}

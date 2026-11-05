import { clamp } from '../../../core/math';
import type { FaceParams } from '../../../schema';
import type { FaceLandmarks } from '../../landmarks';
import { buildHairline } from '../hairline';
import { earSpans, type EarSpan } from './ear-marks';
import { sideburnProfile } from './sideburn';
import { skullSurface, type SkullSurface } from './skull-surface';
import type { BoundaryPoint, EdgeKind, HairBoundary, HairMarks, SideburnProfile } from './types';

const DEG = Math.PI / 180;
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const ease = (t: number): number => t * t * (3 - 2 * t);

/** Point de lisière non projeté : (tronçon, hauteur, azimut). */
interface Raw {
  readonly kind: EdgeKind;
  readonly y: number;
  readonly az: number;
}

/**
 * Côté DROIT (az > 0), du coin de tempe à la ligne de la nuque. Le côté gauche en est le miroir (az → −az) avec ses propres oreilles.
 *  1. bord avant de la patte : suit la marge de `sideburnProfile` (même bande que le garde-fou), de la tempe à la pointe ;
 *  2. pointe arrondie, puis bord arrière de la patte jusqu'au-dessus de l'oreille ;
 *  3. arche au-dessus de l'oreille, puis derrière l'oreille jusqu'à la mastoïde ;
 *  4. nuque : de la mastoïde à la ligne de la nuque, centrée à az = π.
 */
function rightSide(S: SkullSurface, sb: SideburnProfile, yCorner: number, ear: EarSpan, napeY: number, H: number): Raw[] {
  const out: Raw[] = [];
  const N = 10;
  for (let i = 1; i <= N; i++) {
    const y = i === N ? sb.yTip : yCorner + (sb.yTip - yCorner) * (i / N);
    out.push({ kind: 'sideburn', y, az: Math.asin(clamp(1 - sb.margin(y) / S.a(y), 0, 1)) });
  }
  const azF = (out[out.length - 1] as Raw).az;
  const band = 0.15;
  out.push({ kind: 'sideburn', y: sb.yTip + 0.004 * H, az: azF + band * 0.3 }, { kind: 'sideburn', y: sb.yTip + 0.005 * H, az: azF + band * 0.7 }, { kind: 'sideburn', y: sb.yTip + 0.002 * H, az: azF + band });
  // Bord arrière de la patte → arche au-dessus de l'oreille (jamais plus bas que la pointe de la patte moins sa propre largeur).
  const yArch = ear.top - 0.014 * H;
  for (let i = 1; i <= 4; i++) out.push({ kind: 'ear', y: lerp(sb.yTip + 0.002 * H, yArch, i / 4), az: lerp(azF + band, 86 * DEG, i / 4) });
  for (let i = 1; i <= 4; i++) out.push({ kind: 'ear', y: yArch - 0.006 * H * Math.sin((Math.PI * i) / 4), az: lerp(86 * DEG, 98 * DEG, i / 4) });
  const yMast = ear.bottom + 0.01 * H;
  for (let i = 1; i <= 5; i++) out.push({ kind: 'ear', y: lerp(yArch, yMast, i / 5), az: lerp(100 * DEG, 107 * DEG, i / 5) });
  // Nuque : la hauteur descend vite (ease) vers la ligne de la nuque, puis reste à plat jusqu'au centre.
  const M = 9;
  for (let i = 1; i <= M; i++) out.push({ kind: 'nape', y: lerp(yMast, napeY, ease(Math.min(1, (i / M) * 1.6))), az: lerp(107 * DEG, Math.PI, i / M) });
  return out;
}

/**
 * LISIÈRE complète d'un visage : le bord qui sépare le territoire des cheveux du reste de la tête, posé sur la surface du crâne.
 * Le tronçon `front` est la ligne d'implantation historique (`buildHairline` : forme, recul, irrégularité, raie) : on ne la réécrit pas, on
 * la prolonge par les pattes, le contour de l'oreille et la nuque, tous lus sur les repères du visage (contour, oreilles, mâchoire).
 */
export function buildBoundary(p: FaceParams, lm: FaceLandmarks): HairBoundary {
  const { H } = lm;
  const S = skullSurface(lm);
  const hairline = buildHairline(p, lm);
  const sideburn = sideburnProfile(p, lm);
  const ears = earSpans(p, lm);
  const nPts = hairline.pts.length;
  const left = hairline.pts[0] as { x: number; y: number };
  const right = hairline.pts[nPts - 1] as { x: number; y: number };
  // Nuque : au niveau de l'angle de la mâchoire (un peu au-dessus), jamais au-dessus du bas des oreilles + 0,04 H.
  const napeY = Math.max(lm.jawY - 0.02 * H, Math.max(ears.left.bottom, ears.right.bottom) + 0.04 * H);
  const project = (r: Raw): BoundaryPoint => ({ kind: r.kind, y: r.y, az: r.az, p: { x: S.a(r.y) * Math.sin(r.az), y: r.y } });
  const front: BoundaryPoint[] = hairline.pts.map((q) => ({ kind: 'front', y: q.y, az: S.azOf(q.x, q.y), p: q }));
  const R = rightSide(S, sideburn, right.y, ears.right, napeY, H).map(project);
  const L = rightSide(S, sideburn, left.y, ears.left, napeY, H).map((r) => project({ ...r, az: -r.az }));
  // Parcours fermé : front G→D, côté droit vers la nuque (az = π), côté gauche remonté (az = −π doublon écarté).
  const loop: BoundaryPoint[] = [...front, ...R, ...L.slice(0, -1).reverse()];
  const marks: HairMarks = {
    centerY: hairline.yAt(0),
    cornerY: { left: left.y, right: right.y },
    azCorner: (front[nPts - 1] as BoundaryPoint).az,
    tipY: sideburn.yTip,
    earTopY: { left: ears.left.top, right: ears.right.top },
    earBottomY: { left: ears.left.bottom, right: ears.right.bottom },
    napeY,
  };
  const segment = (kind: EdgeKind, side?: -1 | 1): readonly BoundaryPoint[] => loop.filter((q) => q.kind === kind && (side === undefined || (side === 1 ? q.az >= 0 : q.az < 0)));
  const isFace = (x: number, y: number): boolean => {
    if (y < S.topY || y > S.chinY) return false;
    if (Math.abs(x) >= S.a(y) - sideburn.margin(y)) return false;
    return y > hairline.yAt(x);
  };
  return { loop, hairline, marks, sideburn, skull: S, isFace, segment };
}

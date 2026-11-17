import type { Vec } from '../../geometry/eye/primitives';
import type { BoundaryPoint, HairBoundary } from '../hair/boundary/types';
import type { Hairline } from '../hair/hairline';
import type { BareScalp, HairGeometry } from '../hair/types';
import type { Poly } from '../poly';
import { anchorDepth, anchorKind } from './hair-pose-strand';
import type { Skull } from './skull';

/**
 * ÉLÉMENTS LIÉS AUX CHEVEUX SOUS POSE (`docs/ROTATION-STEP-04-HAIR-2D.md`, tranche 3 ; `docs/ROTATION-HAIR-LINKED.md`). Tout ce qui est POSÉ SUR LE CRÂNE (ligne d'implantation, lisière, cuir chevelu, raie, éclaircissement,
 * zones rasées, ombres portées sur la peau, zone d'oreille, bord de frange) suit la MÊME projection que la masse (`Skull.projectX`) : la lisière reste donc sur le bord de la coque, sans jour ni chevauchement.
 * Les attaches (`ties`) suivent la règle des pièces attachées (rigides, profondeur de l'ancre) pour rester collées à leur queue ou à leur chignon.
 * Ne sont PAS recalculés ici : `boundary.isFace`, `boundary.skull`, `marks` et `sideburn` (lus à la CONSTRUCTION de la grammaire, en repère de face), ni les occlusions (cibles = traits du visage : étape 3).
 */
type Map2 = (q: Vec) => Vec;

/** Insère des points sur les arêtes d'une polyligne OUVERTE plus longues que `maxLen` (la projection n'est pas affine). */
export function densifyOpen(line: readonly Vec[], maxLen: number): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i] as Vec, b = line[i + 1] as Vec, n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / maxLen));
    for (let j = 0; j < n; j++) out.push({ x: a.x + ((b.x - a.x) * j) / n, y: a.y + ((b.y - a.y) * j) / n });
  }
  if (line.length) out.push(line[line.length - 1] as Vec);
  return out;
}

/** Ligne d'implantation posée : mêmes points projetés ; `yAt` interpole la ligne posée, `at(s)` lit la ligne posée par abscisse normalisée. */
export function posedHairline(h: Hairline, P: Map2, maxLen: number): Hairline {
  const pts = densifyOpen(h.pts, maxLen).map(P);
  return {
    pts,
    yAt(x: number): number {
      if (x <= (pts[0] as Vec).x) return (pts[0] as Vec).y;
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i] as Vec, b = pts[i + 1] as Vec;
        if (x <= b.x) return a.y + ((b.y - a.y) * (x - a.x)) / Math.max(1e-9, b.x - a.x);
      }
      return (pts[pts.length - 1] as Vec).y;
    },
    at(s: number): Vec {
      const u = (Math.min(1, Math.max(-1, s)) + 1) / 2 * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(u)), f = u - i, a = pts[i] as Vec, b = pts[i + 1] as Vec;
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    },
  };
}

/** Lisière posée : points du parcours projetés, tronçons relus sur la lisière posée. */
export function posedBoundary(b: HairBoundary, P: Map2, maxLen: number): HairBoundary {
  const mapPt = (q: BoundaryPoint): BoundaryPoint => ({ ...q, p: P(q.p) });
  return { ...b, loop: b.loop.map(mapPt), hairline: posedHairline(b.hairline, P, maxLen), segment: (kind, side) => b.segment(kind, side).map(mapPt) };
}

/** Attaches posées : rigides, dans le plan de l'ancre (voir `hair-pose-strand.ts`). */
export function posedTies(ties: HairGeometry['ties'], skull: Skull, yawDeg: number, W: number): HairGeometry['ties'] {
  const a = (yawDeg * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
  return ties.map((t) => ({ ...t, at: { x: t.at.x * c + anchorDepth(anchorKind(t.at, skull, W), t.at, skull) * sn, y: t.at.y }, rx: t.rx * Math.max(0.6, Math.abs(c)) }));
}

export interface LinkedPose {
  readonly hairline: Vec[];
  readonly boundary: HairBoundary;
  readonly scalp: Poly;
  readonly bare: BareScalp;
  readonly skinShadows: Poly[] | undefined;
  readonly shaved: Poly[] | undefined;
  readonly fringeBottom: Vec[] | null;
  readonly sides: HairGeometry['sides'];
  readonly ties: HairGeometry['ties'];
}

export function poseLinked(geo: HairGeometry, skull: Skull, P: Map2, densifyClosed: (p: Poly) => Poly, yawDeg: number, W: number, maxLen: number): LinkedPose {
  const closed = (p: Poly): Poly => densifyClosed(p).map(P);
  const zone = (s: HairGeometry['sides']['left']) => ({ ...s, earZone: closed(s.earZone) });
  return {
    hairline: densifyOpen(geo.hairline, maxLen).map(P),
    boundary: posedBoundary(geo.boundary, P, maxLen),
    scalp: closed(geo.scalp),
    bare: { part: geo.bare.part ? closed(geo.bare.part) : null, thin: geo.bare.thin.map(closed) },
    skinShadows: geo.skinShadows?.map(closed),
    shaved: geo.shaved?.map(closed),
    fringeBottom: geo.fringeBottom ? densifyOpen(geo.fringeBottom, maxLen).map(P) : null,
    sides: { left: zone(geo.sides.left), right: zone(geo.sides.right) },
    ties: posedTies(geo.ties, skull, yawDeg, W),
  };
}

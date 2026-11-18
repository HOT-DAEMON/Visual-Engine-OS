import type { Vec } from '../../geometry/eye/primitives';
import type { BoundaryPoint, HairBoundary } from '../hair/boundary/types';
import type { Hairline } from '../hair/hairline';
import type { BareScalp, HairGeometry } from '../hair/types';
import type { Poly } from '../poly';
import { anchorDepth, anchorKind, facing } from './hair-pose-strand';
import { curvatureCap, HIDE_NZ, limbLine, type LimbLine } from './hairline-limb';
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

/**
 * Ligne d'implantation posée : `pts` vient de `limbLine` (échantillonnage adaptatif, abscisse monotone, pas d'arc constant, virages bornés : `hairline-limb.ts`). `yAt` interpole la ligne posée ; `at(s)` la lit par
 * abscisse normalisée le long de la ligne POSÉE (pas d'arc constant : s n'est plus l'indice de la ligne de face, personne ne le relit après la pose).
 */
export function posedHairline(pts: Vec[]): Hairline {
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

/** Point `front` posé : hauteur et azimut lus par interpolation de la ligne de face à l'indice continu `u`. */
function posedFront(front: readonly BoundaryPoint[], line: LimbLine): BoundaryPoint[] {
  const last = front.length - 1;
  return line.pts.map((p, k) => {
    const u = Math.min(last, Math.max(0, line.u[k] as number)), i = Math.min(last - 1, Math.floor(u)), f = u - i, a = front[i] as BoundaryPoint, b = front[i + 1] as BoundaryPoint;
    return { kind: 'front', y: a.y + (b.y - a.y) * f, az: a.az + (b.az - a.az) * f, p };
  });
}

/**
 * Lisière posée. Le tronçon `front` est REMPLACÉ par les points de la ligne posée (même ligne que `hairline`, voir `posedHairline`) ; les autres tronçons (pattes, oreille, nuque) sont projetés point par point.
 * `segment` relit la lisière posée (côté lu sur l'azimut, comme à la construction).
 */
export function posedBoundary(b: HairBoundary, P: Map2, line: LimbLine): HairBoundary {
  const mapPt = (q: BoundaryPoint): BoundaryPoint => ({ ...q, p: P(q.p) });
  const front = b.loop.filter((q) => q.kind === 'front'), pf = front.length >= 3 ? posedFront(front, line) : front.map(mapPt);
  let done = false;
  const loop: BoundaryPoint[] = [];
  for (const q of b.loop) {
    if (q.kind !== 'front') loop.push(mapPt(q));
    else if (!done) { loop.push(...pf); done = true; }
  }
  const segment = (kind: BoundaryPoint['kind'], side?: -1 | 1): readonly BoundaryPoint[] => loop.filter((q) => q.kind === kind && (side === undefined || (side === 1 ? q.az >= 0 : q.az < 0)));
  return { ...b, loop, hairline: posedHairline(line.pts), segment };
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
  // Une seule ligne posée pour `hairline`, `boundary.hairline` et le tronçon `front`, calculée une fois (`hairline-limb.ts`) : coupée à l'horizon (n_z = cos(φ + a) de la rotation exacte, comme le fondu des mèches de devant),
  // ramenée dans la silhouette posée du crâne (mêmes bornes d'ordonnée que la vérification), courbure plafonnée à celle de la ligne de face.
  const yc = (y: number): number => Math.min(skull.chinY - 0.02 * (-2 * skull.topY), Math.max(skull.topY + 0.02 * (-2 * skull.topY), y));
  const line = limbLine(geo.hairline, P, maxLen, curvatureCap(geo.hairline), {
    hidden: (q) => facing(skull, q.x, q.y, yawDeg) < HIDE_NZ,
    inside: (q) => { const hx = skull.halfAt(yc(q.y), yawDeg); return Math.abs(q.x) > hx ? { x: Math.sign(q.x) * hx, y: q.y } : q; },
  });
  const zone = (s: HairGeometry['sides']['left']) => ({ ...s, earZone: closed(s.earZone) });
  return {
    hairline: line.pts,
    boundary: posedBoundary(geo.boundary, P, line),
    scalp: closed(geo.scalp),
    bare: { part: geo.bare.part ? closed(geo.bare.part) : null, thin: geo.bare.thin.map(closed) },
    skinShadows: geo.skinShadows?.map(closed),
    shaved: geo.shaved?.map(closed),
    fringeBottom: geo.fringeBottom ? densifyOpen(geo.fringeBottom, maxLen).map(P) : null,
    sides: { left: zone(geo.sides.left), right: zone(geo.sides.right) },
    ties: posedTies(geo.ties, skull, yawDeg, W),
  };
}

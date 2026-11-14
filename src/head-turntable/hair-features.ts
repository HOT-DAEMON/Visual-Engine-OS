import { mulberry32 } from '../core/prng';
import type { HairGeometry } from '../face/hair';
import { h2 } from './hair-hash';
import { FRINGE_STEP, type HairFringe, type HairPart } from './hair-volume-types';

/**
 * TRAITS DE LA COIFFURE dérivés de la GÉOMÉTRIE 2D du moteur de visage (`docs/HAIR-FRINGE-3D.md`, `docs/HAIR-SPIKY.md`, `docs/HAIR-FLOW-3D.md`) : rien n'est inventé côté 3D, tout vient du
 * dessin de face (frange, épis) ou de la graine de la coiffure (sens du tourbillon). Fonctions pures.
 */
const DEG = 180 / Math.PI, lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Distance minimale (U) entre le bord de la frange et le sourcil : la frange ne descend jamais sur l'œil (convention d'anatomie : le sourcil reste dégagé). */
export const FRINGE_BROW_GAP = 0.03;

/**
 * Frange : bord inférieur des mèches de front (`geo.fringeBottom`, px de l'hôte) converti en table (azimut → U) de −90° à +90°. Un azimut sans point prend l'interpolation des voisins ;
 * deux points proches prennent le plus BAS (la pointe de mèche la plus longue). Lissé [1 2 1], plafonné à `maxU` (sourcil − `FRINGE_BROW_GAP`). `null` sans frange.
 */
export function fringeOf(geo: HairGeometry, toU: (y: number) => number, maxU: number, seed: number, cover = 1): HairFringe | null {
  const fb = geo.fringeBottom;
  if (!fb || fb.length < 4) return null;
  const S = geo.boundary.skull, pts = fb.map((q) => ({ az: S.azOf(q.x, q.y) * DEG, y: toU(q.y) })).sort((a, b) => a.az - b.az), n = Math.round(180 / FRINGE_STEP) + 1;
  const raw = Array.from({ length: n }, (_, i) => {
    const g = -90 + i * FRINGE_STEP;
    let best = -Infinity;
    for (const p of pts) if (Math.abs(p.az - g) <= 0.9 * FRINGE_STEP) best = Math.max(best, p.y);
    if (best > -Infinity) return best;
    const lo = [...pts].reverse().find((p) => p.az < g), hi = pts.find((p) => p.az > g);
    return lo && hi ? lerp(lo.y, hi.y, (g - lo.az) / (hi.az - lo.az || 1)) : (lo ?? hi)!.y;
  });
  let y = raw;
  for (let pass = 0; pass < 2; pass++) y = y.map((v, i) => (i === 0 || i === n - 1 ? v : 0.25 * y[i - 1]! + 0.5 * v + 0.25 * y[i + 1]!));
  y = y.map((v) => Math.min(v, maxU));
  // Frange du moteur v2 (`blades`, `sheer`, `wispy`) : des mèches avec des JOURS, jamais une masse pleine (`fringe2.ts`) ; la bande 3D est la bande de MÊME AIRE (part `cover` de la hauteur entre l'implantation et le bord des mèches) : elle ne recouvre pas de peau que le dessin laisse voir.
  if (cover < 1) {
    const hl = geo.boundary.hairline.pts.map((q) => ({ az: S.azOf(q.x, q.y) * DEG, y: toU(q.y) })).sort((a, b) => a.az - b.az);
    const edge = (g: number): number => { const hi = hl.findIndex((q) => q.az >= g); if (hi <= 0) return hl[Math.max(0, hi)]!.y; const a = hl[hi - 1]!, b = hl[hi]!; return lerp(a.y, b.y, (g - a.az) / (b.az - a.az || 1)); };
    y = y.map((v, i) => { const e = hl.length ? edge(-90 + i * FRINGE_STEP) : v; return v > e ? e + (v - e) * cover : v; });
  }
  const low = y.indexOf(Math.max(...y)), az = -90 + low * FRINGE_STEP;
  return { y, side: Math.abs(az) < 6 ? (h2(7, 8, seed & 0xffff) < 0.5 ? -1 : 1) : az < 0 ? -1 : 1 };
}

/** Sens et force du tourbillon du sommet et du balayage du front, tirés de la graine de la coiffure : une chevelure réelle a un épi dans un sens ou dans l'autre, et la frange balaie vers le côté où elle descend le plus. */
export function flowOf(style: string, seed: number, fringe: HairFringe | null): { whorl: number; sweep: number } {
  const s = seed & 0xffff, dir = h2(1, 2, s) < 0.5 ? -1 : 1;
  return { whorl: style === 'buzz' ? 0 : dir * (5 + 3 * h2(3, 4, s)), sweep: fringe ? fringe.side * (3.5 + 2 * h2(5, 6, s)) : 0 };
}

/** Semis d'épis sur le dôme, hors du contour (déjà couvert par les épis 2D) : anneaux (hauteur U, nombre). Pas d'épi sur le devant sous `FRONT_YMAX` (la frange et le front restent dégagés). Convention de style. */
export const SPIKE = { rings: [{ y: 0, n: 1 }, { y: 0.1, n: 6 }, { y: 0.22, n: 10 }, { y: 0.33, n: 12 }], frontAz: 62, frontYMax: 0.1, rMax: 0.05, rBase: 0.38, power: 1.6 } as const;

const median = (a: readonly number[]): number => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] ?? 0; };

/**
 * ÉPIS 3D (coiffure `spiky`). Les cônes 2D du moteur de visage (`kind: 'cone'`) sont des épis vus de FACE, posés sur le contour du crâne : leur direction (dx, dy) est la projection de face, donc
 * dx est l'axe x du monde. Ils sont repris tels quels (racine, longueur, largeur de base, netteté) : à 0° la silhouette est celle du dessin. Le reste du dôme (devant exclu, contour exclu)
 * reçoit un semis déterministe d'épis de MÊME loi de longueur (55 – 95 % de la médiane 2D), plus couchés vers l'extérieur à mesure qu'on descend : la rotation à 360° a des pointes partout.
 */
export function spikesOf(geo: HairGeometry, kU: number, toU: (y: number) => number, seed: number): HairPart[] {
  const cones = geo.locks.filter((l) => l.kind === 'cone' && l.spine && l.spine.length > 1);
  if (!cones.length) return [];
  const S = geo.boundary.skull, out: HairPart[] = [], lens: number[] = [];
  for (const l of cones) {
    const sp = l.spine!, R = sp[0]!, T = sp[sp.length - 1]!, dx = T.x - R.x, dy = T.y - R.y, L = Math.hypot(dx, dy) || 1, az = S.azOf(R.x, R.y), len = L * kU;
    lens.push(len);
    // dx est l'axe x du monde : il se décompose en part sortante (sin az) et part tangente à l'azimut (cos az).
    out.push({ kind: 'spike', az: az * DEG, y: toU(R.y), up: -dy / L, out: (dx / L) * Math.sin(az), sx: (dx / L) * Math.cos(az), len, r: Math.min(SPIKE.rMax, SPIKE.rBase * len), power: l.power ?? SPIKE.power });
  }
  const rnd = mulberry32((seed ^ 0x51d3) >>> 0), med = median(lens);
  for (const ring of SPIKE.rings) {
    for (let k = 0; k < ring.n; k++) {
      const az = ring.n === 1 ? 0 : -180 + (360 * (k + 0.2 + 0.6 * rnd())) / ring.n, a = Math.abs(az), len = med * (0.55 + 0.4 * rnd()), low = ring.y / 0.35, sx = (rnd() - 0.5) * 0.3, dy = ring.y + 0.04 * rnd();
      if ((ring.y > SPIKE.frontYMax && a < SPIKE.frontAz) || (a > 70 && a < 110 && ring.n > 1)) continue;
      out.push({ kind: 'spike', az, y: dy, up: 1 - 0.5 * low, out: 0.25 + 0.9 * low, sx, len, r: Math.min(SPIKE.rMax, SPIKE.rBase * len), power: SPIKE.power });
    }
  }
  return out;
}

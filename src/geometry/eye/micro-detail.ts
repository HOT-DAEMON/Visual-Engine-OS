import { mulberry32 } from '../../core/prng';
import type { Microdetail } from '../../schema/eye-microdetail';
import type { OpeningGeometry } from './opening';
import type { Vec } from './primitives';

/**
 * EYE-07 — Géométrie des microdétails de la sclère (pure, déterministe) + niveaux de détail (LOD).
 * Invariants testés : aucun point de vaisseau dans l'iris ; tous dans la boîte de l'ouverture ; mêmes graines = mêmes vaisseaux ;
 * le LOD ne fait que RETIRER des détails (les troncs conservés sont identiques à pleine résolution).
 */
export interface Lod {
  /** Visibilité des vaisseaux fins (0 : retirés, 1 : tous). */
  readonly vessels: number;
  /** Visibilité des imperfections et de l'occlusion fine. */
  readonly fine: number;
  /** Visibilité des ramifications secondaires. */
  readonly branches: number;
}

/** LOD selon la largeur de l'œil en pixels : ≥ 220 px détail complet ; < 70 px plus de vaisseaux fins ni de ramifications. Continu, monotone. */
export function microLod(eyePixels: number | null): Lod {
  if (eyePixels === null) return { vessels: 1, fine: 1, branches: 1 };
  const s = (a: number, b: number): number => Math.min(1, Math.max(0, (eyePixels - a) / (b - a)));
  return { vessels: s(40, 160), fine: s(70, 220), branches: s(70, 200) };
}

export interface Vessel {
  /** Points de contrôle (courbe lisse), du canthus vers l'iris. */
  readonly pts: readonly Vec[];
  readonly width: number;
  readonly alpha: number;
  readonly branch: boolean;
}

const irisNorm = (p: Vec, c: Vec, rx: number, ry: number): number => Math.hypot((p.x - c.x) / rx, (p.y - c.y) / ry);

/** Vaisseaux de la sclère : troncs partant des deux canthi, quelques ramifications ; tous hors de l'iris. */
export function scleraVessels(g: OpeningGeometry, c: Vec, irisRx: number, irisRy: number, v: NonNullable<Microdetail['vessels']>, seed: number, lod: Lod): Vessel[] {
  const out: Vessel[] = [];
  const perSide = Math.round(v.density * 14);
  const rnd = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const b = g.bbox;
  const clampBox = (p: Vec): Vec => ({ x: Math.min(b.x + b.w, Math.max(b.x, p.x)), y: Math.min(b.y + b.h, Math.max(b.y, p.y)) });
  for (const canthus of [g.pi, g.po]) {
    for (let i = 0; i < perSide; i++) {
      // Tirages dans un ordre FIXE, même si le vaisseau est ensuite écarté par le LOD (stabilité d'identité).
      const along = 0.04 + rnd() * 0.1;
      const jy = (rnd() - 0.5) * g.hEff * 0.3;
      const stopAt = 1.05 + rnd() * 0.5;
      const wob = (rnd() - 0.5) * 0.5;
      const wid = 0.55 + rnd() * 0.9;
      const keep = rnd();
      const hasBranch = rnd() < v.branching;
      const bAt = 0.4 + rnd() * 0.3;
      const bAng = (rnd() < 0.5 ? -1 : 1) * (0.25 + rnd() * 0.35);
      const bLen = 0.25 + rnd() * 0.3;
      if (keep > lod.vessels) continue;
      const start = clampBox({ x: canthus.x + (c.x - canthus.x) * along, y: canthus.y + jy });
      // Fin : sur le rayon start → centre de l'iris, à `stopAt` fois le rayon de l'iris (métrique de l'ellipse).
      const dx = c.x - start.x;
      const dy = c.y - start.y;
      const len = Math.hypot(dx, dy) || 1;
      let lo = 0;
      let hi = 1;
      for (let k = 0; k < 24; k++) {
        const m = (lo + hi) / 2;
        const q = { x: start.x + dx * m, y: start.y + dy * m };
        if (irisNorm(q, c, irisRx, irisRy) > stopAt) lo = m; else hi = m;
      }
      const tEnd = lo;
      if (tEnd < 0.08) continue;
      const nx = -dy / len;
      const ny = dx / len;
      const pts: Vec[] = [0, 0.25, 0.5, 0.75, 1].map((t) => {
        const w = Math.sin(t * Math.PI) * wob * len * tEnd * 0.18;
        return clampBox({ x: start.x + dx * tEnd * t + nx * w, y: start.y + dy * tEnd * t + ny * w });
      });
      const width = g.hEff * 0.006 * (0.4 + v.thickness * 1.6) * wid;
      const alpha = v.visibility * (0.3 + 0.35 * wid * 0.5);
      out.push({ pts, width, alpha, branch: false });
      if (hasBranch && lod.branches > keep) {
        const a0 = pts[Math.round(bAt * 4)] as Vec;
        const dir = Math.atan2(dy, dx) + bAng;
        const bl = len * tEnd * bLen;
        const tip = clampBox({ x: a0.x + Math.cos(dir) * bl, y: a0.y + Math.sin(dir) * bl });
        if (irisNorm(tip, c, irisRx, irisRy) >= 1.02) out.push({ pts: [a0, { x: (a0.x + tip.x) / 2 + nx * wob * 2, y: (a0.y + tip.y) / 2 + ny * wob * 2 }, tip], width: width * 0.55, alpha: alpha * 0.8, branch: true });
      }
    }
  }
  return out;
}

/** Petites marques de la sclère (EYE-07F) : centres et rayons, hors iris, dans l'ouverture ; `count` × visibilité fine. */
export function scleraMarks(g: OpeningGeometry, c: Vec, irisRx: number, irisRy: number, count: number, seed: number, fine: number): { x: number; y: number; r: number }[] {
  const rnd = mulberry32((seed ^ 0x85ebca6b) >>> 0);
  const out: { x: number; y: number; r: number }[] = [];
  const b = g.bbox;
  for (let i = 0; i < count; i++) {
    const x = b.x + b.w * (0.1 + 0.8 * rnd());
    const y = b.y + b.h * (0.3 + 0.4 * rnd());
    const r = g.hEff * (0.008 + 0.012 * rnd());
    const keep = rnd();
    if (keep > fine || irisNorm({ x, y }, c, irisRx, irisRy) < 1.1) continue;
    out.push({ x, y, r });
  }
  return out;
}

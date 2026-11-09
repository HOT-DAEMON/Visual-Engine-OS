import { mulberry32 } from '../../core/prng';
import type { Vec } from '../../geometry/eye/primitives';
import { inPoly, type Poly } from '../poly';
import { lockFrom, type HairCtx } from './flow';
import { arcAt } from './hairline';
import type { HairLock } from './types';

/**
 * DÔME DES COIFFURES TIRÉES ET RASE (`docs/HAIR-FORM-DOMES.md`). Avant : `ponytail`, `bun`, `braids` et `buzz` n'avaient AUCUNE mèche sur le dessus du crâne (bord nu 0,88 à 1,00) :
 * un aplat lisse. C'était voulu pour l'anatomie (cheveux plaqués, ras), mais un cheveu tiré n'est pas un aplat : il garde les STRIES du peigne, toutes dirigées vers l'attache, et
 * un crâne rasé montre du CHAUME (poils très courts, dressés perpendiculairement à la peau).
 *
 *  - tirées (queue, chignon, tresses) : traits fins (`hairline`) partant de l'implantation, courbés autour du dôme, convergeant vers l'attache (queue / chignon) ou vers le sommet (tresses) ;
 *    des stries claires (reflet) et sombres (séparation) alternent ; aucune mèche épaisse, aucun volume ajouté ;
 *  - rase : chaume = traits très courts radiaux depuis le centre du crâne, de tons voisins, avec un DÉGRADÉ vers les flancs (`FADE`, `HAIR-SKULL-REMAINING.md` 15).
 * Tous rognés au bord de la coque. Graine PROPRE et exécution en dernier : le reste de la chevelure est identique avec ou sans ces traits.
 */
export type CombKind = 'streaks' | 'stubble';

/** Nombre de traits et longueur relative par coiffure. */
export const COMB = { streaks: { n: 78, reach: [0.4, 0.95] }, stubble: { n: 220, len: [0.014, 0.03] } } as const;

/**
 * DÉGRADÉ (fade) de la coupe rase : le chaume s'éclaircit et raccourcit vers les flancs (tempes, au-dessus des oreilles), comme une tondeuse dont le sabot descend. `fadeAt` donne la
 * part de fondu (0 au sommet, 1 au flanc) pour une abscisse `x` sur une tête de demi-largeur `hw`. Source unique : traits (`comb.ts`) et voile de peau du rendu (`hair.ts`).
 */
export const FADE = { from: 0.55, to: 0.98, skin: 0.5 } as const;
export const fadeAt = (x: number, hw: number): number => { const t = Math.min(1, Math.max(0, (Math.abs(x) / hw - FADE.from) / (FADE.to - FADE.from))); return t * t * (3 - 2 * t); };

export const combKind = (style: string): CombKind | null => (style === 'ponytail' || style === 'bun' || style === 'braids' ? 'streaks' : style === 'buzz' ? 'stubble' : null);

/** Coupe le tracé au premier point hors de la coque (`base`). */
const clipTo = (pts: Vec[], base: Poly): Vec[] => {
  const k = pts.findIndex((q, i) => i >= 2 && !inPoly(base, q.x, q.y));
  return k < 0 ? pts : pts.slice(0, k);
};

export function combLocks(ctx: HairCtx, base: Poly, spots: readonly Vec[]): HairLock[] {
  const kind = combKind(ctx.h.style);
  if (!kind || ctx.h.sim.enabled) return [];
  const { lm, hl, arc, boundary, h } = ctx;
  const { W, H } = lm, S = boundary.skull;
  const rnd = mulberry32(((h.seed ^ 0xc0b0) * 2654435761) >>> 0);
  const out: HairLock[] = [];
  // Cible des stries : l'attache la plus proche du point de départ (queue / chignon), sinon le sommet du crâne (tresses : raies vers l'arrière).
  const topPt: Vec = { x: 0, y: S.topY - 0.02 * H };
  const target = (from: Vec): Vec => {
    if (!spots.length) return topPt;
    const T = spots.reduce((a, b) => (Math.abs(b.x - from.x) < Math.abs(a.x - from.x) ? b : a));
    // Une attache basse (nuque) est invisible de face : les stries montent vers le sommet, jamais vers le bas.
    return { x: T.x, y: Math.min(T.y, S.topY + 0.1 * H) };
  };
  const n = kind === 'streaks' ? COMB.streaks.n : COMB.stubble.n;
  const keep = 1 - 0.5 * h.thinning;
  for (let i = 0; i < Math.round(n * keep); i++) {
    const s = -1 + 2 * rnd();
    const a = hl.at(s), b = arcAt(arc, s);
    const t = kind === 'streaks' ? 0.05 + 0.75 * rnd() : 0.1 + 0.9 * rnd();
    const from: Vec = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    if (!inPoly(base, from.x, from.y)) continue;
    // Dégradé : sur les flancs, des traits en moins (jusqu'à 60 %) et plus courts (jusqu'à −45 %).
    const fade = kind === 'stubble' ? fadeAt(from.x, W * 0.5) : 0;
    if (fade > 0 && rnd() < 0.6 * fade) continue;
    let pts: Vec[];
    if (kind === 'streaks') {
      const T = target(from), f = COMB.streaks.reach[0] + (COMB.streaks.reach[1] - COMB.streaks.reach[0]) * rnd();
      const e = { x: from.x + (T.x - from.x) * f, y: from.y + (T.y - from.y) * f };
      // Courbure : la strie contourne le dôme (elle s'écarte de l'axe avant de converger), le départ est quasi vertical.
      const bow = Math.sign(from.x - T.x || 1) * 0.12 * Math.abs(e.x - from.x + 1e-3) + Math.sign(from.x || 1) * 0.012 * W;
      const c = { x: (from.x + e.x) / 2 + bow, y: from.y + (e.y - from.y) * 0.55 };
      pts = Array.from({ length: 12 }, (_, j) => { const u = j / 11; return { x: (1 - u) ** 2 * from.x + 2 * (1 - u) * u * c.x + u * u * e.x, y: (1 - u) ** 2 * from.y + 2 * (1 - u) * u * c.y + u * u * e.y }; });
    } else {
      // Chaume : dressé perpendiculairement au crâne, donc radial depuis le centre ; très court.
      const dx = from.x - ctx.C.x, dy = from.y - ctx.C.y, l = Math.hypot(dx, dy) || 1, len = (COMB.stubble.len[0] + (COMB.stubble.len[1] - COMB.stubble.len[0]) * rnd()) * H * (1 - 0.45 * fade);
      pts = Array.from({ length: 5 }, (_, j) => ({ x: from.x + (dx / l) * len * (j / 4), y: from.y + (dy / l) * len * (j / 4) }));
    }
    pts = clipTo(pts, base);
    if (pts.length < 3) continue;
    // Reflet (clair) ou séparation (sombre) : les stries d'un cheveu tiré alternent, le chaume varie à peine.
    const tone = kind === 'streaks' ? (rnd() < 0.4 ? 0.12 + 0.28 * rnd() : -(0.08 + 0.3 * rnd())) : (rnd() - 0.5) * 0.3;
    const wd = W * (kind === 'streaks' ? 0.0016 + 0.0018 * rnd() : 0.0011 + 0.0009 * rnd());
    out.push(...lockFrom(ctx, pts, { width: wd, rank: 'hairline', tone, layer: 'front', sharp: 1, raw: true, kind: 'lock', fade: kind === 'streaks' ? 0.35 : 0.1 }).map((l): HairLock => ({ ...l, comb: true })));
  }
  return out;
}

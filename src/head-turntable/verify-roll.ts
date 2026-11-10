import { PART } from './mesh';
import { REGION, type HeadTurnSpec, type TurnRender } from './types';
import { check, type Check } from './verify-types';

/** Roulis de contrôle (°) : assez grand pour être mesuré à ≈ 1° près, dans l'amplitude (±40°) du schéma. */
export const ROLL_PROBE = 20;

/** Centres de gravité (px) des pixels d'œil, côté image gauche puis droit (séparés à la moyenne des x). */
function eyeCentres(r: TurnRender): { l: { x: number; y: number }; r: { x: number; y: number } } | null {
  const px: { x: number; y: number }[] = []; let mx = 0;
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (r.regions[y * r.w + x] === REGION.eye) { px.push({ x, y }); mx += x; }
  if (!px.length) return null;
  mx /= px.length;
  const c = (a: { x: number; y: number }[]): { x: number; y: number } => ({ x: a.reduce((s, q) => s + q.x, 0) / (a.length || 1), y: a.reduce((s, q) => s + q.y, 0) / (a.length || 1) });
  const L = px.filter((q) => q.x < mx), Rr = px.filter((q) => q.x >= mx);
  return L.length && Rr.length ? { l: c(L), r: c(Rr) } : null;
}
const tilt = (r: TurnRender): number | null => { const e = eyeCentres(r); return e ? (Math.atan2(e.r.y - e.l.y, e.r.x - e.l.x) * 180) / Math.PI : null; };
const area = (r: TurnRender, id: number): number => { let n = 0; for (let i = 0; i < r.ids.length; i++) if (r.ids[i] === id) n++; return n; };

/** Nombre de composantes connexes (4-voisinage) des pixels couverts : une tête rigide jointe au cou n'en a qu'une. */
function components(r: TurnRender): number {
  const seen = new Uint8Array(r.w * r.h), nb = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  let n = 0;
  for (let s = 0; s < seen.length; s++) {
    if (seen[s] || !r.ids[s]) continue;
    n++; seen[s] = 1;
    const st = [s];
    while (st.length) {
      const k = st.pop()!, x = k % r.w, y = (k - x) / r.w;
      for (const [dx, dy] of nb) {
        const xx = x + dx, yy = y + dy, j = yy * r.w + xx;
        if (xx >= 0 && yy >= 0 && xx < r.w && yy < r.h && !seen[j] && r.ids[j]) { seen[j] = 1; st.push(j); }
      }
    }
  }
  return n;
}
/** Centre (px) des 6 dernières rangées du cou : sa base (à tangage 0 la coupe du cou est de chant). Elle ne doit pas bouger avec le roulis (les épaules restent de niveau). */
function baseCentre(r: TurnRender): { x: number; y: number } | null {
  let bot = -1;
  for (let y = r.h - 1; y >= 0 && bot < 0; y--) for (let x = 0; x < r.w; x++) if (r.ids[y * r.w + x] === PART.neck || r.ids[y * r.w + x] === PART.neckCut) { bot = y; break; }
  if (bot < 0) return null;
  let n = 0, sx = 0, sy = 0;
  for (let y = bot - 5; y <= bot; y++) for (let x = 0; x < r.w; x++) if (r.ids[y * r.w + x] === PART.neck || r.ids[y * r.w + x] === PART.neckCut) { n++; sx += x; sy += y; }
  return { x: sx / n, y: sy / n };
}

/**
 * Contrôles du ROULIS, sur trois rendus : `r0` (yaw 0, roulis 0), `r1` (yaw 0, roulis +ROLL_PROBE), `r2` (yaw 60, roulis −ROLL_PROBE) :
 *  - GÉOMÉTRIE : la ligne des yeux tourne de l'angle demandé (la tête pivote vraiment de ρ) ; la tête est rigide (aire conservée) ; tête + cou restent d'un seul tenant (pas de fente à la jonction).
 *  - ANATOMIE : la base du cou ne bouge pas (les épaules restent de niveau, le cou se plie).
 */
export function rollChecks(_spec: HeadTurnSpec, r0: TurnRender, r1: TurnRender, r2: TurnRender): { geometry: Check[]; anatomy: Check[] } {
  const g: Check[] = [], a: Check[] = [], t0 = tilt(r0), t1 = tilt(r1);
  if (t0 !== null && t1 !== null) g.push(check('geometry', 'head.roll.eyeline', `Roulis ${ROLL_PROBE}° : rotation de la ligne des yeux mesurée dans l'image (°) [attendu ${ROLL_PROBE}, ± 1,5]`, t1 - t0, ROLL_PROBE - 1.5, ROLL_PROBE + 1.5));
  g.push(check('geometry', 'head.roll.rigid', 'Roulis : aire de la tête avec roulis / sans roulis (rotation rigide : 1)', area(r1, PART.head) / Math.max(1, area(r0, PART.head)), 0.97, 1.03));
  g.push(check('geometry', 'head.roll.joined', 'Roulis : composantes connexes de la silhouette tête + cou, à 0° et à 60° (1 = pas de fente à la jonction)', Math.max(components(r1), components(r2)), 1, 1));
  const b0 = baseCentre(r0), b1 = baseCentre(r1);
  if (b0 && b1) a.push(check('anatomy', 'head.roll.neck-base', 'Roulis : déplacement (px) de la base du cou, les épaules restent de niveau (< 2 % de la hauteur de l\'image)', Math.hypot(b1.x - b0.x, b1.y - b0.y), 0, 0.02 * r0.h));
  return { geometry: g, anatomy: a };
}

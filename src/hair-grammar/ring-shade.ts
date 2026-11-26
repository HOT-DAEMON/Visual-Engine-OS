import { MEASURED } from './ring-measures';
import type { V2 } from './vec';

/**
 * OMBRE AVAL LISSE du reflet transversal (passe 8) — remplace les trois paliers à bords durs des passes 6–7 (`RingBands.shoulder`, conservés pour le retour arrière).
 * La référence 60 est un dégradé ; le profil [x, w] vient de la mesure (`ring-profile.ts`, `MEASURED.shadeProfile`).
 * La zone est découpée en un segment par intervalle de nœuds, SUIVANT L'AXE COURBE de la mèche, et chaque segment porte un `linearGradient` aligné sur sa propre corde :
 * un seul dégradé droit placerait mal les isolignes (mesuré sur 462 ombres : l'axe s'écarte de sa corde de 0,19 demi-largeur en médiane, 1,07 au 99e centile ; tangente inclinée de 13° en médiane, 26° au 90e centile).
 * Les segments se raccordent : la fin du segment k et le début du segment k+1 ont la même position ET la même opacité (continuité C0, vérifiée par `ring-check.ts`).
 * L'opacité d'un point = crête × w(x) ; la crête dépend du ton (`core/shade.ts`).
 */
export interface ShadeSegment {
  /** Quadrilatère du segment (bord amont gauche, amont droit, aval droit, aval gauche), dans le repère de la lame. */
  readonly poly: readonly V2[];
  /** Axe du dégradé : milieu du bord amont → milieu du bord aval. */
  readonly from: V2; readonly to: V2;
  /** Poids du profil (0–1) à `from` et à `to`. */
  readonly w0: number; readonly w1: number;
}

export const SHADE_NODES: readonly (readonly [number, number])[] = MEASURED.shadeProfile;

/** Poids du profil à la distance relative x ∈ [0, 1] (interpolation linéaire entre nœuds ; 0 au-delà). */
export function shadeAt(x: number, nodes: readonly (readonly [number, number])[] = SHADE_NODES): number {
  if (!(x >= 0)) return nodes[0]![1]; const last = nodes[nodes.length - 1]!; if (x >= last[0]) return last[1];
  for (let i = 1; i < nodes.length; i++) { const p = nodes[i - 1]!; const q = nodes[i]!; if (x <= q[0]) return p[1] + ((q[1] - p[1]) * (x - p[0])) / (q[0] - p[0] || 1); }
  return last[1];
}

/**
 * Segments de l'ombre. `at(s, u)` : point de la lame à l'abscisse curviligne s (px) et à la position latérale u ; `a` : début (bord aval du reflet) ; `dir` : +1 vers la pointe, −1 vers la racine ;
 * `dl` : longueur de l'ombre (px) ; `total` : longueur de la mèche (px). Un segment coupé par la pointe ou la racine garde le profil à SA vraie distance (le dégradé n'est pas étiré) ;
 * un segment entièrement au-delà est omis.
 */
export function shadeSegments(at: (s: number, u: number) => V2, a: number, dir: 1 | -1, dl: number, total: number, lateral = 0.96, nodes: readonly (readonly [number, number])[] = SHADE_NODES): ShadeSegment[] {
  const out: ShadeSegment[] = []; const clamp = (s: number): number => Math.max(0, Math.min(total, s));
  for (let k = 0; k < nodes.length - 1; k++) {
    const n0 = nodes[k]!; const n1 = nodes[k + 1]!; const s0 = a + dir * dl * n0[0]; const s1 = a + dir * dl * n1[0]; const c0 = clamp(s0); const c1 = clamp(s1);
    if (Math.abs(c1 - c0) < 1e-6) continue;
    const kept = Math.abs(c1 - c0) / (Math.abs(s1 - s0) || 1); // part du segment qui reste sur la mèche
    const from = at(c0, 0); const to = at(c1, 0); if (Math.hypot(to.x - from.x, to.y - from.y) < 1e-6) continue;
    out.push({ poly: [at(c0, -lateral), at(c0, lateral), at(c1, lateral), at(c1, -lateral)], from, to, w0: n0[1], w1: n0[1] + (n1[1] - n0[1]) * kept });
  }
  return out;
}

/** Valeurs d'opacité (début, fin) d'un segment pour la crête `peak`. */
export const shadeStops = (s: ShadeSegment, peak: number): readonly [number, number] => [peak * s.w0, peak * s.w1];

/** Poids du profil EMIS, reconstruit des segments (distance cumulée le long de l'axe, normalisée à la longueur totale demandée) : ce que `verify-ring.ts` compare à la mesure. */
export function emittedProfile(segs: readonly ShadeSegment[]): [number, number][] {
  const pts: [number, number][] = []; let d = 0;
  segs.forEach((s, i) => { if (i === 0) pts.push([0, s.w0]); d += Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y); pts.push([d, s.w1]); });
  return pts;
}

// Empreinte déterministe (FNV-1a 32 bits, deux graines) du contenu d'un dégradé : deux dégradés identiques partagent le même identifiant (sans conséquence), deux dégradés différents n'en partagent jamais
// (les identifiants sont globaux dans un document SVG : une planche qui repeint la même mèche sous plusieurs lumières en aurait sinon deux de même nom, et le premier gagnerait).
function fingerprint(text: string): string {
  let a = 0x811c9dc5; let b = 0x9747b28c;
  for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); a = Math.imul(a ^ c, 0x01000193) >>> 0; b = Math.imul(b ^ c, 0x85ebca6b) >>> 0; b = (b ^ (b >>> 13)) >>> 0; }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}
const f2 = (v: number): string => (Math.round(v * 100) / 100).toString();
const f3 = (v: number): string => (Math.round(v * 1000) / 1000).toString();

/** SVG de l'ombre pour le moteur de grammaire : un `<defs>` de dégradés puis un quadrilatère par segment. Chaîne vide si la crête est nulle (ton trop sombre) ou s'il n'y a pas de segment. */
export function shadeMarkup(segs: readonly ShadeSegment[], peak: number, color: string): string {
  if (!(peak > 0) || !segs.length) return '';
  const key = fingerprint(`${color}|${f3(peak)}|${segs.map((s) => `${f2(s.from.x)},${f2(s.from.y)},${f2(s.to.x)},${f2(s.to.y)},${f3(s.w0)},${f3(s.w1)}`).join(';')}`);
  const defs: string[] = []; const paths: string[] = [];
  segs.forEach((s, k) => {
    const id = `rsh${key}-${k}`; const [o0, o1] = shadeStops(s, peak);
    defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f2(s.from.x)}" y1="${f2(s.from.y)}" x2="${f2(s.to.x)}" y2="${f2(s.to.y)}"><stop offset="0" stop-color="${color}" stop-opacity="${f3(o0)}"/><stop offset="1" stop-color="${color}" stop-opacity="${f3(o1)}"/></linearGradient>`);
    paths.push(`<path d="M${s.poly.map((p) => `${f2(p.x)} ${f2(p.y)}`).join('L')}Z" fill="url(#${id})"/>`);
  });
  return `<defs>${defs.join('')}</defs>${paths.join('')}`;
}

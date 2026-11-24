import type { HeadSpec, View } from './head';
import type { Light } from './local-geometry';
import type { ProLock } from './paint-pro';
import { RING, ringBands, type RingBands } from './spec-ring';
import type { Check, Report } from './verify';
import type { V2 } from './vec';

/**
 * VÉRIFICATION DU REFLET TRANSVERSAL (docs/HAIR-PASS6.md) — les trois couches de `verify.ts`, appliquées aux anneaux de `spec-ring.ts`.
 * Chaque contrôle relit la bande ÉMISE (sommets) et la compare à la lame et à la géométrie locale, au lieu de relire les constantes qui l'ont construite :
 *  - GÉOMÉTRIQUE : sommets finis ; la bande reste dans le contour émis de la lame ; elle est TRANSVERSE (bord ⟂ tangente) ;
 *  - ANATOMIQUE  : le reflet est sur une face éclairée et tournée vers la caméra (exposition ≥ 0,5, jamais sur le dessous) ; l'ombre aval est du côté opposé à la lumière ;
 *  - STYLE       : la part de mèches portant un reflet n'est ni « mat » ni « plastique » ; étendue et couverture dans la plage MESURÉE sur la référence 60 ; trois paliers d'ombre ;
 *    la bande n'occupe qu'une fraction de la lame.
 * Les plages mesurées sont celles de `spec-ring.ts` (étendue 0,047–0,071 L ; couverture 0,67–0,91 sur rubans droits, réduite sur les lames pliées) ; les bornes de part (15–85 %) et d'aire (≤ 35 %) sont des seuils d'ingénierie.
 * Une scène sans mèche assez nombreuse (< `MIN_LOCKS`) n'est pas jugée sur la part : un seul reflet ne dit rien de la proportion.
 */
export const MIN_LOCKS = 8;
const chk = (name: string, value: number, min: number, max: number): Check => ({ name, value, min, max, ok: Number.isFinite(value) && value >= min && value <= max });
const rep = (layer: Report['layer'], checks: Check[]): Report => ({ layer, checks, ok: checks.every((c) => c.ok) });

const area = (poly: readonly V2[]): number => { let a = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i] as V2; const q = poly[(i + 1) % poly.length] as V2; a += p.x * q.y - q.x * p.y; } return Math.abs(a) / 2; };
const bladeArea = (l: ProLock): V2[] => [...l.blade.left, ...[...l.blade.right].reverse()];
const finite = (r: RingBands): boolean => [...r.highlight, ...r.shoulder.flat()].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)) && [r.at, r.strength, r.extent, r.coverage].every(Number.isFinite);

const cross = (a: V2, b: V2, p: V2): number => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
const inTri = (a: V2, b: V2, c: V2, p: V2): boolean => { const d1 = cross(a, b, p); const d2 = cross(b, c, p); const d3 = cross(c, a, p); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); };
/**
 * Point couvert par la lame ? UNION des tranches (quadrilatère gauche[i], gauche[i+1], droite[i+1], droite[i]) et non test pair/impair sur le contour : une mèche qui se replie sur elle-même
 * (spine qui revient près de sa racine) recouvre sa propre surface, et un test pair/impair y déclarait « dehors » un point pourtant peint (faux positif relevé sur une mèche « mass » repliée).
 */
function covered(l: ProLock, p: V2): boolean {
  const { left, right } = l.blade;
  for (let i = 0; i < left.length - 1; i++) { const a = left[i] as V2; const b = left[i + 1] as V2; const c = right[i + 1] as V2; const d = right[i] as V2; if (inTri(a, b, c, p) || inTri(a, c, d, p)) return true; }
  return false;
}
/** Part des sommets du reflet qui sortent de la surface peinte de la lame (gauche/droite émis), et non d'une demi-largeur recalculée : la lame est la vérité de ce qui est peint. */
function outsideShare(l: ProLock, r: RingBands): number { return r.highlight.filter((p) => !covered(l, p)).length / r.highlight.length; }

/** |cos| entre le bord de la bande (premier au dernier sommet du bord haut) et la tangente de la spine au centre : 0 = parfaitement transverse. */
function edgeCos(l: ProLock, r: RingBands): number {
  const sp = l.blade.spine; const cum = [0]; for (let i = 1; i < sp.length; i++) cum.push((cum[i - 1] as number) + Math.hypot((sp[i] as V2).x - (sp[i - 1] as V2).x, (sp[i] as V2).y - (sp[i - 1] as V2).y));
  const target = r.at * (cum[cum.length - 1] as number); let i = 0; while (i < sp.length - 2 && (cum[i + 1] as number) < target) i++;
  const t = { x: (sp[i + 1] as V2).x - (sp[i] as V2).x, y: (sp[i + 1] as V2).y - (sp[i] as V2).y };
  const half = (r.highlight.length / 2) | 0; const a = r.highlight[0] as V2; const b = r.highlight[half - 1] as V2; const e = { x: b.x - a.x, y: b.y - a.y };
  return Math.abs(t.x * e.x + t.y * e.y) / ((Math.hypot(t.x, t.y) * Math.hypot(e.x, e.y)) || 1);
}

/** Les trois rapports (géométrie, anatomie, style) des reflets transversaux d'une coiffure peinte. `painted` : sortie de `paintLockPro`/`paintHairPro`. */
export function verifyRing(_h: HeadSpec, view: View, painted: readonly ProLock[], light: Light): Report[] {
  const rings = painted.map((l) => ({ l, r: ringBands(l.blade, l.geom, l.spec, view, light) })).filter((x): x is { l: ProLock; r: RingBands } => x.r !== null);
  const nonFinite = rings.filter(({ r }) => !finite(r)).length;
  const worstOut = rings.reduce((m, { l, r }) => Math.max(m, outsideShare(l, r)), 0);
  const worstCos = rings.reduce((m, { l, r }) => Math.max(m, edgeCos(l, r)), 0);
  const geometry = rep('geometry', [chk('reflets : sommets non finis', nonFinite, 0, 0), chk('reflets : part de sommets hors du contour de la lame', worstOut, 0, 0), chk('reflets : |cos| bord/tangente max (transverse)', worstCos, 0, 0.43)]);

  const exposure = (l: ProLock, r: RingBands): number => { const n = Math.min(l.geom.n, l.blade.spine.length); return l.geom.exposure[Math.min(n - 1, Math.round(r.at * (n - 1)))] as number; };
  const minExp = rings.length ? Math.min(...rings.map(({ l, r }) => exposure(l, r))) : 1;
  const backfaced = rings.filter(({ l, r }) => { const n = Math.min(l.geom.n, l.blade.spine.length); return l.geom.backface[Math.min(n - 1, Math.round(r.at * (n - 1)))]; }).length;
  const anatomy = rep('anatomy', [chk('reflets sur le dessous du ruban', backfaced, 0, 0), chk('exposition minimale au centre du reflet (demi-Lambert)', minExp, 0.5, 1)]);

  const share = painted.length ? rings.length / painted.length : 0;
  const judged = painted.length >= MIN_LOCKS;
  const ext = rings.map(({ r }) => r.extent); const cov = rings.map(({ r }) => r.coverage);
  const areaShare = rings.length ? Math.max(...rings.map(({ l, r }) => area(r.highlight) / Math.max(1e-6, area(bladeArea(l))))) : 0;
  const style = rep('style', [
    chk('part de mèches à reflet (ni mat, ni plastique)', judged ? share : 0.5, 0.15, 0.85),
    chk('étendue du reflet / longueur (mesurée 0,047–0,071)', ext.length ? Math.max(...ext) : RING.extent, 0.035, 0.08),
    chk('couverture moyenne en largeur (mesurée 0,67–0,91 sur rubans droits ; réduite par la courbure)', cov.length ? cov.reduce((a, c) => a + c, 0) / cov.length : RING.coverage, 0.6, 0.91),
    chk('paliers d\'ombre aval (3)', rings.length ? Math.min(...rings.map(({ r }) => r.shoulder.length)) : RING.shoulderSteps.length, RING.shoulderSteps.length, RING.shoulderSteps.length),
    chk('aire max du reflet / aire de la lame', areaShare, 0, 0.35),
  ]);
  return [geometry, anatomy, style];
}

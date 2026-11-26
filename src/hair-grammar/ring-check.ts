import type { Blade } from './blade';
import type { Defect } from './lock-check';
import type { LockGeom } from './local-geometry';
import type { LockSpec } from './lock';
import type { ShadeSegment } from './ring-shade';
import type { RingBands } from './spec-ring';
import type { V2 } from './vec';

/**
 * CONTRÔLES D'UN REFLET TRANSVERSAL, mèche par mèche (module partagé par `verify-ring.ts`, qui juge une coiffure, et par `paint-pro.ts`, qui s'en sert comme garde de rendu).
 * Séparé de `verify-ring.ts` parce que celui-ci importe `INK_PRO` de `paint-pro.ts` : l'importer en retour aurait créé un cycle. Ne dépend que de types.
 */
export interface RingHost { readonly spec: LockSpec; readonly blade: Blade; readonly geom: LockGeom }
/** Part maximale de sommets d'ombre hors de la lame tolérée (ingénierie ; mesuré : 1 sommet sur ~40 au pire). */
export const SHADE_OUTSIDE_MAX = 0.1;
export const area = (poly: readonly V2[]): number => { let a = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i] as V2; const q = poly[(i + 1) % poly.length] as V2; a += p.x * q.y - q.x * p.y; } return Math.abs(a) / 2; };
export const bladeArea = (l: RingHost): V2[] => [...l.blade.left, ...[...l.blade.right].reverse()];
export const finite = (r: RingBands): boolean => [...r.highlight, ...r.shoulder.flat(), ...r.shade.flatMap((s) => [...s.poly, s.from, s.to])].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)) && [r.at, r.strength, r.extent, r.coverage, ...r.shade.flatMap((s) => [s.w0, s.w1])].every(Number.isFinite);

const cross = (a: V2, b: V2, p: V2): number => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
const inTri = (a: V2, b: V2, c: V2, p: V2): boolean => { const d1 = cross(a, b, p); const d2 = cross(b, c, p); const d3 = cross(c, a, p); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); };
/**
 * Point couvert par la lame ? UNION des tranches (quadrilatère gauche[i], gauche[i+1], droite[i+1], droite[i]) et non test pair/impair sur le contour : une mèche qui se replie sur elle-même
 * (spine qui revient près de sa racine) recouvre sa propre surface, et un test pair/impair y déclarait « dehors » un point pourtant peint (faux positif relevé sur une mèche « mass » repliée).
 */
export function covered(l: RingHost, p: V2): boolean {
  const { left, right } = l.blade;
  for (let i = 0; i < left.length - 1; i++) { const a = left[i] as V2; const b = left[i + 1] as V2; const c = right[i + 1] as V2; const d = right[i] as V2; if (inTri(a, b, c, p) || inTri(a, c, d, p)) return true; }
  return false;
}
/** Part des sommets du reflet qui sortent de la surface peinte de la lame (gauche/droite émis), et non d'une demi-largeur recalculée : la lame est la vérité de ce qui est peint. */
export function outsideShare(l: RingHost, r: RingBands): number { return r.highlight.filter((p) => !covered(l, p)).length / r.highlight.length; }

/** Part des sommets de l'ombre lisse hors de la surface peinte de la lame (mesuré passe 8 : 9 sommets sur 17 956, un par mèche, sur 462 ombres). */
export function shadeOutsideShare(l: RingHost, r: RingBands): number { const v = r.shade.flatMap((s) => s.poly); return v.length ? v.filter((p) => !covered(l, p)).length / v.length : 0; }
/** Rupture de continuité de l'ombre lisse : plus grand écart, entre un segment et le suivant, de position (px) ou de poids (0–1). 0 = les segments se raccordent exactement. */
export function shadeBreak(r: RingBands): number { let m = 0; for (let i = 1; i < r.shade.length; i++) { const a = r.shade[i - 1] as ShadeSegment; const b = r.shade[i] as ShadeSegment; m = Math.max(m, Math.hypot(a.to.x - b.from.x, a.to.y - b.from.y), Math.abs(a.w1 - b.w0)); } return m; }
/** Plus forte REMONTÉE du poids le long de l'ombre (0 = l'ombre ne se creuse jamais en s'éloignant du reflet) : une ombre qui s'assombrit plus loin n'est pas une ombre portée. */
export function shadeRise(r: RingBands): number { let m = 0; for (const s of r.shade) m = Math.max(m, s.w1 - s.w0); for (let i = 1; i < r.shade.length; i++) m = Math.max(m, (r.shade[i] as ShadeSegment).w0 - (r.shade[i - 1] as ShadeSegment).w1); return Math.max(0, m); }
/** Plus forte variation de poids entre deux bords d'un segment : la « dureté » du dégradé (un palier de la passe 7 valait 0,27 à 0,40 ; le profil mesuré, 0,19 au plus). */
export function shadeSlope(r: RingBands): number { return r.shade.reduce((m, s) => Math.max(m, Math.abs(s.w1 - s.w0)), 0); }

/** |cos| entre le bord de la bande (premier au dernier sommet du bord haut) et la tangente de la spine au centre : 0 = parfaitement transverse. */
export function edgeCos(l: RingHost, r: RingBands): number {
  const sp = l.blade.spine; const cum = [0]; for (let i = 1; i < sp.length; i++) cum.push((cum[i - 1] as number) + Math.hypot((sp[i] as V2).x - (sp[i - 1] as V2).x, (sp[i] as V2).y - (sp[i - 1] as V2).y));
  const target = r.at * (cum[cum.length - 1] as number); let i = 0; while (i < sp.length - 2 && (cum[i + 1] as number) < target) i++;
  const t = { x: (sp[i + 1] as V2).x - (sp[i] as V2).x, y: (sp[i + 1] as V2).y - (sp[i] as V2).y };
  const half = (r.highlight.length / 2) | 0; const a = r.highlight[0] as V2; const b = r.highlight[half - 1] as V2; const e = { x: b.x - a.x, y: b.y - a.y };
  return Math.abs(t.x * e.x + t.y * e.y) / ((Math.hypot(t.x, t.y) * Math.hypot(e.x, e.y)) || 1);
}


/**
 * Fautes du reflet de CHAQUE mèche, en `Defect` localisés. Mêmes seuils que `verifyRing` (la vérification globale reste la référence) ; sévérité 1 = reflet à ne pas dessiner.
 * Garde de rendu : `paintLockPro` consulte `ringIsSane`, une mèche en faute garde son rendu SANS reflet transversal (le reflet est décoratif : l'omettre ne casse rien, le dessiner faux si).
 */
export function ringDefects(l: RingHost, r: RingBands): Defect[] {
  const id = l.spec.id; const family = l.spec.family; const D: Defect[] = [];
  const add = (code: string, layer: Defect['layer'], severity: number, detail: string): void => { D.push({ code, layer, lock: id, family, severity, detail }); };
  if (!finite(r)) return [{ code: 'ring.finite', layer: 'geometry', lock: id, family, severity: 3, detail: 'sommet de reflet non fini' }];
  const out = outsideShare(l, r); if (out > 0) add('ring.outside', 'geometry', 1, `${(100 * out).toFixed(0)} % des sommets hors de la lame`);
  // Ombre lisse : seuil de 10 % des sommets (un sommet sur 40 déborde sur 2 % des mèches : liseré d'un pixel, toléré) ; continuité et monotonie exactes.
  const so = shadeOutsideShare(l, r); if (so > SHADE_OUTSIDE_MAX) add('ring.shade.outside', 'geometry', 1, `${(100 * so).toFixed(0)} % des sommets d'ombre hors de la lame`);
  const br = shadeBreak(r); if (br > 1e-6) add('ring.shade.continuity', 'geometry', 1, `rupture entre segments d'ombre (${br.toExponential(1)})`);
  const rise = shadeRise(r); if (rise > 1e-9) add('ring.shade.monotone', 'style', 1, `l'ombre se creuse en s'éloignant du reflet (+${rise.toFixed(3)})`);
  const c = edgeCos(l, r); if (c > 0.43) add('ring.transverse', 'geometry', 1, `bord non transverse (|cos| ${c.toFixed(2)})`);
  const n = Math.min(l.geom.n, l.blade.spine.length); const k = Math.min(n - 1, Math.round(r.at * (n - 1)));
  if (l.geom.backface[k]) add('ring.backface', 'anatomy', 1, 'reflet sur le dessous du ruban');
  else if ((l.geom.exposure[k] as number) < 0.5) add('ring.exposure', 'anatomy', 1, `exposition ${(l.geom.exposure[k] as number).toFixed(2)} < 0,5`);
  const a = area(r.highlight) / Math.max(1e-6, area(bladeArea(l))); if (a > 0.35) add('ring.area', 'style', 1, `reflet = ${(100 * a).toFixed(0)} % de la lame`);
  return D;
}

/** Vrai si le reflet de cette mèche ne porte aucun défaut : condition pour le dessiner. */
export const ringIsSane = (l: RingHost, r: RingBands): boolean => ringDefects(l, r).length === 0;

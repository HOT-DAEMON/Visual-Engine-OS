import { DEFAULT_HEAD } from '../head';
import { range as R, type FamilySpec, type HairProfile } from '../grammar';
import { backCover, himeFrame } from './frame';
import { HIME } from './hime';
import { v3, type V3 } from '../vec';

/**
 * Coupes à CHIGNONS (données seulement, MÊME générateur que les autres coupes). Cible : référence 04 (deux chignons hauts, frange pleine à bord franc, mèches latérales
 * longues), mesurée par `scripts/hair-grammar/measure-buns.py` (docs/HAIR-BUNS.md) : rayon extérieur ≈ 0,20 Hc, centre à ≈ ±0,25 Hc de l'axe, au niveau du sommet du crâne.
 *
 * Un chignon n'est pas un objet nouveau : c'est une famille de mèches COURTES, LARGES, qui partent toutes du nœud, rayonnent autour de lui (champ d'écoulement local :
 * `FamilySpec.field` = tourbillon centré sur le nœud, `radial` + `swirl`) et dont le décollement tombe de `lift0` (sommet du chignon) à 0 au bord (`liftPow` 2 : profil en dôme
 * 1 − t²). Vu de face, ces arcs dessinent un disque bombé posé sur le crâne ; vu de côté, une demi-sphère.
 */
const ROOT = (h = DEFAULT_HEAD, el: number, az: number): V3 => {
  const e = (el * Math.PI) / 180; const a = (az * Math.PI) / 180;
  return v3(h.rx * Math.cos(e) * Math.sin(a), -h.ry * Math.sin(e), h.cz + h.rz * Math.cos(e) * Math.cos(a));
};
const base = { follow: 1, fan: 0.1, bend: R(0, 0.06), waveAmp: R(0, 0.05), waveFreq: R(1, 1.6), flickAmt: R(0, 0.06), flickLen: R(0.1, 0.2), liftPow: R(2, 2.4), gravity: R(0, 0.05), peak: R(0.45, 0.6), taper: R(0.8, 1.1), tone: R(-0.2, 1), strands: R(1, 3), layer: 'auto' as const };

export interface BunSpec { readonly id: string; readonly el: number; readonly az: number; readonly count: number; readonly radius: number; readonly height: number; readonly swirl: number }

/**
 * « Chignon » = DEUX familles posées au même nœud. (1) `<id>Body` : un corps opaque, des pales larges à bout rond (`taper` < 1) qui rayonnent autour du nœud et font un disque plein
 * (sans lui, le dessin radial de mèches fines laissait voir le crâne entre les rayons : un chignon « en étoile », vu sur la première planche). (2) `<id>` : des mèches plus fines en spirale
 * (`swirl`) posées dessus, qui donnent l'enroulement. `radius` = portée au sol (H), `height` = sommet du dôme au-dessus de la coque (H).
 */
export function bunFamily(b: BunSpec): FamilySpec[] {
  const knot = ROOT(DEFAULT_HEAD, b.el, b.az); const root = { el: R(b.el - 2, b.el + 2), az: R(b.az - 3, b.az + 3) };
  const body: FamilySpec = {
    ...base, id: `${b.id}Body`, count: Math.max(16, Math.round(b.count * 0.65)), ...root, fan: 0.04,
    field: { whorl: knot, sweep: v3(0, 0, 0), swirl: b.swirl * 0.2, radial: 1, fall: 0 },
    length: R(b.radius * 0.92, b.radius * 1.0), width: R(b.radius * 0.9, b.radius * 1.1), peak: R(0.5, 0.6), taper: R(0.6, 0.75),
    lift0: R(b.height * 0.8, b.height * 0.9), lift1: R(0.005, 0.015), tone: R(-0.3, 0.2), strands: R(0, 1),
  };
  const coil: FamilySpec = {
    ...base, id: b.id, count: b.count, ...root,
    field: { whorl: knot, sweep: v3(0, 0, 0), swirl: b.swirl, radial: 0.8, fall: 0 }, bend: R(0.1, 0.35),
    length: R(b.radius * 0.7, b.radius * 0.92), width: R(b.radius * 0.25, b.radius * 0.35), taper: R(0.6, 0.8),
    lift0: R(b.height * 0.95, b.height * 1.1), lift1: R(0.01, 0.025),
  };
  return [body, coil];
}

const KEEP = ['dome', 'fringeLow', 'fringeHigh', 'fringeTop', 'templeL', 'templeR', 'underL', 'underR', 'sideL', 'sideR'];
/** Chignon HAUT : les côtés sont tirés vers le nœud, donc pas de nappes `under` (elles font un carré) ; seules les mèches de joue encadrent le visage. */
const KEEP_UP = KEEP.filter((k) => !k.startsWith('under'));
const fromHime = (keep: readonly string[] = KEEP): FamilySpec[] => himeFrame(keep, 1.6);

export const DOUBLE_BUNS: HairProfile = {
  name: 'double_buns', head: DEFAULT_HEAD,
  field: HIME.field,
  families: [...fromHime(), backCover(), ...bunFamily({ id: 'bunL', el: 61, az: -83, count: 28, radius: 0.18, height: 0.2, swirl: 0.5 }), ...bunFamily({ id: 'bunR', el: 61, az: 83, count: 28, radius: 0.18, height: 0.2, swirl: -0.5 })],
};

/** Chignon haut unique (« top-knot ») : nœud sur le sommet, un peu en arrière ; cadre de visage de la hime (frange + mèches latérales). Cible : références 21, 12, 48. */
export const TOP_BUN: HairProfile = {
  name: 'top_bun', head: DEFAULT_HEAD, field: HIME.field,
  families: [...fromHime(KEEP_UP), backCover(), ...bunFamily({ id: 'bun', el: 80, az: 180, count: 34, radius: 0.24, height: 0.26, swirl: 0.55 })],
};

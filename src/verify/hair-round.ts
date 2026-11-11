import { faceLandmarks, type FaceLandmarks } from '../face';
import { hairGeometry, type HairGeometry } from '../face/hair';
import { shellCoverage } from '../face/hair/crown-fill';
import { spineLength } from '../face/hair/fringe-split';
import type { Poly } from '../face/poly';
import type { RandomFace } from '../generation/random-face';
import { check, type Check } from './types';

/**
 * VÉRIFICATION DE LA FORME RONDE DES VOLUMES ET DES FRANGES (`docs/HAIR-ROUND.md`, `docs/HAIR-FRINGE-ASPECT.md`), trois couches. Seuils issus de mesures
 * (40 visages par coiffure, graines 9000 + 71 k ; valeurs et marges dans `docs/HAIR-ROUND-VERIFY.md`) :
 *  - géométrie : un afro / bouclé est une masse RONDE CENTRÉE sur le crâne — asymétrie gauche/droite de la coque et décalage du sommet bornés ;
 *  - anatomie  : la masse reste proportionnée au crâne (largeur de la masse / largeur de la tête, élévation du dôme au-dessus du crâne) et les deux moitiés de la coque sont garnies de façon comparable ;
 *  - style     : aucune frange en « triangles trapus » (mèche plus large que longue : rapport largeur / longueur) ; la coque n'est pas nue sur plus de la part tolérée (éclaircissement voulu mis à part, en avertissement).
 */
export const ROUND_LIMITS = {
  /** |demi-largeur droite − gauche| / somme : 0 = dôme centré. */
  lop: 0.05,
  /** Décalage horizontal du sommet de la masse / W. */
  topOff: 0.1,
  /** Écart de part nue entre les moitiés gauche et droite de la coque. */
  bareGap: 0.25,
  /** Largeur de la masse / largeur de la tête (borne basse : une masse plus étroite que la tête n'est plus un volume ; borne haute : démesure). */
  widthMin: 1.0,
  widthMax: 1.8,
  /** Élévation du dôme au-dessus du sommet du crâne, en hauteur de tête. */
  riseMax: 0.4,
  /** Part des mèches de frange plus larges que longues (rapport > 1) tolérée par visage. */
  fringeWideShare: 0.35,
  /** Rapport maximal largeur / longueur de n'importe quelle mèche de frange. */
  fringeAspectMax: 3.0,
} as const;

export const VOLUME_STYLES = ['afro', 'curly'] as const;

export interface RoundMetrics {
  readonly lop: number;
  readonly topOff: number;
  readonly bareGap: number;
  readonly width: number;
  readonly rise: number;
}

/** Mesures de la masse (`geo.base[0]`) : asymétrie, décalage du sommet, écart de part nue entre moitiés, proportions par rapport à la tête. */
export function roundMetrics(geo: HairGeometry, lm: FaceLandmarks): RoundMetrics {
  const base = geo.base[0] as Poly;
  let mxR = 0, mxL = 0, topY = Infinity, topX = 0;
  for (const v of base) {
    if (v.x > 0) mxR = Math.max(mxR, v.x); else mxL = Math.max(mxL, -v.x);
    if (v.y < topY) { topY = v.y; topX = v.x; }
  }
  const polys = geo.locks.filter((l) => l.layer === 'front' && l.rank !== 'hairline').map((l) => l.poly);
  const half = (sg: 1 | -1): number => {
    const clip = (p: Poly): Poly => p.map((v) => ({ x: sg * Math.max(0, sg * v.x), y: v.y }));
    return shellCoverage(geo.boundary.skull, clip(base), lm.W, polys.map(clip)).all;
  };
  const headTop = -lm.H / 2; // sommet du crâne : le haut du cadre de la tête (repère centré)
  return { lop: Math.abs(mxR - mxL) / Math.max(1e-9, mxR + mxL), topOff: Math.abs(topX) / lm.W, bareGap: Math.abs(half(-1) - half(1)), width: (mxR + mxL) / lm.W, rise: (headTop - topY) / lm.H };
}

export interface FringeAspect {
  readonly n: number;
  /** Part des mèches de frange de rapport largeur / longueur > 1. */
  readonly wideShare: number;
  readonly max: number;
}

/** Rapport largeur de base / longueur de ligne médiane de chaque mèche de frange (`bang`) : un triangle trapu a un rapport > 1. */
export function fringeAspect(geo: HairGeometry): FringeAspect {
  const a: number[] = [];
  for (const l of geo.locks) {
    if (!l.bang || !l.spine || !l.w0) continue;
    const len = spineLength(l.spine);
    if (len > 1e-6) a.push(l.w0 / len);
  }
  return { n: a.length, wideShare: a.length ? a.filter((x) => x > 1).length / a.length : 0, max: a.length ? Math.max(...a) : 0 };
}

/** `override` : géométrie à contrôler à la place de celle du visage (contrôles négatifs des tests). */
export function checkHairRound(face: RandomFace, override?: HairGeometry): Check[] {
  const p = face.params;
  if (p.hair.style === 'bald') return [];
  const lm = faceLandmarks(p, face.width, face.height);
  const geo = override ?? hairGeometry(p, lm);
  if (!geo) return [];
  const L = ROUND_LIMITS;
  const out: Check[] = [];
  if ((VOLUME_STYLES as readonly string[]).includes(p.hair.style) && geo.base[0]) {
    const m = roundMetrics(geo, lm);
    out.push(check('geometry', 'round-dome-centered', '<=', m.lop, L.lop, 'la masse est penchée : une moitié plus large que l\'autre'));
    out.push(check('geometry', 'round-top-centered', '<=', m.topOff, L.topOff, 'le sommet de la masse est décentré par rapport au crâne'));
    out.push(check('anatomy', 'round-width-ratio', '>=', m.width, L.widthMin, 'la masse est plus étroite que la tête : ce n\'est pas un volume'));
    out.push(check('anatomy', 'round-width-max', '<=', m.width, L.widthMax, 'la masse est démesurée par rapport à la tête'));
    out.push(check('anatomy', 'round-rise', '<=', m.rise, L.riseMax, 'le dôme s\'élève trop haut au-dessus du crâne'));
    out.push(check('style', 'round-bare-balance', '<=', m.bareGap, L.bareGap, 'une moitié de la coque est nettement plus nue que l\'autre', 'warn'));
  }
  const fr = fringeAspect(geo);
  if (fr.n > 0) {
    out.push(check('style', 'fringe-wide-share', '<=', fr.wideShare, L.fringeWideShare, 'trop de mèches de frange plus larges que longues (triangles trapus)', 'warn'));
    out.push(check('style', 'fringe-aspect-max', '<=', fr.max, L.fringeAspectMax, 'une mèche de frange est un bloc trois fois plus large que long', 'warn'));
  }
  return out;
}

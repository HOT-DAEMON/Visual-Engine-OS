import { faceLandmarks } from '../face';
import { hairGeometry, type HairGeometry } from '../face/hair';
import { RIM } from '../face/hair/rim';
import { inPoly } from '../face/poly';
import { distanceOutsideSkull } from '../face/hair/thickness';
import type { RandomFace } from '../generation/random-face';
import { check, type Check } from './types';

/**
 * VÉRIFICATION DE LA LISIÈRE EXTÉRIEURE ET DE LA RETOMBÉE (`docs/HAIR-EDGE.md`), trois couches. Mesures reproductibles, seuils issus de mesures
 * sur 60 visages par coiffure (voir le document ; dépassement : max mesuré 0,049 W sur 60 visages et 30 graines déformées (tresses `plait` : ruban en bombement après rognage sommet par sommet) ; tolérance `margin + 0,04`) :
 *  - géométrie : afro / bouclé — aucun sommet de mèche (hors duvet `wisp`) ne dépasse la coque de plus de `RIM.margin` au-dessus des sourcils ; sommets finis ;
 *  - anatomie  : coiffures pendantes — la chevelure ne s'évase pas sous la mâchoire au-delà de la largeur du crâne (elle converge vers le cou) ;
 *  - style     : silhouette des volumes — nombre de « dents » (secteurs de 5° où le rayon de la silhouette fait un à-coup > 3,5 % W), borné.
 */
const SECTORS = 36;
/** Rayon maximal de la silhouette (hors duvet) par secteur de 5° au-dessus des sourcils, centre = hauteur de tempe. Utilisé par le contrôle ET par les scripts de preuve. */
export function silhouetteProfile(geo: HairGeometry, W: number, cy: number, browY: number): number[] {
  void W;
  const bins = new Array<number>(SECTORS).fill(0);
  for (const l of geo.locks) {
    if (l.kind === 'wisp' || l.kind === 'cheek' || l.layer === 'over') continue;
    for (const q of l.poly) {
      if (q.y > browY) continue;
      const a = Math.atan2(cy - q.y, q.x);
      if (a < 0 || a > Math.PI) continue;
      const k = Math.min(SECTORS - 1, Math.floor((a / Math.PI) * SECTORS));
      bins[k] = Math.max(bins[k] as number, Math.hypot(q.x, q.y - cy));
    }
  }
  return bins;
}

/** Nombre de dents : secteurs intérieurs dont la dérivée seconde du rayon dépasse `0,035 W`. */
export function toothCount(bins: number[], W: number): number {
  let t = 0;
  for (let i = 1; i < bins.length - 1; i++) if (Math.abs((bins[i - 1] as number) - 2 * (bins[i] as number) + (bins[i + 1] as number)) > 0.035 * W) t++;
  return t;
}

/** Distance maximale (en largeur de tête) d'un sommet de mèche (hors duvet, hors crâne : la frange du front n'est pas la lisière du volume) à l'extérieur de la coque, au-dessus des sourcils. */
export function maxBeyondRim(geo: HairGeometry, W: number, browY: number): number {
  const base = geo.base[0];
  const skull = geo.boundary.skull;
  if (!base) return 0;
  let worst = 0;
  for (const l of geo.locks) {
    if (l.kind === 'wisp' || l.kind === 'cheek' || l.layer !== 'front') continue;
    for (const v of l.poly) {
      if (v.y > browY || inPoly(base, v.x, v.y) || distanceOutsideSkull(skull, v) === 0) continue;
      let d = Infinity;
      for (let i = 0; i < base.length; i++) {
        const a = base[i] as { x: number; y: number }, b = base[(i + 1) % base.length] as { x: number; y: number };
        const vx = b.x - a.x, vy = b.y - a.y, L2 = vx * vx + vy * vy || 1e-9;
        const t = Math.max(0, Math.min(1, ((v.x - a.x) * vx + (v.y - a.y) * vy) / L2));
        d = Math.min(d, Math.hypot(v.x - a.x - t * vx, v.y - a.y - t * vy));
      }
      worst = Math.max(worst, d / W);
    }
  }
  return worst;
}

/**
 * CONVERGENCE vers le cou : demi-largeur maximale du QUART INFÉRIEUR de la chevelure pendante (de la mâchoire à la pointe la plus basse) divisée par la demi-largeur maximale
 * juste sous la mâchoire (de `jawY` à `jawY + 0,10 H`). < 1 : la chevelure converge ; > 1 : elle s'évase vers le bas (silhouette de rideau rectangulaire ou de cloche).
 */
export function lowerFlare(geo: HairGeometry, jawY: number, H: number): number {
  let bottom = jawY;
  for (const l of geo.locks) if (l.kind !== 'wisp' && l.layer !== 'over') for (const q of l.poly) bottom = Math.max(bottom, q.y);
  const y0 = bottom - 0.25 * (bottom - jawY);
  let top = 1e-6, low = 0;
  for (const l of geo.locks) {
    if (l.kind === 'wisp' || l.layer === 'over') continue;
    for (const q of l.poly) {
      if (q.y >= jawY && q.y <= jawY + 0.1 * H) top = Math.max(top, Math.abs(q.x));
      if (q.y >= y0) low = Math.max(low, Math.abs(q.x));
    }
  }
  return low / top;
}

/** `override` : géométrie à contrôler à la place de celle du visage (contrôles négatifs des tests). */
export function checkHairEdge(face: RandomFace, override?: HairGeometry): Check[] {
  const p = face.params;
  if (p.hair.style === 'bald') return [];
  const lm = faceLandmarks(p, face.width, face.height);
  const geo = override ?? hairGeometry(p, lm);
  if (!geo) return [];
  const { W, H } = lm;
  const out: Check[] = [];
  out.push(check('geometry', 'edge-finite', '==', geo.locks.every((l) => l.poly.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y))) ? 1 : 0, 1, 'un sommet de mèche n\'est pas un nombre fini'));
  const rim = RIM[p.hair.style as keyof typeof RIM];
  if (rim) {
    out.push(check('geometry', 'edge-rim-bound', '<=', maxBeyondRim(geo, W, lm.browLimitY), rim.margin + 0.04, 'une mèche dépasse la coque du volume de plus que la marge de lisière'));
    out.push(check('style', 'edge-rim-teeth', '<=', toothCount(silhouetteProfile(geo, W, lm.hair.sideY, lm.browLimitY), W), 16, 'silhouette du volume en dents de scie', 'warn'));
  }
  if (p.hair.style === 'long' || p.hair.style === 'bob') {
    out.push(check('anatomy', 'edge-hem-converges', '<=', lowerFlare(geo, lm.jawY, H), 1.0, 'le bas de la chevelure est plus large qu\'à la mâchoire (pas de convergence vers le cou)', 'warn'));
  }
  return out;
}

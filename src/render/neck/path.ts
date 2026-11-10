import { num } from '../../core/svg';
import { catmullRom } from '../../face/curve';
import { frontSilhouette } from '../../neck/geometry';
import type { NeckModel, P2 } from '../../neck/types';

/**
 * Contour du cou : projection de face des sections (`frontSilhouette`) — la SEULE source du contour, lue aussi par les ombres de contact
 * (récepteur du cou) : l'ombre de la mâchoire suit donc exactement le cou déformé. Lisse (Catmull-Rom) ; si l'angularité de style dépasse 0,35,
 * polygone à facettes dont le nombre de sommets décroît avec l'angularité (sculpture, anime). Base arrondie, haut fermé derrière la tête.
 */
export function silhouetteRing(model: NeckModel): P2[] {
  const { left, right } = frontSilhouette(model);
  const ang = model.composition.morphology.angularity;
  const pick = (a: readonly P2[]): P2[] => {
    if (ang <= 0.35) return [...a];
    const k = Math.max(4, Math.round(24 - 20 * ang)), out: P2[] = [];
    for (let j = 0; j <= k; j++) out.push(a[Math.round((j / k) * (a.length - 1))]!);
    return out;
  };
  const l = pick(left), r = pick(right), H = model.ctx.H, yb = l[l.length - 1]!.y;
  const smooth = ang <= 0.35;
  const side = (a: P2[]): P2[] => (smooth ? catmullRom(a, false, 4) : a);
  // Base : on garde l'évasement jusqu'à 0,012 H de la base, puis un congé de 6 % de la largeur (pas de pointe au coin).
  const k = 0.012 * H, w = r[r.length - 1]!.x - l[l.length - 1]!.x, c = 0.06 * w;
  const L = side(l).filter((p) => p.y < yb - k), R = side(r).filter((p) => p.y < yb - k);
  const ll = l[l.length - 1]!, rr = r[r.length - 1]!;
  return [...L, { x: ll.x, y: yb - k }, { x: ll.x + c, y: yb }, { x: rr.x - c, y: yb }, { x: rr.x, y: yb - k }, ...R.reverse()];
}

export function silhouettePath(model: NeckModel): string {
  const ring = silhouetteRing(model);
  return `M${ring.map((p) => `${num(p.x)} ${num(p.y)}`).join('L')}Z`;
}

/**
 * Arêtes RÉELLES du cou (repère du visage) lues par les autres composants du visage : anneau du contour (sections déformées) et les deux bords entre le menton et
 * la base. Ils remplaçaient un rectangle de largeur constante (`±lm.neck.half`) : la lumière de contour du cou, tracée sur ce rectangle, restait droite
 * (strie verticale) alors que le cou s'évase, se tord ou s'incline. Source unique : `frontSilhouette`.
 */
export function neckEdges(model: NeckModel): { ring: P2[]; left: P2[]; right: P2[] } {
  const { left, right } = frontSilhouette(model), top = model.ctx.chinY;
  // Entre le menton et la BASE du cou : plus bas, la silhouette s'évase sur l'épaule et c'est le contour du corps qui prend le relais (une lumière de contour du cou y dessinait une courbe fantôme hors des épaules).
  const bottom = model.ctx.chinY + (model.composition.morphology.topY + model.composition.morphology.lengthPx - model.ctx.chinY);
  const from = (a: readonly P2[]): P2[] => { const k = a.findIndex((p) => p.y >= top); return a.slice(Math.max(0, k)).filter((p) => p.y <= bottom); };
  return { ring: silhouetteRing(model), left: from(left), right: from(right) };
}

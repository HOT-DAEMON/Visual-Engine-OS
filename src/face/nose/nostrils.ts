import { clamp, clamp01 } from '../../core/math';
import { rotate } from '../curve';
import type { Vec } from '../../geometry/eye/primitives';
import type { FaceParams } from '../../schema';
import type { NoseFrame } from './frame';
import type { NostrilGeo } from './types';

/** Nombre de sommets du contour d'une narine. */
const N_POINTS = 28;

/**
 * Contour d'une narine : une GOUTTE (large en bas, effilée vers le haut) dans son repère propre (u le long de l'axe, de bas en haut ;
 * v perpendiculaire), puis tournée de `tilt`. Pour la narine droite, le haut converge vers la ligne médiane (rotation vers x < 0).
 */
function dropPoly(c: Vec, a: number, b: number, tiltDeg: number, side: -1 | 1): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; i < N_POINTS; i++) {
    const th = (2 * Math.PI * i) / N_POINTS;
    const u = a * Math.cos(th);
    // Demi-largeur en u : ellipse, élargie vers le bas (u < 0) de 35 % — c'est ce qui fait la goutte.
    const v = b * Math.sin(th) * (1 - 0.35 * (u / a));
    // Repère local → hôte : l'axe « vers le haut » est -y ; la rotation incline le haut vers l'intérieur.
    const r = rotate({ x: v, y: -u }, -side * tiltDeg);
    out.push({ x: c.x + r.x, y: c.y + r.y });
  }
  return out;
}

/**
 * Narines. Elles ont leur propre forme (`shape` : ronde → fente), leur orientation (`tiltDeg`), leur visibilité (dérivée de
 * l'orientation de la pointe : relevée → ouvertes, abaissée → cachées) et leur asymétrie. Elles sont bornées à la bande
 * pointe → base du nez : jamais deux points noirs posés n'importe où, toujours une ouverture située SOUS la pointe, dans l'aile.
 */
export function nostrilGeometry(p: FaceParams, F: NoseFrame): { left: NostrilGeo; right: NostrilGeo } {
  const n = p.nose;
  const o = n.nostrils;
  const band = F.baseY - F.tipY;
  // Visibilité : imposée, ou dérivée de la rotation de la pointe (-1 → 0,1 ; 0 → 0,55 ; +1 → 1).
  const vis = o.visibility ?? clamp01(0.55 + 0.45 * n.tip.rotation);
  const scale = 0.35 + 0.65 * vis;
  const make = (side: -1 | 1): NostrilGeo => {
    // Asymétrie : la narine du côté positif grandit, l'autre rétrécit (±25 %) et s'incline de ±6°.
    const k = 1 + 0.25 * o.asymmetry * side;
    const a = Math.min(F.nw * (0.07 + 0.07 * n.nostril) * scale * k, 0.42 * band + 0.002 * F.H);
    const b = a * (1 - 0.62 * o.shape);
    const tilt = clamp(o.tiltDeg + 6 * o.asymmetry * side, 0, 55);
    const c: Vec = { x: side * (F.colHalf + b * 1.15 + F.nw * 0.025), y: F.baseY - 0.001 * F.H - 0.9 * a };
    return { side, c, a, b, tiltDeg: tilt, poly: dropPoly(c, a, b, tilt, side) };
  };
  return { left: make(-1), right: make(1) };
}

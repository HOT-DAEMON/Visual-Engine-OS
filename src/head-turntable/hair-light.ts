import { dirToCam, dot, norm, v3 } from './math';
import { parseHex } from '../core/color';
import { toLab } from '../relief/oklab';
import { tonesOf, type LightModel, type Shade, type Tones } from '../relief/model';
import type { RGB } from './color';
import type { HeadTurnSpec, V3, View } from './types';

/**
 * ÉCLAIRAGE DES CHEVEUX de la tête en rotation (lecture du moteur `src/relief`, rien de nouveau côté lumière) :
 *  1. TONS PROPRES : ombre et lumière dérivées de la couleur des CHEVEUX, pas de la peau ; l'écart d'ombre est borné à 55 % de la clarté de la mèche (OKLab) — avant, une chevelure brune tombait à presque noir « par en dessous » (`LIGHT-HEAD3D-07.md`).
 *  2. BANDE DE BRILLANCE (Kajiya-Kay) : la lumière se réfléchit en bande perpendiculaire au brin ; le brin suit le méridien du crâne (du vertex vers la nuque), la bande épouse donc la courbure du crâne
 *     et se déplace avec la tête sous une lumière fixe — l'arc blanc des références (planches 02, 06, 07 d'éclairage ; `face/hair/sim/sheen.ts` pour le dessin de face).
 */
const CAP = 0.55;

/** Tons des cheveux sous `m` : ombre / cœur dérivés de la couleur des cheveux, écart ΔL borné. */
export function hairTones(spec: HeadTurnSpec, m: LightModel): Tones {
  const L = toLab(spec.palette.hair).L;
  return tonesOf(spec.palette.hair, { ...m, dL: Math.min(m.dL, CAP * L) });
}

/** Tangente du brin (repère tête) : la verticale projetée sur le plan tangent au crâne ; nulle (0) au sommet, où les brins rayonnent. */
export function strandTangent(nh: V3): V3 {
  const k = nh.y, t = v3(-k * nh.x, 1 - k * nh.y, -k * nh.z), l = Math.hypot(t.x, t.y, t.z);
  return l < 1e-4 ? v3(0, 0, 0) : norm(t);
}

/** Part 0 … 1 de la bande de brillance au pixel : tangente en repère caméra, demi-vecteur lumière-œil, seuil franc en cel, dégradé en peint ; masquée côté ombre. */
export function hairSheen(m: LightModel, nh: V3, y: number, view: View, s: Shade): number {
  const t = strandTangent(nh), len = Math.hypot(t.x, t.y, t.z);
  if (len < 0.5) return 0;
  const tc = dirToCam(t, view, 'head', y), hv = norm(v3(m.dir.x, m.dir.y, m.dir.z + 1)), th = dot(tc, hv), sinTH = Math.sqrt(Math.max(0, 1 - th * th));
  const band = m.style === 'soft' ? Math.max(0, (sinTH - 0.96) / 0.04) ** 3 : Math.min(1, Math.max(0, (sinTH - 0.99) / 0.005));
  return band * s.lit * Math.min(1, 2 * (len - 0.5)) * m.intensity;
}

/** Fusion `screen` de la brillance : la couleur de la source éclaircit la mèche (pas de blanc plaqué). */
export function sheenScreen(c: RGB, m: LightModel, amount: number): RGB {
  const lc = parseHex(m.color), k = 0.3 * amount;
  return [c[0] + (255 - c[0]) * k * (lc[0]! / 255), c[1] + (255 - c[1]) * k * (lc[1]! / 255), c[2] + (255 - c[2]) * k * (lc[2]! / 255)];
}

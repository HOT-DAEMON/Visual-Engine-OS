import { pair } from './atom';
import type { BodyFrame } from './frame';
import { at, halfAt } from './torso';
import type { Atom, BodyParams, V } from './types';

const ring = (c: V, rx: number, ry: number, n = 8): V[] => Array.from({ length: n }, (_, i) => ({ x: c.x + rx * Math.cos((2 * Math.PI * i) / n), y: c.y + ry * Math.sin((2 * Math.PI * i) / n) }));

/**
 * Sein (masse adipo-glandulaire), pli sous-mammaire, aréole, mamelon. GARDE-FOU DE CONCEPTION : avant 18 ans aucun atome `breast.*` n'est produit
 * (ni masse, ni aréole) ; seul un repère de mamelon neutre, identique pour tous les sexes, est posé (`torso.nipple`) — comme sur toute planche d'anatomie
 * d'un enfant. Volume = féminité effective (`−dimorphisme`, donc nulle avant la puberté) × curseur de volume × adiposité ; ptôse = curseur + âge.
 */
export function breastMass(f: BodyFrame, p: BodyParams): number {
  if (p.age < 18) return 0;
  const fem = Math.max(0, -f.dim);
  return Math.min(1, fem * (0.35 + 0.65 * p.breast.volume) * (0.8 + 0.5 * f.fat));
}

export function breasts(f: BodyFrame, p: BodyParams): Atom[] {
  const { h, y: Y } = f, mass = breastMass(f, p), pt = p.breast.ptosis;
  const yp = Y.nipple;
  if (mass < 0.04) return pair('torso.nipple', 'landmark', 'breasts', 'pec', 3, () => ring(at(f, 0.46, yp), 0.011 * h, 0.011 * h, 6));
  const r = 0.2 * h * (0.6 + 0.7 * mass), sag = 0.1 * h * pt * mass * (1 + 0.8 * f.sen);
  const cu = 0.46 * (1 + 0.25 * p.breast.spacing);
  const cx = at(f, cu, yp).x;
  const c: V = { x: cx, y: yp + 0.25 * r + sag * 0.4 };
  const proj = 0.85 + 0.3 * p.breast.projection;
  const cap = (q: V): V => ({ x: Math.min(q.x, halfAt(f, q.y) * 1.0), y: q.y });
  const body = (): V[] => Array.from({ length: 12 }, (_, i) => { const t = (2 * Math.PI * i) / 12, s = Math.sin(t); return cap({ x: c.x + r * proj * Math.cos(t), y: c.y + r * s * (s > 0 ? 1 + 0.35 * pt : 0.85) }); });
  const nip: V = { x: cx + 0.02 * r, y: yp + sag * 0.7 };
  const out: Atom[] = [];
  out.push(...pair('breast', 'fat', 'breasts', 'pec', 1, body, { tone: 0.12 }));
  out.push(...pair('breast.fold', 'line', 'breasts', 'breast', 3, () => Array.from({ length: 5 }, (_, i) => { const t = -0.9 + (1.8 * i) / 4; return cap({ x: c.x + r * proj * t, y: c.y + r * (1 + 0.35 * pt) * Math.sqrt(1 - t * t * 0.85) * 0.98 }); }), { open: true }));
  out.push(...pair('breast.areola', 'skin', 'breasts', 'breast', 3, () => ring(nip, 0.036 * h * (0.8 + 0.4 * mass), 0.036 * h * (0.8 + 0.4 * mass)), { tone: -0.25 }));
  out.push(...pair('breast.nipple', 'skin', 'breasts', 'breast.areola', 3, () => ring(nip, 0.011 * h, 0.011 * h, 6), { tone: -0.4 }));
  return out;
}

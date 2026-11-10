import type { Correction } from '../core/resolve';
import type { NeckSystem } from '../schema/neck-system';
import type { HeadContext, NeckMorphology } from './types';

/**
 * ACCESSOIRES ANNULAIRES et COLLISIONS (TODO §7, test « ajout d'accessoires ») : collier, écharpe et pointes occupent chacun une BANDE du cou (demi-hauteur
 * en `u`). Deux bandes qui se recouvrent ne peuvent pas coexister : le second accessoire est DÉPLACÉ juste en dessous du premier ; s'il ne tient plus sur le
 * cou il est ramené à la base et la correction est consignée (`attachment-collision`). Crête et collerette sont derrière le cou : hors de ce conflit.
 * NON-COLLISION AVEC LA MÂCHOIRE : le haut de la bande d'un accessoire annulaire ne peut pas passer au-dessus du menton (+ marge) ; au-dessus, le cou est derrière la tête et le
 * collier serait coupé ou ressortirait à travers la mâchoire. L'ancrage est ramené sous le menton (`attachment-jaw`), avant la résolution accessoire/accessoire.
 * Les accessoires restent indépendants du cou : seul leur ancrage (`at`) est corrigé, jamais la géométrie du cou.
 */
type Att = NeckSystem['attachments'][number];
const RING: readonly Att['kind'][] = ['collar', 'scarf', 'spikes'];
/** Marge (fraction de la longueur du cou) entre le menton et le haut de la bande d'un accessoire. */
export const JAW_MARGIN = 0.03;

/** Demi-hauteur de bande en fraction de la longueur du cou (mêmes formules que `render/neck/attach.ts`). */
export function halfBand(a: Att, ctx: HeadContext, m: NeckMorphology): number {
  const U = ctx.W / 300;
  const px = a.kind === 'spikes' ? a.size * 0.12 * ctx.H * 0.3 : (Math.max(4 * U, a.size * 0.1 * ctx.H) * (a.kind === 'scarf' ? 1.6 : 1)) / 2;
  return px / m.lengthPx;
}

export function resolveAttachments(list: NeckSystem['attachments'], ctx: HeadContext, m: NeckMorphology): { attachments: Att[]; corrections: Correction[] } {
  const corrections: Correction[] = [], out: Att[] = list.map((a) => ({ ...a }));
  const ring = out.map((a, i) => ({ a, i })).filter((r) => RING.includes(r.a.kind)).sort((p, q) => p.a.at - q.a.at || p.i - q.i);
  // Ligne du menton sur l'axe du cou (fraction de la longueur) : stations régulières avant déformation, donc linéaire en `y`.
  const chinU = Math.min(1, Math.max(0, (ctx.chinY - m.topY) / m.lengthPx));
  for (const r of ring) {
    const half = halfBand(r.a, ctx, m), floor = Math.min(1 - half, chinU + JAW_MARGIN + half), asked = r.a.at;
    if (r.a.at < floor) { r.a.at = floor; corrections.push({ id: 'attachment-jaw', param: `neck.system.attachments[${r.i}].at`, requested: asked, applied: floor, reason: 'bande d\'accessoire au-dessus du menton : ramenée sous la mâchoire (sans toucher au cou)' }); }
  }
  ring.sort((p, q) => p.a.at - q.a.at || p.i - q.i);
  let prev: { at: number; half: number } | null = null;
  for (const r of ring) {
    const half = halfBand(r.a, ctx, m), asked = r.a.at;
    if (prev && r.a.at - half < prev.at + prev.half) r.a.at = Math.min(1 - half, prev.at + prev.half + half + 0.004);
    if (prev && r.a.at - half < prev.at + prev.half - 1e-9) r.a.at = Math.min(1, prev.at + prev.half + half);
    if (r.a.at !== asked) corrections.push({ id: 'attachment-collision', param: `neck.system.attachments[${r.i}].at`, requested: asked, applied: r.a.at, reason: 'bandes d\'accessoires qui se recouvrent : déplacé sous le précédent (sans toucher au cou)' });
    prev = { at: r.a.at, half };
  }
  return { attachments: out, corrections };
}

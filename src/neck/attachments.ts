import type { Correction } from '../core/resolve';
import type { NeckSystem } from '../schema/neck-system';
import type { HeadContext, NeckMorphology } from './types';

/**
 * ACCESSOIRES ANNULAIRES et COLLISIONS (TODO §7, test « ajout d'accessoires ») : collier, écharpe et pointes occupent chacun une BANDE du cou (demi-hauteur
 * en `u`). Deux bandes qui se recouvrent ne peuvent pas coexister : le second accessoire est DÉPLACÉ juste en dessous du premier ; s'il ne tient plus sur le
 * cou il est ramené à la base et la correction est consignée (`attachment-collision`). Crête et collerette sont derrière le cou : hors de ce conflit.
 * Les accessoires restent indépendants du cou : seul leur ancrage (`at`) est corrigé, jamais la géométrie du cou.
 */
type Att = NeckSystem['attachments'][number];
const RING: readonly Att['kind'][] = ['collar', 'scarf', 'spikes'];

/** Demi-hauteur de bande en fraction de la longueur du cou (mêmes formules que `render/neck/attach.ts`). */
export function halfBand(a: Att, ctx: HeadContext, m: NeckMorphology): number {
  const U = ctx.W / 300;
  const px = a.kind === 'spikes' ? a.size * 0.12 * ctx.H * 0.3 : (Math.max(4 * U, a.size * 0.1 * ctx.H) * (a.kind === 'scarf' ? 1.6 : 1)) / 2;
  return px / m.lengthPx;
}

export function resolveAttachments(list: NeckSystem['attachments'], ctx: HeadContext, m: NeckMorphology): { attachments: Att[]; corrections: Correction[] } {
  const corrections: Correction[] = [], out: Att[] = list.map((a) => ({ ...a }));
  const ring = out.map((a, i) => ({ a, i })).filter((r) => RING.includes(r.a.kind)).sort((p, q) => p.a.at - q.a.at || p.i - q.i);
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

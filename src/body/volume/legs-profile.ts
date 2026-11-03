import type { LegFrame } from '../lower/frame';

/**
 * PROFIL DE LA PEAU DE LA JAMBE, le long du chemin hanche → cheville (s = distance depuis le haut de la cuisse `C0`, en px ; cuisse : 0…thigh, jambe : thigh…thigh+shin).
 * SOURCE COMMUNE de l'enveloppe (`legs.ts`) et des muscles (`legs-muscles.ts`) : les muscles se posent sur la surface réelle de la peau, ils ne recalculent aucune cote.
 *  a = demi-largeur ; k = rapport profondeur/largeur ; back = recul du centre (fraction de la profondeur) : le mollet gonfle vers l'ARRIÈRE, la cuisse vers l'avant.
 */
export interface LegRow { readonly s: number; readonly a: number; readonly k: number; readonly back: number }
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export function legRows(lf: LegFrame): LegRow[] {
  const { w } = lf, h = lf.body.h, th = lf.len.thigh, sh = lf.len.shin, r = (s: number, a: number, k: number, back: number): LegRow => ({ s, a, k, back });
  return [r(-0.14 * h, 0.9 * w.top, 1.3, 0), r(0, w.top, 1.22, -0.02), r(0.18 * th, lerp(w.top, w.mid, 0.4), 1.12, -0.03), r(0.5 * th, w.mid, 1.02, -0.03), r(0.85 * th, lerp(w.mid, w.knee, 0.7), 0.98, 0),
    r(th, w.knee * 1.02, 0.96, 0), r(th + 0.25 * sh, w.calf * 0.95, 1.12, 0.14), r(th + 0.62 * sh, lerp(w.calf, w.ankle, 0.6), 1.0, 0.06), r(th + sh, w.ankle * 1.05, 1.0, 0), r(th + sh + 0.02 * h, w.ankle * 0.55, 0.9, 0), r(th + sh + 0.035 * h, w.ankle * 0.15, 0.8, 0)];
}
const sm = (u: number): number => u * u * (3 - 2 * u);
/** Valeur du profil en `s` (même lissage que `loft` : interpolation de Hermite entre sections). */
export function legProf(rows: readonly LegRow[], s: number): { a: number; k: number; back: number } {
  const f = rows[0] as LegRow, l = rows[rows.length - 1] as LegRow;
  if (s <= f.s) return f; if (s >= l.s) return l;
  let i = 0; while (i < rows.length - 2 && s > (rows[i + 1] as LegRow).s) i++;
  const A = rows[i] as LegRow, B = rows[i + 1] as LegRow, q = sm((s - A.s) / (B.s - A.s));
  return { a: lerp(A.a, B.a, q), k: lerp(A.k, B.k, q), back: lerp(A.back, B.back, q) };
}

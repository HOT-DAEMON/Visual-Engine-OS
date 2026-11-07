import type { ResolvedAppearance } from '../../appearance';
import { el, num, urlRef } from '../../core/svg';
import { intensityFor } from '../../lighting/rig';
import type { LightVector } from '../../lighting/light';
import { gradientStop as stop } from '../../materials';
import { sectionPoint, surfaceNormal } from '../../neck/geometry';
import type { NeckModel } from '../../neck/types';

/**
 * Ombrage VOLUMÉTRIQUE du cou : le cou est découpé en bandes horizontales ; chaque bande reçoit un dégradé horizontal calculé depuis les NORMALES
 * réelles de sa section (Lambert : n·l). Aucun dégradé « fixe » : une torsion, une asymétrie, une courbure ou un autre angle de lumière changent l'ombrage.
 * Ton : base = peau assombrie par `neck.shade` (le cou est dans l'ombre du menton, comme l'historique), modulée par la lumière. Mode cel (anime) : 3 aplats.
 * La couleur vient de `ra.tone(…, skin)` : la MÊME peau et la MÊME apparence que la tête, le corps et les membres (cohérence de teinte).
 */
export interface BodyOut { readonly defs: string[]; readonly markup: string }

const BANDS = 14;

export function shadeBody(id: string, model: NeckModel, path: string, skin: string, ra: ResolvedAppearance, L: LightVector, shade: number): BodyOut {
  const S = model.stations, I = intensityFor(L, 'skin');
  const vBase = -(0.12 + 0.28 * shade), cel = ra.spec.shading?.mode === 'cel';
  const celTones = ra.cel(skin);
  const defs: string[] = [el('clipPath', { id: `${id}-clip` }, [el('path', { d: path })])];
  const bands: string[] = [el('path', { d: path, fill: ra.tone(vBase, skin) })];
  const idx = Array.from({ length: BANDS + 1 }, (_, k) => Math.round((k / BANDS) * (S.length - 1)));
  for (let b = 0; b < BANDS; b++) {
    const i0 = idx[b]!, i1 = idx[b + 1]!, im = Math.round((i0 + i1) / 2);
    const samples: { x: number; lit: number }[] = [];
    for (let k = 0; k <= 48; k++) {
      const psi = (k / 48) * 2 * Math.PI - Math.PI, n = surfaceNormal(model, im, psi);
      if (n.z <= 0.02) continue;
      samples.push({ x: sectionPoint(S[im]!, psi).x, lit: Math.max(0, n.x * L.x + n.y * L.y + n.z * L.z) });
    }
    if (samples.length < 3) continue;
    samples.sort((p, q) => p.x - q.x);
    const xl = samples[0]!.x, xr = samples[samples.length - 1]!.x, step = Math.max(1, Math.floor(samples.length / 12));
    const pick = samples.filter((_, k) => k % step === 0 || k === samples.length - 1);
    const colorOf = (lit: number): string => (cel ? (lit > 0.62 ? celTones.lit : lit > 0.28 ? celTones.shade : celTones.core) : ra.tone(vBase + 1.6 * I * (lit - 0.4), skin));
    const gid = `${id}-band-${b}`;
    defs.push(el('linearGradient', { id: gid, gradientUnits: 'userSpaceOnUse', x1: xl, y1: 0, x2: xr, y2: 0 }, pick.map((s) => stop((s.x - xl) / (xr - xl || 1), colorOf(s.lit), 1))));
    const top = S[i0]!, bot = S[i1]!, pad = b === BANDS - 1 ? 0 : 1.2;
    const w = (st: typeof top): [number, number] => { let lo = Infinity, hi = -Infinity; for (let k = 0; k < 24; k++) { const x = sectionPoint(st, (k / 24) * 2 * Math.PI - Math.PI).x; lo = Math.min(lo, x); hi = Math.max(hi, x); } return [lo - 0.5, hi + 0.5]; };
    const [tl, tr] = w(top), [bl, br] = w(bot);
    bands.push(el('path', { d: `M${num(tl)} ${num(top.y)}L${num(tr)} ${num(top.y)}L${num(br)} ${num(bot.y + pad)}L${num(bl)} ${num(bot.y + pad)}Z`, fill: urlRef(gid) }));
  }
  return { defs, markup: el('g', { 'clip-path': urlRef(`${id}-clip`) }, bands) };
}

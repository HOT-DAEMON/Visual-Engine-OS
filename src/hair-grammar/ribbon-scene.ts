import { ribbonPath, tonePath, type RibbonProfile } from './ribbon';

/** Palette de la scène au trait : encre, masses de ton (cel shading à 2 niveaux, comme la référence). */
export interface RibbonStyle { readonly ink: string; readonly tone1: string; readonly tone2: string; readonly paper: string; readonly widthScale: number; readonly minW: number }
export const RIBBON_STYLE: RibbonStyle = { ink: '#141414', tone1: '#e9e7e4', tone2: '#cfcdca', paper: '#ffffff', widthScale: 1, minW: 0.5 };

/** Scène complète : fond → masses de ton → rubans de visage → rubans de cheveux. SVG de chemins uniquement (aucun filtre). */
export function ribbonScene(P: RibbonProfile, view: { w: number; h: number; px: number }, st: RibbonStyle = RIBBON_STYLE, roles: ReadonlySet<string> = new Set(['hair', 'face'])): string {
  const f = P.frame;
  const tones = P.tones.map((t) => `<path d="${tonePath(t, f)}" fill="${t.level === 1 ? st.tone1 : st.tone2}"/>`).join('');
  const ink = P.ribbons.filter((r) => roles.has(r.role)).map((r) => ribbonPath(r, f, st.widthScale, st.minW)).filter(Boolean).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${view.w} ${view.h}" width="${view.w * view.px}" height="${view.h * view.px}"><rect width="100%" height="100%" fill="${st.paper}"/>${tones}<path d="${ink}" fill="${st.ink}"/></svg>`;
}

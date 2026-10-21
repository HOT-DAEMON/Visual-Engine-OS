import { el, urlRef } from '../../../core/svg';

/**
 * MODE DE RENDU `ink` (encrage noir et blanc) : un filtre SVG appliqué APRÈS le dessin. Il n'a aucune connaissance de l'anatomie : niveaux de gris, puis seuil
 * (tout ce qui est plus sombre que `threshold` devient noir, le reste blanc). C'est la preuve qu'une même géométrie peut recevoir un autre traitement sans être reconstruite.
 */
export function inkFilter(id: string, W: number, H: number, threshold = 0.7): { defs: string[]; ref: string } {
  const fid = `${id}-ink`;
  // Table discrète de 10 pas : les `n0` premiers pas valent 0 (noir), les suivants 1 (blanc) ; le seuil tombe à n0 / 10.
  const n0 = Math.max(1, Math.min(9, Math.round(threshold * 10)));
  const table = Array.from({ length: 10 }, (_, i) => (i < n0 ? 0 : 1)).join(' ');
  const fn = (t: string): string => el(t, { type: 'discrete', tableValues: table });
  const defs = [el('filter', { id: fid, filterUnits: 'userSpaceOnUse', x: -W, y: -H, width: 2 * W, height: 3 * H, 'color-interpolation-filters': 'sRGB' }, [el('feColorMatrix', { type: 'saturate', values: 0 }), el('feComponentTransfer', {}, [fn('feFuncR'), fn('feFuncG'), fn('feFuncB')])])];
  return { defs, ref: urlRef(fid) };
}

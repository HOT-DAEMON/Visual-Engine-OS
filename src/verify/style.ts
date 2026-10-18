import { toHsl, hueDelta } from '../appearance';
import { luminance } from '../core/color';
import type { HairGeometry } from '../face/hair';
import { hairAppearance } from '../render/face/hair-look';
import type { FaceParams } from '../schema';
import { check, type Check } from './types';

/** Une couleur « vive » : saturée et ni sombre ni délavée (définition unique, partagée avec les statistiques de palette). */
export function isVivid(hex: string): boolean {
  const c = toHsl(hex);
  return c.s >= 0.6 && c.l >= 0.35 && c.l <= 0.72;
}

/**
 * STYLE ARTISTIQUE d'une chevelure. `svg` = SVG complet du visage (pour inspecter ce qui est réellement dessiné).
 *  - cel : chaque mèche a au plus 3 aplats à bords nets (ombre, ombre propre, reflet), sans dégradé dans les bandes ;
 *  - lumière : les trois teintes (ombre, lumière, contour) sont distinctes ; l'ombre reste dans la famille de la couleur
 *    principale (décalage bleuté modéré) ; les reflets gardent la teinte de la couleur (reflets colorés cohérents) ;
 *  - dégradé racine → pointe réellement différent quand demandé ; contraste cheveux / peau suffisant (avertissement).
 */
export function checkStyle(params: FaceParams, geo: HairGeometry | null, svg: string, skin: string): Check[] {
  const out: Check[] = [];
  if (!geo) return out;
  const h = params.hair;
  const ra = hairAppearance(h);
  const cel = h.appearance.shading.mode === 'cel';
  if (cel) {
    const groups = [...svg.matchAll(/<g clip-path="url\(#[^"]*-hl-c\d+\)">(.*?)<\/g>/g)].map((m) => m[1] as string);
    const tooMany = groups.filter((g) => (g.match(/<path/g) ?? []).length > 3).length;
    const gradInBands = groups.filter((g) => g.includes('fill="url(')).length;
    out.push(check('style', 'cel-max-3-tones', '==', tooMany, 0, 'mèches cel avec plus de 3 aplats'));
    out.push(check('style', 'cel-hard-edges', '==', gradInBands, 0, 'dégradé à l\'intérieur des bandes cel (bords non nets)'));
    if (h.appearance.shading.highlightBand > 0.3 && geo.locks.some((l) => l.rank === 'mass' || l.rank === 'main')) {
      const lit = groups.filter((g) => g.includes('stroke="')).length;
      out.push(check('style', 'cel-highlight-band', '>=', lit, 1, 'aucune bande de reflet à contour dur alors qu\'elle est demandée'));
    }
  }
  const dl = Math.abs(luminance(ra.light) - luminance(ra.shadow));
  out.push(check('style', 'light-shadow-distinct', '>=', dl, 0.02, 'teintes de lumière et d\'ombre indiscernables'));
  const b = toHsl(ra.base);
  if (b.s > 0.25 && b.l > 0.25) {
    out.push(check('style', 'shadow-near-main', '<=', Math.abs(hueDelta(b.h, toHsl(ra.shadow).h)), 75, 'ombre trop éloignée de la couleur principale', 'warn'));
    out.push(check('style', 'highlight-keeps-hue', '<=', Math.abs(hueDelta(b.h, toHsl(ra.light).h)), 70, 'lumière / reflet de teinte incohérente avec les cheveux', 'warn'));
  }
  if (h.look.tipColor) out.push(check('style', 'gradient-differs', '>=', Math.abs(luminance(ra.ramp(0)) - luminance(ra.ramp(1))) + (ra.ramp(0) === ra.ramp(1) ? 0 : 0.001), 0.001, 'dégradé racine → pointe sans effet'));
  out.push(check('style', 'hair-skin-contrast', '>=', Math.abs(luminance(ra.base) - luminance(skin)), 0.02, 'cheveux et peau de luminance trop proche', 'warn'));
  if (h.silhouette.asymmetry >= 0.5) {
    const pts = geo.locks.flatMap((l) => l.poly);
    const left = pts.reduce((a, q) => Math.max(a, -q.x), -Infinity);
    const right = pts.reduce((a, q) => Math.max(a, q.x), -Infinity);
    out.push(check('style', 'silhouette-asymmetric', '>=', Math.max(left, right) / Math.max(1e-6, Math.min(left, right)), 1.04, 'silhouette demandée asymétrique mais quasi symétrique', 'warn'));
  }
  return out;
}

/** Statistiques de palette d'un lot de visages : part de couleurs vives, familles de teinte distinctes, part avec dégradé. */
export function paletteStats(faces: { params: FaceParams }[]): { vivid: number; hueFamilies: number; gradient: number } {
  const hs = faces.map((f) => f.params.hair);
  const fam = new Set(hs.filter((h) => isVivid(h.color)).map((h) => Math.floor(toHsl(h.color).h / 30)));
  return { vivid: hs.filter((h) => isVivid(h.color)).length / hs.length, hueFamilies: fam.size, gradient: hs.filter((h) => h.look.tipColor !== null).length / hs.length };
}

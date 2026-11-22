import { rayFactor } from '../../geometry/eye/highlights';
import type { PlacedHighlight } from '../../geometry/eye';
import { el } from '../../core/svg';
import { P } from './helpers';

/**
 * AIGUILLES DE RAYONNEMENT (passe 13) : les éclats des références 10a / 10b / 07 ne sont pas des polygones plats mais un corps compact prolongé par de fines lames effilées,
 * blanches au cœur, teintées aux pointes. Ce module dessine ces lames pour un reflet `sparkle` / `star` placé par `placeHighlights` ; il ne fait rien quand `rays` = 0
 * (le SVG historique reste identique). Les lames partent de l'intérieur du corps (pas de joint visible) et s'arrêtent à `rays` rayons du corps.
 */
export function rayMarkup(p: PlacedHighlight, fill: string): string[] {
  const { item } = p;
  if (item.rays <= 0 || p.outline.length === 0) return [];
  const n = item.points ?? (item.shape === 'star' ? 5 : 4);
  // pointes = maxima locaux du rayon du contour (sparkle : sommets pairs ; star lissé par Chaikin : un sommet par pointe, pas un par point du contour)
  const rad = p.outline.map((v) => Math.hypot(v.x, v.y)); const rmax = Math.max(...rad); const m = rad.length;
  const tips = p.outline.filter((_, i) => rad[i]! >= rad[(i + m - 1) % m]! && rad[i]! > rad[(i + 1) % m]! && rad[i]! >= 0.8 * rmax);
  const out: string[] = [];
  tips.forEach((v, k) => {
    const r = Math.hypot(v.x, v.y); if (r < 1e-6) return;
    const ux = v.x / r, uy = v.y / r; const reach = r + Math.max(p.rx, p.ry) * item.rays * rayFactor(item, k, n);
    const half = Math.max(p.rx, p.ry) * 0.085;                   // demi-largeur à la racine : lame fine
    const b0 = { x: p.cx + ux * r * 0.55, y: p.cy + uy * r * 0.55 }; const tip = { x: p.cx + ux * reach, y: p.cy + uy * reach };
    const nx = -uy * half, ny = ux * half;
    out.push(el('path', { d: `M${P({ x: b0.x + nx, y: b0.y + ny })}L${P(tip)}L${P({ x: b0.x - nx, y: b0.y - ny })}Z`, fill, 'fill-opacity': item.opacity }));
  });
  return out;
}

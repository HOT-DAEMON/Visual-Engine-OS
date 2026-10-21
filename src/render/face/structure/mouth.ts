import { el, urlRef } from '../../../core/svg';
import { mix } from '../../../core/color';
import { polyD } from '../../../contact/types';
import type { MouthGeo } from '../../../face/mouth';
import { gradientStop as stop } from '../../../materials';
import { lineD } from '../soft';
import { blobEl, type StructureCtx } from './kit';

/**
 * Bouche structurée (T7), peinte d'après `mouthGeometry` : cavité, langue, gencive, dents (supérieures puis inférieures), lèvre inférieure, lèvre supérieure,
 * arc de Cupidon + tubercule, ligne de fermeture, ombres aux commissures. Aucune forme n'est recalculée ici. Ordre = profondeur : le fond d'abord, la peau des lèvres en dernier.
 */
export function renderMouthStructured(c: StructureCtx, m: MouthGeo, skin: string): { defs: string[]; markup: string[] } {
  const { p, ra, I, u, detail, dir } = c;
  const defs: string[] = [];
  const out: string[] = [];
  const lip = p.mouth.color ?? mix(skin, '#b8434f', 0.55);
  const lipShade = mix(lip, ra.shadow, 0.45);
  const lipLight = mix(lip, ra.light, 0.35);
  const dark = mix('#1a0709', ra.shadow, 0.15);
  // Cavité : sombre ; plus profonde (`cavity`) = plus noire. Langue et gencive posées dessus.
  if (m.cavity.length) out.push(el('path', { d: polyD(m.cavity), fill: mix(dark, '#5a1f28', 1 - p.mouth.cavity) }));
  if (m.tongue.length) out.push(el('path', { d: polyD(m.tongue), fill: mix('#c25c6a', dark, 0.25) }));
  if (m.gums.length) out.push(el('path', { d: polyD(m.gums), fill: mix('#d4727e', ra.shadow, 0.15) }));
  // Dents : blanc cassé, dégradé vertical vers l'ombre (les dents inférieures sont plus dans l'ombre de la lèvre supérieure).
  const tg = `${c.id}-teeth`;
  defs.push(el('linearGradient', { id: tg, x1: 0, y1: 0, x2: 0, y2: 1 }, [stop(0, '#f6f1e7', 1), stop(1, mix('#f6f1e7', ra.shadow, 0.35), 1)]));
  if (m.upperTeeth.length) out.push(el('path', { d: polyD(m.upperTeeth), fill: urlRef(tg) }));
  if (m.lowerTeeth.length) out.push(el('path', { d: polyD(m.lowerTeeth), fill: mix('#efe9dd', ra.shadow, 0.3) }));
  // Lèvre inférieure : dégradé vertical lumière → teinte, reflet central marqué ; lèvre supérieure : plus sombre (elle regarde vers le bas).
  const lg = `${c.id}-lowerlip`;
  defs.push(el('linearGradient', { id: lg, x1: 0, y1: 0, x2: 0, y2: 1 }, [stop(0, lip, 1), stop(0.5, lipLight, 1), stop(1, lipShade, 1)]));
  out.push(el('path', { d: polyD(m.lowerLip), fill: urlRef(lg) }));
  const ug = `${c.id}-upperlip`;
  defs.push(el('linearGradient', { id: ug, x1: 0, y1: 0, x2: 0, y2: 1 }, [stop(0, mix(lip, ra.light, 0.12), 1), stop(1, lipShade, 1)]));
  out.push(el('path', { d: polyD(m.upperLip), fill: urlRef(ug) }));
  // Reflets : sur la lèvre inférieure (côté lumière) et sur les pics de l'arc de Cupidon ; tubercule : petit reflet sous le creux central.
  // Reflet de la lèvre inférieure : centré à 40 % de son épaisseur sous son bord haut, décalé vers la lumière.
  const lt = m.lowerLip[(m.closure.length - 1) / 2] as { x: number; y: number };
  const lipH = Math.max(1 * u, m.lowerLipBottomY - lt.y);
  out.push(blobEl(c, { c: { x: lt.x + dir.x * 0.1 * m.halfWidth, y: lt.y + 0.4 * lipH }, rx: m.halfWidth * 0.4, ry: Math.max(0.6 * u, 0.2 * lipH), rotDeg: 0 }, '#ffffff', 0.28 * I * detail, 1.2 * u));
  for (const pk of [m.cupid.peakLeft, m.cupid.peakRight]) out.push(blobEl(c, { c: pk, rx: 3 * u, ry: 1.3 * u, rotDeg: 0 }, ra.light, 0.3 * I * p.mouth.cupid.depth * detail, 0.9 * u));
  out.push(blobEl(c, { c: m.cupid.tubercle, rx: 2.4 * u, ry: 1.1 * u, rotDeg: 0 }, ra.light, 0.34 * I * p.mouth.cupid.tubercle * detail, 0.8 * u));
  // Ligne de fermeture : trait sombre là où les lèvres se touchent (invisible quand la cavité s'ouvre : la cavité la remplace).
  if (!m.cavity.length) out.push(el('path', { d: lineD(m.closure), fill: 'none', stroke: mix(dark, lip, 0.35), 'stroke-width': 1.4 * u, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  // Commissures : petite ombre qui creuse l'angle de la bouche (profondeur = `cornerFolds`).
  for (const k of [m.corners.left, m.corners.right]) out.push(blobEl(c, { c: { x: k.x + Math.sign(k.x) * 1.2 * u, y: k.y }, rx: 2.8 * u, ry: 2 * u, rotDeg: 0 }, dark, 0.3 * p.mouth.cornerFolds * detail, 1 * u));
  return { defs, markup: out.filter((s) => s !== '') };
}

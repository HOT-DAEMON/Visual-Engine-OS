import { lineD } from '../soft';
import type { StructureGeometry } from '../../../face/structure';
import { blobEl, litSide, type StructureCtx } from './kit';

/**
 * Menton (T5), calque de structure : fossette ronde, sillon vertical, transitions supérieure / latérales / inférieure.
 * (Le coussinet, le sillon labio-mentonnier de base et le reflet du gonion restent ceux de `render/face/jaw.ts`.)
 * La largeur des transitions vient de `structureGeometry().chin`, donc de la dépendance « projection → raccords » (`dependencies.ts`).
 */
export function renderChinStructure(c: StructureCtx, g: StructureGeometry): string[] {
  const { p, ra, I, u, detail } = c;
  const ch = g.chin;
  const k = p.chin;
  const out: string[] = [];
  // Fossette ronde : creux d'ombre avec un reflet décalé vers la lumière (la dépression reçoit l'ombre du côté lumière, le bord opposé s'éclaire).
  if (k.dimple > 0.02) {
    out.push(blobEl(c, ch.dimple, ra.shadow, 0.34 * k.dimple * detail, 1.4 * u));
    out.push(blobEl(c, { ...ch.dimple, c: { x: ch.dimple.c.x - c.dir.x * 0.5 * ch.dimple.rx, y: ch.dimple.c.y - c.dir.y * 0.5 * ch.dimple.ry }, rx: ch.dimple.rx * 0.6, ry: ch.dimple.ry * 0.5 }, ra.light, 0.2 * I * k.dimple * detail, 1 * u));
  }
  // Sillon vertical : trait d'ombre flou, largeur et opacité selon `groove`.
  if (k.groove > 0.02) out.push(c.kit.stroke(lineD(ch.groove), ra.shadow, (1.2 + 2.4 * k.groove) * u, 0.12 + 0.4 * k.groove, 1.2 * u * c.soft));
  // Transition supérieure (sillon labio-mentonnier) : bande d'ombre sous la lèvre ; plus nette = plus sombre et plus étroite.
  out.push(blobEl(c, ch.upper, ra.shadow, 0.2 * (0.3 + 0.9 * (1 - k.upperBlend)) * detail, (1 + 3 * k.upperBlend) * u));
  // Raccords latéraux (menton → joues antérieures) : ombre côté opposé à la lumière, reflet côté lumière ; la zone est élargie quand le menton avance.
  for (const l of [ch.lateral.left, ch.lateral.right]) {
    const lit = litSide(c, l.c.x);
    out.push(blobEl(c, l, lit ? ra.light : ra.shadow, lit ? 0.1 * I : 0.18 * (1 - 0.5 * k.lateralBlend), (2 + 4 * k.lateralBlend) * u));
  }
  // Transition inférieure : ombre sous le menton (région sous-mentonnière), plus nette avec `lowerBlend` faible.
  out.push(blobEl(c, ch.lower, ra.shadow, 0.26 * (0.4 + 0.8 * (1 - k.lowerBlend)), (1.5 + 3 * k.lowerBlend) * u));
  return out.filter((s) => s !== '');
}

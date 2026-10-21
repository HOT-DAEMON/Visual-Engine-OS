import type { MouthGeo } from '../../../face/mouth';
import type { StructureGeometry } from '../../../face/structure';
import { displaceAll, type TissueField } from '../../../face/deform';
import { blobEl, litSide, type StructureCtx } from './kit';
import { lineD } from '../soft';

/**
 * PLIS comme DÉFORMATION DE TISSU (T8). Un pli n'est pas une ligne collée : c'est (1) la courbe de base du pli DÉPLACÉE par le champ de tissu de l'expression
 * (`displaceAll`) — elle se creuse et glisse avec le sourire —, (2) une ombre dans le pli, (3) un liseré clair SUR LE BOURRELET de chair qui s'accumule du côté
 * déplacé (la chair poussée forme un coussin au-dessus du sillon nasogénien quand la joue remonte), (4) un coussin lumineux dont la taille croît avec la déformation.
 */
export function renderFolds(c: StructureCtx, g: StructureGeometry, m: MouthGeo, field: TissueField, foldDeepen: number): string[] {
  const { p, ra, I, u, detail } = c;
  const out: string[] = [];
  // Profondeur effective : contrat de base × (1 + creusement dû à l'expression).
  const naso = Math.min(1, p.nose.junction.nasolabial * (1 + foldDeepen));
  const peri = Math.min(1, m.folds.depth);
  for (const s of ['left', 'right'] as const) {
    const side = s === 'left' ? -1 : 1;
    const lit = litSide(c, side);
    // Sillon nasogénien : courbe de base du nez, déplacée par le champ (la joue remonte → le sillon se creuse et se déplace).
    const nl = displaceAll(g.tissue.folds.nasolabial[s], field);
    // Le sillon de REPOS est déjà peint par le nez de base (`nose.junctions`) : ici seul le creusement dû à l'expression s'ajoute (opacité ∝ `foldDeepen`), pour ne pas doubler le trait.
    out.push(c.kit.stroke(lineD(nl), ra.shadow, (1.2 + 2.6 * naso) * u, 0.42 * naso * Math.min(1, 1.5 * foldDeepen) * detail, 1.3 * u * c.soft));
    // Bourrelet : liseré clair décalé vers l'extérieur du sillon (côté joue) ; opacité croît avec la déformation.
    const bulge = nl.map((q) => ({ x: q.x + side * (2 + 3 * naso) * u, y: q.y - (1 + 2 * foldDeepen) * u }));
    out.push(c.kit.stroke(lineD(bulge), ra.light, (1.6 + 2 * naso) * u, 0.3 * naso * Math.min(1, 1.5 * foldDeepen) * I * detail * (lit ? 1 : 0.6), 1.4 * u * c.soft));
    // Pli péri-buccal (commissure → menton) : déjà déplacé par le champ dans `mouthGeometry`.
    const pf = m.folds[s];
    out.push(c.kit.stroke(lineD(pf), ra.shadow, (1 + 2 * peri) * u, (0.08 + 0.34 * peri) * detail, 1.2 * u * c.soft));
  }
  // Coussin de la joue : volume qui remonte avec l'expression ; taille et opacité croissent avec le creusement (aire conservée côté géométrie, `facePose`).
  for (const ch of [g.tissue.cheeks.left, g.tissue.cheeks.right]) {
    const d = field(ch.volume.c);
    if (Math.hypot(d.x, d.y) > 0.3 * u) out.push(blobEl(c, { ...ch.zygoma, c: { x: ch.zygoma.c.x + d.x, y: ch.zygoma.c.y + d.y } }, ra.light, Math.min(0.4, 0.05 * Math.hypot(d.x, d.y) / u) * I * detail, 3.5 * u));
  }
  return out.filter((x) => x !== '');
}

import { lineD } from '../soft';
import type { StructureGeometry } from '../../../face/structure';
import { blobEl, type StructureCtx } from './kit';

/**
 * Cou (T9), calque de structure : ombre portée du menton sous la mandibule (profondeur = angle cervico-mentonnier effectif), bande de tissu sous-mandibulaire,
 * sterno-cléido-mastoïdiens (relief `muscles`), tension du platysma (bouche ouverte, tête inclinée). Dessiné juste après le cou, derrière la tête.
 */
export function renderNeckStructure(c: StructureCtx, g: StructureGeometry): string[] {
  const { p, ra, I, u, detail } = c;
  const nk = g.neck;
  const out: string[] = [];
  // Ombre sous le menton : plus profonde quand l'angle cervico-mentonnier se ferme (nk.shadowReachPx a déjà l'angle et le sous-menton intégrés).
  out.push(blobEl(c, { c: { x: 0, y: nk.submentalBand.c.y }, rx: nk.submentalBand.rx, ry: nk.submentalBand.ry, rotDeg: 0 }, ra.shadow, 0.5 * (0.5 + p.neck.thickness), 3 * u));
  // Épaisseur sous la mandibule : bande douce plus sombre dessous.
  out.push(blobEl(c, { ...nk.submentalBand, c: { x: 0, y: nk.submentalBand.c.y + 0.5 * nk.submentalBand.ry }, ry: nk.submentalBand.ry * 0.7 }, ra.shadow, 0.18 * p.neck.thickness, 4 * u));
  // Sterno-cléido-mastoïdiens : ombre le long du bord interne, reflet du côté lumière ; relief = `muscles` × détail.
  for (const [s, line] of [[-1, nk.scm.left], [1, nk.scm.right]] as const) {
    const lit = s * c.dir.x >= 0;
    out.push(c.kit.stroke(lineD(line), ra.shadow, (2 + 3 * p.neck.muscles) * u, (0.06 + 0.24 * p.neck.muscles) * detail, 2.2 * u * c.soft));
    if (lit) out.push(c.kit.stroke(lineD(line.map((q) => ({ x: q.x + s * 3 * u, y: q.y }))), ra.light, 1.6 * u, 0.12 * I * p.neck.muscles * detail, 1.6 * u * c.soft));
  }
  // Platysma : deux bandes verticales fines sous le menton, visibles seulement sous tension (ouverture, inclinaison).
  if (nk.platysmaTension > 0.05) {
    for (const s of [-1, 1]) out.push(c.kit.stroke(lineD([{ x: s * 0.28 * nk.halfWidthPx, y: g.neck.submentalBand.c.y }, { x: s * 0.2 * nk.halfWidthPx, y: g.neck.submentalBand.c.y + 0.8 * nk.shadowReachPx + 12 * u }]), ra.shadow, 1.6 * u, 0.3 * nk.platysmaTension * detail, 1.4 * u * c.soft));
  }
  return out.filter((s) => s !== '');
}

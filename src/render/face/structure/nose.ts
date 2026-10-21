import { el } from '../../../core/svg';
import { mix } from '../../../core/color';
import type { NoseGeometry } from '../../../face';
import { polyD } from '../../../contact/types';
import { lineD } from '../soft';
import { blobEl, litSide, type StructureCtx } from './kit';

/**
 * Régions du nez (T1) peintes par-dessus le nez de base : parois latérales (ombre côté opposé à la lumière, gouttière), dômes alaires (reflets), sillons alaires (ombre
 * de profondeur `groove.depth`), base du nez (ombre sous les narines), columelle, narines à REBORD (anneau de peau + ouverture sombre inscrite), philtrum
 * (gouttière, crêtes, fondu avec la lèvre). Chaque élément lit la géométrie de `noseGeometry().regions`, sans rien recalculer.
 */
export function renderNoseRegions(c: StructureCtx, g: NoseGeometry, skin: string): string[] {
  const { p, ra, I, u, detail } = c;
  const r = g.regions;
  const out: string[] = [];
  const n = p.nose;
  // Parois latérales : voile d'ombre sur la paroi du côté OPPOSÉ à la lumière (profondeur croissante avec la pente), reflet doux côté lumière.
  for (const w of [r.sidewalls.left, r.sidewalls.right]) {
    const lit = litSide(c, w.side);
    out.push(c.kit.fill(polyD(w.poly), lit ? ra.light : ra.shadow, lit ? 0.16 * I : 0.28 + 0.2 * n.sidewall.slope, 2.6 * u * c.soft));
    // Gouttière : creux de la paroi, ligne d'ombre floue (concavité) bordée d'un liseré clair côté lumière.
    if (w.gutter.length > 1) out.push(c.kit.stroke(lineD(w.gutter), ra.shadow, (1.6 + 2.4 * n.sidewall.concavity) * u, (0.12 + 0.4 * n.sidewall.concavity) * detail, 1.8 * u * c.soft));
  }
  // Dômes alaires : reflet sur chaque dôme (relief `prominence`), décalé vers la lumière ; creux d'ombre entre les deux dômes (séparation).
  for (const d of [r.domes.left, r.domes.right]) {
    out.push(blobEl(c, { c: { x: d.c.x + c.dir.x * 0.25 * d.rx, y: d.c.y + c.dir.y * 0.25 * d.ry }, rx: d.rx * 0.7, ry: d.ry * 0.55, rotDeg: 0 }, ra.light, 0.5 * I * (0.3 + 0.9 * n.domes.prominence), 1.6 * u));
    // Ombre propre du dôme : croissant sous le reflet, côté opposé à la lumière (donne le volume du lobule).
    out.push(blobEl(c, { c: { x: d.c.x - c.dir.x * 0.45 * d.rx, y: d.c.y + 0.55 * d.ry }, rx: d.rx * 0.9, ry: d.ry * 0.5, rotDeg: 0 }, ra.shadow, 0.3 * (0.4 + 0.8 * n.domes.prominence) * detail, 1.6 * u));
  }
  out.push(blobEl(c, { c: { x: 0, y: r.domes.left.c.y + 0.1 * r.domes.left.ry }, rx: Math.max(0.6 * u, r.domes.right.c.x - r.domes.right.rx * 0.4), ry: r.domes.left.ry * 0.7, rotDeg: 0 }, ra.shadow, 0.3 * n.domes.separation * detail, 1.4 * u));
  // Sillons alaires : pli entre l'aile et la joue ; profondeur = `groove.depth`, prolongé vers la joue par un trait qui s'efface.
  for (const gr of [r.grooves.left, r.grooves.right]) {
    out.push(c.kit.stroke(lineD(gr.line), ra.shadow, (1.2 + 2.2 * n.groove.depth) * u, (0.2 + 0.5 * n.groove.depth) * detail, 1.2 * u * c.soft));
    out.push(c.kit.stroke(lineD(gr.cheekBlend), ra.shadow, 1.4 * u, 0.14 * n.groove.depth * detail, 1.8 * u * c.soft));
  }
  // Base du nez : ombre sous les narines (plancher), plus profonde avec `base.depth` ; columelle : léger reflet de la cloison.
  out.push(c.kit.fill(polyD(r.base.poly), ra.shadow, 0.26 + 0.3 * n.base.depth, 1.6 * u * c.soft));
  out.push(c.kit.fill(polyD(r.columella.poly), ra.light, 0.12 * I, 1.2 * u * c.soft));
  // Narines à rebord : anneau de peau (contour extérieur couvre le noir du nez de base) puis ouverture sombre inscrite. Le rebord est un peu plus clair que la peau côté lumière.
  const rimFill = mix(skin, ra.shadow, 0.28);
  for (const nl of [r.nostrils.left, r.nostrils.right]) {
    out.push(el('path', { d: polyD(nl.outer), fill: rimFill, 'fill-opacity': 0.95 }));
    out.push(el('path', { d: polyD(nl.aperture), fill: mix(ra.shadow, '#000000', 0.7) }));
    if (litSide(c, nl.side)) out.push(c.kit.stroke(lineD(nl.outer), ra.light, 0.8 * u, 0.28 * I * detail, 0.5 * u));
  }
  // Philtrum : gouttière centrale (ombre), deux crêtes (reflet côté lumière), fondu avec la lèvre supérieure (ellipse de transition, `blend`).
  const ph = r.philtrum;
  out.push(c.kit.stroke(lineD(ph.groove), ra.shadow, (1.4 + 3 * n.philtrum.depth) * u, (0.08 + 0.3 * n.philtrum.depth) * detail, 1.6 * u * c.soft));
  for (const col of [ph.columns.left, ph.columns.right]) out.push(c.kit.stroke(lineD(col), ra.light, 1.1 * u, 0.16 * I * n.philtrum.depth * detail, 0.9 * u * c.soft));
  out.push(blobEl(c, { c: ph.lipBand.c, rx: ph.lipBand.rx, ry: ph.lipBand.ry, rotDeg: 0 }, ra.shadow, 0.12 * (1 - 0.5 * n.philtrum.blend), (1 + 2 * n.philtrum.blend) * u));
  return out.filter((s) => s !== '');
}

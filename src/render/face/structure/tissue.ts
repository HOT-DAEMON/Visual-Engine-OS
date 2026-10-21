import { lineD } from '../soft';
import type { StructureGeometry } from '../../../face/structure';
import { blobEl, litSide, type StructureCtx } from './kit';

/**
 * Calque des TISSUS MOUS sur la peau (T3, T6, T8) : joues, pommettes, creux, transitions, masséter, région préauriculaire, bord inférieur de la mâchoire.
 * Chaque forme est un VOLUME (ellipse molle) positionné par `structureGeometry` ; la lumière en choisit le rôle (reflet côté lumière, ombre côté opposé).
 * Les détails fins (creux, relief du masséter, transitions) sont multipliés par `ctx.detail`.
 */
export function renderTissue(c: StructureCtx, g: StructureGeometry): string[] {
  const { p, ra, I, u, detail } = c;
  const out: string[] = [];
  const ck = p.cheek;
  const st = p.softTissue;
  for (const ch of [g.tissue.cheeks.left, g.tissue.cheeks.right]) {
    const lit = litSide(c, ch.side);
    // Chair de la joue : reflet doux côté lumière, léger voile d'ombre côté opposé (le volume tourne vers l'ombre).
    out.push(blobEl(c, ch.volume, lit ? ra.light : ra.shadow, lit ? 0.16 * I * (0.5 + ck.volume) : 0.12 * (0.5 + ck.volume), 7 * u));
    // Pommette (os zygomatique) : reflet net côté lumière ; côté ombre, un simple adoucissement.
    out.push(blobEl(c, ch.zygoma, ra.light, (lit ? 0.3 : 0.08) * I * (0.4 + ck.boneProjection), 4.5 * u));
    // Creux sous la pommette : ombre, plus marquée quand le creux est profond (détail anatomique).
    out.push(blobEl(c, ch.hollow, ra.shadow, (0.12 + 0.34 * ck.hollow) * detail * (lit ? 0.8 : 1.1), 4 * u));
    // Transition creux → masséter : plus elle est fondue, plus l'ombre est large et douce.
    out.push(blobEl(c, ch.masseterBlend, ra.shadow, 0.14 * detail, (2 + 4 * ck.masseterBlend) * u));
  }
  for (const [s, m, pre] of [[-1, g.mandible.masseter.left, g.mandible.preauricular.left], [1, g.mandible.masseter.right, g.mandible.preauricular.right]] as const) {
    const lit = litSide(c, s);
    // Masséter : reflet sur la sangle musculaire (côté lumière) et ombre sous son bord (côté opposé) ; opacité = relief × volume (repos + serrage).
    const vol = Math.min(1, st.masseter.volume + 0.6 * p.deform.articulation.clench);
    const k = st.masseter.relief * (0.35 + 0.65 * vol) * detail;
    out.push(blobEl(c, { ...m, rx: m.rx * (lit ? 0.7 : 1), c: { x: m.c.x + s * 0.3 * m.rx, y: m.c.y } }, lit ? ra.light : ra.shadow, (lit ? 0.12 : 0.3) * k * (lit ? I : 1), (lit ? 5 : 3) * u));
    // Transition préauriculaire : bande d'ombre douce dans la région devant l'oreille, côté opposé à la lumière seulement (côté lumière : peau éclairée continue).
    if (!lit && pre.length > 2) out.push(c.kit.fill(`M${pre.map((q) => `${q.x} ${q.y}`).join('L')}Z`, ra.shadow, 0.2 * (0.4 + 0.6 * p.mandible.depth) * (1 - 0.6 * p.mandible.preauricular), 4 * u * c.soft));
  }
  // Bord inférieur de la mâchoire : liseré clair côté lumière et ombre dessous côté opposé ; plus net (étroit et contrasté) quand `lowerBorder` est grand.
  const lb = g.mandible.lowerBorder;
  const litPts = lb.filter((q) => litSide(c, q.x));
  const darkPts = lb.filter((q) => !litSide(c, q.x));
  const sharp = p.mandible.lowerBorder;
  if (litPts.length > 1) out.push(c.kit.stroke(lineD(litPts), ra.light, (1.2 + 2 * (1 - sharp)) * u, (0.1 + 0.3 * sharp) * I * detail, (0.6 + 2.4 * (1 - sharp)) * u * c.soft));
  if (darkPts.length > 1) out.push(c.kit.stroke(lineD(darkPts), ra.shadow, (2 + 3 * (1 - sharp)) * u, 0.16 + 0.3 * sharp, (0.8 + 3 * (1 - sharp)) * u * c.soft));
  // Tissu péri-labial : léger volume au-dessus de la lèvre supérieure et sous la lèvre inférieure (plénitude `perioral`).
  const pl = g.tissue.perioral;
  out.push(blobEl(c, pl.upper, ra.light, 0.1 * I * st.perioral * detail, 3 * u));
  out.push(blobEl(c, pl.lower, ra.light, 0.08 * I * st.perioral * detail, 3 * u));
  return out.filter((s) => s !== '');
}

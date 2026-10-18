import { darken, mix } from '../../../core/color';
import { el, urlRef } from '../../../core/svg';
import { gradientStop as stop } from '../../../materials';
import { polyD } from '../../../contact';
import type { NoseAlaGeo } from '../../../face';
import { lineD } from '../soft';
import type { NoseCtx } from './context';

/**
 * Ailes du nez : un VOLUME (pas un arc de trait). Dégradé radial de volume (clair côté lumière, ombré à l'opposé), bord épais
 * (liseré d'ombre à l'intérieur de la silhouette + reflet décalé vers la lumière) et sillon alaire flou qui raccorde l'aile à la joue :
 * net si `attachment` est faible, fondu s'il est fort.
 */
function drawAla(c: NoseCtx, a: NoseAlaGeo, tag: string): string[] {
  const { p, ra, dir, I } = c;
  const al = p.nose.alae;
  const d = polyD(a.poly);
  const out: string[] = [];
  const vid = `${c.id}-nose-ala-${tag}`;
  c.defs.push(el('radialGradient', { id: vid, cx: 0.5, cy: 0.5, r: 0.5, fx: 0.5 + dir.x * 0.25, fy: 0.5 + dir.y * 0.25 }, [stop(0, ra.light, 0.45 * al.volume * I), stop(0.55, ra.light, 0.08 * al.volume * I), stop(1, ra.shadow, 0.5 * al.volume)]));
  out.push(el('path', { d, fill: urlRef(vid) }));
  // Bord : trait d'ombre intérieur (épaisseur de l'aile) + reflet fin décalé vers la lumière, tous deux limités à la silhouette de l'aile.
  const cid = `${c.id}-nose-ala-clip-${tag}`;
  c.defs.push(el('clipPath', { id: cid }, [el('path', { d })]));
  const t = a.thicknessPx;
  out.push(
    el('g', { 'clip-path': urlRef(cid) }, [
      el('path', { d, fill: 'none', stroke: ra.shadow, 'stroke-width': t * 1.2, 'stroke-opacity': 0.3 + 0.2 * al.thickness }),
      el('g', { transform: `translate(${dir.x * t * 0.45} ${dir.y * t * 0.45})` }, [el('path', { d, fill: 'none', stroke: ra.light, 'stroke-width': t * 0.55, 'stroke-opacity': 0.3 * I })]),
    ]),
  );
  return out;
}

export function renderAlae(c: NoseCtx): string[] {
  const { g, ra, u, I } = c;
  const out = [...drawAla(c, g.alae.left, 'l'), ...drawAla(c, g.alae.right, 'r')];
  const gj = g.junctions.alarGroove;
  // Sillon alaire : flou d'autant plus large que le raccord à la joue est doux.
  for (const side of ['left', 'right'] as const) {
    const pts = gj[side];
    if (pts.length > 1) out.push(c.kit.stroke(lineD(pts), ra.shadow, (1.8 + 1.6 * (1 - gj.depth)) * u, 0.5 * gj.depth * (0.5 + 0.5 * I), (0.9 + 1.4 * (1 - gj.depth)) * u));
  }
  return out;
}

/**
 * Narines : goutte orientée, intérieur sombre dégradé (la paroi interne est visible), liseré clair sur le bord éclairé et ombre de seuil
 * floue juste autour. La profondeur de la narine suit sa taille ; la columelle (cloison) reçoit un reflet vertical doux.
 */
export function renderNostrils(c: NoseCtx): string[] {
  const { g, skin, ra, dir, I, u } = c;
  const out: string[] = [];
  const inner = mix(ra.shadow, '#000000', 0.62);
  for (const s of ['left', 'right'] as const) {
    const n = g.nostrils[s];
    const d = polyD(n.poly);
    const gid = `${c.id}-nose-nostril-${s}`;
    c.defs.push(el('radialGradient', { id: gid, cx: 0.5, cy: 0.55, r: 0.55 }, [stop(0, darken(inner, 0.4), 0.95), stop(0.7, inner, 0.9), stop(1, mix(inner, skin, 0.35), 0.85)]));
    out.push(c.kit.fill(d, ra.shadow, 0.35, 1.2 * u));
    out.push(el('path', { d, fill: urlRef(gid) }));
    // Bord éclairé : trait fin décalé vers la lumière, limité à l'extérieur de la narine par son propre tracé.
    out.push(el('g', { transform: `translate(${-dir.x * 0.6 * u} ${-dir.y * 0.6 * u})` }, [el('path', { d, fill: 'none', stroke: ra.light, 'stroke-width': 0.8 * u, 'stroke-opacity': 0.22 * I })]));
  }
  const col = g.columella;
  const cid = `${c.id}-nose-col`;
  c.defs.push(el('linearGradient', { id: cid, gradientUnits: 'userSpaceOnUse', x1: 0, y1: col.topY, x2: 0, y2: col.bottomY }, [stop(0, ra.light, 0.0), stop(0.5, ra.light, 0.16 * I), stop(1, ra.shadow, 0.18)]));
  out.push(el('path', { d: `M${-col.half} ${col.topY}L${col.half} ${col.topY}L${col.half * 0.8} ${col.bottomY}L${-col.half * 0.8} ${col.bottomY}Z`, fill: urlRef(cid) }));
  return out;
}

/** Région nasolabiale : pli de l'aile vers la commissure, ombre floue + lèvre claire du côté lumière. */
export function renderNasolabial(c: NoseCtx): string[] {
  const { g, ra, dir, I, u } = c;
  const nl = g.junctions.nasolabial;
  const out: string[] = [];
  for (const side of ['left', 'right'] as const) {
    const pts = nl[side];
    out.push(c.kit.stroke(lineD(pts), ra.shadow, 3.4 * u, 0.4 * nl.depth * (0.5 + 0.5 * I), 2.2 * u));
    out.push(c.kit.stroke(lineD(pts.map((q) => ({ x: q.x + dir.x * 3 * u, y: q.y + dir.y * 3 * u }))), ra.light, 2.2 * u, 0.16 * nl.depth * I, 1.8 * u));
  }
  return out;
}

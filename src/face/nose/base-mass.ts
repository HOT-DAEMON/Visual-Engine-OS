import type { NoseGeometry } from './types';
import type { UnderviewModel } from './underview-model';

/**
 * MASSE DE LA BASE DU NEZ vue de dessous (docs/NOSE-BASE-MASS.md). La base est construite dans SA PROPRE EMPREINTE : x (largeur) × w (profondeur devant le plan du visage, 0 = sous-nez,
 * `projectionPx` = sommet de la pointe), puis relevée en un volume continu. Défauts de la v1 corrigés : (a) lobule, ailes et columelle étaient des surfaces séparées (max de z) → deux plaques et
 * une tige (« champignon ») ; (b) en les fusionnant dans le repère de FACE, la hauteur de face du lobule (très haute) devenait sa profondeur → une « corne ».
 * Ici la profondeur d'un point vient de sa hauteur de face par la pente de la sous-face (`depthOf`), mais les RAYONS en profondeur du lobule et des ailes ne viennent PAS de leur hauteur de face.
 *
 * Construction (rapports de hauteur de `UnderviewModel`, NON VALIDÉ : docs/NOSE-UNDERVIEW-CALIB.md ; rayons en profondeur et congés = CHOIX de construction, NON MESURÉS) :
 *  1 · empreinte = union lissée (min polynomial des distances signées) du lobule, des deux ailes et de la bande de la columelle → un ovoïde ;
 *  2 · profil de relief parabolique (pente finie au bord : pas de mur) ; 3 · narines : cavités à paroi lisse, positions lues sur la géométrie de face.
 */
export interface BaseSample { readonly x: number; readonly y: number; readonly z: number; readonly cavity: boolean }
export interface BaseMass { readonly xMin: number; readonly xMax: number; readonly wMax: number; readonly P: number; sample(x: number, w: number): BaseSample | null }

const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
const para = (s: number, r: number): number => { const t = clamp(s / r, 0, 1); return 1 - (1 - t) * (1 - t); };
/** Min polynomial lisse (rayon de congé k, px). */
export const smin = (a: number, b: number, k: number): number => { const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1); return b + (a - b) * h - k * h * (1 - h); };
/** Distance signée approchée à une ellipse (négative dedans) : (|p/ab| − 1) × min(a, b). */
const sdEllipse = (x: number, w: number, cx: number, cw: number, a: number, b: number): number => (Math.hypot((x - cx) / a, (w - cw) / b) - 1) * Math.min(a, b);

export function baseMass(nose: NoseGeometry, m: UnderviewModel): BaseMass {
  const P = nose.tip.projectionPx, hw = nose.widthPx, yB = nose.baseY, yT = nose.tip.c.y, rise = Math.max(1e-6, yB - yT), col = nose.columella;
  /** Profondeur d'un point de face de hauteur y : la sous-face monte du sous-nez (w = 0) à la pointe (w = P). */
  const depthOf = (y: number): number => clamp((yB - y) / rise, 0, 1.15) * P;
  const lob = { cx: nose.tip.c.x, cw: 0.80 * P, a: Math.max(1.12 * nose.tip.rx, 0.24 * hw), b: clamp(nose.tip.rx, 0.18 * P, 0.34 * P) };
  const w0 = 0.05 * P;
  const alas = ([-1, 1] as const).map((s) => {
    const al = s === 1 ? nose.alae.right : nose.alae.left, x0 = 0.45 * nose.tip.rx, half = 0.5 * Math.max(1e-6, Math.abs(al.outerX) - x0);
    // l'aile s'étend de la base (w ≈ 0,05 P) jusqu'au lobule : quelle que soit la projection, base et pointe forment UNE masse (sinon un col étroit les sépare : le champignon revient
    // sur les nez à forte projection ; mis en évidence par les règles de src/verify/nose-lit.ts sur 60 visages tirés)
    const b = Math.max(1.6 * half, 0.5 * (lob.cw - 0.5 * lob.b - w0)), cw = w0 + b;
    return { cx: s * (x0 + half), cw, a: half, b };
  });
  // cœur : comble l'encoche entre le lobule et les ailes sur les nez larges (sinon l'ovoïde a deux creux latéraux) ; milieu de la base, largeur du lobule élargie
  const core = { cx: 0, cw: 0.5 * (w0 + lob.cw), a: Math.max(lob.a, 0.32 * hw), b: 0.5 * (lob.cw - w0) };
  const bar = { half: Math.max(col.half, 0.1 * hw), w1: 0.22 * P };
  const kJoin = 0.42 * hw, H = 0.20 * hw * (m.alarTop / 0.5514), R = 0.5 * Math.min(lob.a, alas[0]!.a);
  const footprint = (x: number, w: number): number => {
    let d = sdEllipse(x, w, lob.cx, lob.cw, lob.a, lob.b);
    for (const a of alas) d = smin(d, sdEllipse(x, w, a.cx, a.cw, a.a, a.b), kJoin);
    d = smin(d, sdEllipse(x, w, core.cx, core.cw, core.a, core.b), kJoin);
    const dx = Math.abs(x) - bar.half, dw = Math.max(-w, w - bar.w1);   // bande de la columelle : de w = 0 à 0,22 P (le V qui dépasse sous l'ovoïde)
    return smin(d, Math.max(dx, dw), 0.5 * kJoin);
  };
  const pits = [nose.nostrils.left, nose.nostrils.right].map((n) => ({ cx: n.c.x, cw: clamp(depthOf(n.c.y), 0.2 * P, 0.7 * P), a: 1.25 * n.b, b: 1.05 * n.a }));
  const xMax = Math.max(...alas.map((a) => Math.abs(a.cx) + a.a)) + 0.1 * hw;
  return {
    xMin: -xMax, xMax, wMax: 1.12 * P, P,
    sample(x, w) {
      const d = footprint(x, w); if (d >= 0) return null;
      let h = H * para(-d, R);
      if (Math.abs(x) <= bar.half * 1.6 && w <= bar.w1) h = Math.max(h, H * 0.9 * (m.lobuleRim / 0.5) * (1 - w / bar.w1) ** 0.6 * para(bar.half * 1.6 - Math.abs(x), 0.9 * bar.half));
      // profondeur d'une narine ≤ 0,9 × son demi-axe : un puits plus profond que large est caché par son bord dès 20–40° de tangage (constaté sur 6 visages tirés : 0 pixel de cavité visible)
      let cut = 0, cav = false;
      for (const p of pits) { const e = sdEllipse(x, w, p.cx, p.cw, p.a, p.b); if (e < 0) { const D = Math.min(0.95 * H, 0.9 * p.a), c = D * para(-e, 0.7 * p.a); cut = Math.max(cut, c); if (c > 0.4 * D) cav = true; } }
      h -= cut;
      return { x, y: yB - (w / P) * rise + h, z: w, cavity: cav };   // sous-face : plan incliné du sous-nez à la pointe, relevé de h vers l'observateur
    },
  };
}

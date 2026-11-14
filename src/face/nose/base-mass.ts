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

/**
 * OUVERTURE DE NARINE vue de dessous : une FENTE allongée, pas un creux rond (docs/NOSE-NOSTRIL-SLIT.md). Valeurs MESURÉES sur les références, pas choisies à l'œil :
 *  · allongement = 1 + 3,27 × `nostrils.shape` : au réglage par défaut (0,55) 2,8, entre la médiane de la réf. 03 (2,23 ; 34 traits) et celle de la réf. 04 (3,31 ; 9 traits, majorant :
 *    l'épaisseur mesurée est celle du trait dessiné) ; `shape = 0` redonne un creux rond ;
 *  · longueur totale = 0,20 × la largeur du nez (réf. 04 : médiane 0,199 de l'ellipse ; réf. 03 : 0,217) ;
 *  · extrémité externe relevée de 23° (réf. 04 : médiane de 9 traits, dans le repère de l'ellipse ; 8 sur 9 positifs) — en montant à l'écran (w croissant dans la vue de dessous).
 * `sizeExponent` (la taille choisie agit en racine carrée) et `minThicknessOverWidth` (épaisseur plancher 0,04 × la largeur : sans lui les petites narines à forte `shape` n'ont que ≈ 7 pixels de cavité visibles à 40°, sous la règle `nose-lit-nostril-cavities`) sont des CHOIX posés après un échec constaté sur les seeds 105516 et 52169. La COURBURE du trait (extrémités plus hautes que le milieu) et le rapport profondeur / épaisseur de la cavité sont des CHOIX de construction, NON MESURÉS.
 */
export const SLIT = { elongPerShape: 2.2, lengthOverWidth: 0.2, outerRiseDeg: 23, bend: 0.9, depthOverThickness: 1.2, sizeExponent: 0.5, minThicknessOverWidth: 0.04 } as const;

/**
 * Distance signée approchée (négative dedans, px) à une fente : ellipse de demi-axes (A, B) dont l'axe, tourné de `riseDeg`, s'éloigne de la ligne médiane en MONTANT À L'ÉCRAN
 * (dans la vue de dessous, w croissant monte à l'écran : constaté sur le rendu), à ligne médiane courbée en sourire (extrémités plus hautes que le milieu, flèche `bend` × B).
 * Les deux narines sont des images miroir (x → side × x).
 */
export function sdSlit(x: number, w: number, cx: number, cw: number, side: -1 | 1, A: number, B: number, riseDeg: number, bend: number): number {
  const r = (riseDeg * Math.PI) / 180, mx = side * (x - cx), dw = w - cw;
  const s = mx * Math.cos(r) + dw * Math.sin(r);           // le long de l'axe (interne → externe), l'extrémité externe est à w plus grand
  const v = -mx * Math.sin(r) + dw * Math.cos(r);          // perpendiculaire à l'axe, vers w croissant
  const mid = -bend * B * (1 - Math.min(1, (s / A) ** 2)); // flèche : le milieu est à w plus petit que les bouts (sourire)
  return (Math.hypot(s / A, (v - mid) / B) - 1) * Math.min(A, B);
}

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
  // narines : fentes mesurées (SLIT). Longueur totale = 0,20 × largeur du nez, mise à l'échelle de la taille choisie (`nostril`) par le rapport de la demi-longueur de face à sa valeur par défaut.
  const pits = ([nose.nostrils.left, nose.nostrils.right] as const).map((n) => {
    const E = 1 + SLIT.elongPerShape * n.shape, A = 0.5 * SLIT.lengthOverWidth * hw * (n.a / (0.079 * hw)) ** SLIT.sizeExponent, B = Math.max(A / E, SLIT.minThicknessOverWidth * hw);
    return { side: n.side, cx: n.c.x, cw: clamp(depthOf(n.c.y), 0.2 * P, 0.7 * P), A, B };
  });
  const xMax = Math.max(...alas.map((a) => Math.abs(a.cx) + a.a)) + 0.1 * hw;
  return {
    xMin: -xMax, xMax, wMax: 1.12 * P, P,
    sample(x, w) {
      const d = footprint(x, w); if (d >= 0) return null;
      let h = H * para(-d, R);
      if (Math.abs(x) <= bar.half * 1.6 && w <= bar.w1) h = Math.max(h, H * 0.9 * (m.lobuleRim / 0.5) * (1 - w / bar.w1) ** 0.6 * para(bar.half * 1.6 - Math.abs(x), 0.9 * bar.half));
      // profondeur d'une narine ≤ 1,6 × sa demi-épaisseur (fente) : un puits trop profond pour sa largeur est caché par son bord dès 20–40° de tangage (constaté sur 6 visages tirés : 0 pixel de cavité visible)
      let cut = 0, cav = false;
      for (const p of pits) { const e = sdSlit(x, w, p.cx, p.cw, p.side, p.A, p.B, SLIT.outerRiseDeg, SLIT.bend); if (e < 0) { const D = Math.min(0.95 * H, SLIT.depthOverThickness * p.B), c = D * para(-e, 0.35 * p.B); cut = Math.max(cut, c); if (c > 0.4 * D) cav = true; } }
      h -= cut;
      return { x, y: yB - (w / P) * rise + h, z: w, cavity: cav };   // sous-face : plan incliné du sous-nez à la pointe, relevé de h vers l'observateur
    },
  };
}

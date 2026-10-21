import { catmullRom, superEllipse } from '../curve';
import type { Vec } from '../../geometry/eye/primitives';
import type { FaceParams } from '../../schema';
import { inPoly } from '../poly';
import type { FaceLandmarks } from '../landmarks';
import type { ResolvedNose } from './constraints';
import { baseHalfAt } from './constraints';
import type { NoseFrame } from './frame';
import { dropPoly } from './nostrils';
import type { NoseDomeGeo, NoseGrooveGeo, NoseRegionsGeo, NoseSidewallGeo, NostrilRegionGeo } from './regions-types';
import type { NoseAlaGeo, NoseDorsumGeo, NostrilGeo, NoseTipGeo } from './types';

/** Entrées des régions : tout ce que `noseGeometry` a déjà calculé (aucune région ne recalcule le cadre ni les sous-composants de base). */
export interface RegionInputs {
  readonly p: FaceParams;
  readonly F: NoseFrame;
  readonly lm: FaceLandmarks;
  readonly R: ResolvedNose;
  readonly dorsum: NoseDorsumGeo;
  readonly tip: NoseTipGeo;
  readonly alae: { readonly left: NoseAlaGeo; readonly right: NoseAlaGeo };
  readonly nostrils: { readonly left: NostrilGeo; readonly right: NostrilGeo };
}

const mirror = (q: Vec): Vec => ({ x: -q.x, y: q.y });

/**
 * Parois latérales : région entre l'arête (`half`) et la jonction avec la joue. Son bord extérieur est DÉFINI ICI (et non par `wallHalf`, qui est la silhouette
 * historique de la pyramide et peut être plus étroite que l'arête près de la pointe) : largeur de paroi = `amp × bell(t)`, avec `amp` réglée par la PENTE
 * (plans presque horizontaux = paroi large, plans abrupts = paroi étroite) et `bell` nulle à la racine et à la supra-pointe (la paroi naît et meurt dans les volumes voisins).
 * La gouttière suit le milieu de la paroi de 35 % à 85 % de la hauteur, creusée vers l'arête quand la concavité augmente.
 */
function sidewall(i: RegionInputs, side: -1 | 1): NoseSidewallGeo {
  const { axis, half, wallHalf } = i.dorsum;
  const n = axis.length;
  // Amplitude maximale de la paroi : de 5 % (abrupt) à 15 % (plat) de la largeur des ailes.
  const amp = i.F.nw * (0.05 + 0.1 * (1 - i.p.nose.sidewall.slope));
  const inner = axis.map((q, k) => ({ x: q.x + side * (half[k] as number), y: q.y }));
  const outer = axis.map((q, k) => {
    const t = k / (n - 1);
    // Cloche sin(π t)^0,7 : nulle aux deux bouts, large au milieu ; plancher de 0,4 px pour que le polygone ne dégénère jamais.
    const w = Math.max(0.4, amp * Math.sin(Math.PI * t) ** 0.7);
    // Jamais plus étroite que la silhouette historique (la paroi couvre au moins ce que la pyramide couvrait déjà).
    const reach = Math.max(half[k] as number + w, wallHalf[k] as number);
    return { x: q.x + side * reach, y: q.y };
  });
  const lo = Math.floor(0.35 * (n - 1));
  const hi = Math.ceil(0.85 * (n - 1));
  const gutter: Vec[] = [];
  for (let k = lo; k <= hi; k++) {
    const a = inner[k] as Vec;
    const b = outer[k] as Vec;
    // Position de la gouttière entre l'arête (0) et le bord extérieur (1) : 0,5 sans concavité, 0,2 avec concavité maximale.
    const t = 0.5 - 0.3 * i.p.nose.sidewall.concavity;
    gutter.push({ x: a.x + (b.x - a.x) * t, y: a.y });
  }
  // Largeur moyenne : moyenne de (bord extérieur − arête) en valeur absolue sur toute la hauteur.
  const meanWidthPx = outer.reduce((sum, q, k) => sum + Math.abs(q.x - (inner[k] as Vec).x), 0) / n;
  return { side, poly: [...inner, ...[...outer].reverse()], gutter, meanWidthPx };
}

/** Dômes alaires : deux super-ellipses CONTENUES dans la pointe ; leur écart est la séparation arbitrée (`R.domeSeparation`). */
function dome(i: RegionInputs, side: -1 | 1): NoseDomeGeo {
  const t = i.tip;
  // Chaque dôme occupe 50 % de la demi-largeur de la pointe ; son centre est à (20 % + 30 % × séparation) de cette demi-largeur du centre : à la séparation maximale
  // admise par `constraints.ts` (0,3 + 0,7 × largeur de pointe), l'extrémité reste ≤ tip.rx. Au repos les deux dômes se touchent presque (deux lobes lisibles).
  const build = (k: number): NoseDomeGeo => {
    const rx = 0.5 * t.rx * k;
    const ry = 0.85 * t.ry * k;
    const c: Vec = { x: t.c.x + side * (0.2 + 0.3 * i.R.domeSeparation) * t.rx, y: t.c.y - 0.05 * ry };
    return { side, c, rx, ry, poly: superEllipse(c.x, c.y, rx, ry, 2.2, 28) };
  };
  // CONTENEMENT : la pointe n'est pas une ellipse (forme réglée par `tip.roundness`) ; on réduit le dôme par pas de 7 % jusqu'à ce que 98 % de ses sommets soient
  // dans le polygone de la pointe (au plus 8 pas : jamais en dessous de 50 % de sa taille).
  let k = 1;
  let d = build(k);
  for (let n = 0; n < 8 && d.poly.filter((q) => inPoly(i.tip.poly, q.x, q.y)).length / d.poly.length < 0.98; n++) {
    k *= 0.93;
    d = build(k);
  }
  return d;
}

/** Sillon alaire : la fin du bord extérieur de l'aile (de l'attache vers la pointe, sur la part `groove.length`), prolongé vers la joue. */
function groove(i: RegionInputs, ala: NoseAlaGeo): NoseGrooveGeo {
  const e = ala.outerEdge;
  // Le bord va de la jonction avec la pointe (0) à l'attache (dernier) : on garde la fin, longueur = part demandée (au moins 3 points).
  const keep = Math.max(3, Math.round(i.p.nose.groove.length * e.length));
  const line = e.slice(e.length - keep);
  const end = line[line.length - 1] as Vec;
  const dx = ala.side * 0.045 * i.F.W;
  // Transition vers la joue : courbe qui part de l'attache, s'écarte vers l'extérieur et s'efface (le sillon se fond dans la joue).
  const cheekBlend = catmullRom([end, { x: end.x + dx * 0.5, y: end.y + 0.006 * i.F.H }, { x: end.x + dx, y: end.y + 0.002 * i.F.H }], false, 6);
  return { side: ala.side, line, cheekBlend };
}

/** Narine à ouverture : contour extérieur (goutte), rebord d'épaisseur `rim`, ouverture sombre inscrite (voir `constraints.ts` pour le plafond de l'ouverture). */
function nostril(i: RegionInputs, n: NostrilGeo): NostrilRegionGeo {
  const rimPx = Math.max(0.3, i.p.nose.nostrils.rim * 0.35 * n.b);
  // Ouverture : `null` = pleine (comportement d'avant) ; sinon l'ouverture réduit l'aire sombre de 25 % (fermée) à 100 % (grande ouverte).
  const k = i.R.nostrilOpening === null ? 1 : 0.25 + 0.75 * i.R.nostrilOpening;
  // Demi-axes de l'ouverture : on retire le rebord de chaque côté, puis on applique le facteur d'ouverture ; jamais plus grand que le contour.
  const a = Math.max(0.3, (n.a - 0.5 * rimPx) * Math.sqrt(k));
  const b = Math.max(0.2, (n.b - rimPx) * Math.sqrt(k));
  return { side: n.side, outer: n.poly, aperture: dropPoly(n.c, Math.min(a, n.a), Math.min(b, n.b), n.tiltDeg, n.side), rimPx };
}

export function noseRegions(i: RegionInputs): NoseRegionsGeo {
  const { F, lm, p, R } = i;
  const H = F.H;
  const baseHalf = baseHalfAt(F, R.baseWidth);
  const y0 = F.baseY - 0.004 * H;
  const depthPx = (0.004 + 0.012 * p.nose.base.depth) * H;
  // Base : trapèze sous les narines ; large au niveau des attaches des ailes, resserré (1,6 × la columelle) vers le philtrum.
  const base = { halfWidth: baseHalf, y: y0, depthPx, poly: [{ x: -baseHalf, y: y0 }, { x: baseHalf, y: y0 }, { x: F.colHalf * 1.6, y: y0 + depthPx }, { x: -F.colHalf * 1.6, y: y0 + depthPx }] };
  // Columelle : de la pointe (sous-pointe) au-delà de la base d'une descente `hang` (arbitrée : ne touche jamais la lèvre).
  const bottomY = F.baseY + (0.006 + 0.012 * R.columellaHang) * H;
  const topY = F.tipY;
  const col = { half: F.colHalf, topY, bottomY, poly: [{ x: -F.colHalf, y: topY }, { x: F.colHalf, y: topY }, { x: F.colHalf * 1.25, y: bottomY }, { x: -F.colHalf * 1.25, y: bottomY }] };
  // Philtrum : de la columelle (demi-largeur 1,1 × colHalf) à la lèvre ; sa largeur au bas est une part de la demi-bouche (de 12 % à 36 %).
  const topLip = lm.lips.topY;
  const bottomHalf = lm.lips.half * (0.12 + 0.24 * R.philtrumWidth);
  const topHalf = F.colHalf * 1.1;
  const y1 = bottomY + 0.002 * H;
  const column = (s: -1 | 1): Vec[] => catmullRom([{ x: s * topHalf, y: y1 }, { x: s * (topHalf + bottomHalf) * 0.5, y: (y1 + topLip) / 2 }, { x: s * bottomHalf, y: topLip }], false, 6);
  const philtrum = {
    poly: [{ x: -topHalf, y: y1 }, { x: topHalf, y: y1 }, { x: bottomHalf, y: topLip }, { x: -bottomHalf, y: topLip }],
    groove: [{ x: 0, y: y1 }, { x: 0, y: topLip }],
    columns: { left: column(-1), right: column(1) },
    // Bande de transition avec la lèvre : ellipse centrée sur le haut de la lèvre ; plus large et plus haute quand `blend` est grand (fondu).
    lipBand: { c: { x: 0, y: topLip }, rx: bottomHalf * (1.2 + 0.6 * p.nose.philtrum.blend), ry: (0.008 + 0.01 * p.nose.philtrum.blend) * H },
    lengthPx: topLip - y1,
  };
  const wl = sidewall(i, -1);
  const wr = sidewall(i, 1);
  return {
    sidewalls: { left: wl, right: wr },
    domes: { left: dome(i, -1), right: dome(i, 1) },
    grooves: { left: groove(i, i.alae.left), right: groove(i, i.alae.right) },
    base,
    columella: col,
    nostrils: { left: nostril(i, i.nostrils.left), right: nostril(i, i.nostrils.right) },
    philtrum,
    constraints: R.applied,
  };
}

/** Miroir d'un point (exporté pour les tests de symétrie). */
export const mirrorPoint = mirror;

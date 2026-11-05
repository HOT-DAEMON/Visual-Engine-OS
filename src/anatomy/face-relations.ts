import { earGeometry, halfWidthAt, rightSamples, type FaceLandmarks, type NoseGeometry } from '../face';
import { inPoly } from '../face/poly';
import type { FaceParams } from '../schema';
import type { PublishedOrbits } from './orbit';
import type { Relation, RelationKind } from './relations';

/**
 * RELATIONS EXPLICITES du visage (docs/FACE-RELATIONS.md) : nez, bouche, oreille, mâchoire, cheveux — chacune avec ses voisins, ses trois familles
 * (géométrique : où c'est posé · anatomique : à quoi ça doit correspondre · visuelle : comment ça se voit) et sa valeur MESURÉE sur la géométrie
 * réellement produite (repères, `noseGeometry`, `earGeometry`, orbites publiées) — jamais lue dans un paramètre.
 * Les seuils anatomiques sont des CANONS larges (proportions classiques), pas des cibles : ils signalent les cas aberrants, ils ne normalisent pas les visages.
 * Convention de valeur : toutes les relations s'écrivent `valeur <= limite` ou `valeur >= limite` ; les bornes à deux côtés sont deux relations.
 */
export function faceRelations(p: FaceParams, lm: FaceLandmarks, nose: NoseGeometry, published?: PublishedOrbits): Relation[] {
  const out: Relation[] = [];
  const H = lm.H, rs = rightSamples(lm.outline), hw = (y: number): number => halfWidthAt(lm.outline, y, rs);
  const rel = (id: string, kind: RelationKind, between: readonly [string, string], value: number, limit: number, cmp: '<=' | '>=', unit: string, message: string, severity: 'error' | 'warn' = 'error'): void => {
    out.push({ id, kind, between, value, limit, cmp, unit, message, severity });
  };

  // ---- NEZ ↔ yeux, bouche, visage ------------------------------------------------------------------------------------------------
  const interCanthal = lm.innerCanthus.right.x - lm.innerCanthus.left.x;
  const alarVsEyes = nose.widthPx / interCanthal;
  rel('nose.alar-vs-intercanthal.wide', 'anatomical', ['nose', 'eye'], alarVsEyes, 1.9, '<=', 'rapport', "les ailes du nez sont bien plus larges que l'écart entre les yeux (canon ≈ 1)", 'warn');
  rel('nose.alar-vs-intercanthal.narrow', 'anatomical', ['nose', 'eye'], alarVsEyes, 0.45, '>=', 'rapport', "les ailes du nez sont bien plus étroites que l'écart entre les yeux (canon ≈ 1)", 'warn');
  rel('nose.base-below-eyes', 'geometric', ['nose', 'eye'], lm.eyeY - nose.baseY, 0, '<=', 'px', 'la base du nez remonte au niveau des yeux');
  rel('nose.tip-above-lips', 'geometric', ['nose', 'mouth'], nose.tip.c.y + nose.tip.ry - lm.lips.topY, 0, '<=', 'px', 'la pointe du nez descend sur la lèvre supérieure');
  rel('nose.within-face', 'anatomical', ['nose', 'face'], Math.max(...nose.alae.left.poly.map((q) => Math.abs(q.x)), ...nose.alae.right.poly.map((q) => Math.abs(q.x))) / hw(nose.baseY), 0.6, '<=', 'rapport', 'le nez occupe plus de 60 % de la demi-largeur du visage à sa base');
  const nostrilsOut = [nose.nostrils.left, nose.nostrils.right].reduce((n, s) => n + s.poly.filter((q) => !inPoly(nose.silhouette, q.x, q.y)).length, 0);
  rel('nose.nostrils-in-silhouette', 'geometric', ['nose', 'nose'], nostrilsOut, 0, '<=', 'points', 'une narine sort de la silhouette du nez');
  rel('nose.centered', 'geometric', ['nose', 'face'], Math.abs(nose.tip.c.x) / lm.W, 0.04, '<=', 'fraction de W', "la pointe du nez est loin de l'axe du visage");

  // ---- BOUCHE ↔ nez, menton, visage ------------------------------------------------------------------------------------------------
  const lowerFace = lm.chinY - lm.noseBaseY, share = (lm.mouthY - lm.noseBaseY) / lowerFace;
  rel('mouth.below-nose', 'geometric', ['mouth', 'nose'], lm.noseBaseY - lm.lips.topY, 0, '<=', 'px', 'la lèvre supérieure remonte au-dessus de la base du nez');
  rel('mouth.above-chin-sulcus', 'geometric', ['mouth', 'chin'], lm.lips.bottomY - lm.chin.sulcusY, 0, '<=', 'px', 'la lèvre inférieure descend sous le sillon mentolabial');
  rel('mouth.lower-face-share.low', 'anatomical', ['mouth', 'face'], share, 0.12, '>=', 'part', "la bouche est collée sous le nez (canon : un tiers de la hauteur nez → menton)", 'warn');
  rel('mouth.lower-face-share.high', 'anatomical', ['mouth', 'face'], share, 0.55, '<=', 'part', 'la bouche est loin sous le nez (canon : un tiers de la hauteur nez → menton)', 'warn');
  rel('mouth.within-face', 'anatomical', ['mouth', 'face'], lm.lips.half / hw(lm.mouthY), 0.8, '<=', 'rapport', 'les commissures approchent le contour du visage');
  rel('mouth.vs-nose-width', 'anatomical', ['mouth', 'nose'], (2 * lm.lips.half) / nose.widthPx, 3.2, '<=', 'rapport', 'la bouche est plus de 3 fois plus large que le nez (canon ≈ 1,5)', 'warn');

  // ---- OREILLES ↔ yeux, nez, contour ------------------------------------------------------------------------------------------------
  for (const e of earGeometry(p, lm)) {
    const s = e.side === -1 ? 'left' : 'right', top = Math.min(...e.poly.map((q) => q.y)), bottom = Math.max(...e.poly.map((q) => q.y));
    rel(`ear.top-vs-brow.${s}`, 'anatomical', ['ear', 'brow'], lm.browLimitY - 0.06 * H - top, 0, '<=', 'px', "le haut de l'oreille monte bien au-dessus de l'arcade (canon : au niveau des sourcils)", 'warn');
    rel(`ear.top-below-eye-line.${s}`, 'anatomical', ['ear', 'eye'], top - (lm.eyeY + 0.04 * H), 0, '<=', 'px', "le haut de l'oreille descend sous la ligne des yeux", 'warn');
    rel(`ear.bottom-vs-nose-base.${s}`, 'anatomical', ['ear', 'nose'], Math.abs(bottom - lm.noseBaseY) / H, 0.1, '<=', 'part de H', "le bas de l'oreille est loin de la base du nez (canon : au même niveau)", 'warn');
    rel(`ear.attached-outside.${s}`, 'geometric', ['ear', 'cranium'], hw(e.c.y) - e.side * e.c.x * 1 - e.rx * 0.9, 0, '<=', 'px', "l'oreille est posée à l'intérieur du contour du crâne");
  }

  // ---- MÂCHOIRE ↔ bouche, menton, cou, contour ------------------------------------------------------------------------------------------------
  const g = lm.jaw.gonion;
  // Angle de la mâchoire : au-dessus de la base du nez = avertissement (défaut mesuré : 12 visages sur 200 (6 %), pire 27 px ; une borne dans le résolveur de `face/landmarks.ts` a été essayée puis retirée, voir docs/FACE-RELATIONS.md) ; mesuré 4 nov. 2026 sur 200 visages : il se place en médiane 0,06 H AU-DESSUS de la ligne de la bouche
  // (canon frontal : vers le niveau des lèvres), jusqu'à 0,2 H : au-delà de 0,15 H c'est signalé, pas bloqué (choix de style, dette documentée).
  rel('jaw.gonion-below-nose-base', 'anatomical', ['mandible', 'nose'], nose.baseY - g.y, 0, '<=', 'px', "l'angle de la mâchoire remonte au-dessus de la base du nez (défaut du générateur : voir docs/FACE-RELATIONS.md)", 'warn');
  rel('jaw.gonion-vs-mouth-line', 'anatomical', ['mandible', 'mouth'], (lm.mouthY - g.y) / H, 0.15, '<=', 'part de H', "l'angle de la mâchoire est très au-dessus de la ligne de la bouche (canon : au niveau des lèvres)", 'warn');
  rel('jaw.gonion-above-chin', 'anatomical', ['mandible', 'chin'], g.y - lm.chinY, 0, '<=', 'px', "l'angle de la mâchoire descend sous le menton");
  rel('jaw.gonion-on-outline', 'geometric', ['mandible', 'face'], Math.abs(Math.abs(g.x) - hw(g.y)) / lm.W, 0.03, '<=', 'fraction de W', "le coin de la mâchoire n'est pas sur le contour du visage");
  rel('jaw.chin-narrower-than-jaw', 'anatomical', ['chin', 'mandible'], lm.chin.half - Math.abs(g.x), 0, '<=', 'px', 'le menton est plus large que la mâchoire à son angle');
  rel('jaw.neck-narrower-than-jaw', 'anatomical', ['neck', 'mandible'], lm.neck.half - Math.abs(g.x), 0, '<=', 'px', "le cou est plus large que la mâchoire à son angle (le cou doit rester caché derrière)", 'warn');

  // ---- CHEVEUX ↔ front, orbites, tempes ------------------------------------------------------------------------------------------------
  rel('hair.hairline-above-brow', 'anatomical', ['hair', 'forehead'], lm.hair.centerY - lm.browLimitY, 0, '<=', 'px', "la naissance des cheveux descend sous l'arcade");
  rel('hair.hairline-in-head', 'geometric', ['hair', 'cranium'], -H / 2 - lm.hair.centerY, 0, '<=', 'px', 'la naissance des cheveux sort du haut du crâne');
  rel('hair.temple-above-eye-line', 'anatomical', ['hair', 'eye'], lm.hair.templeY - lm.eyeY, 0, '<=', 'px', 'la tempe de la ligne capillaire descend sous la ligne des yeux');
  rel('hair.forehead-share.low', 'anatomical', ['hair', 'forehead'], (lm.browLimitY - lm.hair.centerY) / H, 0.04, '>=', 'part de H', 'le front visible est presque nul (frange basse ou ligne capillaire très basse)', 'warn');
  if (published) for (const s of ['left', 'right'] as const) {
    const o = published[s];
    rel(`hair.hairline-clear-of-orbit.${s}`, 'visual', ['hair', 'orbit'], lm.hair.centerY - (o.cy - o.ry), 0, '<=', 'px', "la ligne capillaire descend dans l'orbite : les cheveux recouvriraient l'œil");
  }
  return out;
}

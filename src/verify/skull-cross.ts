import { hairGeometry } from '../face/hair';
import { facialHairGeometry } from '../face/beard-geometry';
import { faceLandmarks } from '../face/landmarks';
import { headOutline, rightSamples } from '../face/outline';
import { resolveTexture } from '../face/hair/texture';
import { BREADTH_SCALE, CI_BOUNDS, type Derivation } from '../skull/derive';
import type { ProfileEyeData } from '../skull/eye-data';
import { hairHangFrac } from '../skull/hair-shape';
import type { ProfileRender } from '../skull/render';
import type { SkullParams, V2 } from '../skull/types';
import type { FaceParams } from '../schema';
import { check, type Check } from './types';

/**
 * CONTRÔLES CROISÉS FACE ↔ PROFIL : la même tête vue de face et de profil doit s'accorder. Chaque contrôle compare une grandeur MESURÉE dans la vue
 * de profil (géométrie ou SVG émis) à la même grandeur MESURÉE dans la vue de face (contour, repères, géométrie des cheveux et de la pilosité de la face) :
 * rapport largeur/longueur de tête, taille de l'œil, présence et longueur des cheveux, couleur et type de coiffure, pilosité.
 * Un contrôle `error` invalide le rapport ; un `warn` signale un écart esthétique.
 */
export interface CrossInput {
  readonly face: FaceParams;
  /** Dimensions de l'hôte de FACE (px) et œil de face lu par le profil. */
  readonly faceW: number;
  readonly faceH: number;
  readonly eye: ProfileEyeData | null;
  /** Hauteur de la fente de l'œil MESURÉE sur la face (fraction de H) : référence indépendante des données d'œil passées au rendu de profil. */
  readonly faceEyeHeightH?: number;
  readonly skull: SkullParams;
  readonly render: ProfileRender;
  /** Dérivation du crâne (si le crâne en provient) : l'indice mesuré est comparé à l'indice appliqué. */
  readonly derivation?: Derivation;
}

/** Mesures de la vue de face, en fraction de la hauteur sommet → menton (bouche fermée). */
const maxOf = (a: readonly number[]): number => a.reduce((m, v) => (v > m ? v : m), -Infinity);
/** `need` : mesures coûteuses demandées (la géométrie de cheveux de la face est le poste dominant : ~75 ms, calculée seulement quand un contrôle la lit). */
export function faceMeasures(face: FaceParams, W: number, H: number, need: { hair: boolean; beard: boolean } = { hair: true, beard: true }): { breadthH: number; hairBottom: number | null; beardBottom: number | null; eyeLine: number } {
  const lm = faceLandmarks(face, W, H);
  const o = headOutline(face, W, H);
  const base = lm.chinY + H / 2;
  const half = maxOf(rightSamples(o).map((p) => p.x));
  const hg = need.hair ? hairGeometry(face, lm) : null;
  // Chevelure retombante : la masse arrière (`backBase`) est la silhouette ; sinon l'ensemble des masses (les mèches libres isolées ne définissent pas la longueur).
  const ys = hg ? (hg.backBase ? [hg.backBase] : [...hg.front, ...hg.back]).flat().map((p) => p.y) : [];
  const fh = need.beard ? facialHairGeometry(face, lm) : null;
  const bys = (fh ? [fh.beard, fh.mustache, ...fh.sideburns] : []).filter((p): p is NonNullable<typeof p> => !!p).flat().map((p) => p.y);
  return { breadthH: (2 * half) / H, hairBottom: ys.length ? (maxOf(ys) + H / 2) / base : null, beardBottom: bys.length ? (maxOf(bys) + H / 2) / base : null, eyeLine: (lm.eyeY + H / 2) / base };
}

const inPoly = (p: V2, poly: readonly V2[]): boolean => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i] as V2, b = poly[j] as V2; if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c; } return c; };

export function checkCrossView(c: CrossInput): Check[] {
  const { face, render: r } = c;
  const g = r.geo, H = g.H;
  const m = faceMeasures(face, c.faceW, c.faceH, { hair: face.hair.style === 'bob' || face.hair.style === 'long', beard: face.facialHair.beard !== 'none' });
  const out: Check[] = [];
  // --- Rapport largeur / longueur de tête (indice céphalique) -------------------------------------------------------------------------------
  const breadth = BREADTH_SCALE * m.breadthH; // largeur de tête (fraction de H) lue sur le contour de la FACE, avec la convention de la dérivation
  const lengthH = ((g.skin.get('supraglabella') as V2).x - (g.skin.get('opisthocranion') as V2).x) / H;
  const ci = breadth / lengthH;
  const aspect = c.faceW / c.faceH;
  out.push(check('geometry', 'face-width-source', '<=', Math.abs(m.breadthH - aspect), 1e-6, 'la largeur de tête lue par le profil n’est pas la largeur maximale du contour de la face'));
  out.push(check('anatomy', 'cephalic-index-range', '>=', ci, CI_BOUNDS[0] - 0.02, 'indice céphalique du profil trop bas (tête trop longue pour sa largeur de face)'));
  out.push(check('anatomy', 'cephalic-index-range-max', '<=', ci, CI_BOUNDS[1] + 0.02, 'indice céphalique du profil trop haut (tête trop courte pour sa largeur de face)'));
  // La longueur mesurée diffère de la longueur dérivée par la projection de l'occiput (± 0,017 H ≈ ± 0,02 d'indice) et par le bornage éventuel de `length` : tolérance 0,035.
  if (c.derivation) out.push(check('geometry', 'cephalic-index-matches-derivation', '<=', Math.abs(ci - c.derivation.ci.applied), 0.035, 'l’indice céphalique mesuré s’écarte de celui dérivé de la face (au-delà de l’occiput et du bornage)'));
  // --- Œil ----------------------------------------------------------------------------------------------------------------------------------
  if (c.eye && r.shapes.eye) {
    const e = r.shapes.eye;
    out.push(check('geometry', 'eye-height-matches-face', '<=', Math.abs(e.hp / H / (c.faceEyeHeightH ?? c.eye.heightH) - 1), 0.02, 'la hauteur de l’œil de profil diffère de celle de l’œil de face (rapport à la hauteur de tête)'));
    out.push(check('geometry', 'eye-line-matches-face', '<=', Math.abs(e.cy / H - m.eyeLine), 1e-9, 'la ligne des yeux du profil diffère de celle de la face'));
    const poly = g.poly;
    const inside = [e.A, e.T, e.B, { x: e.cx - 0.02 * e.dp, y: e.cy }].every((p) => inPoly(p, poly));
    out.push(check('anatomy', 'eye-inside-head', '==', Number(inside), 1, 'l’œil de profil sort du contour de la tête'));
    out.push(check('anatomy', 'iris-inside-eye', '==', Number(e.iris.cx - e.iris.rx >= e.A.x && e.iris.cx <= e.cx && e.iris.cy >= e.top && e.iris.cy <= e.bottom), 1, 'le centre de l’iris sort de la fente palpébrale (les paupières, elles, peuvent recouvrir le bord de l’iris : il est découpé par la fente)'));
    out.push(check('anatomy', 'brow-above-eye', '>=', e.top - (e.brow.yFront + e.brow.th / 2), 0, 'le sourcil de profil descend sur l’œil'));
    out.push(check('anatomy', 'brow-below-supraglabella', '>=', e.brow.yFront - e.brow.th / 2 - g.frame.f.supra * H, 0, 'le sourcil dépasse l’arcade (supra-glabelle)'));
    const hex = r.svg.match(/id="sk-iris"[^>]*>(?:<stop[^>]*stop-color="(#[0-9a-f]{6})"[^>]*>){3}/i);
    out.push(check('style', 'iris-color-matches-face', '==', Number(!!hex && hex[0].toLowerCase().includes(c.eye.iris.mid.toLowerCase())), 1, 'la couleur de l’iris de profil diffère de celle de la face'));
  }
  // --- Cheveux : présence, type, texture, couleur, longueur -----------------------------------------------------------------------------------
  const hs = r.shapes.hair, h = face.hair;
  if (c.skull.hair === 'auto') {
    out.push(check('anatomy', 'hair-presence-matches-face', '==', Number(!!hs), Number(h.style !== 'bald'), 'cheveux présents d’un côté et absents de l’autre'));
    if (hs) {
      out.push(check('anatomy', 'hair-style-matches-face', '==', Number(hs.style === h.style), 1, 'le type de coiffure de profil diffère de celui de la face'));
      out.push(check('anatomy', 'hair-texture-matches-face', '==', Number(hs.texture === resolveTexture(h.style, h.texture)), 1, 'la texture des cheveux de profil diffère de celle de la face'));
      const col = r.svg.match(/id="sk-hair-grad"[^>]*>(?:<stop[^>]*>){1}<stop offset="0.3" stop-color="(#[0-9a-f]{6})"/i);
      out.push(check('style', 'hair-color-matches-face', '==', Number(col?.[1]?.toLowerCase() === h.color.toLowerCase()), 1, 'la couleur des cheveux de profil diffère de celle de la face'));
      // Longueur : la chevelure retombante descend aussi bas en profil qu'en face (tolérance : variation de longueur de mèche + pointes) ;
      // les coiffures non retombantes restent au-dessus de la mâchoire des deux côtés.
      const faceBottom = m.hairBottom ?? 0, profBottom = hs.bottom / H;
      const hangs = h.style === 'bob' || h.style === 'long';
      if (hangs) out.push(check('anatomy', 'hair-length-matches-face', '<=', Math.abs(profBottom - faceBottom), 0.12, 'la longueur des cheveux de profil diffère de celle de la face (fraction de la hauteur de tête)', 'warn'));
      const jaw = g.frame.f.jawY;
      if (hangs) out.push(check('anatomy', 'hair-reaches-jaw-matches-face', '==', Number(profBottom >= jaw === faceBottom >= jaw || Math.abs(profBottom - faceBottom) <= 0.04), 1, 'les cheveux dépassent la mâchoire dans une vue et pas dans l’autre', 'warn'));
      out.push(check('anatomy', 'hair-hang-formula', '<=', hangs ? Math.abs(hs.bottom / H - hairHangFrac(h, g.frame.f.jawY)) : 0, 0.07, 'la chevelure retombante s’écarte de la formule de retombée partagée avec la face', 'warn'));
    }
  }
  // --- Pilosité faciale ---------------------------------------------------------------------------------------------------------------------
  const fh = face.facialHair;
  const hasFace = fh.beard !== 'none' || fh.mustache !== 'none' || fh.sideburns !== 'none';
  out.push(check('anatomy', 'facial-hair-presence-matches-face', '==', Number(!!r.shapes.beard), Number(hasFace), 'pilosité faciale présente d’un côté et absente de l’autre'));
  if (r.shapes.beard && fh.beard !== 'none' && m.beardBottom !== null) out.push(check('anatomy', 'beard-length-matches-face', '<=', Math.abs(r.shapes.beard.bottom / H - m.beardBottom), 0.12, 'la longueur de la barbe de profil diffère de celle de la face', 'warn'));
  return out;
}

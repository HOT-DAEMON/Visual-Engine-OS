import { svgCostMs, svgFeatures, SVG_COST_MAX_MS } from './eye-cost';
import { IRIS_FIT, applyTurnAbout, turnedHalfExtents, apparentWidthRatio, edgeFrames, edgePolygon, eyeEdges, eyeTurn, openingPolygon, eyeLashSet, upperFrame, lowerFrame, placeHighlights, pupilOccludedByStar, pupilContours, scleraVessels, microLod, type Vec } from '../geometry/eye';
import { halfVectorXY, lightVector, toLocal, type LightVector } from '../lighting/light';
import { rotateLightForHeadTurn } from '../lighting/head-turn';
import { compileEye, resolveEye, withAutoLod } from '../render/eye/eye';
import { irisCenter, irisRadii } from '../render/eye/helpers';
import { dominantColor } from '../materials';
import { EyeSpec } from '../schema';
import { REFERENCE_LIGHT } from './face-engine';
import { checkEyeEnvelope } from './eye-envelope';
import { checkEyeCornea } from './eye-cornea';
import { checkEyeLashes, type LashMetrics } from './eye-lashes';
import { checkCanthusLines } from './eye-canthus-lines';
import { checkEyeAppearance } from './eye-appearance';
import { isFlat } from '../render/eye/flat-finish';
import { check, report, type Check, type Report } from './types';

/**
 * VÉRIFICATION DU RENDU D'UN ŒIL — trois couches chiffrées (même contrat que `verifyFace`, voir types.ts) :
 *  - geometry : nombres finis (spec ET svg), ouverture simple (sans auto-intersection) et d'aire > 0, iris qui rencontre l'ouverture, pupille(s)
 *    STRICTEMENT dans l'iris, reflets confinés, vaisseaux hors iris, œil non retourné derrière le crâne (modèle sphère) ;
 *  - anatomy  : proportions iris/ouverture, pupille/iris, aspect de l'iris, fraction d'iris visible (paupière haute), centre de l'iris dans
 *    l'ouverture, reflet physique du côté de la lumière ;
 *  - style    : coût (filtres, poids du SVG), contraste iris/sclère, pupille plus sombre que l'iris, reflets plus clairs que l'iris.
 * `error` invalide le rapport ; `warn` signale un défaut esthétique ou de plausibilité sans l'invalider (les styles stylisés — chibi, cercle… —
 * sortent volontairement des bornes humaines : ils déclenchent des `warn`, jamais des `error`).
 */
const lum = (hex: string): number => {
  const c = [1, 3, 5].map((i) => { const v = parseInt(hex.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * (c[0] as number) + 0.7152 * (c[1] as number) + 0.0722 * (c[2] as number);
};
const ccw = (a: Vec, b: Vec, c: Vec): number => (c.y - a.y) * (b.x - a.x) - (b.y - a.y) * (c.x - a.x);
const crosses = (a: Vec, b: Vec, c: Vec, d: Vec): boolean => ccw(a, c, d) * ccw(b, c, d) < 0 && ccw(a, b, c) * ccw(a, b, d) < 0;
const inside = (p: Vec, poly: readonly Vec[]): boolean => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i] as Vec; const b = poly[j] as Vec;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
};
const area = (poly: readonly Vec[]): number => Math.abs(poly.reduce((s, p, i) => { const q = poly[(i + 1) % poly.length] as Vec; return s + (p.x * q.y - q.x * p.y); }, 0)) / 2;

export interface EyeMetrics {
  readonly openingArea: number;
  readonly irisToOpeningWidth: number;
  readonly pupilToIris: number;
  readonly irisVisible: number;
  readonly filters: number;
  readonly svgBytes: number;
  readonly lashes: LashMetrics;
}
export interface EyeReport extends Report { readonly metrics: EyeMetrics; }

export function verifyEye(input: unknown, light: LightVector = lightVector(REFERENCE_LIGHT)): EyeReport {
  const raw = EyeSpec.parse(input);
  const eye = resolveEye(raw);
  const out: Check[] = [];
  const { g0, turned, g } = eyeTurn(eye); const ht = eye.headTurn;
  const lodEye = withAutoLod(eye, 1, apparentWidthRatio(g0, turned)).eye; // exactement l'œil que le rendu dessine (LOD, raccourcissement de rotation compris)
  const edges = eyeEdges(lodEye, g); const fr = edges ? edgeFrames(g, edges) : null; // bords irréguliers : cils et contour lus sur le tracé réellement dessiné
  const { rx: irisRx, ry: irisRy } = irisRadii(eye);
  const c = irisCenter(eye, g, turned?.jac ?? null);
  const poly = edges ? edgePolygon(edges) : openingPolygon(g);
  const compiled = compileEye(raw, light);
  const svg = compiled.defs.join('') + compiled.markup;

  // ---- geometry ----------------------------------------------------------------------------------------------
  const ctrl = [g.pi, g.po, g.u1, g.u2, g.l1, g.l2, c];
  out.push(check('geometry', 'eye-finite', '==', Number(ctrl.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))), 1, 'une coordonnée de l’enveloppe ou du centre de l’iris n’est pas finie'));
  out.push(check('geometry', 'svg-finite', '==', Number(!/NaN|Infinity|undefined/.test(svg)), 1, 'le SVG contient NaN, Infinity ou undefined'));
  let selfX = 0;
  for (let i = 0; i < poly.length; i++) for (let j = i + 2; j < poly.length; j++) {
    if (i === 0 && j === poly.length - 1) continue;
    if (crosses(poly[i] as Vec, poly[(i + 1) % poly.length] as Vec, poly[j] as Vec, poly[(j + 1) % poly.length] as Vec)) selfX++;
  }
  out.push(check('geometry', 'opening-simple', '==', selfX, 0, 'l’ouverture palpébrale se recoupe elle-même'));
  const openingArea = area(poly);
  out.push(check('geometry', 'opening-area', '>=', openingArea / (g.w * g.h || 1), 0.15, 'ouverture quasi dégénérée (aire trop petite devant w × h)'));
  // Rotation de tête (modèle `sphere`) : le rendu dessine l'iris dans son repère puis lui applique la matrice locale de la projection (`turnT`, globe-inner.ts) — on mesure l'iris TEL QUE DESSINÉ.
  const turnJac = turned?.jac ?? null;
  const toDrawn = (p: Vec): Vec => (turnJac ? applyTurnAbout(p, c, turnJac) : p);
  const ring = Array.from({ length: 24 }, (_, i) => toDrawn({ x: c.x + Math.cos((i / 24) * Math.PI * 2) * irisRx, y: c.y + Math.sin((i / 24) * Math.PI * 2) * irisRy }));
  const irisVisible = [c, ...ring].filter((p) => inside(p, poly)).length / (ring.length + 1);
  out.push(check('geometry', 'iris-meets-opening', '>=', irisVisible, 0.2, 'l’iris est presque entièrement hors de l’ouverture'));
  const pc = pupilContours(eye.pupil, eye.pupil.size, irisRx, irisRy, eye.seed);
  const worst = Math.max(...pc.contours.flatMap((k) => k.map((p) => Math.hypot(p.x / irisRx, p.y / irisRy))));
  out.push(check('geometry', 'pupil-inside-iris', '<=', worst, IRIS_FIT, 'la pupille sort de l’iris'));
  if (eye.highlights.list.length) {
    const L = toLocal(rotateLightForHeadTurn(light, ht.yawDeg, ht.pitchDeg), eye.transform.rotationDeg);
    const placed = placeHighlights(eye.highlights.list, { c, irisRx, irisRy, half: halfVectorXY(L), bbox: g.bbox });
    const bad = placed.filter((p) => {
      const m = toDrawn({ x: p.cx, y: p.cy }); const h = turnJac ? turnedHalfExtents(p.rx, p.ry, turnJac) : { rx: p.rx, ry: p.ry }; // centre et demi-axes de l'ellipse comprimée, comme dessinée
      return m.x - h.rx < g.bbox.x - 1e-6 || m.x + h.rx > g.bbox.x + g.bbox.w + 1e-6 || m.y - h.ry < g.bbox.y - 1e-6 || m.y + h.ry > g.bbox.y + g.bbox.h + 1e-6;
    }).length;
    out.push(check('geometry', 'highlights-confined', '==', bad, 0, 'un reflet sort de la boîte de l’ouverture'));
  }
  if (eye.microdetail?.vessels) {
    const vs = scleraVessels(g, c, irisRx, irisRy, eye.microdetail.vessels, eye.seed, microLod(lodEye.microdetail?.lod.eyePixels ?? null));
    const inIris = vs.flatMap((v) => v.pts).filter((p) => Math.hypot((p.x - c.x) / irisRx, (p.y - c.y) / irisRy) < 1).length;
    out.push(check('geometry', 'vessels-outside-iris', '==', inIris, 0, 'des vaisseaux traversent l’iris'));
  }
  if (turned) out.push(check('geometry', 'eye-facing-camera', '>=', turned.facing, 0.05, 'l’œil est passé derrière le crâne (rotation trop forte pour sa position)'));

  out.push(...checkEyeCornea(raw, eye, g0)); // cornée (réfraction) et bords palpébraux irréguliers : geometry / anatomy / style (eye-cornea.ts)
  out.push(...checkEyeEnvelope(g0, eye.shape.style, irisRy)); // enveloppe vs références mesurées (geometry / anatomy / style)
  const lashTh = eye.lids.thickness * eye.shape.height;
  const lashCheck = checkEyeLashes(eye, g, lashTh, eyeLashSet(lodEye, g, lashTh, edges), fr?.upper ?? ((t) => upperFrame(g, t)), fr?.lower ?? ((t) => lowerFrame(g, t)), poly); // cils : géométrie / anatomie / style (eye-lashes.ts)
  out.push(...lashCheck.checks);
  out.push(...checkCanthusLines(lodEye, g, lashTh, poly, isFlat(lodEye))); // plis des canthi (07G) : géométrie, anatomie, style
  out.push(...checkEyeAppearance(raw, irisRx, g.hEff, withAutoLod(eye, 1, apparentWidthRatio(g0, turned)).eyePx / eye.shape.width)); // leviers d'apparence (passe 20) : bande, ombre portée, reflets, opacité

  // ---- anatomy -----------------------------------------------------------------------------------------------
  const irisToOpening = (2 * irisRx) / (g.bbox.w || 1);
  out.push(check('anatomy', 'iris-to-opening-width', '>=', irisToOpening, 0.22, 'iris très petit devant l’ouverture', 'warn'));
  out.push(check('anatomy', 'iris-to-opening-width-max', '<=', irisToOpening, 0.95, 'iris plus large que l’ouverture (style non réaliste)', 'warn'));
  const pupilToIris = pc.contours.length === 1 ? Math.max(...pc.contours[0]!.map((p) => Math.hypot(p.x / irisRx, p.y / irisRy))) : worst;
  out.push(check('anatomy', 'pupil-to-iris', '<=', pupilToIris, 0.8, 'pupille dilatée au-delà de 80 % du rayon de l’iris', 'warn'));
  out.push(check('anatomy', 'iris-aspect', '<=', eye.iris.aspect, 1.35, 'iris trop allongé verticalement', 'warn'));
  out.push(check('anatomy', 'iris-visible-fraction', '>=', irisVisible, 0.5, 'plus de la moitié de l’iris est cachée par les paupières', 'warn'));
  out.push(check('anatomy', 'iris-center-in-opening', '==', Number(inside(c, poly)), 1, 'le centre de l’iris est hors de l’ouverture (regard impossible)'));
  const refl = eye.highlights.list.filter((h) => h.kind === 'reflection' && h.anchor === 'light' && h.role === 'primary');
  if (refl.length) {
    const L = toLocal(rotateLightForHeadTurn(light, ht.yawDeg, ht.pitchDeg), eye.transform.rotationDeg);
    const half = halfVectorXY(L);
    const [p] = placeHighlights(refl, { c, irisRx, irisRy, half, bbox: g.bbox });
    const dot = p ? (p.cx - c.x) * half.x + (p.cy - c.y) * half.y : 0;
    out.push(check('anatomy', 'reflection-faces-light', '>=', dot, 0, 'le reflet physique est du côté opposé à la lumière'));
  }

  // ---- style -------------------------------------------------------------------------------------------------
  const filters = (svg.match(/<filter /g) ?? []).length;
  const svgCost = svgCostMs(svgFeatures(svg));
  const svgBytes = svg.length;
  out.push(check('style', 'filter-budget', '<=', filters, 14, 'trop de filtres SVG (coût de rastérisation)', 'warn'));
  out.push(check('style', 'svg-cost', '<=', svgCost, SVG_COST_MAX_MS, 'coût de rastérisation prédit trop élevé (applications de filtre surtout ; modèle mesuré, voir eye-cost.ts)', 'warn'));
  const irisBase = dominantColor(eye.iris.material.base);
  const scl = dominantColor(eye.sclera.base);
  out.push(check('style', 'iris-sclera-contrast', '>=', Math.abs(lum(scl) - lum(irisBase)), 0.1, 'iris et sclère trop proches en luminance', 'warn'));
  const pupilFill = eye.pupil.fill.type === 'solid' ? eye.pupil.fill.color : dominantColor(eye.pupil.fill);
  if (!pupilOccludedByStar(eye)) out.push(check('style', 'pupil-darker-than-iris', '>=', lum(irisBase) - lum(pupilFill), 0.02, 'pupille plus claire que l’iris (non évaluée si une étoile centrée la noie : réfs 04 / 10a / 10b)', 'warn'));

  const r = report(out);
  return { ...r, metrics: { openingArea, irisToOpeningWidth: irisToOpening, pupilToIris, irisVisible, filters, svgBytes, lashes: lashCheck.metrics } };
}

import { cheekLevels, cheekRelief } from './engines/cheek-relief';
import { farEarSide } from './engines/ear-cull';
import { headRelief } from './engines/head-relief';
import { neckSection } from './engines/neck3d';
import { skullAsymmetry, skullRelief } from './engines/skull-relief';
import { maskIoU } from './verify-geo';
import { headMesh, PART } from './mesh';
import { sectionAt } from './sections';
import type { HeadTurnSpec, TurnRender } from './types';
import { check, type Check } from './verify-types';

/**
 * COUCHE DE VÉRIFICATION DES RELIEFS de la tête (bosses pariétales, asymétrie du crâne, joues, oreille lointaine, jonction cou / épaules). Trois couches, comme le reste de la vérification :
 *   géométrie : amplitude bornée, continuité (pas de falaise), la face (0°, < 4°) et la largeur (90°) restent celles des moteurs, le maillage ne dépasse jamais la demi-largeur de la section ;
 *   anatomie  : éminence pariétale derrière l'oreille et au tiers supérieur de la voûte, pommette entre la ligne des yeux et la bouche, asymétrie du crâne plausible (silhouette de dos presque symétrique) ;
 *   style     : oreille lointaine omise à 20° (convention de la planche) et présente à 0° ; cou évasé vers les trapèzes sans marche.
 * Les bornes sont des CONVENTIONS d'anatomie artistique, écrites avant la mesure et justifiées dans `docs/HEAD-TURNTABLE-RELIEF-VERIFY.md` ; aucune n'a été ajustée pour faire passer un rendu.
 */
type Rend = { at: (yaw: number, pitch0?: boolean) => TurnRender };
const D = 180 / Math.PI;

/** Balayage de la grille (y, azimut) : maximum, minimum de f et position du maximum ; pas de 0,0125 U et de 3°. */
function scan(f: (y: number, th: number) => number, y0: number, y1: number): { max: number; min: number; yMax: number; azMax: number; maxStep: number } {
  let max = -Infinity, min = Infinity, yMax = 0, azMax = 0, maxStep = 0;
  for (let y = y0; y <= y1 + 1e-9; y += 0.0125) for (let az = 0; az <= 180; az += 3) {
    const v = f(y, az / D); if (v > max) { max = v; yMax = y; azMax = az; } if (v < min) min = v;
    if (az > 0) maxStep = Math.max(maxStep, Math.abs(v - f(y, (az - 3) / D)));
    if (y > y0 + 1e-9) maxStep = Math.max(maxStep, Math.abs(v - f(y - 0.0125, az / D)));
  }
  return { max, min, yMax, azMax, maxStep };
}

export function reliefGeometryChecks(spec: HeadTurnSpec): Check[] {
  const e = spec.engine, rel = headRelief(e), G = 'geometry' as const;
  if (!e || !rel) return [];
  const c: Check[] = [], all = scan(rel, 0.02, 1.0);
  c.push(check(G, 'head.geo.relief.amplitude', 'Relief (crâne + joues) : amplitude radiale maximale en valeur absolue (U) [≈ 0,03 U ≈ 6 mm d\'une tête de 230 mm]', Math.max(Math.abs(all.max), Math.abs(all.min)), 0, 0.04));
  c.push(check(G, 'head.geo.relief.continuity', 'Relief : plus grand saut entre deux échantillons voisins (0,0125 U ou 3°) : une falaise ferait une arête dans le maillage', all.maxStep, 0, 0.012));
  c.push(check(G, 'head.geo.relief.face', 'Relief : déplacement maximal à moins de 4° du plan de face (U) : le nez, les lèvres et le profil à 90° restent ceux des moteurs', Math.max(...[0.1, 0.3, 0.5, 0.7, 0.9].map((y) => Math.abs(rel(y, 2 / D)))), 0, 0.002));
  const cheekSide = scan((y, th) => cheekRelief(e, y, th), 0.45, 1.0);   // les joues s'éteignent avant le côté : le contour de face reste celui du moteur de visage
  c.push(check(G, 'head.geo.cheek.side', 'Joues : déplacement à 90° (U) : la silhouette de face à 0° est le contour du moteur de visage', Math.max(...[0.55, 0.65, 0.75, 0.85].map((y) => Math.abs(cheekRelief(e, y, Math.PI / 2)))), 0, 0.001));
  void cheekSide;
  const m = headMesh(spec, 96, 0.025);
  let over = 0;
  for (let i = 0; i < m.P.length; i++) { const p = m.P[i]!; if (Math.abs(p.x) > sectionAt(spec, p.y).a + 1e-9) over = Math.max(over, Math.abs(p.x) - sectionAt(spec, p.y).a); }
  c.push(check(G, 'head.geo.relief.width', 'Maillage : dépassement de la demi-largeur de la section par le relief (U)', over, 0, 1e-9));
  return c;
}

export function reliefAnatomyChecks(spec: HeadTurnSpec, R: Rend): Check[] {
  const e = spec.engine, rel = headRelief(e), A = 'anatomy' as const;
  if (!e || !rel) return [];
  const c: Check[] = [], sk = scan((y, th) => skullRelief(e, y, th), 0.05, 0.7);
  c.push(check(A, 'head.anat.parietal.height', 'Éminence pariétale : hauteur du maximum (U) [canon : au tiers supérieur de la voûte, au-dessus de l\'oreille (haut ≈ 0,5)]', sk.yMax, 0.12, 0.4));
  c.push(check(A, 'head.anat.parietal.azimuth', 'Éminence pariétale : azimut du maximum (° ; 0 = face, 90 = côté) [canon : derrière le conduit auditif, 95° – 135°]', sk.azMax, 95, 135));
  c.push(check(A, 'head.anat.parietal.size', 'Éminence pariétale : amplitude (U) [bosse visible mais discrète : 0,006 – 0,030]', sk.max, 0.006, 0.03));
  const L = cheekLevels(e), ck = scan((y, th) => cheekRelief(e, y, th), 0.45, 1.0);
  c.push(check(A, 'head.anat.cheek.zygoma', 'Joue : hauteur du maximum du modelé (U) [canon : entre la ligne des yeux et la bouche]', ck.yMax, Math.min(L.yZ, L.yV) - 0.12, L.yM + 0.06, ck.max > 0.003 ? 'hard' : 'info'));
  c.push(check(A, 'head.anat.cheek.hollow', 'Joue : creux sous la pommette (U, valeur négative = creux) [canon : fosse infra-zygomatique ≥ −0,04 ; pas de poche qui pend]', ck.min, -0.04, 0.0005));
  // Asymétrie : silhouette de dos (180°) retournée autour de l'axe : l'écart relatif des masques doit rester petit (une tête réelle est presque symétrique vue de dos).
  const r = R.at(180, true), asym = 1 - maskIoU(r, r, true);
  c.push(check(A, 'head.anat.asym.back', 'Asymétrie du crâne : 1 − IoU de la silhouette de dos et de son miroir [canon : < 0,06 ; 0 = parfaitement symétrique]', asym, 0, 0.06));
  c.push(check(A, 'head.anat.asym.value', 'Asymétrie crânienne signée (dérivée de `face.asymmetry`, −1…+1)', Math.abs(skullAsymmetry(e)), 0, 1, 'info'));
  return c;
}

/** Pixels d'oreille (PART.ear) dans la moitié d'image de signe s (par rapport au pivot). */
function earPixels(r: TurnRender, s: 1 | -1): number {
  let n = 0;
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (r.ids[y * r.w + x] === PART.ear && Math.sign(x + 0.5 - r.originX) === s) n++;
  return n;
}

export function reliefStyleChecks(spec: HeadTurnSpec, R: Rend): Check[] {
  const S = 'style' as const, c: Check[] = [];
  if (!spec.engine) return c;
  const r20 = R.at(20), far = farEarSide({ yaw: 20, pitch: 0 }), sg = (far * Math.sign(Math.cos(20 / D))) as 1 | -1;
  c.push(check(S, 'head.style.ear.far20', 'Oreille lointaine à 20° : pixels d\'oreille du côté lointain (la planche l\'omet)', earPixels(r20, sg), 0, 0));
  c.push(check(S, 'head.style.ear.near20', 'Oreille proche à 20° : pixels d\'oreille du côté proche (doit rester dessinée)', earPixels(r20, -sg as 1 | -1), 150, 1e9));
  const r0 = R.at(0);
  c.push(check(S, 'head.style.ear.both0', 'Oreilles à 0° : la plus petite des deux moitiés d\'image (les deux oreilles se lisent de face)', Math.min(earPixels(r0, 1), earPixels(r0, -1)), 150, 1e9));
  const y1 = spec.neck.y1, w = (y: number): number => neckSection(spec.engine!, y, y1).a;
  c.push(check(S, 'head.style.neck.flare', 'Cou : largeur au bas / largeur à mi-cou [évasement vers les trapèzes : ≥ 1,08 ; ≤ 2,2 = R max 2,4 du modèle `SHOULDER` ; la planche garde ses 10 %]', w(y1) / w(0.5 * (spec.neck.y0 + y1)), 1.08, 2.2));
  // Cloche des trapèzes (réf. `rotation-3d/07.jpg`, vue de dos : ×2,77 mesuré sur des épaules entières ; le modèle borne R à [1,6 ; 2,4], convention) et monotonie : pas de goulot ni de bosse dans la jonction.
  const wTop = w(spec.neck.y0), fromFace = !!(spec.engine.fit as { mandLandmarks?: boolean }).mandLandmarks;   // la planche (ellipses mesurées, évasement 10 %) n'a pas de cloche
  if (fromFace) c.push(check(S, 'head.style.neck.bell', 'Cou : largeur à la coupe / largeur sous le crâne [cloche des trapèzes : réf. 07 ×2,77 sur des épaules entières ; modèle 1,6 – 2,4 ; planche exclue]', w(y1) / wTop, 1.55, 2.5));
  let worst = 0; for (let y = spec.neck.y0 + 0.01; y <= y1; y += 0.01) worst = Math.min(worst, w(y) - w(y - 0.01));
  c.push(check(S, 'head.style.neck.monotone', 'Cou : plus forte DIMINUTION de largeur vers le bas entre deux sections (U) : un goulot ou une bosse dans la jonction cou → épaules', -worst, 0, 1e-6));
  let step = 0; for (let y = spec.neck.y0 + 0.02; y <= y1; y += 0.02) step = Math.max(step, Math.abs(w(y) - w(y - 0.02)));
  c.push(check(S, 'head.style.neck.step', 'Cou : plus grande marche de largeur entre deux sections voisines (U) : pas de cassure à la jonction', step, 0, 0.03));
  return c;
}

import type { RandomFace } from '../generation/random-face';
import { faceIsCel } from '../face/head-style';
import { check, type Check } from './types';

/**
 * COUCHE « PAIRE D'YEUX » du visage (rattachée à `checkFaceEngine`) : les trois familles de contrôles sur les deux yeux posés par `generateRandomFace`.
 *   géométrie : transformations finies ; coins externes de côtés opposés (un œil gauche et un droit, jamais deux fois le même sens) ; même roulis (rotation commune de la tête) ;
 *   anatomie  : asymétrie d'échelle gauche / droite bornée (mesurée sur 600 visages : 0,878–1,162 -> bornes 0,85–1,18) ; décalage vertical des deux yeux ≤ 0,08 largeur d'œil (mesuré ≤ 0,062) ;
 *   style     : les deux yeux sont de la MÊME identité (même enveloppe, même aspect d'iris, même sclère, même palette d'iris) — jamais deux yeux d'identités différentes sur un visage ;
 *               même FINI (peint ou flat : un œil en aplats et l'autre peint casse le style de la tête) ;
 *   (passe 17) anatomie : les microdétails de paupière (bord irrégulier, plis des canthi) sont présents sur les DEUX yeux ou sur aucun, et leur force diffère de ≤ 0,35.
 */
type EyeObj = { id: string; transform: { x: number; y: number; rotationDeg: number; scale: number }; shape: { width: number; outerSide: string; style: string }; iris: unknown; sclera: unknown; finish?: string; microdetail?: { edge?: { irregularity: number } | null; canthusLines?: { outer: number; inner: number } | null } | null };
export function checkEyePair(face: RandomFace): Check[] {
  const L = face.objects.find((o) => o.id.endsWith('eye-left')) as unknown as EyeObj | undefined;
  const R = face.objects.find((o) => o.id.endsWith('eye-right')) as unknown as EyeObj | undefined;
  if (!L || !R) return [];
  const o: Check[] = [];
  const fin = [L.transform.x, L.transform.y, L.transform.scale, R.transform.x, R.transform.y, R.transform.scale].every(Number.isFinite);
  o.push(check('geometry', 'eyes-transforms-finite', '==', fin ? 1 : 0, 1, 'une transformation d’œil n’est pas finie'));
  o.push(check('geometry', 'eyes-outer-corners-opposite', '==', L.shape.outerSide !== R.shape.outerSide && [L.shape.outerSide, R.shape.outerSide].every((s) => s === 'left' || s === 'right') ? 1 : 0, 1, 'les coins externes des deux yeux ne sont pas de côtés opposés'));
  o.push(check('geometry', 'eyes-share-roll', '<=', Math.abs(L.transform.rotationDeg - R.transform.rotationDeg), 0.5, 'les deux yeux n’ont pas le même roulis'));
  const ratio = L.transform.scale / R.transform.scale;
  o.push(check('anatomy', 'eyes-scale-asymmetry', '<=', Math.max(ratio, 1 / ratio), 1 / 0.85, 'asymétrie de taille gauche / droite hors bornes (0,85–1,18)'));
  const wMean = (L.shape.width * L.transform.scale + R.shape.width * R.transform.scale) / 2;
  o.push(check('anatomy', 'eyes-same-height', '<=', Math.abs(L.transform.y - R.transform.y) / wMean, 0.08, 'les deux yeux ne sont pas à la même hauteur (> 0,08 largeur d’œil)'));
  const same = L.shape.style === R.shape.style && JSON.stringify(L.iris) === JSON.stringify(R.iris) && JSON.stringify(L.sclera) === JSON.stringify(R.sclera);
  o.push(check('style', 'eyes-same-identity', '==', same ? 1 : 0, 1, 'les deux yeux ne sont pas de la même identité (enveloppe, iris ou sclère différents)'));
  o.push(check('style', 'eyes-same-finish', '==', (L.finish ?? 'shaded') === (R.finish ?? 'shaded') ? 1 : 0, 1, 'un œil est en aplats (flat) et l’autre peint : le style de la tête n’est pas homogène'));
  // (passe 19) Style : une tête cel (aplats à bords nets) avec des yeux ombrés (dégradés, vernis, ombre de paupière), ou l'inverse, n'est pas une seule main. Avertissement, jamais erreur : un œil peint sur une tête cel peut être un choix.
  const flatish = (e: EyeObj): boolean => e.finish === 'flat' || e.finish === 'cel';
  const eyesFlat = flatish(L) && flatish(R);
  o.push(check('style', 'eyes-finish-matches-head', '==', faceIsCel(face.params) === eyesFlat ? 1 : 0, 1, 'le fini des yeux (aplats / ombré) ne suit pas le style de la tête (cel / lisse)', 'warn'));
  const both = (f: (e: EyeObj) => unknown): boolean => Boolean(f(L)) === Boolean(f(R));
  o.push(check('anatomy', 'eyes-micro-presence', '==', both((e) => e.microdetail?.edge) && both((e) => e.microdetail?.canthusLines) ? 1 : 0, 1, 'bord irrégulier ou plis des canthi présents sur un seul œil', 'warn'));
  const dOuter = Math.abs((L.microdetail?.canthusLines?.outer ?? 0) - (R.microdetail?.canthusLines?.outer ?? 0)); const dIrr = Math.abs((L.microdetail?.edge?.irregularity ?? 0) - (R.microdetail?.edge?.irregularity ?? 0));
  o.push(check('anatomy', 'eyes-micro-strength-match', '<=', Math.max(dOuter, dIrr), 0.35, 'force des plis des canthi ou du bord irrégulier trop différente entre les deux yeux', 'warn'));
  return o;
}

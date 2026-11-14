import type { RandomFace } from '../generation/random-face';
import { check, type Check } from './types';

/**
 * COUCHE « PAIRE D'YEUX » du visage (rattachée à `checkFaceEngine`) : les trois familles de contrôles sur les deux yeux posés par `generateRandomFace`.
 *   géométrie : transformations finies ; coins externes de côtés opposés (un œil gauche et un droit, jamais deux fois le même sens) ; même roulis (rotation commune de la tête) ;
 *   anatomie  : asymétrie d'échelle gauche / droite bornée (mesurée sur 600 visages : 0,878–1,162 -> bornes 0,85–1,18) ; décalage vertical des deux yeux ≤ 0,08 largeur d'œil (mesuré ≤ 0,062) ;
 *   style     : les deux yeux sont de la MÊME identité (même enveloppe, même aspect d'iris, même sclère, même palette d'iris) — jamais deux yeux d'identités différentes sur un visage.
 */
type EyeObj = { id: string; transform: { x: number; y: number; rotationDeg: number; scale: number }; shape: { width: number; outerSide: string; style: string }; iris: unknown; sclera: unknown };
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
  return o;
}

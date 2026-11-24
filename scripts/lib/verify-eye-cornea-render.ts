import { Resvg } from '@resvg/resvg-js';
import { compileScene } from '../../src';
import { openingGeometry } from '../../src/geometry/eye';
import { irisCenter, irisRadii } from '../../src/render/eye/helpers';
import { resolveEye } from '../../src/render/eye/eye';
import { EyeSpec } from '../../src/schema';

/**
 * PIXELS de la couche « cornée » : on rend l'œil, on mesure le rayon APPARENT de la pupille le long de l'axe horizontal (franchissement du milieu entre la luminance de la pupille et
 * celle de l'iris voisin) et on le compare à `rx_iris × warp(taille vraie)` — la loi de réfraction du code doit être CE QU'ON VOIT. Mesure indépendante de la géométrie du moteur
 * (aucun appel au rendu de la pupille) : seule l'image est lue.
 *   geometry : rayon mesuré = rayon prédit par la loi (± `tolPx`) ;  anatomy : agrandissement mesuré / rayon vrai ≤ 1,35 ;  style : la pupille reste plus sombre que l'iris (contraste conservé).
 */
const W = 700, H = 460;
export interface PupilMeasure { readonly measured: number; readonly predicted: number; readonly trueRadius: number; readonly pupilLum: number; readonly irisLum: number }
export function measurePupilRadiusPx(input: Record<string, unknown>): PupilMeasure {
  const spec = { ...input, eyebrow: null, highlights: { list: [], primary: { size: 0.05, opacity: 0 }, secondary: { size: 0.05, opacity: 0 } } };
  const eye = resolveEye(EyeSpec.parse({ kind: 'eye', id: 'e', ...spec })); const g = openingGeometry(eye.shape, eye.canthi); const c = irisCenter(eye, g); const { rx } = irisRadii(eye);
  const r = compileScene({ width: W, height: H, background: '#ff00ff', objects: [{ kind: 'eye', id: 'e', transform: { x: W / 2, y: H / 2 }, ...spec }] } as never);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  const px = new Resvg(r.svg).render().pixels as unknown as Uint8Array;
  const L = (x: number): number => { const i = (Math.round(H / 2 + c.y) * W + Math.round(W / 2 + c.x + x)) * 4; return 0.2126 * (px[i] as number) + 0.7152 * (px[i + 1] as number) + 0.0722 * (px[i + 2] as number); };
  const pupilLum = L(0); const irisLum = L(rx * 0.85); const mid = (pupilLum + irisLum) / 2;
  let x = 0; while (x < rx && L(x) < mid) x += 0.25;
  const raw = EyeSpec.parse({ kind: 'eye', id: 'e', ...spec, cornea: null }); const trueSize = resolveEye(raw).pupil.size;
  const predicted = rx * (eye.pupil.size);               // `eye` est l'œil EFFECTIF : sa taille de pupille est déjà `warp(taille vraie)`
  return { measured: x, predicted, trueRadius: rx * trueSize, pupilLum, irisLum };
}

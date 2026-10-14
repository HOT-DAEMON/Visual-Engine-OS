import { halfVectorXY, toLocal, type LightVector } from '../../lighting/light';
import { objectTransform, type CompiledObject } from '../object';
import type { RobotEyeSpec } from '../../schema';
import { el } from '../../core/svg';
import { renderHousing } from './housing';
import { renderLens } from './lens';

/**
 * Compile un œil de robot : boîtier (housing.ts) + lentille (lens.ts). Ce fichier n'est que
 * l'ORCHESTRATEUR : il calcule les rayons partagés (R, Rin, Rl) et le vecteur médian de la lumière
 * (H, pour le reflet fantôme du verre), délègue le dessin à chaque module, et assemble le résultat.
 */
export function compileRobotEye(r: RobotEyeSpec, worldLight: LightVector): CompiledObject {
  const rot = r.transform.rotationDeg;
  const L = toLocal(worldLight, rot);
  const H = halfVectorXY(L);
  const R = r.size / 2;
  const Rin = R * (1 - r.housing.ringWidth);
  const Rl = Rin * 0.94;

  const housing = renderHousing(r, L, rot, r.id, R, Rin);
  const lens = renderLens(r, L, H, r.id, Rl, rot);

  return {
    defs: [...housing.defs, ...lens.defs],
    markup: el('g', { transform: objectTransform(r.transform) }, [...housing.body, ...lens.body]),
  };
}

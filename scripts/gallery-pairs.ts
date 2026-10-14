import { mkdirSync, writeFileSync } from 'node:fs';
import { generateRandomEye } from '../src/generation/random-eye';
import type { SceneInput } from '../src/schema';

/**
 * Pour chacun des 48 individus de la galerie (mêmes seeds), produit sa paire œil gauche / œil
 * droit (même identité — iris, couleur, cils, archétype — mais `outerSide` imposé explicitement
 * sur chaque copie, donc un vrai miroir plutôt que deux tirages indépendants).
 */
const IDENTITIES = 48;
const PER_ROW = 6; // 6 identités par ligne × 2 (gauche/droite) = 12 colonnes
const CELL_X = 150;
const CELL_Y = 260;
const TARGET_WIDTH = 120;

const objects: SceneInput['objects'] = [];
for (let i = 0; i < IDENTITIES; i++) {
  const eye = generateRandomEye(1000 + i * 101, { expression: { kind: 'neutral', intensity: 1 } });
  const baseWidth = eye.shape?.width ?? 280;
  const baseHeight = eye.shape?.height ?? 170;
  const k = TARGET_WIDTH / baseWidth;
  const idRow = Math.floor(i / PER_ROW);
  const idCol = i % PER_ROW;
  for (const side of ['left', 'right'] as const) {
    const col = idCol * 2 + (side === 'left' ? 0 : 1);
    objects.push({
      ...eye,
      id: `eye-${i}-${side}`,
      transform: { x: CELL_X / 2 + col * CELL_X, y: CELL_Y / 2 + 30 + idRow * CELL_Y },
      shape: { ...eye.shape, width: baseWidth * k, height: baseHeight * k, outerSide: side },
    });
  }
}
const scene: SceneInput = {
  width: PER_ROW * 2 * CELL_X,
  height: Math.ceil(IDENTITIES / PER_ROW) * CELL_Y,
  background: '#eec9ad',
  label: `${IDENTITIES} identités × paire œil gauche/droit (${IDENTITIES * 2} yeux, miroir exact par outerSide)`,
  objects,
};
mkdirSync('examples', { recursive: true });
writeFileSync('examples/gallery-pairs.json', JSON.stringify(scene, null, 2));
console.log(`examples/gallery-pairs.json : ${IDENTITIES} identités × 2 = ${objects.length} yeux`);

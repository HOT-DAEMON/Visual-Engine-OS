import { mkdirSync, writeFileSync } from 'node:fs';
import { generateRandomEye } from '../src/generation/random-eye';
import type { SceneInput } from '../src/schema';

const COLS = 8;
const ROWS = 6;
const CELL_X = 240;
const CELL_Y = 260;
const TARGET_WIDTH = 150; // largeur cible après mise à l'échelle UNIFORME (conserve les proportions tirées)

const objects: SceneInput['objects'] = [];
for (let i = 0; i < COLS * ROWS; i++) {
  const eye = generateRandomEye(1000 + i * 101, { expression: { kind: 'neutral', intensity: 1 } });
  const baseWidth = eye.shape?.width ?? 280;
  const baseHeight = eye.shape?.height ?? 170;
  const k = TARGET_WIDTH / baseWidth; // même facteur sur largeur ET hauteur : ne déforme pas l'œil tiré
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  objects.push({
    ...eye,
    id: `eye-${i}`,
    transform: { x: CELL_X / 2 + col * CELL_X, y: CELL_Y / 2 + 30 + row * CELL_Y },
    shape: { ...eye.shape, width: baseWidth * k, height: baseHeight * k },
  });
}
const scene: SceneInput = {
  width: COLS * CELL_X,
  height: ROWS * CELL_Y,
  background: '#eec9ad',
  label: `Galerie : ${COLS * ROWS} yeux générés (seed unique par case, aucune retouche manuelle)`,
  objects,
};
mkdirSync('examples', { recursive: true });
writeFileSync('examples/gallery.json', JSON.stringify(scene, null, 2));
console.log(`examples/gallery.json : ${COLS * ROWS} yeux`);

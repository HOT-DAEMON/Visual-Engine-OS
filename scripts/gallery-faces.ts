import { mkdirSync, writeFileSync } from 'node:fs';
import { generateRandomFace, GALLERY_IDENTITIES } from '../src';
import type { SceneInput } from '../src/schema';

/**
 * 48 visages complets : un par identité d'yeux des galeries (la paire gauche/droite de
 * gallery-pairs.json posée sur un visage tiré d'une seed propre). Expression et proportions varient.
 */
const COLS = 8;
const CELL_X = 230;
const CELL_Y = 450;
const SCALE = 0.5;
const objects: SceneInput['objects'] = [];
for (let i = 0; i < GALLERY_IDENTITIES; i++) {
  const face = generateRandomFace(7000 + i * 131, {
    id: `f${i}`,
    identity: i,
    transform: { x: CELL_X / 2 + (i % COLS) * CELL_X, y: CELL_Y / 2 + Math.floor(i / COLS) * CELL_Y, scale: SCALE },
  });
  objects.push(...face.objects);
}
const scene: SceneInput = {
  width: COLS * CELL_X,
  height: Math.ceil(GALLERY_IDENTITIES / COLS) * CELL_Y,
  background: '#3b4157',
  label: `${GALLERY_IDENTITIES} visages complets (une paire d'yeux de galerie par visage)`,
  objects,
};
mkdirSync('examples', { recursive: true });
writeFileSync('examples/gallery-faces.json', JSON.stringify(scene));
console.log(`examples/gallery-faces.json : ${GALLERY_IDENTITIES} visages, ${objects.length} objets`);

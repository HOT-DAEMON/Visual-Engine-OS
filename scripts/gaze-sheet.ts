import { mkdirSync, writeFileSync } from 'node:fs';
import { generateRandomEye } from '../src/generation/random-eye';
import type { SceneInput } from '../src/schema';

/**
 * Feuille de regard : pour un ÉCHANTILLON représentatif de 6 identités parmi les 48 (réparties sur
 * toute la galerie, pas les 6 premières), la paire œil gauche/droit sous 5 directions de regard :
 * droit devant, haut, bas, gauche, droite. (48 × 2 × 5 = 480 cases produirait une image illisible
 * et un fichier ingérable ; cet échantillon prouve la mécanique sur un format exploitable.)
 */
const IDENTITY_INDICES = [0, 8, 16, 24, 32, 40];
const POSITIONS: { label: string; yawDeg: number; pitchDeg: number }[] = [
  { label: 'droit-devant', yawDeg: 0, pitchDeg: 0 },
  { label: 'haut', yawDeg: 0, pitchDeg: -18 },
  { label: 'bas', yawDeg: 0, pitchDeg: 18 },
  { label: 'gauche', yawDeg: -25, pitchDeg: 0 },
  { label: 'droite', yawDeg: 25, pitchDeg: 0 },
];
const CELL_X = 160;
const CELL_Y = 150;
const TARGET_WIDTH = 120;

const objects: SceneInput['objects'] = [];
IDENTITY_INDICES.forEach((identityIndex, row) => {
  const eye = generateRandomEye(1000 + identityIndex * 101, { expression: { kind: 'neutral', intensity: 1 } });
  const baseWidth = eye.shape?.width ?? 280;
  const baseHeight = eye.shape?.height ?? 170;
  const k = TARGET_WIDTH / baseWidth;
  (['left', 'right'] as const).forEach((side, sideIdx) => {
    POSITIONS.forEach((pos, col) => {
      objects.push({
        ...eye,
        id: `eye-${identityIndex}-${side}-${pos.label}`,
        transform: { x: CELL_X / 2 + col * CELL_X, y: CELL_Y / 2 + 20 + (row * 2 + sideIdx) * CELL_Y },
        shape: { ...eye.shape, width: baseWidth * k, height: baseHeight * k, outerSide: side },
        gaze: { ...eye.gaze, yawDeg: pos.yawDeg, pitchDeg: pos.pitchDeg },
      });
    });
  });
});
const scene: SceneInput = {
  width: POSITIONS.length * CELL_X,
  height: IDENTITY_INDICES.length * 2 * CELL_Y,
  background: '#eec9ad',
  label: 'Feuille de regard — 6 identités × paire G/D × 5 directions (devant, haut, bas, gauche, droite)',
  objects,
};
mkdirSync('examples', { recursive: true });
writeFileSync('examples/gaze-sheet.json', JSON.stringify(scene, null, 2));
console.log(`examples/gaze-sheet.json : ${objects.length} yeux (${IDENTITY_INDICES.length} identités × 2 × ${POSITIONS.length})`);

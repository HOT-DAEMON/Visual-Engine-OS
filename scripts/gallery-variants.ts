import { mkdirSync, writeFileSync } from 'node:fs';
import { generateRandomEye } from '../src/generation/random-eye';
import type { SceneInput } from '../src/schema';

type EyeInput = Extract<SceneInput['objects'][number], { kind: 'eye' }>;
const IDENTITIES = 48;
const TARGET_WIDTH = 120;

/** Les 48 mêmes identités (mêmes seeds que gallery.ts/gallery-pairs.ts) que partout ailleurs. */
function baseEyes(): EyeInput[] {
  return Array.from({ length: IDENTITIES }, (_, i) => generateRandomEye(1000 + i * 101, { expression: { kind: 'neutral', intensity: 1 } }));
}

function scaled(eye: EyeInput): { width: number; height: number; k: number } {
  const width = eye.shape?.width ?? 280;
  const height = eye.shape?.height ?? 170;
  const k = TARGET_WIDTH / width;
  return { width, height, k };
}

/** Une variante « paire » : les 48 identités × gauche/droite, avec un override commun (ex. headTurn). */
function writePairGallery(file: string, label: string, override: (eye: EyeInput) => Partial<EyeInput>) {
  const COLS = 6; // identités par ligne (× 2 pour gauche/droite = 12 colonnes)
  const CELL_X = 150;
  const CELL_Y = 260;
  const objects: SceneInput['objects'] = [];
  baseEyes().forEach((eye, i) => {
    const { width, height, k } = scaled(eye);
    const row = Math.floor(i / COLS);
    const col = i % COLS;
    for (const side of ['left', 'right'] as const) {
      const c = col * 2 + (side === 'left' ? 0 : 1);
      objects.push({
        ...eye,
        ...override(eye),
        id: `eye-${i}-${side}`,
        transform: { x: CELL_X / 2 + c * CELL_X, y: CELL_Y / 2 + 30 + row * CELL_Y },
        shape: { ...eye.shape, ...override(eye).shape, width: width * k, height: height * k, outerSide: side },
      });
    }
  });
  const scene: SceneInput = {
    width: COLS * 2 * CELL_X,
    height: Math.ceil(IDENTITIES / COLS) * CELL_Y,
    background: '#eec9ad',
    label,
    objects,
  };
  mkdirSync('examples', { recursive: true });
  writeFileSync(`examples/${file}.json`, JSON.stringify(scene, null, 2));
  console.log(`examples/${file}.json : ${objects.length} yeux`);
}

/** Une variante « simple » : les 48 identités, un œil chacune, avec un override commun (ex. expression). */
function writeSingleGallery(file: string, label: string, override: (eye: EyeInput) => Partial<EyeInput>) {
  const COLS = 8;
  const CELL_X = 150;
  const CELL_Y = 260;
  const objects: SceneInput['objects'] = [];
  baseEyes().forEach((eye, i) => {
    const { width, height, k } = scaled(eye);
    const row = Math.floor(i / COLS);
    const col = i % COLS;
    objects.push({
      ...eye,
      ...override(eye),
      id: `eye-${i}`,
      transform: { x: CELL_X / 2 + col * CELL_X, y: CELL_Y / 2 + 30 + row * CELL_Y },
      shape: { ...eye.shape, ...override(eye).shape, width: width * k, height: height * k },
    });
  });
  const scene: SceneInput = {
    width: COLS * CELL_X,
    height: Math.ceil(IDENTITIES / COLS) * CELL_Y,
    background: '#eec9ad',
    label,
    objects,
  };
  mkdirSync('examples', { recursive: true });
  writeFileSync(`examples/${file}.json`, JSON.stringify(scene, null, 2));
  console.log(`examples/${file}.json : ${objects.length} yeux`);
}

// --- Rotation de tête : les 48 identités × paire gauche/droite, à deux angles 3/4 -------------
writePairGallery('gallery-head-left34', '48 identités × paire G/D — tête tournée 3/4 gauche (yaw -35°)', () => ({
  headTurn: { yawDeg: -35, pitchDeg: 0 },
}));
writePairGallery('gallery-head-right34', '48 identités × paire G/D — tête tournée 3/4 droite (yaw +35°)', () => ({
  headTurn: { yawDeg: 35, pitchDeg: 0 },
}));

// --- Expressions : les 48 identités, une expression par fichier --------------------------------
const EXPRESSIONS = [
  'angry',
  'sad',
  'fearful',
  'anguished',
  'melancholic',
  'drowsy',
  'surprised',
  'sulky',
  'furious',
  'joyful',
  'smiling',
  'fierce',
  'stressed',
] as const;
const FR_LABEL: Record<(typeof EXPRESSIONS)[number], string> = {
  angry: 'colère',
  sad: 'tristesse',
  fearful: 'peur',
  anguished: 'angoisse',
  melancholic: 'mélancolie',
  drowsy: 'fatigue',
  surprised: 'étonnement',
  sulky: 'air maussade',
  furious: 'fureur',
  joyful: 'joie',
  smiling: 'sourire',
  fierce: 'regard féroce',
  stressed: 'stress',
};
for (const kind of EXPRESSIONS) {
  writeSingleGallery(`gallery-expr-${kind}`, `48 identités — expression : ${FR_LABEL[kind]}`, () => ({
    expression: { kind, intensity: 1 },
  }));
}

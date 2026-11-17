import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { compileScene, type SceneInput } from '../src';
import { checkHairPose } from '../src/verify/hair-pose';
import { FaceParams } from '../src/schema';
import { hairFace, type CleanStyle } from './lib/hair-faces';

/**
 * Preuves de l'étape 4 (mèches, éléments liés, pièces attachées) de la rotation : `docs/ROTATION-HAIR-STRANDS.md`. `npx tsx scripts/rotation-hair-strands-proof.ts`.
 *  01 / 02 : rendu RÉEL du moteur, 10 coiffures × 5 lacets (−45, −30, 0, +30, +45) ; 03 : gros plans courte et longue à 0°, +30°, −30° ; 04 : séquence −75° → +75° par pas de 15° (le schéma `headPose.yawDeg` refuse au-delà de ±75° ; la projection est plafonnée vers ±50° ; pas de vue de dos) ;
 *  `verification.json` : tous les contrôles de la couche `checkHairPose` (géométrie, anatomie, style) sur le corpus.
 */
const OUT = 'artefacts/rotation-hair-strands', CELL = 300;
mkdirSync(OUT, { recursive: true });
const png = (svg: string, w: number): Buffer => new Resvg(svg, { fitTo: { mode: 'width', value: w }, background: '#ffffff' }).render().asPng() as Buffer;
type Spec = [CleanStyle, number];

function sheet(file: string, rows: Spec[], yaws: number[], cell: number, scale: number, width: number): void {
  const objects: unknown[] = [];
  rows.forEach(([style, seed], r) => yaws.forEach((yaw, c) => {
    const f = hairFace(style, 1, { seed, id: `f${r}-${c}`, transform: { x: cell * (c + 0.5), y: cell * (r + 0.5) + 6, scale } });
    const host = f.objects[0] as unknown as { face: Record<string, unknown> };
    host.face = { ...host.face, headPose: { yawDeg: yaw } };
    objects.push(...f.objects);
  }));
  const r = compileScene({ width: cell * yaws.length, height: cell * rows.length, background: '#ffffff', objects } as unknown as SceneInput);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  // Étiquettes ajoutées hors du moteur (texte SVG), une par cellule.
  const labels = rows.flatMap(([style, seed], ri) => yaws.map((yaw, c) => `<text x="${cell * c + 8}" y="${cell * ri + 16}" font-size="13" font-family="monospace" fill="#333">${style} ${seed} · ${yaw}°</text>`)).join('');
  writeFileSync(`${OUT}/${file}`, png(r.svg.replace('</svg>', `${labels}</svg>`), width));
}

const SHORT: Spec[] = [['buzz', 9003], ['short', 9001], ['spiky', 9001], ['curly', 9001], ['afro', 9000]];
const LONG: Spec[] = [['bob', 9001], ['long', 9002], ['ponytail', 9001], ['bun', 9001], ['braids', 9001]];
const YAWS = [-45, -30, 0, 30, 45];
sheet('01-courtes-frisees-x-lacet.png', SHORT, YAWS, CELL, 0.62, 1500);
sheet('02-longues-attachees-x-lacet.png', LONG, YAWS, CELL, 0.62, 1500);
sheet('03a-gros-plan-courte.png', [['short', 9001]], [-30, 0, 30], 520, 1.05, 1560);
sheet('03b-gros-plan-longue.png', [['long', 9002]], [-30, 0, 30], 520, 1.05, 1560);
sheet('04a-sequence-courte.png', [['short', 9001]], [-75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75], 240, 0.5, 1760);
sheet('04b-sequence-longue.png', [['long', 9002]], [-75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75], 240, 0.5, 1760);

// Vérification : tous les contrôles sur le corpus (10 coiffures × 3 graines × 7 lacets).
const styles: CleanStyle[] = ['buzz', 'short', 'spiky', 'curly', 'afro', 'bob', 'long', 'ponytail', 'bun', 'braids'];
const rows: Record<string, unknown>[] = [];
let n = 0, failed = 0, warned = 0;
for (const style of styles) for (const seed of [9001, 9002, 9003]) for (const yaw of [-45, -30, -15, 0, 15, 30, 45]) {
  const f = hairFace(style, 1, { seed }), host = f.objects[0] as unknown as { face: Record<string, unknown>; width: number; height: number };
  const cs = checkHairPose({ params: FaceParams.parse(host.face), width: host.width, height: host.height }, yaw);
  for (const c of cs) { n++; if (!c.ok && c.severity === 'error') failed++; if (!c.ok && c.severity === 'warn') { warned++; rows.push({ style, seed, yaw, id: c.id, layer: c.layer, value: +c.value.toFixed(3), limit: +c.limit.toFixed(3) }); } }
}
writeFileSync(`${OUT}/verification.json`, JSON.stringify({ checks: n, errors: failed, warnings: warned, warningDetail: rows }, null, 1));
console.log(`artefacts écrits dans ${OUT}/ : ${n} contrôles, ${failed} erreurs, ${warned} avertissements`);

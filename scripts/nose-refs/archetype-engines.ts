import { readFileSync, writeFileSync } from 'node:fs';
import { faceLandmarks, noseGeometry, noseArchetype, NOSE_ARCHETYPE_NAMES, widthProfile25 } from '../../src/face';
import { FaceParams } from '../../src/schema';
import { generateRandomFace } from '../../src/generation/random-face';

/**
 * ÉTUDE (avant tout branchement) : l'archétype de nez donne-t-il la même silhouette en moteur `classic` (celui du générateur aléatoire par défaut)
 * qu'en moteur `structured` (celui où il a été ajusté) ? Deux mesures :
 *  1. visage NEUTRE : résidu de silhouette contre references/nez/06.png, mêmes constantes, deux moteurs ;
 *  2. 40 VISAGES ALÉATOIRES par graine fixe avec l'archétype imposé via `anatomy.nose` : L/H de la silhouette, dispersion, dans les deux moteurs.
 * Sortie : references/nez/archetype-engines.json (relue par tests/nose-archetype-wiring.test.ts).
 */
const W = 300, H = 380, UPPER = 18;
const refs = JSON.parse(readFileSync('references/nez/measures-06.json', 'utf8')).shapes as { aspectWoverH: number; widthProfile25: number[] }[];
const REF_INDEX = { pyramide: 0, 'cloche-ailes': 2 } as const;
const residual = (engine: 'classic' | 'structured', name: keyof typeof REF_INDEX): { r: number; aspect: number } => {
  const p = FaceParams.parse({ anatomyEngine: engine, ...noseArchetype(name) });
  const m = widthProfile25(noseGeometry(p, faceLandmarks(p, W, H)).silhouette), ref = refs[REF_INDEX[name]]!;
  let e = 0; for (let i = 0; i < UPPER; i++) e += (m.profile[i]! - ref.widthProfile25[i]!) ** 2;
  return { r: Math.sqrt(e / UPPER) + 0.25 * Math.abs(Math.log(m.aspect / ref.aspectWoverH)), aspect: m.aspect };
};
const stats = (a: number[]) => { const s = [...a].sort((x, y) => x - y), mean = a.reduce((x, y) => x + y, 0) / a.length; return { min: s[0]!, median: s[Math.floor(s.length / 2)]!, max: s[s.length - 1]!, sd: Math.sqrt(a.reduce((x, y) => x + (y - mean) ** 2, 0) / a.length) }; };
const out: Record<string, unknown> = {};
for (const name of NOSE_ARCHETYPE_NAMES) {
  const neutral = { classic: residual('classic', name), structured: residual('structured', name) };
  const random: Record<string, ReturnType<typeof stats>> = {};
  for (const engine of ['classic', 'structured'] as const) {
    const aspects: number[] = [];
    for (let seed = 1; seed <= 40; seed++) {
      const f = generateRandomFace(seed * 7919, { structure: engine === 'structured', anatomy: { nose: (noseArchetype(name) as any).nose } });
      const lm = faceLandmarks(f.params, f.width, f.height);
      aspects.push(widthProfile25(noseGeometry(f.params, lm).silhouette).aspect);
    }
    random[engine] = stats(aspects);
  }
  const free: number[] = [];
  for (let seed = 1; seed <= 40; seed++) { const f = generateRandomFace(seed * 7919, {}); free.push(widthProfile25(noseGeometry(f.params, faceLandmarks(f.params, f.width, f.height)).silhouette).aspect); }
  out[name] = { neutral, random, freeClassicAspect: stats(free), refAspect: refs[REF_INDEX[name]]!.aspectWoverH };
  console.log(name, JSON.stringify(out[name]));
}
writeFileSync('references/nez/archetype-engines.json', JSON.stringify(out, null, 1));

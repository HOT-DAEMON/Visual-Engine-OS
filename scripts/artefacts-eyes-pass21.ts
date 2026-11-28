import { mkdirSync, writeFileSync } from 'node:fs';
import { compileScene, generateRandomFace } from '../src';
import { verifyEye } from '../src/verify/eye';
import { famEye } from './eye-refs/calibrate-atoms-lib';
import { makeKit } from './lib/artefacts-kit';

/**
 * PASSE 21 — preuves visuelles : (03) lumière de la pupille liée à l'intensité de scène (follow 0 / 1 × scène sombre / moyenne / vive) ;
 * (04) têtes ENTIÈRES : fini cel (pli rattaché) et pupilles non rondes (reflet dégagé) ; (rapport.json) vérification G/A/S.
 * Les planches 00–02 (avant / après du pli cel et du reflet) ont été produites en rendant le même code avant et après le correctif. Sortie : artefacts/eyes-pass21/.
 */
const OUT = 'artefacts/eyes-pass21'; mkdirSync(OUT, { recursive: true });
const { BG, sheet, cropPng, eyeScene } = makeKit(OUT);
const base = famEye('emerald-facets') as Record<string, any>;
const { transform: _t, place: _p, appearance: _a, ...rest } = base;

// ── 03 lumière de scène → pupille ─────────────────────────────────────────────────────────────
const sceneEye = (intensity: number, follow: number): string => {
  const r: any = compileScene({ width: 420, height: 300, background: BG, light: { azimuthDeg: 330, elevationDeg: 55, color: '#ffffff', intensity }, objects: [{ kind: 'eye', id: 'z', transform: { x: 210, y: 154, scale: 1.9 }, ...rest, appearance: null, eyebrow: null, pupil: { ...rest.pupil, size: 0.3, response: { model: 'circular', light: 0.5, follow } } }] } as never);
  if (!r.ok) throw new Error(r.issues.join('\n')); return r.svg;
};
const cells3: { svg: string; label: string }[] = [];
for (const follow of [0, 1]) for (const i of [0.15, 0.55, 1]) cells3.push({ svg: sceneEye(i, follow), label: `follow ${follow} — scène ${i}` });
sheet('03-pupille-lumiere-de-scene.png', cells3, 300, 214, 3);

// ── 04 têtes entières ────────────────────────────────────────────────────────────────────────────
const head = (seed: number, fin: string | null, shape: string | null): string => {
  const g = generateRandomFace(seed, { id: 'f0', transform: { x: 400, y: 470, scale: 2.3 } } as never);
  for (const o of g.objects as any[]) if (o.kind === 'eye') { if (fin) o.finish = fin; if (shape) { o.archetype = null; o.pupil = { ...o.pupil, shape, size: Math.min(o.pupil.size, 0.34) }; } }
  const r: any = compileScene({ width: 800, height: 800, background: BG, objects: g.objects } as never); if (!r.ok) throw new Error(r.issues.join('\n')); return r.svg;
};
const cells4: { img: Buffer; label: string }[] = [];
for (const [seed, fin, shape, label] of [[7, 'cel', null, 'cel, pli rattaché'], [12, 'cel', 'slit_vertical', 'cel + fente'], [7, null, 'cross', 'ombré + croix'], [12, null, 'star', 'ombré + étoile']] as const)
  cells4.push({ img: cropPng(head(seed, fin, shape), 0.8, 80, 120, 640, 560), label: `graine ${seed} — ${label}` });
sheet('04-tetes-entieres.png', cells4, 512, 448, 2);

// ── 05 vérification G/A/S ────────────────────────────────────────────────────────────────────────
const cas: [string, Record<string, unknown>][] = [['ronde', {}], ['fente verticale', { pupil: { shape: 'slit_vertical', size: 0.34 } }], ['croix', { pupil: { shape: 'cross', size: 0.34 } }], ['étoile 0,7 (sans place)', { pupil: { shape: 'star', size: 0.7 } }], ['cel, pli lisible', { finish: 'cel' }], ['cel, œil 20 px', { finish: 'cel', shape: { width: 20, height: 10 }, lids: { crease: { height: 0.05, depth: 0.5 } } }]];
const rapport = cas.map(([nom, e]) => { const r = verifyEye({ kind: 'eye', id: 'v', shape: { width: 240, height: 130 }, ...e } as never); return { cas: nom, ok: r.ok, controles: r.checks.filter((c) => /highlight-clear|highlight-keeps|cel-crease/.test(c.id)).map((c) => ({ id: c.id, couche: c.layer, ok: c.ok, severite: c.severity })) }; });
writeFileSync(`${OUT}/rapport.json`, JSON.stringify(rapport, null, 2));
void eyeScene;
console.log(JSON.stringify(rapport));

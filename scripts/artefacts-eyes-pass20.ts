import { mkdirSync, writeFileSync } from 'node:fs';
import { compileScene, generateRandomFace } from '../src';
import { verifyEye } from '../src/verify/eye';
import { generateExtraEye } from '../src/generation/eye-gallery-ext';
import { auditEyeParams } from './lib/eye-param-audit';
import { famEye } from './eye-refs/calibrate-atoms-lib';
import { makeKit } from './lib/artefacts-kit';

/**
 * PASSE 20 — preuves visuelles : (01) audit des paramètres orphelins ; (02) chacun des six leviers d'apparence de l'œil, bas / neutre / haut, sur deux yeux ;
 * (03) têtes entières avec les leviers ; (04) vérification G/A/S des leviers. Sortie : artefacts/eyes-pass20/.
 */
const OUT = 'artefacts/eyes-pass20'; mkdirSync(OUT, { recursive: true });
const { BG, sheet, eyeScene, cropPng } = makeKit(OUT);
const E1 = famEye('emerald-facets') as Record<string, unknown>, E2 = generateExtraEye(9) as Record<string, unknown>;
const strip = (e: Record<string, unknown>): Record<string, unknown> => { const { transform: _t, place: _p, appearance: _a, ...rest } = e as Record<string, unknown>; return { ...rest, appearance: null }; };

// ── 01 audit ──────────────────────────────────────────────────────────────────────────────────
const audit = auditEyeParams();
const rapport: Record<string, unknown> = { audit: { feuilles: audit.leaves, orphelins: audit.orphans, exemptes: Object.entries(audit.verdict).filter(([, v]) => v === 'exempt').map(([k]) => k), conditionnees: audit.gatedBy, avantPasse20: ['appearance.opacity', 'appearance.reflection.intensity', 'appearance.reflection.size', 'appearance.shading.mode', 'appearance.shading.castShadow', 'appearance.shading.highlightBand'] } };

// ── 02 leviers : bas / neutre / haut ───────────────────────────────────────────────────────────
type Lv = { name: string; fin?: string; vals: [string, Record<string, unknown>][] };
const LEVERS: Lv[] = [
  { name: 'opacity', vals: [['0,35', { opacity: 0.35 }], ['1 (neutre)', {}], ['0,7', { opacity: 0.7 }]] },
  { name: 'reflection.intensity', vals: [['0,1', { reflection: { intensity: 0.1 } }], ['0,5 (neutre)', {}], ['1', { reflection: { intensity: 1 } }]] },
  { name: 'reflection.size', vals: [['0', { reflection: { size: 0 } }], ['0,5 (neutre)', {}], ['1', { reflection: { size: 1 } }]] },
  { name: 'shading.castShadow (cel)', fin: 'cel', vals: [['0 (neutre)', {}], ['0,5', { shading: { castShadow: 0.5 } }], ['1', { shading: { castShadow: 1 } }]] },
  { name: 'shading.highlightBand', vals: [['0 (neutre)', {}], ['0,4', { shading: { highlightBand: 0.4 } }], ['1', { shading: { highlightBand: 1 } }]] },
  { name: 'shading.mode', vals: [['smooth (neutre)', {}], ['cel = fini cel', { shading: { mode: 'cel' } }], ['cel + bande 0,6', { shading: { mode: 'cel', highlightBand: 0.6 } }]] },
];
for (const [fi, E] of [['A', E1], ['B', E2]] as const) {
  const cells = LEVERS.flatMap((lv) => lv.vals.map(([v, ap]) => ({ svg: eyeScene({ ...strip(E), ...(lv.fin ? { finish: lv.fin } : {}), appearance: Object.keys(ap).length ? ap : null }, 1.9, 420, 300), label: `${lv.name} = ${v}` })));
  sheet(`02${fi}-leviers-oeil-${fi}.png`, cells, 300, 214, 3);
}

// ── 03 têtes entières, cadrées assez grand pour que les yeux (≈ 90 px) se lisent ─────────────────────
const head = (seed: number, yaw: number, ap: Record<string, unknown> | null, scale = 2.3): string => {
  const g = generateRandomFace(seed, { id: 'f0', transform: { x: 400, y: 470, scale } } as never);
  (g.objects[0] as any).face = { ...(g.objects[0] as any).face, headPose: { yawDeg: yaw } };
  for (const o of g.objects as any[]) if (o.kind === 'eye') o.appearance = ap;
  const r: any = compileScene({ width: 800, height: 800, background: BG, objects: g.objects } as never); if (!r.ok) throw new Error(r.issues.join('\n')); return r.svg;
};
const LOOK = { shading: { mode: 'cel', highlightBand: 0.6, castShadow: 0.4 }, reflection: { intensity: 0.8, size: 0.7 } };
const cells3: { img: Buffer; label: string }[] = [];
for (const [seed, yaw] of [[7, 0], [7, -20], [23, 0], [23, 25]] as const) {
  const a = head(seed, yaw, null), b = head(seed, yaw, LOOK);
  cells3.push({ img: cropPng(a, 0.8, 80, 120, 640, 560), label: `graine ${seed}, lacet ${yaw}° — neutre` }, { img: cropPng(b, 0.8, 80, 120, 640, 560), label: `graine ${seed}, lacet ${yaw}° — cel + bande 0,6 + ombre 0,4 + reflets` });
}
sheet('03-tetes-entieres.png', cells3, 512, 448, 2);

// ── 04 vérification G/A/S ───────────────────────────────────────────────────────────────────────
const cas: [string, Record<string, unknown>, Record<string, unknown>][] = [
  ['neutre', {}, {}], ['bande 0,5', { shading: { highlightBand: 0.5 } }, {}], ['bande 1 + grande pupille', { shading: { highlightBand: 1 } }, { pupil: { size: 0.7 } }],
  ['opacité 0,1', { opacity: 0.1 }, {}], ['reflets size 1', { reflection: { size: 1 } }, {}], ['bande + ombre, œil 24 px', { shading: { highlightBand: 0.2, castShadow: 0.1 } }, { shape: { width: 24, height: 10 } }],
];
rapport.verification = cas.map(([nom, ap, extra]) => { const r = verifyEye({ kind: 'eye', id: 'v', shape: { width: 240, height: 130 }, ...extra, ...(Object.keys(ap).length ? { appearance: ap } : {}) } as never); return { cas: nom, ok: r.ok, niveaux: r.checks.filter((c) => /band|cast-shadow|opacity-readable|reflection-(scale|visible)/.test(c.id)).map((c) => ({ id: c.id, couche: c.layer, ok: c.ok, severite: c.severity })) }; });
writeFileSync(`${OUT}/rapport.json`, JSON.stringify(rapport, null, 2));
console.log(JSON.stringify(rapport.audit), '\n', JSON.stringify(rapport.verification));

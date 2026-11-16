import { mkdirSync, writeFileSync } from 'node:fs';
import { EyeSpec } from '../src';
import { eyeLashSet, openingGeometry, openingPolygon, upperLashes, lowerLashes } from '../src/geometry/eye';
import { lashHitsOpening } from '../src/geometry/eye/lash-clearance';
import { EXTRA_EYE_COUNT, generateExtraEye } from '../src/generation/eye-gallery-ext';
import { LASH_FAMILY_IDS, applyLashFamily, type LashFamilyId } from '../src/generation/eye-lash-families';
import { eyeSheetPng } from './lib/eye-sheet';

/**
 * Artefacts de la passe 4 (`npx tsx scripts/artefacts-eyes-pass4.ts`) :
 *   01 facettes d'iris : seules / dispersion / rayons / les deux · 02 familles de cils avec et sans liner épais (œil de la réf. 13) · 03 dégagement de l'ouverture (mesure JSON).
 */
const OUT = 'artefacts/eyes-pass4'; mkdirSync(OUT, { recursive: true });

const mk = (label: string, facets: Record<string, unknown>) => ({ label, background: '#14161f', eye: { seed: 21, shape: { width: 330, height: 300, style: 'round' }, iris: { radius: 0.5, aspect: 1, material: { base: { type: 'radial', stops: [{ offset: 0, color: '#ffd27a' }, { offset: 0.6, color: '#c0612c' }, { offset: 1, color: '#4a1d14' }] } }, detail: { density: 0.5, facets } }, lashes: { upper: { count: 0, flick: { count: 0 } }, lower: { count: 0 } }, eyebrow: null } as Record<string, unknown> });
const F = { count: 14, rings: 3, contrast: 0.8 };
writeFileSync(`${OUT}/01-facettes-dispersion-rayons.png`, eyeSheetPng([mk('facettes seules', F), mk('dispersion 0,8', { ...F, dispersion: 0.8 }), mk('rayons 8', { ...F, rays: 8 }), mk('dispersion 1 + rayons 10', { ...F, dispersion: 1, rays: 10 })], 2, 520, 420, false));

const fams: LashFamilyId[] = ['plume', 'touffes', 'frange-dense', 'fin-feminin', 'aile-liner'];
const base = generateExtraEye(0) as Record<string, unknown>;
const cell = (f: LashFamilyId, liner: boolean) => { const e = applyLashFamily({ ...base, eyebrow: null } as never, f) as Record<string, unknown>; const lids = { ...(e.lids as object), ...(liner ? {} : { liner: null }) }; return { label: `${f}${liner ? ' + liner' : ' sans liner'}`, background: '#ffffff', eye: { ...e, lids, transform: { x: 150, y: 120, scale: 0.55 } } as Record<string, unknown> }; };
writeFileSync(`${OUT}/02-familles-liner-avant-apres.png`, eyeSheetPng([...fams.map((f) => cell(f, false)), ...fams.map((f) => cell(f, true))], 5, 300, 230, true));

let raw = 0; let after = 0; let tot = 0; let eyes = 0;
for (let i = 0; i < EXTRA_EYE_COUNT; i++) for (const f of [null, ...LASH_FAMILY_IDS]) {
  const spec = EyeSpec.parse(f ? applyLashFamily(generateExtraEye(i) as never, f) : generateExtraEye(i));
  const g = openingGeometry(spec.shape, spec.canthi); const th = spec.lids.thickness * spec.shape.height; const poly = openingPolygon(g);
  const r = [...upperLashes(g, spec.lashes.upper, th, (spec.seed ^ 0xa5a5a5a5) >>> 0), ...lowerLashes(g, spec.lashes.lower, th, (spec.seed ^ 0x5a5a5a5a) >>> 0)];
  const s = eyeLashSet(spec, g, th); eyes++; tot += r.length;
  raw += r.filter((l) => lashHitsOpening(l, poly, th)).length; after += [...s.upper, ...s.lower].filter((l) => lashHitsOpening(l, poly, th)).length;
}
writeFileSync(`${OUT}/03-degagement-ouverture.json`, JSON.stringify({ yeux: eyes, cils: tot, intrusionsAvantDegagement: raw, intrusionsApres: after, definition: 'corps du cil (ligne médiane + demi-largeur) dans l’ouverture de plus de la demi-épaisseur du trait de paupière, après 50 % de la longueur' }, null, 1));
console.log('pass4 OK', { eyes, tot, raw, after });

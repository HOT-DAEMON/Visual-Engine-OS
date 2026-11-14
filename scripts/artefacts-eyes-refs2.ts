import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { ALMOND_REF, NEUTRAL_REF, openingGeometry, openingProfile } from '../src/geometry/eye';
import { EXTRA_EYE_COUNT, distinctness, extraEyeRecipes, generateExtraEye } from '../src/generation/eye-gallery-ext';
import { EXTENDED_IDENTITIES } from '../src/generation/eye-pool';
import { REF_FITS } from '../src/generation/eye-ref-fits';
import { generateRandomFace } from '../src/generation/random-face';
import { Canthi } from '../src/schema/eye-canthi-fold';
import { Shape } from '../src/schema/eye-shape';
import { verifyEye } from '../src/verify/eye';
import { checkEyePair } from '../src/verify/eye-pair';
import { eyeSheetPng } from './lib/eye-sheet';
import { BASE, SWEEPS, sweepResult, withPath } from './lib/eye-param-sweeps';
import { layout, render } from './lib/proof';
import { verifyEyeRender } from './lib/verify-eye-render';

/** Artefacts (preuves visuelles) de la passe « EYES-REFS-2 » : `npx tsx scripts/artefacts-eyes-refs2.ts` -> artefacts/eyes-refs2/ (les surimpressions sil-*.png / sprites-*.png viennent de scripts/eye-refs/*.py). */
const OUT = 'artefacts/eyes-refs2';
mkdirSync(OUT, { recursive: true });
const png = (n: string, b: Buffer): void => { writeFileSync(`${OUT}/${n}`, b); console.log(`${OUT}/${n}`); };
const SIL = JSON.parse(readFileSync('references/eyes/measures-silhouettes.json', 'utf8')).eyes as Record<string, { upperProfile: number[]; lowerProfile: number[] }>;
const recipes = extraEyeRecipes();
const kept = recipes.filter((r) => r.ref);

// ---- 02 : profils mesurés vs enveloppe ajustée --------------------------------------------------------------------------------------------------------
const cw = 330, chh = 230;
const cellsSvg = REF_FITS.map((f, i) => {
  const ids = f.source.split('+'); const ms = ids.map((k) => SIL[k]!); const avg = (k: 'upperProfile' | 'lowerProfile'): number[] => ms[0]![k].map((_, j) => ms.reduce((s, m) => s + m[k][j]!, 0) / ms.length);
  const p = openingProfile(openingGeometry(Shape.parse({ width: 240, height: 240 * f.aspect, tiltDeg: f.tiltDeg, upperFraction: f.upperFraction, openness: f.openness, style: f.style as never }), Canthi.parse({ inner: { roundness: f.innerRoundness, caruncle: 0.5 }, outer: { roundness: f.outerRoundness } })));
  const X = (j: number): number => 20 + (j / 20) * (cw - 40); const Y = 118; const S = 190;
  const line = (v: readonly number[], sg: number, col: string, w: number, dash = ''): string => `<polyline fill="none" stroke="${col}" stroke-width="${w}" ${dash ? `stroke-dasharray="${dash}"` : ''} points="${v.map((y, j) => `${X(j)},${Y + sg * -y * S}`).join(' ')}"/>`;
  const kept_ = kept.some((r) => r.ref === f.id);
  return `<g transform="translate(${(i % 3) * cw},${Math.floor(i / 3) * chh})"><rect x="4" y="4" width="${cw - 8}" height="${chh - 8}" fill="#262b42" rx="6"/>${line(avg('upperProfile'), 1, '#ffffff', 2.4, '6 4')}${line(avg('lowerProfile'), -1, '#ffffff', 2.4, '6 4')}${line(p.upper, 1, '#4ade80', 2)}${line(p.lower, -1, '#4ade80', 2)}` +
    `<text x="14" y="22" fill="#cfd6ee" font-size="13" font-family="DejaVu Sans">${f.id} → ${f.style}</text><text x="14" y="${chh - 12}" fill="#9aa4c8" font-size="11" font-family="DejaVu Sans">RMS ${f.rms} · asp ${f.aspect} · upF ${f.upperFraction} · ${kept_ ? 'retenue dans la galerie' : 'écartée (double une forme existante)'}</text></g>`;
});
png('02-profils-mesures-vs-moteur.png', new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${3 * cw}" height="${3 * chh}"><rect width="100%" height="100%" fill="#1b1e30"/>${cellsSvg.join('')}</svg>`, { font: { loadSystemFonts: true } }).render().asPng() as Buffer);

// ---- 03 : les yeux issus des références ---------------------------------------------------------------------------------------------------------------
png('03-yeux-des-references.png', eyeSheetPng(kept.map((r) => ({ label: `#${r.index} ← ${r.ref} · ${r.style} · tilt ${r.tiltDeg}° upF ${r.upperFraction}`, eye: generateExtraEye(r.index) as never })), 3, 420, 300));

// ---- 04 : iris atomique (macro) -----------------------------------------------------------------------------------------------------------------------
const base: any = generateExtraEye(15);
const teal = [{ color: '#0b5f52', color2: '#1fb58f', gradient: 'radial', opacity: 1 }];
const withD = (d: object): any => ({ ...base, eyebrow: null, iris: { ...base.iris, layers: teal, detail: { density: 0.7, contrast: 0.6, ...d } }, transform: { x: 330, y: 215, scale: 3.4 } });
const macro = [['détail historique (sans facettes ni bulles)', withD({})], ['facettes : 16 × 2 couronnes', withD({ facets: { count: 16, rings: 2, contrast: 0.7 } })], ['bulles : 12', withD({ bubbles: { count: 12, size: 0.09 } })], ['facettes 20 × 3 + bulles 10', withD({ facets: { count: 20, rings: 3, contrast: 0.8 }, bubbles: { count: 10, size: 0.07 } })]] as const;
const spriteIdx = kept.find((r) => r.ref === '15-A')!.index, inkIdx = kept.find((r) => r.ref === '13-E5')!.index;
const bigEye = (e: any): any => ({ ...e, eyebrow: null, transform: { x: 330, y: 215, scale: 1.9 } });
png('04-iris-atomique-facettes-bulles-sprite-encre.png', eyeSheetPng([...macro.map(([l, e]) => ({ label: l, eye: e as never })), { label: `sprite mesuré (15-A, #${spriteIdx}) : iris ovale 1,49, 0,88 de l’ouverture`, eye: bigEye(generateExtraEye(spriteIdx)) }, { label: `encre (13-E5, #${inkIdx}) : sclère blanche, trait épais, reflets en lentille`, eye: bigEye(generateExtraEye(inkIdx)) }] as never, 2, 660, 430));

// ---- 05 : balayages des nouveaux paramètres d'iris ----------------------------------------------------------------------------------------------------
const irisSweeps = SWEEPS.filter((s) => s.path.startsWith('iris.detail'));
const small = withPath(withPath(BASE, 'shape.width', 170), 'shape.height', 96);
png('05-parametres-iris-consommes-bas-vs-haut.png', eyeSheetPng(irisSweeps.flatMap((s) => { const r = sweepResult(s); const mk = (v: unknown): never => ({ ...withPath(small, s.path, v), transform: { x: 150, y: 150, scale: 1.4 } }) as never; return [{ label: `${s.path} = ${s.lo === undefined ? 'absent' : JSON.stringify(s.lo)}`, eye: mk(s.lo) }, { label: `= ${JSON.stringify(s.hi)}  Δ ${r.changed} px`, eye: mk(s.hi) }]; }), 4, 300, 270));

// ---- 06 / 07 : têtes complètes avec la galerie étendue ----------------------------------------------------------------------------------------------
const FACE = { eyeSource: 'extended', expression: { kind: 'neutral', intensity: 1 }, hair: { style: 'short', fringe: 'sweep', color: '#2b1d14', seed: 2 }, facialHair: { mustache: 'none', beard: 'none' } };
const heads = (ids: number[], cols: number, cw_: number, ch_: number, s: number, seed0: number): Buffer => { const L = layout(ids.length, cols, cw_, ch_, s, (i) => ({ seed: seed0 + i * 11, opts: { ...FACE, identity: ids[i] } as never })); return render(L.objects as never, cols * cw_, Math.ceil(ids.length / cols) * ch_, '', '#3b4157', cols * cw_); };
png('06-tetes-yeux-des-references.png', heads(kept.slice(0, 6).map((r) => 48 + r.index), 3, 360, 600, 0.72, 900));
png('07-tetes-galerie-etendue-12.png', heads([48 + 15, 48 + 22, 48 + 31, 48 + 47, 48 + 58, 48 + 64, 48 + 71, 48 + 80, 48 + 88, 48 + 93, 48 + 97, 48 + 99], 4, 300, 520, 0.62, 1200));

// ---- 08 : rapport de vérification --------------------------------------------------------------------------------------------------------------------
const rep = Array.from({ length: EXTRA_EYE_COUNT }, (_, i) => { const e = generateExtraEye(i) as never; const v = verifyEye(e); return { index: i, ref: recipes[i]!.ref ?? null, style: recipes[i]!.style, ok: v.ok, pixel: verifyEyeRender(e).filter((c) => !c.ok).map((c) => c.id) }; });
let pairChecks = 0, pairFail = 0; for (let id = 0; id < EXTENDED_IDENTITIES; id++) for (const c of checkEyePair(generateRandomFace(1000 + id, { eyeSource: 'extended', identity: id }))) { pairChecks++; if (!c.ok) pairFail++; }
const prof = (s: typeof ALMOND_REF) => { const sv = { ...ALMOND_REF }; Object.assign(ALMOND_REF, s); const p = openingProfile(openingGeometry(Shape.parse({ style: 'almond' }), Canthi.parse({}))); Object.assign(ALMOND_REF, sv); return { outerDeg: p.canthusAngleDeg.outer, innerDeg: p.canthusAngleDeg.inner, upperFraction: p.upperFraction }; };
writeFileSync(`${OUT}/08-verification.json`, JSON.stringify({ galleryExtra: { eyes: EXTRA_EYE_COUNT, verifyEyeErrors: rep.filter((r) => !r.ok).length, pixelFailures: rep.filter((r) => r.pixel.length).length, fromReferences: kept.map((r) => ({ index: r.index, ref: r.ref, style: r.style })), distinctness: distinctness() }, faces: { identities: EXTENDED_IDENTITIES, pairChecks, pairFailures: pairFail }, almondPass2: { measuredFrontMean: { outerDeg: 119.0, innerDeg: 93.67 }, neutral: prof(NEUTRAL_REF), passe1: prof({ u2dx: 0.88, u2dy: 1.01, l1dx: 0.63, l1dy: 1.09, l2dx: 1.95, l2dy: 0.85 }), passe2: prof(ALMOND_REF) } }, null, 1));
console.log('08-verification.json', JSON.stringify({ errors: rep.filter((r) => !r.ok).length, pixel: rep.filter((r) => r.pixel.length).length, pairFailures: pairFail }));

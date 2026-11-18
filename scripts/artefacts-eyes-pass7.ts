import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { ALMOND_REF, canthusChordAngles, openingGeometry, openingProfile } from '../src/geometry/eye';
import { EXTRA_EYE_COUNT, distinctness, extraEyeRecipes, generateExtraEye } from '../src/generation/eye-gallery-ext';
import { Canthi } from '../src/schema/eye-canthi-fold';
import { Shape } from '../src/schema/eye-shape';
import { checkEyeEnvelope } from '../src/verify/eye-envelope';
import { eyeSheetPng } from './lib/eye-sheet';
import { layout, render } from './lib/proof';
import { verifyEyeRender } from './lib/verify-eye-render';
import { FRONT, report } from './eye-refs/fit-almond';

/**
 * Artefacts de la PASSE 7 (almond réajusté, EYES-REFS-4) : `npx tsx scripts/artefacts-eyes-pass7.ts` → `artefacts/eyes-pass7/`
 *   01 almond avant / après sur les aspects des 3 yeux de face · 02 profils (références / avant / après) en unités de largeur · 03 galerie des 100 · 04 têtes entières + gros plan · 05 rapport chiffré recalculé
 * « avant » = facteurs de la PASSE 3 (OLD) appliqués temporairement à ALMOND_REF ; « après » = facteurs du dépôt.
 */
const OUT = 'artefacts/eyes-pass7';
mkdirSync(OUT, { recursive: true });
const OLD = { u1dx: 1.077, u1dy: 0.966, u2dx: 1.028, u2dy: 0.985, l1dx: 0.814, l1dy: 1.049, l2dx: 2.171, l2dy: 0.824 };
const NEW = { ...ALMOND_REF };
const withFactors = <T>(f: object, fn: () => T): T => { Object.assign(ALMOND_REF, f); try { return fn(); } finally { Object.assign(ALMOND_REF, NEW); } };
const M = JSON.parse(readFileSync('references/eyes/measures.json', 'utf8')).eyes as Record<string, { aspect: number; upperFraction: number; tiltDeg: number; upperProfile: number[]; lowerProfile: number[] }>;
const eyeOf = (k: string): Record<string, unknown> => ({ shape: { style: 'almond', width: 240, height: 240 * M[k]!.aspect, upperFraction: M[k]!.upperFraction, tiltDeg: M[k]!.tiltDeg }, eyebrow: null });

// 01 : almond avant / après (trois yeux de face, leurs propres aspect / fraction haute / inclinaison) ; les deux jeux de facteurs ne coexistent pas : deux planches empilées
const sheet = (f: object): Buffer => withFactors(f, () => eyeSheetPng(FRONT.map((k) => ({ label: '', eye: eyeOf(k) })), 3, 320, 220, false));
const b64 = (x: Buffer): string => `data:image/png;base64,${x.toString('base64')}`;
writeFileSync(`${OUT}/01-almond-avant-apres.png`, new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="500"><rect width="960" height="500" fill="#2b2f3f"/><image href="${b64(sheet(OLD))}" x="0" y="30" width="960" height="220"/><image href="${b64(sheet(NEW))}" x="0" y="280" width="960" height="220"/><text x="10" y="20" font-family="DejaVu Sans" font-size="14" fill="#cfd6ee">avant (PASSE 3) — réfs 04 · 07 · 11</text><text x="10" y="270" font-family="DejaVu Sans" font-size="14" fill="#cfd6ee">après (PASSE 7) — mêmes aspect / fraction haute / inclinaison</text></svg>`, { font: { loadSystemFonts: true } }).render().asPng());

// 02 : profils en unités de largeur (courbes haute / basse, références en pointillé)
const prof = (k: string, f: object) => withFactors(f, () => openingProfile(openingGeometry(Shape.parse({ style: 'almond', width: 1000, height: 1000 * M[k]!.aspect, upperFraction: M[k]!.upperFraction, tiltDeg: M[k]!.tiltDeg }), Canthi.parse({}))));
const PW = 420, PH = 260, X0 = 30, Y0 = 130, SX = 360, SY = 300;
const path = (v: readonly number[], sign: 1 | -1): string => v.map((y, i) => `${i ? 'L' : 'M'}${(X0 + (i / 20) * SX).toFixed(1)},${(Y0 - sign * y * SY).toFixed(1)}`).join('');
const panel = (k: string, ox: number): string => {
  const o = prof(k, OLD), n = prof(k, NEW), r = M[k]!;
  const line = (v: readonly number[], s: 1 | -1, col: string, dash = ''): string => `<path d="${path(v, s)}" fill="none" stroke="${col}" stroke-width="2" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
  return `<g transform="translate(${ox},0)"><text x="${X0}" y="18" font-size="13" fill="#cfd6ee" font-family="DejaVu Sans">réf. ${k} · asp ${r.aspect.toFixed(2)} · fraction haute ${r.upperFraction.toFixed(2)}</text>` +
    [1, -1].map((s) => line(r.upperProfile.length ? (s === 1 ? r.upperProfile : r.lowerProfile) : [], s as 1 | -1, '#ffffff', '5 4')).join('') +
    [1, -1].map((s) => line(s === 1 ? o.upper : o.lower, s as 1 | -1, '#ff7a7a')).join('') + [1, -1].map((s) => line(s === 1 ? n.upper : n.lower, s as 1 | -1, '#6be58a')).join('') + `</g>`;
};
const legend = `<text x="30" y="${PH - 6}" font-size="12" font-family="DejaVu Sans" fill="#ffffff">- - - référence mesurée</text><text x="210" y="${PH - 6}" font-size="12" font-family="DejaVu Sans" fill="#ff7a7a">— avant</text><text x="300" y="${PH - 6}" font-size="12" font-family="DejaVu Sans" fill="#6be58a">— après</text>`;
writeFileSync(`${OUT}/02-profils-references-avant-apres.png`, new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${3 * PW}" height="${PH}"><rect width="100%" height="100%" fill="#2b2f3f"/>${FRONT.map((k, i) => panel(k, i * PW)).join('')}${legend}</svg>`, { font: { loadSystemFonts: true } }).render().asPng());

// 03 : galerie des 100 après réajustement (+ recette → étiquette)
const rc = extraEyeRecipes();
writeFileSync(`${OUT}/03-galerie-100.png`, eyeSheetPng(Array.from({ length: EXTRA_EYE_COUNT }, (_, i) => ({ label: `${i} ${rc[i]!.style}${rc[i]!.ref ? ` · ${rc[i]!.ref}` : ''}`, eye: generateExtraEye(i) as Record<string, unknown> })), 10, 230, 175));

// 04 : têtes entières (identités étendues) + gros plan
const ids = [15, 22, 31, 47, 58, 64, 71, 80, 88, 93, 97, 99].map((k) => 48 + k);
const L = layout(ids.length, 4, 300, 520, 0.62, (i) => ({ seed: 1200 + i * 11, opts: { eyeSource: 'extended', identity: ids[i], lashFamily: 'auto' } as never }));
writeFileSync(`${OUT}/04-tetes-entieres.png`, render(L.objects as never, 1200, 1560, '', '#3b4157', 1200));
const close = layout(1, 1, 700, 900, 1.5, () => ({ seed: 4242, opts: { eyeSource: 'extended', identity: 48 + 22, lashFamily: 'fin-feminin' } as never }));
writeFileSync(`${OUT}/04b-tete-gros-plan.png`, render(close.objects as never, 700, 900, '', '#3b4157', 700));

// 05 : rapport chiffré (tout recalculé ici)
const rep = (f: object) => withFactors(f, () => report(f as never));
const pick = (r: ReturnType<typeof report>) => ({ rmsHautMoyen: +r.meanRmsUp.toFixed(4), rmsBasMoyen: +r.meanRmsLo.toFixed(4), ecartHauteurMoyen: +r.meanAbsDAspect.toFixed(4), ecartFractionHauteMoyen: +r.meanAbsDUpF.toFixed(4), parOeil: r.eyes.map((e) => ({ id: e.id, rmsHaut: +e.rmsUp.toFixed(4), rmsBas: +e.rmsLo.toFixed(4), ecartHauteur: +e.dAspect.toFixed(4), cordeMoteur: e.chord, cordeReference: e.refChord })) });
const tally: Record<string, { checked: number; failed: number }> = {};
for (let i = 0; i < EXTRA_EYE_COUNT; i++) for (const c of verifyEyeRender(generateExtraEye(i) as never)) { const t = (tally[`${c.layer}/${c.id}`] ??= { checked: 0, failed: 0 }); t.checked++; if (!c.ok) t.failed++; }
const env: Record<string, number> = {};
for (const style of ['almond']) for (const asp of [0.35, 0.45, 0.55, 0.65]) for (const upF of [0.5, 0.62, 0.72]) for (const tilt of [-4, 2, 8, 14]) for (const [lbl, f] of [['avant', OLD], ['apres', NEW]] as const) withFactors(f, () => { const g = openingGeometry(Shape.parse({ style: style as 'almond', width: 240, height: 240 * asp, upperFraction: upF, tiltDeg: tilt }), Canthi.parse({})); for (const c of checkEyeEnvelope(g, 'almond', 0)) if (!c.ok && /height-contract|canthus-opening/.test(c.id)) env[`${lbl} ${c.id}`] = (env[`${lbl} ${c.id}`] ?? 0) + 1; });
const hDev = (style: 'sharp' | 'drooping' | 'almond'): number => { const g = openingGeometry(Shape.parse({ style, width: 240, height: 240 * 0.55 }), Canthi.parse({})); return +(((openingProfile(g).aspect - g.hEff / g.w) / (g.hEff / g.w)) * 100).toFixed(1); };
const d = distinctness();
writeFileSync(`${OUT}/05-rapport-passe7.json`, JSON.stringify({
  almond: { facteursAvant: OLD, facteursApres: NEW, avant: pick(rep(OLD)), apres: pick(rep(NEW)), definitionAngle: 'cordes à x = 0,05 (canthusChordAngles), identique pour références et moteur ; écart-type inter-références interne 13°, externe 16°' },
  reglesAjoutees: { sweepAlmond48Combinaisons: env, note: 'envelope-height-contract, canthus-opening-angle-inner/outer(-max), almond seulement' },
  ecartHauteurDemandeeObtenue_pct: { almond: hDev('almond'), sharp: hDev('sharp'), drooping: hDev('drooping'), note: 'sharp et drooping : défaut préexistant NON corrigé (voir docs/EYES-REFS-4.md)' },
  galerie100: { distanceMinAuxExistants: d.minToExisting, distanceMinEntreLes100: d.minAmongNew, quotasParStyle: d.byStyle },
  verifierPixelsGalerie100: tally,
  chord: Object.fromEntries(FRONT.map((k) => [k, canthusChordAngles(M[k]!.upperProfile, M[k]!.lowerProfile)])),
}, null, 1));
console.log('artefacts passe 7 OK');

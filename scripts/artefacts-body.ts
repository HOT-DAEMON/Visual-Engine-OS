import { mkdirSync, writeFileSync } from 'node:fs';
import { compileScene, generateRandomFace } from '../src';
import { ARCHETYPES, ARCHETYPE_NAMES, BODY_CONTRACTS, BodyParams, anchorFromFace, bodyGeometry, bodyMarkup, composeFigure, downstream, generateBody, readersOf, type BodyInput, type Level } from '../src/body';
import { verifyBody } from '../src/verify';
import { rasterPng } from './lib/raster';

/**
 * Artefacts du corps (tronc, épaules, bras, mains) — `npx tsx scripts/artefacts-body.ts [dossier]` (défaut : artefacts/body-upper-limb).
 * Chaque planche est rendue par le moteur lui-même (aucun dessin à la main) ; les légendes sont les seules choses ajoutées hors moteur.
 */
const OUT = process.argv[2] ?? 'artefacts/body-upper-limb';
mkdirSync(OUT, { recursive: true });
let CW = 540;
const CH = 820, LH = 34;
let S = 0.34;
interface Cell { readonly label: string; readonly body: BodyInput; readonly seed?: number; readonly level?: Level; readonly mode?: 'skin' | 'atoms' }
type Host = { face: Parameters<typeof anchorFromFace>[0]; width: number; height: number; material: { color: string } };

function cell(c: Cell, i: number): string {
  const f = generateRandomFace(c.seed ?? 11, { id: `f${i}`, transform: { x: CW / 2, y: 95, scale: S } });
  const o = f.objects[0] as unknown as Host;
  const sc = compileScene({ width: CW, height: CH, background: '#3b4157', objects: f.objects });
  if (!sc.ok) throw new Error(sc.issues.join(';'));
  const m = bodyMarkup(c.body, anchorFromFace(o.face, o.width, o.height), { skin: o.material.color, level: c.level ?? 3, mode: c.mode ?? 'skin', uid: `b${i}` });
  const inner = composeFigure(sc.svg, m).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  // <svg> imbriqué : chaque cellule est ROGNÉE à son cadre (un bras en pose large ne déborde pas sur la cellule voisine).
  return `<svg x="${(i % COLS) * CW}" y="${Math.floor(i / COLS) * (CH + LH)}" width="${CW}" height="${CH + LH}" viewBox="0 0 ${CW} ${CH + LH}">${inner}<rect x="0" y="${CH}" width="${CW}" height="${LH}" fill="#20232f"/><text x="${CW / 2}" y="${CH + 23}" font-family="DejaVu Sans" font-size="17" fill="#e8e8f0" text-anchor="middle">${c.label}</text></svg>`;
}
let COLS = 7;
function sheet(file: string, cells: Cell[], cols: number, title: string, cw = 540, scale = 0.34): void {
  COLS = cols; CW = cw; S = scale;
  const rows = Math.ceil(cells.length / cols), W = cols * CW, H = rows * (CH + LH) + 46;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -46 ${W} ${H}" width="${W}" height="${H}"><rect x="0" y="-46" width="${W}" height="${H}" fill="#20232f"/><text x="16" y="-16" font-family="DejaVu Sans" font-size="24" fill="#ffffff">${title}</text>${cells.map(cell).join('')}</svg>`;
  writeFileSync(`${OUT}/${file}`, rasterPng(svg, { fonts: true, fitWidth: Math.min(W, 2800) }));
  console.log(file, cells.length, 'cellules');
}
const nm: Record<string, string> = { baby: 'bébé 0,6 an', toddler: 'petit enfant 3 ans', child: 'enfant 8 ans', teenFemale: 'ado fille 15 ans', teenMale: 'ado garçon 15 ans', adultFemale: 'femme 28 ans', adultMale: 'homme 28 ans', thin: 'mince', obese: 'obèse', muscular: 'musclé', veryMuscular: 'très musclé', elderFemale: 'femme 78 ans', elderMale: 'homme 78 ans' };
const pose = (a: object): BodyInput => ({ pose: { left: a, right: a } }) as BodyInput;

sheet('01-archetypes.png', ARCHETYPE_NAMES.map((n) => ({ label: nm[n] ?? n, body: generateBody(5, n, 0.15) })), 7, 'Les 13 archétypes — 4 axes indépendants (âge, sexe, adiposité, musculature) + variation de charpente');
const ages = [0.6, 3, 8, 12, 15, 22, 45, 80];
sheet('02-age-x-sexe.png', [-1, 1].flatMap((sex) => ages.map((age) => ({ label: `${sex < 0 ? 'F' : 'M'} · ${age} ans`, body: { age, sex, adiposity: 0.3, muscularity: 0.35 } as BodyInput }))), 8, 'Âge × sexe (adiposité 0,3 · musculature 0,35) — le sexe n’agit qu’après la puberté ; aucun sein avant 18 ans');
sheet('03-adiposite-x-musculature.png', [0.04, 0.4, 0.95].flatMap((a) => [0.1, 0.55, 1].map((m) => ({ label: `adiposité ${a} · muscles ${m}`, body: { age: 28, sex: 1, adiposity: a, muscularity: m } as BodyInput }))), 9, 'Homme 28 ans — adiposité (lignes) × musculature (colonnes) : mince / normal / obèse × peu / musclé / très musclé');
const lv: Cell[] = ([0, 1, 2, 3] as Level[]).map((level) => ({ label: `niveau ${level}`, body: ARCHETYPES.muscular as BodyInput, level }));
sheet('04-hierarchie-de-presentation.png', [...lv, { label: 'atomes (cachés en pointillés)', body: ARCHETYPES.muscular as BodyInput, mode: 'atoms', level: 3 }], 5, 'Hiérarchie de présentation : 0 enveloppes · 1 masses · 2 muscles et segments · 3 repères et micro-détails · mode atomes');
sheet('05-poses-des-bras.png', [{ label: 'repos', body: pose({}) }, { label: 'abduction 60°, paumes avant', body: pose({ abduction: 60, pronation: -1, spread: 0.7, curl: [0, 0, 0, 0, 0] }) }, { label: 'T (85°), dos de la main', body: pose({ abduction: 85, pronation: 1, spread: 0.5, curl: [0.1, 0.1, 0.1, 0.1, 0.1] }) }, { label: 'mains aux hanches', body: pose({ abduction: 38, elbowFlex: 35, forearmSwing: 62, pronation: 0.6, curl: [0.5, 0.7, 0.7, 0.7, 0.7] }) }, { label: 'asymétrique', body: { pose: { left: { abduction: 70, pronation: -1, spread: 0.8, curl: [0, 0, 0, 0, 0] }, right: { abduction: 15, elbowFlex: 60, pronation: 0.3, curl: [0.6, 0.9, 1, 1, 1] } } } as BodyInput }, { label: 'poings, coudes pliés', body: pose({ abduction: 25, elbowFlex: 75, pronation: 0, curl: [0.9, 1, 1, 1, 1] }) }], 6, 'Poses : cinématique plane du bras (abduction, flexion = perspective, rotation de l’avant-bras, flexion de chaque doigt)', 1000, 0.26);
sheet('06-tetes-et-corps.png', [3, 17, 29, 41, 53, 67, 71].map((seed, i) => ({ label: `identité ${seed}`, seed, body: generateBody(seed, i % 2 ? 'adultFemale' : 'adultMale', 0.2) })), 7, 'Tête complète du moteur de visage (crâne, cheveux, visage, sourcils, yeux, joues, nez, mâchoire, bouche, menton, oreilles, cou) sur le corps');
sheet('07-atomes-bebe-adulte-vieux.png', (['baby', 'child', 'adultFemale', 'adultMale', 'elderFemale'] as const).map((n) => ({ label: `atomes — ${nm[n]}`, body: ARCHETYPES[n] as BodyInput, mode: 'atoms' as const })), 5, 'Mode atomes : chaque composant du contrat a sa teinte ; pointillés = existe mais caché de face');

// --- Mains : 6 vues agrandies ---
{
  const o = generateRandomFace(11, { id: 'f0', transform: { x: 0, y: 0, scale: 1 } }).objects[0] as unknown as Host;
  const A = anchorFromFace(o.face, o.width, o.height);
  const views: Array<[string, object]> = [['paume ouverte', { pronation: -1, spread: 0.6, curl: [0, 0, 0, 0, 0] }], ['dos ouvert', { pronation: 1, spread: 0.6, curl: [0, 0, 0, 0, 0] }], ['paume mi-fermée', { pronation: -0.8, spread: 0.2, curl: [0.5, 0.6, 0.7, 0.75, 0.8] }], ['poing vu de dos', { pronation: 1, spread: 0.1, curl: [0.9, 1, 1, 1, 1] }], ['poing vu de paume', { pronation: -1, spread: 0.1, curl: [0.9, 1, 1, 1, 1] }], ['tranche (pouce devant)', { pronation: 0, spread: 0.3, curl: [0.2, 0.2, 0.2, 0.2, 0.2] }]];
  const cells = views.map(([label, p], i) => {
    const g = bodyGeometry({ age: 28, sex: 1, pose: { left: { abduction: 4, elbowFlex: 0, ...p }, right: { abduction: 4, elbowFlex: 0, ...p } } } as BodyInput, A);
    const w = g.byId.get('wrist.crease.L')!.poly[1]!;
    const m = bodyMarkup({ age: 28, sex: 1, pose: { left: { abduction: 4, elbowFlex: 0, ...p }, right: { abduction: 4, elbowFlex: 0, ...p } } } as BodyInput, A, { skin: '#c99a76', uid: `h${i}` });
    return `<svg x="${i * 360}" y="0" width="360" height="440" viewBox="${w.x - 110} ${w.y - 40} 330 404"><rect x="${w.x - 110}" y="${w.y - 40}" width="330" height="404" fill="#3b4157"/>${m.back}</svg><text x="${i * 360 + 180}" y="472" font-family="DejaVu Sans" font-size="20" fill="#e8e8f0" text-anchor="middle">${label}</text>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2160 490" width="2160" height="490"><rect width="2160" height="490" fill="#20232f"/>${cells.join('')}</svg>`;
  writeFileSync(`${OUT}/08-mains-detail.png`, rasterPng(svg, { fonts: true }));
  console.log('08-mains-detail.png', views.length, 'vues');
}

// --- Mesures : vérification 3 couches, influence des paramètres, catalogue d'atomes ---
{
  const o = generateRandomFace(11, { id: 'f0', transform: { x: 0, y: 0, scale: 1 } }).objects[0] as unknown as Host;
  const A = anchorFromFace(o.face, o.width, o.height);
  const per: Record<string, { bodies: number; checks: number; failures: number; warnings: number }> = {};
  const worst: Record<string, number> = {};
  for (const n of ARCHETYPE_NAMES) for (let s = 1; s <= 25; s++) {
    const g = bodyGeometry(generateBody(s * 31, n), A), r = verifyBody(g, bodyMarkup(generateBody(s * 31, n), A, { skin: '#c99a76' }));
    const e = (per[n] ??= { bodies: 0, checks: 0, failures: 0, warnings: 0 });
    e.bodies++; e.checks += r.checks.length; e.failures += r.failures.length; e.warnings += r.warnings.length;
    for (const c of r.checks) if (c.layer === 'geometry' || c.layer === 'anatomy') worst[c.id] = Math.max(worst[c.id] ?? -Infinity, c.value);
  }
  const total = Object.values(per).reduce((a, b) => ({ bodies: a.bodies + b.bodies, checks: a.checks + b.checks, failures: a.failures + b.failures, warnings: a.warnings + b.warnings }));
  const BASE = BodyParams.parse({ age: 28, sex: -1, adiposity: 0.3, muscularity: 0.4 });
  const leaves = (v: unknown, p = ''): string[] => (typeof v === 'number' ? [p] : Array.isArray(v) ? v.flatMap((x, i) => leaves(x, `${p}.${i}`)) : Object.entries(v as object).flatMap(([k, x]) => leaves(x, p ? `${p}.${k}` : k)));
  const get = (v: unknown, p: string): number => p.split('.').reduce<unknown>((c, k) => (c as Record<string, unknown>)[k], v) as number;
  const set = (v: unknown, p: string, x: number): unknown => { const c = structuredClone(v) as Record<string, unknown>; const ks = p.split('.'); let cur = c; for (const k of ks.slice(0, -1)) cur = cur[k] as Record<string, unknown>; cur[ks.at(-1)!] = x; return c; };
  const sig = (a: { view: string; poly: readonly { x: number; y: number }[] }): string => `${a.view}|${a.poly.map((q) => `${q.x.toFixed(6)},${q.y.toFixed(6)}`).join(';')}`;
  const g0 = bodyGeometry(BASE, A), ref = new Map(g0.atoms.map((a) => [a.id, sig(a)]));
  const influence: Record<string, { changes: string[]; declaredReaders: string[]; undeclared: string[] }> = {};
  for (const p of leaves(BASE)) {
    let g1 = null;
    for (const d of [0.25, -0.25, 6, -6, 30, -30]) { const r = BodyParams.safeParse(set(BASE, p, get(BASE, p) + d)); if (r.success) { g1 = bodyGeometry(r.data, A); break; } }
    const changed = [...new Set(g1!.atoms.filter((a) => ref.get(a.id) !== sig(a)).map((a) => a.part))].sort();
    const allowed = downstream(readersOf(p));
    influence[p] = { changes: changed, declaredReaders: readersOf(p), undeclared: changed.filter((c) => !allowed.has(c)) };
  }
  const catalog = (n: 'adultFemale' | 'adultMale' | 'baby'): unknown => { const g = bodyGeometry(ARCHETYPES[n] as BodyInput, A); const byPart: Record<string, number> = {}, byLevel: Record<string, number> = {}, byKind: Record<string, number> = {}; for (const a of g.atoms) { byPart[a.part] = (byPart[a.part] ?? 0) + 1; byLevel[a.level] = (byLevel[a.level] ?? 0) + 1; byKind[a.kind] = (byKind[a.kind] ?? 0) + 1; } return { atoms: g.atoms.length, byPart, byLevel, byKind, hiddenFromFront: g.atoms.filter((a) => a.view === 'occluded').length, ids: g.atoms.map((a) => `${a.id} [${a.kind}, N${a.level}, parent ${a.parent ?? '—'}]`) }; };
  writeFileSync(`${OUT}/verification.json`, JSON.stringify({ total, perArchetype: per, worstValues: worst, contracts: Object.keys(BODY_CONTRACTS).length }, null, 2));
  writeFileSync(`${OUT}/influence.json`, JSON.stringify({ base: 'femme 28 ans', parametres: Object.keys(influence).length, parametresSansEffet: Object.entries(influence).filter(([, v]) => v.changes.length === 0).map(([k]) => k), changementsNonDeclares: Object.entries(influence).filter(([, v]) => v.undeclared.length).map(([k]) => k), detail: influence }, null, 2));
  writeFileSync(`${OUT}/atomes.json`, JSON.stringify({ femme: catalog('adultFemale'), homme: catalog('adultMale'), bebe: catalog('baby') }, null, 2));
  console.log('verification', JSON.stringify(total), '| influence', Object.keys(influence).length, 'paramètres');
}

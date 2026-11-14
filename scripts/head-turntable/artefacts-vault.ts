import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { encodePngRgba } from '../../src/core/png';
import { fromEngineY } from '../../src/head-turntable/engines/rows';
import { vaultRise, unwarpY } from '../../src/head-turntable/engines/vault-model';
import { variedHead } from '../../src/head-turntable/engines/from-face';
import { vaultCurves } from '../../src/skull/vault-curves';
import { VAULT_STRUCTURES } from '../../src/skull/vault-registry';
import { tissueStack, transmission } from '../../src/skull/vault-tissue';
import { assessVault } from '../../src/skull/vault-constraints';
import { SkullParams } from '../../src/skull/types';
import { project, toCam, dirToCam } from '../../src/head-turntable/math';
import { renderDiff, vaultRender, vaultSpec, VAULT_VIEWS, type VaultViewId } from '../../src/head-turntable/vault-lab';
import { caseSpec, measureProof, proofCases, RELIEF_ON, type ProofCase } from '../../src/head-turntable/vault-proof';
import { placeAll, surfaceFrame } from '../../src/head-turntable/vault-visibility';
import { vaultReport } from '../../src/head-turntable/verify-vault';
import type { TurnRender } from '../../src/head-turntable/types';
import { FAMILIES, PAIRS } from './vault-boards';

/**
 * Preuves visuelles de la voûte crânienne. Écrit les VIGNETTES (png) et les enregistrements (json / csv) ; `compose-vault.py` assemble les planches étiquetées.
 * Même graine (3), même caméra, même éclairage, même rendu pour toutes les valeurs d'un paramètre. Usage : tsx artefacts-vault.ts <dossier> [hauteurPx, défaut 300]
 * Les rendus sont mémoïsés : un rendu identique n'est jamais refait (planches, preuve et enregistrement partagent les mêmes images).
 */
const out = process.argv[2] ?? '/tmp/vault', H = Number(process.argv[3] ?? 300), VIEWS = Object.keys(VAULT_VIEWS) as VaultViewId[];
const memo = new WeakMap<object, Map<string, TurnRender>>();
const render = (spec: object, v: VaultViewId, h = H): TurnRender => { let m = memo.get(spec); if (!m) memo.set(spec, (m = new Map())); const k = `${v}|${h}`; let r = m.get(k); if (!r) m.set(k, (r = vaultRender(spec as never, v, h))); return r; };
const png = (path: string, r: TurnRender): void => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, encodePngRgba(r.w, r.h, r.rgba)); };
const T = (...p: string[]): string => join(out, 'tiles', ...p);
const json = (rel: string, v: unknown): void => { const f = join(out, 'verification', rel); mkdirSync(join(f, '..'), { recursive: true }); writeFileSync(f, JSON.stringify(v, null, 1)); };

// 1. Planches par paramètre : min / nominal / max × 6 vues, et enregistrement de la preuve (mêmes rendus).
const cases = proofCases(), proofs = [];
for (const c of cases) {
  const specs = { lo: caseSpec(c, c.lo), nom: caseSpec(c, c.nom), hi: caseSpec(c, c.hi) };
  for (const [n, s] of Object.entries(specs)) for (const v of VIEWS) png(T('param', c.id, `${n}_${v}.png`), render(s, v));
  proofs.push({ ...measureProof(c, H, 3, (s, v, h) => render(s, v, h)), lo: c.lo, nom: c.nom ?? null, hi: c.hi, expectedViews: c.views, metric: c.metric ?? 'pixels' });
  console.log('param', c.id);
}
json('proofs.json', proofs);
writeFileSync(join(out, 'verification', 'proofs.csv'), ['parametre,perceptible,meilleure_vue,xor_pct,ombre_pct', ...proofs.map((p) => `${p.id},${p.perceptible},${p.best.view},${(p.best.xor * 100).toFixed(3)},${(p.best.shadeFrac * 100).toFixed(3)}`)].join('\n'));

// 2. Têtes complètes (cheveux et chauve) sous les 6 vues ; calque anatomique (sutures, lignes, repères avec visibilité et occlusion).
const hairy = variedHead(3).spec, bald = vaultSpec({}), overlay: Record<string, unknown> = {};
for (const [name, spec] of [['cheveux', hairy], ['chauve', bald]] as const) for (const v of VIEWS) {
  const r = render(spec, v, 420); png(T('tete', `${name}_${v}.png`), r);
  const e = spec.engine!, rise = vaultRise(e), view = VAULT_VIEWS[v];
  const curves = vaultCurves(e.sk).filter((c) => c.kind !== 'point').flatMap((c) => ([1, -1] as const).filter((s) => !(s === -1 && c.pts.every((p) => p.az === 0 || p.az === 180))).map((s) => ({
    id: c.id, side: s, pts: c.pts.map((p) => { const y = unwarpY(fromEngineY(p.y), rise), { P, n } = surfaceFrame(spec, y, p.az * Math.PI / 180 * s), pr = project(toCam(P, view, 'head'), view); return { x: r.originX + pr.x * r.ppu, y: r.originY + pr.y * r.ppu, vis: dirToCam(n, view, 'head', y).z > 0.05 }; }) })));
  overlay[`${name}_${v}`] = { curves, points: placeAll(spec, view, r).map((p) => ({ id: p.id, side: p.side, x: p.px, y: p.py, visible: p.visible, by: p.occludedBy, facing: +p.facing.toFixed(3), local: [p.local.x, p.local.y, p.local.z].map((q) => +q.toFixed(4)), bone: [p.bone.x, p.bone.y, p.bone.z].map((q) => +q.toFixed(4)), depthMm: +(p.depthU * 230).toFixed(2), global: [p.global.x, p.global.y, p.global.z].map((q) => +q.toFixed(4)) })) };
}
json('registre-placements.json', overlay);
json('registre-structures.json', VAULT_STRUCTURES.map((s) => ({ id: s.id, fr: s.fr, latin: s.latin, kind: s.kind, region: s.region, neighbors: s.neighbors, anchor: s.anchor, params: s.params, influence: s.influence, visibleByDefault: s.visibleByDefault, material: s.material, tissues: tissueStack(s.region), transmission: { fin: +transmission(s.region, 0.05, 0).toFixed(3), nominal: +transmission(s.region, 0.5, 0).toFixed(3), epais: +transmission(s.region, 0.95, 0).toFixed(3) } })));

// 3. Familles de crânes : COMBINAISONS de mesures indépendantes, jamais des modèles prédéfinis.
const famReport: Record<string, unknown> = {};
for (const f of FAMILIES) {
  const s = vaultSpec(f.ov as never); for (const v of VIEWS) png(T('famille', `${f.id}_${v}.png`), render(s, v));
  famReport[f.id] = { overrides: f.ov, layers: vaultReport(s).map((l) => ({ layer: l.layer, failed: l.checks.filter((c) => !c.ok).map((c) => c.id) })) }; console.log('famille', f.id);
}
json('familles.json', famReport);

// 4. Interactions : grilles 3 × 3 de deux paramètres ; les cellules voisines doivent différer de façon perceptible.
const inter: Record<string, unknown> = {};
for (const p of PAIRS) {
  const adj: boolean[] = [], cell = (i: number, j: number) => { const c: ProofCase = { id: `${p.a}__${p.b}`, lo: 0, hi: 0, nom: 0, base: { ...p.base, [p.a]: p.va[i]!, [p.b]: p.vb[j]! } as never, views: [p.view] }; return caseSpec(c, undefined, 3); };
  const imgs = [0, 1, 2].map((i) => [0, 1, 2].map((j) => render(cell(i, j), p.view)));
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { png(T('inter', `${p.a}__${p.b}`, `${i}_${j}.png`), imgs[i]![j]!); if (j < 2) adj.push(renderDiff(imgs[i]![j]!, imgs[i]![j + 1]!).perceptible); if (i < 2) adj.push(renderDiff(imgs[i]![j]!, imgs[i + 1]![j]!).perceptible); }
  const corr = [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => assessVault(SkullParams.parse({ ...p.base, [p.a]: p.va[i], [p.b]: p.vb[j] })).corrections.length));
  inter[`${p.a}__${p.b}`] = { view: p.view, va: p.va, vb: p.vb, voisinesPerceptibles: adj.filter(Boolean).length, voisinesTotal: adj.length, correctionsStrictes: corr }; console.log('inter', p.a, p.b);
}
json('interactions.json', inter);

// 5. Contraintes strictes (mode normal) contre caricature (levée) : même demande extrême.
const ext = { temporalHollow: 1, templeBreadth: -1, occipitalFlat: 1, occipitalSlope: -1 };
for (const [n, car] of [['normal', false], ['caricature', true]] as const) { const s = vaultSpec(ext, 3, true, undefined, car); for (const v of ['face', 'trois_quarts', 'dos'] as const) png(T('contrainte', `${n}_${v}.png`), render(s, v)); }
json('contraintes.json', { demande: ext, normal: assessVault(SkullParams.parse(ext), false).corrections, caricature: assessVault(SkullParams.parse(ext), true).corrections, preferences: assessVault(SkullParams.parse({ occipitalFlat: 1, length: 1, cranialBreadth: 1 })).preferences });

// 6. Tissus : scalp (cuir chevelu) × boneShow (os apparent), reliefs actifs.
const tc: ProofCase = { id: 'tissus', lo: 0, hi: 0, nom: 0, base: RELIEF_ON, views: [] };
for (const [i, sc] of [0.05, 0.5, 0.95].entries()) for (const [j, bs] of [-1, 0, 1].entries()) png(T('tissus', `${i}_${j}.png`), render(caseSpec({ ...tc, base: { ...RELIEF_ON, scalp: sc, boneShow: bs } }, undefined, 3), 'trois_quarts_arriere'));

// 7. Cheveux : la coiffure est posée sur le MÊME maillage que la voûte ; elle suit donc largeur, hauteur et occiput.
const HAIR = [['nominal', {}], ['large', { cranialBreadth: 1 }], ['etroit', { cranialBreadth: -1 }], ['haut', { vaultHeight: 1 }], ['bas', { vaultHeight: 0 }], ['occiput-plat', { occipitalFlat: 1, occipitalSlope: 0.6 }]] as const;
for (const [n, ov] of HAIR) { const s = vaultSpec(ov as never, 3, false); for (const v of ['face', 'trois_quarts', 'profil', 'dos'] as const) png(T('cheveux', `${n}_${v}.png`), render(s, v)); }
console.log('terminé', existsSync(out));

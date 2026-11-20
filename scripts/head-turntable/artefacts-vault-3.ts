import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { encodePngRgba } from '../../src/core/png';
import { skullGeometry } from '../../src/skull/geometry';
import { mastoidBump, MASTOID_SHAPE } from '../../src/skull/vault-mastoid';
import { transmission } from '../../src/skull/vault-tissue';
import { VAULT_STRUCTURES } from '../../src/skull/vault-registry';
import { assessVault } from '../../src/skull/vault-constraints';
import { SkullParams } from '../../src/skull/types';
import { drawVault } from '../../src/skull/vault-correlations';
import { skullOf } from '../../src/head-turntable/engines/skull-of';
import { silhouetteProfile } from '../../src/head-turntable/silhouette';
import { vaultRender, vaultSpec, VAULT_VIEWS, type VaultViewId } from '../../src/head-turntable/vault-lab';
import { caseSpec, measureProof, proofCases } from '../../src/head-turntable/vault-proof';
import { place } from '../../src/head-turntable/vault-visibility';
import { vaultReport } from '../../src/head-turntable/verify-vault';
import { AGREE, profileAgreement } from '../../src/head-turntable/verify-vault-3';
import { auditAll } from '../../src/head-turntable/vault-audit';
import { ceilingTable, comboCeiling, CEILING_BONE, CEILING_SCALP } from '../../src/head-turntable/vault-ceiling';
import type { TurnRender } from '../../src/head-turntable/types';
import { generateRandomProfile } from '../../src/generation/random-skull';

/**
 * Preuves visuelles de la PASSE 3 de la voûte (`docs/SKULL-VAULT-3.md`) : tête complète avant / après (nue et coiffée), planches min / nominal / max des mesures ajoutées, gros plans sur les ANCRES du registre,
 * accord du contour 2D et de la silhouette 3D, correction de la queue de la mastoïde conique, audit de consommation, table des plafonds de tissus, robustesse sur tirages aléatoires.
 * Écrit des vignettes (png) et des enregistrements (json) ; `compose-vault-3.py` assemble les planches. Usage : tsx artefacts-vault-3.ts <dossier> [hauteurPx, défaut 420]. Graine 3, même caméra, même lumière que les passes 1 et 2.
 * Sections : VAULT3_ONLY=a,b,... pour n'en refaire que certaines (tetes, params, zoom, accord, queue, audit, plafonds, hasard).
 */
const out = process.argv[2] ?? '/tmp/vault3', H = Number(process.argv[3] ?? 420), VIEWS = Object.keys(VAULT_VIEWS) as VaultViewId[];
const ONLY = (process.env.VAULT3_ONLY ?? '').split(',').filter(Boolean), on = (s: string): boolean => ONLY.length === 0 || ONLY.includes(s);
const T = (...p: string[]): string => join(out, 'tiles', ...p);
const png = (path: string, w: number, h: number, rgba: Uint8Array | Uint8ClampedArray): void => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, encodePngRgba(w, h, rgba as Uint8Array)); };
const json = (rel: string, v: unknown): void => { const f = join(out, 'verification', rel); mkdirSync(join(f, '..'), { recursive: true }); writeFileSync(f, JSON.stringify(v, null, 1)); };
const tile = (path: string, r: TurnRender): void => png(path, r.w, r.h, r.rgba);

// 1. Têtes complètes : trois combinaisons de mesures indépendantes (jamais de modèle prédéfini), nominale / après nue / après coiffée, six vues.
const HEADS: readonly { id: string; label: string; ov: Partial<SkullParams> }[] = [
  { id: 'chignon-sillon', label: 'Chignon occipital souligné par le sillon nuchal', ov: { length: 0.6, occipitalFlat: -0.5, occipitalBun: 0.9, inionSize: 0.5, nuchalGroove: 1 } },
  { id: 'asym-3', label: 'Asymétries propres : bosses frontales, azimut pariétal, direction de mastoïde (visage inchangé)', ov: { frontalEminence: 0.7, asymFrontalEminence: 1, parietalBulge: 0.8, asymParietalAzimuth: 1, mastoid: 0.8, asymMastoidDirection: 1, asymFaceCoupling: 0 } },
  { id: 'cone-mastoide', label: 'Mastoïde en cône, grande, tournée vers l\'avant : la queue ne déborde plus sur la tempe', ov: { mastoid: 1, mastoidSize: 1, mastoidSlope: -1, mastoidDirection: -1, boneShow: 0.6 } },
];
if (on('tetes')) {
  for (const h of HEADS) for (const v of VIEWS) {
    tile(T('tetes', h.id, `avant_${v}.png`), vaultRender(vaultSpec({}, 3, true), v, H));
    tile(T('tetes', h.id, `apres_${v}.png`), vaultRender(vaultSpec(h.ov, 3, true), v, H));
    tile(T('tetes', h.id, `coiffee_${v}.png`), vaultRender(vaultSpec(h.ov, 3, false), v, H));
    console.log('tete', h.id, v);
  }
  json('tetes.json', HEADS.map((h) => ({ ...h, graine: 3, hauteurPx: H, vues: VIEWS })));
}

// 2. Planches min / nominal / max des mesures ajoutées ou dont la preuve change (mêmes rendus pour la preuve et pour l'image) + enregistrement au format de proofs.json.
const NEWIDS = ['asymParietalAzimuth', 'asymFrontalEminence', 'asymMastoidDirection', 'nuchalGroove', 'mastoidSlope'];
if (on('params')) {
  const proofs = [];
  for (const c of proofCases().filter((q) => NEWIDS.includes(q.id))) {
    const specs = { lo: caseSpec(c, c.lo), nom: caseSpec(c, c.nom), hi: caseSpec(c, c.hi) }, memo = new Map<string, TurnRender>();
    const render = (s: object, v: VaultViewId, h = H): TurnRender => { const k = `${Object.entries(specs).find(([, x]) => x === s)?.[0]}|${v}|${h}`; let r = memo.get(k); if (!r) memo.set(k, (r = vaultRender(s as never, v, h))); return r; };
    for (const [n, s] of Object.entries(specs)) for (const v of c.views) tile(T('param', c.id, `${n}_${v}.png`), render(s, v));
    proofs.push({ ...measureProof(c, 300, 3, (s, v, h) => render(s, v, h)), lo: c.lo, nom: c.nom ?? null, hi: c.hi, expectedViews: c.views, metric: c.metric ?? 'pixels' });
    console.log('param', c.id);
  }
  json('proofs-passe3.json', proofs);
}

// 3. Gros plans : fenêtre de 0,62 × 0,5 U centrée sur l'ANCRE du registre de la structure (par côté pour les asymétries).
const ZOOM: readonly { id: string; key: string; vals: [number, number, number]; view: VaultViewId; struct: string; side: -1 | 0 | 1; base?: object }[] = [
  { id: 'nuchalGroove', key: 'nuchalGroove', vals: [-1, 0, 1], view: 'profil', struct: 'nuchal-line', side: 0, base: { occipitalBun: 0.6 } },
  { id: 'asymFrontalEminence-plus', key: 'asymFrontalEminence', vals: [-1, 0, 1], view: 'trois_quarts', struct: 'frontal-eminence', side: 1, base: { frontalEminence: 0.5 } },
  { id: 'asymFrontalEminence-moins', key: 'asymFrontalEminence', vals: [-1, 0, 1], view: 'trois_quarts', struct: 'frontal-eminence', side: -1, base: { frontalEminence: 0.5 } },
  { id: 'asymMastoidDirection-plus', key: 'asymMastoidDirection', vals: [-1, 0, 1], view: 'trois_quarts_arriere', struct: 'mastoid-process', side: 1, base: { mastoid: 1 } },
  { id: 'asymParietalAzimuth-plus', key: 'asymParietalAzimuth', vals: [-1, 0, 1], view: 'trois_quarts_arriere', struct: 'parietal-bone', side: 1, base: { parietalBulge: 1 } },
];
const crop = (r: TurnRender, cx: number, cy: number, w: number, h: number): { w: number; h: number; rgba: Uint8Array } => {
  const o = new Uint8Array(w * h * 4); const x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const sx = x0 + x, sy = y0 + y, d = (y * w + x) * 4; if (sx < 0 || sy < 0 || sx >= r.w || sy >= r.h) { o.set([250, 248, 244, 255], d); continue; } o.set(r.rgba.subarray((sy * r.w + sx) * 4, (sy * r.w + sx) * 4 + 4), d); }
  return { w, h, rgba: o };
};
if (on('zoom')) {
  for (const z of ZOOM) {
    const st = VAULT_STRUCTURES.find((s) => s.id === z.struct)!;
    z.vals.forEach((v, i) => {
      const spec = vaultSpec({ ...(z.base ?? {}), [z.key]: v }, 3, true), r = vaultRender(spec, z.view, 800), p = place(spec, st, z.side, VAULT_VIEWS[z.view], r), W = Math.round(0.62 * r.ppu), Hh = Math.round(0.5 * r.ppu);
      const c = crop(r, p.px, p.py, W, Hh); png(T('zoom', `${z.id}_${['lo', 'nom', 'hi'][i]}.png`), c.w, c.h, c.rgba);
    });
    console.log('zoom', z.id);
  }
  json('zoom.json', ZOOM.map((z) => ({ id: z.id, parametre: z.key, valeurs: z.vals, vue: z.view, structure: z.struct, cote: z.side, fenetre: '0,62 × 0,5 U centrée sur l\'ancre du registre', base: z.base ?? {} })));
}

// 4. Accord contour 2D / silhouette 3D : courbes postérieures (t de 0,1 à 0,55), à un décalage constant près ; têtes nominales et extrêmes qui divergent (rapportés).
if (on('accord')) {
  const backAt = (poly: readonly { x: number; y: number }[], y: number): number => { let m = Infinity; for (let i = 0; i + 1 < poly.length; i++) { const a = poly[i]!, b = poly[i + 1]!; if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) m = Math.min(m, a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y)); } return m; };
  const CASES: readonly { id: string; seed: number; ov: object }[] = [
    { id: 'nominal-3', seed: 3, ov: {} }, { id: 'nominal-7 (pire des 12)', seed: 7, ov: {} }, { id: 'chignon + sillon', seed: 3, ov: { occipitalBun: 0.9, nuchalGroove: 1 } },
    { id: 'occipitalSlope +1 (diverge)', seed: 3, ov: { occipitalSlope: 1 } }, { id: 'vaultHeight 0 (diverge)', seed: 3, ov: { vaultHeight: 0 } }, { id: 'occipitalBun +1', seed: 3, ov: { occipitalBun: 1 } },
  ];
  json('accord-2d-3d.json', CASES.map((c) => {
    const spec = vaultSpec(c.ov as never, c.seed, true), e = spec.engine!, g = skullGeometry(e.p as never, skullOf(e), AGREE.H), s3 = silhouetteProfile(vaultRender(spec, 'profil', 400, false), AGREE.ts).map((q) => q.right);
    const b2 = AGREE.ts.map((t) => -backAt(g.poly, t * AGREE.H) / AGREE.H), i0 = AGREE.ref;
    return { id: c.id, graine: c.seed, parametres: c.ov, t: AGREE.ts, contour2D: b2.map((v) => v - b2[i0]!), silhouette3D: s3.map((v) => v - s3[i0]!), ecartMax: profileAgreement(spec) };
  }));
  const nom = Array.from({ length: 12 }, (_, i) => profileAgreement(vaultSpec({}, i + 1, true))); json('accord-nominal-12-tetes.json', { ecarts: nom, pire: Math.max(...nom), borne: 0.018 });
  console.log('accord', Math.max(...nom).toFixed(4));
}

// 5. Queue de la mastoïde conique : relief de la seule mastoïde (taille +1, pente −1) avant (ancienne forme) et après la correction ; coupes (hauteur × azimut), tissus les plus fins.
if (on('queue')) {
  const T0 = transmission('mastoid', 0.05, 1), amp = 0.03, old = (y: number, az: number): number => { const f = 1 + MASTOID_SHAPE.sizeUp, el = 1, su = MASTOID_SHAPE.sAz * f * el, sv = (MASTOID_SHAPE.sY * f) / Math.sqrt(el), u = ((az - 118) * 0.0055) / su, v = (y - 0.67) / sv, p = 1 - MASTOID_SHAPE.slopeK; return f * Math.exp(-0.5 * (u * u + v * v) ** p); };
  const ys: number[] = [], azs: number[] = []; for (let y = 0.3; y <= 0.8001; y += 0.01) ys.push(+y.toFixed(2)); for (let a = 0; a <= 180; a += 2) azs.push(a);
  json('queue-mastoide.json', { transmission: T0, amplitude: amp, y: ys, az: azs, avant: ys.map((y) => azs.map((a) => +(amp * T0 * old(y, a)).toFixed(5))), apres: ys.map((y) => azs.map((a) => +(amp * T0 * mastoidBump(y, a, 0.67, 118, 1, 0, -1)).toFixed(5))) });
  console.log('queue');
}

// 6. Audit de consommation (toutes les mesures de la voûte) et table des plafonds de relief selon les tissus.
if (on('audit')) { json('audit-consommation.json', auditAll()); console.log('audit'); }
if (on('plafonds')) {
  json('plafonds-tissus.json', { limites: { amplitude: 0.06, saut: 0.014 }, scalp: CEILING_SCALP, boneShow: CEILING_BONE, seuls: ceilingTable(), combinaison: Object.fromEntries(([1, -1] as const).map((s) => [s > 0 ? 'tous_a_plus_un' : 'tous_a_moins_un', CEILING_SCALP.flatMap((sc) => CEILING_BONE.map((b) => ({ scalp: sc, boneShow: b, ...comboCeiling(s, sc, b) })))])) });
  console.log('plafonds');
}

// 7. Robustesse : 24 têtes tirées au hasard (variété 0,9, tendance 0,5), puis toutes les nouvelles mesures aux extrêmes sur 3 graines ; aucune défaillance bloquante attendue.
if (on('hasard')) {
  const rows = [];
  for (let seed = 1; seed <= 24; seed++) {
    const k = SkullParams.parse({ ...generateRandomProfile(seed).skull, ...drawVault(seed, { variety: 0.9, tendency: 0.5 }) }), a = assessVault(k, false);
    const fails = vaultReport(vaultSpec(a.params, seed, true)).flatMap((l) => l.checks).filter((c) => !c.ok && c.kind === 'hard').map((c) => c.id);
    rows.push({ graine: seed, corrections: a.corrections.map((q) => q.id), plausibilite: +a.plausibility.toFixed(3), echecs: fails });
    console.log('hasard', seed, fails.length);
  }
  json('aleatoire-passe3.json', rows);
  const ext = [];
  for (const seed of [3, 42, 11]) for (const [n, v] of [['plus', 1], ['moins', -1]] as const) {
    const ov = { asymParietalAzimuth: v, asymFrontalEminence: v, asymMastoidDirection: v, nuchalGroove: v, parietalBulge: 1, frontalEminence: 0.6, mastoid: 1, occipitalBun: 0.8 };
    ext.push({ graine: seed, sens: n, echecs: vaultReport(vaultSpec(ov, seed, true)).flatMap((l) => l.checks).filter((c) => !c.ok && c.kind === 'hard').map((c) => c.id) });
  }
  json('extremes-passe3.json', ext);
}

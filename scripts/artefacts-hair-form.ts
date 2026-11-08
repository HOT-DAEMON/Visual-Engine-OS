import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { generateRandomFace, type RandomFace } from '../src';
import { faceLandmarks, hairGeometry } from '../src/face';
import { rasterPng } from './lib/raster';
import { layout, render, toWorld, type Cell } from './lib/proof';
import { hairFaceSpec, type CleanStyle } from './lib/hair-faces';

/**
 * Preuves de la FORME DES CHEVEUX SUR LE CRÂNE (`docs/HAIR-FORM.md`) : remplissage de la coque et couche de vérification `hair-form`.
 *
 *   npx tsx scripts/artefacts-hair-form.ts render <dossier>   planches brutes + counts.json avec LE CODE COURANT
 *   npx tsx scripts/artefacts-hair-form.ts compose            « après » = code courant ; « avant » = artefacts/hair-form/avant/ (commit d'origine)
 *
 * « Avant » : `git worktree add <dir> <commit>`, lien `node_modules`, ce script copié, puis `render <dir>/avant` (voir `artefacts/hair-form/README.md`).
 * Mêmes graines, mêmes options. Aucune planche n'est retouchée.
 */
const MODE = process.argv[2] ?? 'compose';
const OUT = 'artefacts/hair-form';
const FONT = 'Inter, DejaVu Sans, sans-serif';
const BG = '#f4f1ea';
const txt = (x: number, y: number, s: string, size = 14, fill = '#222', anchor = 'start', weight = 400): string =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${s.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;
const STYLES: CleanStyle[] = ['buzz', 'short', 'spiky', 'curly', 'afro', 'bob', 'long', 'ponytail', 'bun', 'braids'];
const SETS: [string, CleanStyle[]][] = [['tetes-courtes', ['short', 'spiky']], ['tetes-volume', ['curly', 'afro']], ['tetes-pendantes', ['bob', 'long']], ['tetes-inchangees', ['buzz', 'bun', 'ponytail', 'braids']]];

function renderRaw(dir: string): void {
  mkdirSync(dir, { recursive: true });
  for (const [name, styles] of SETS) {
    const C = 4, CW = 300, CH = 400;
    const items = styles.flatMap((st) => Array.from({ length: C }, (_, j) => ({ st, j })));
    const L = layout(items.length, C, CW, CH, 0.62, (i) => hairFaceSpec(items[i]!.st, items[i]!.j + 5, { engine: 'v2', seed: 21000 + i * 31, identity: (i * 5) % 8 }));
    writeFileSync(`${dir}/${name}.png`, render(L.objects, C * CW, styles.length * CH, '', BG));
  }
  const rows: CleanStyle[] = ['afro', 'curly', 'short', 'spiky', 'long'];
  const L = layout(rows.length, rows.length, 460, 520, 1.15, (i) => hairFaceSpec(rows[i]!, 3, { engine: 'v2', seed: 24000 + i * 37, identity: i }));
  writeFileSync(`${dir}/details.png`, render(L.objects, rows.length * 460, 520, '', BG));
  // Empreinte du CODE : nombre de formes par visage du corpus, pour prouver que le reste de la chevelure est inchangé (voir `compose`).
  const counts: Record<string, number> = {};
  for (const st of STYLES) for (let k = 0; k < 8; k++) {
    const sp = hairFaceSpec(st, k, { engine: 'v2', seed: 41000 + k * 31 + STYLES.indexOf(st) * 5 });
    const f = generateRandomFace(sp.seed, sp.opts), g = hairGeometry(f.params, faceLandmarks(f.params, f.width, f.height));
    counts[`${st}-${k}`] = g ? g.locks.length : 0;
  }
  writeFileSync(`${dir}/counts.json`, JSON.stringify(counts, null, 1));
  console.log(`planches brutes : ${dir}`);
}

const b64 = (p: string): string => readFileSync(p).toString('base64');
const sheet = (name: string, w: number, h: number, body: string): void => {
  const full = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${BG}"/>${body}</svg>`;
  writeFileSync(`${OUT}/${name}.png`, rasterPng(full, { fonts: true, fitWidth: Math.min(2000, w) }));
  console.log(`${OUT}/${name}.png`);
};
const img = (p: string, x: number, y: number, w: number, h: number): string => `<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${b64(p)}"/>`;

/** Diagnostic (code courant) : cellules NUES de la coque en cyan, formes de remplissage en magenta. Le contour de la coque est en noir. */
async function overlay(): Promise<void> {
  const { gridOver, paint, centerOf } = await import('../src/face/hair/coverage');
  const rows: CleanStyle[] = ['short', 'curly', 'afro', 'bob'];
  const CW = 520, CH = 640;
  const L = layout(rows.length, rows.length, CW, CH, 0.8, (i) => hairFaceSpec(rows[i]!, 3, { engine: 'v2', seed: 26000 + i * 19, identity: i }));
  const path = (c: Cell, p: { x: number; y: number }[]): string => `M${p.map((q) => toWorld(c, q.x, q.y).map((v) => v.toFixed(1)).join(' ')).join('L')}Z`;
  let ov = '';
  L.cells.forEach((c) => {
    const g = hairGeometry(c.face.params, c.lm)!, base = g.base[0]!;
    const grid = gridOver(base, 0.012 * c.lm.W), inside = new Uint8Array(grid.nx * grid.ny), cover = new Uint8Array(grid.nx * grid.ny);
    paint(grid, base, inside);
    for (const l of g.locks) if (l.layer === 'front' && l.rank !== 'hairline') paint(grid, l.poly, cover);
    for (let i = 0; i < inside.length; i++) if (inside[i] && !cover[i]) { const q = centerOf(grid, i), [x, y] = toWorld(c, q.x, q.y), s = grid.cell * 1.15 * c.s; ov += `<rect x="${(x - s / 2).toFixed(1)}" y="${(y - s / 2).toFixed(1)}" width="${s.toFixed(1)}" height="${s.toFixed(1)}" fill="rgba(0,170,255,0.7)"/>`; }
    for (const l of g.locks) if (l.fill) ov += `<path d="${path(c, l.poly)}" stroke="#d6009a" stroke-width="0.8" fill="rgba(214,0,154,0.10)"/>`;
    ov += `<path d="${path(c, base)}" stroke="#111" stroke-width="1.6" fill="none"/>`;
  });
  writeFileSync(`${OUT}/05-diagnostic-couverture.png`, render(L.objects, rows.length * CW, CH, ov, BG));
}

interface Row { readonly id: string; readonly layer: string; n: number; fail: number; err: number; worst: number; margin: number }
async function report(): Promise<{ rows: Row[]; faces: number; cov: string[]; same: string }> {
  const { checkHairForm } = await import('../src/verify/hair-form');
  const { verifyFace } = await import('../src/verify');
  const { shellCoverage, fillKeep } = await import('../src/face/hair/crown-fill');
  const rows = new Map<string, Row>();
  const corpus: { st: string; k: number; f: RandomFace }[] = [];
  for (const st of STYLES) for (let k = 0; k < 8; k++) { const sp = hairFaceSpec(st, k, { engine: 'v2', seed: 41000 + k * 31 + STYLES.indexOf(st) * 5 }); corpus.push({ st, k, f: generateRandomFace(sp.seed, sp.opts) }); }
  for (let s = 0; s < Number(process.env.FACES ?? 120); s++) corpus.push({ st: 'aléatoire', k: s, f: generateRandomFace(61000 + s * 17) });
  const old: Record<string, number> = existsSync(`${OUT}/avant/counts.json`) ? JSON.parse(readFileSync(`${OUT}/avant/counts.json`, 'utf8')) : {};
  const bare = new Map<string, { b: number[]; a: number[] }>();
  let same = 0, diff = 0;
  for (const { st, k, f } of corpus) {
    if (f.params.hair.style === 'bald') continue;
    for (const c of checkHairForm(f)) {
      const r = rows.get(c.id) ?? { id: c.id, layer: c.layer, n: 0, fail: 0, err: 0, worst: 0, margin: Infinity };
      r.n++;
      if (!c.ok) { r.fail++; if (c.severity === 'error') r.err++; }
      r.worst = Math.max(r.worst, Math.abs(c.value));
      r.margin = Math.min(r.margin, c.limit - c.value);
      rows.set(c.id, r);
    }
    if (st === 'aléatoire') continue;
    const lm = faceLandmarks(f.params, f.width, f.height), g = hairGeometry(f.params, lm)!, S = g.boundary.skull, front = (skip: boolean) => g.locks.filter((l) => l.layer === 'front' && l.rank !== 'hairline' && !(skip && l.fill)).map((l) => l.poly);
    const e = bare.get(st) ?? { b: [], a: [] };
    e.b.push(shellCoverage(S, g.base[0]!, lm.W, front(true), g.bare.thin).rim); e.a.push(shellCoverage(S, g.base[0]!, lm.W, front(false), g.bare.thin).rim);
    bare.set(st, e);
    if (`${st}-${k}` in old) (old[`${st}-${k}`] === g.locks.filter((l) => !l.fill).length ? same++ : diff++);
  }
  if (!verifyFace(generateRandomFace(61000)).checks.some((c) => c.id === 'shell-rim-bare' || c.id === 'fill-style-scope')) throw new Error('checkHairForm n\'est pas branché dans verifyFace');
  const m = (v: number[]): string => (v.reduce((a, b) => a + b, 0) / v.length).toFixed(2), mx = (v: number[]): string => Math.max(...v).toFixed(2);
  const cov = STYLES.map((st) => { const e = bare.get(st)!; return `| ${st} | ${m(e.b)} | ${mx(e.b)} | ${m(e.a)} | ${mx(e.a)} |`; });
  void fillKeep;
  return { rows: [...rows.values()].sort((a, b) => a.layer.localeCompare(b.layer) || a.id.localeCompare(b.id)), faces: corpus.length, cov, same: existsSync(`${OUT}/avant/counts.json`) ? `${same} visages sur ${same + diff} ont exactement le même nombre de formes qu'avant, hors remplissage (${diff} différents)` : 'counts.json « avant » absent : identité non vérifiée' };
}

async function compose(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const A = `${OUT}/apres`, V = `${OUT}/avant`;
  renderRaw(A);
  if (!existsSync(`${V}/tetes-courtes.png`)) throw new Error(`planches « avant » absentes : ${V} (voir l'en-tête du script)`);
  const pair = (file: string, w: number, h: number, name: string, title: string, sub: string, stack = true): void => {
    const gap = 30, top = 86, head = txt(24, 36, title, 24, '#111', 'start', 700) + txt(24, 60, sub, 14, '#555');
    if (stack) sheet(name, w + 48, 2 * h + top + gap + 44, head + txt(24, top - 8, 'AVANT', 15, '#b42318', 'start', 700) + img(`${V}/${file}.png`, 24, top, w, h) + txt(24, top + h + gap + 8, 'APRÈS', 15, '#067647', 'start', 700) + img(`${A}/${file}.png`, 24, top + h + gap + 20, w, h));
    else sheet(name, 2 * w + gap + 48, h + top + 24, head + txt(24 + w / 2, top - 8, 'AVANT', 15, '#b42318', 'middle', 700) + txt(24 + w + gap + w / 2, top - 8, 'APRÈS', 15, '#067647', 'middle', 700) + img(`${V}/${file}.png`, 24, top, w, h) + img(`${A}/${file}.png`, 24 + w + gap, top, w, h));
  };
  pair('tetes-courtes', 1200, 800, '01a-tetes-short-spiky', 'Têtes entières — coupes courtes', 'short · spiky, 4 visages chacun, mêmes graines avant/après', false);
  pair('tetes-volume', 1200, 800, '01b-tetes-curly-afro', 'Têtes entières — coupes volumineuses', 'curly · afro : le dôme est dessiné par des mèches, plus un casque lisse', false);
  pair('tetes-pendantes', 1200, 800, '01c-tetes-bob-long', 'Têtes entières — cheveux pendants', 'bob · long : le dessus du crâne reçoit des mèches ; la retombée est inchangée', false);
  pair('tetes-inchangees', 1200, 1600, '01d-tetes-non-modifiees', 'Contrôle négatif — coiffures qui ne doivent PAS changer', 'buzz · bun · ponytail · braids : aucune mèche ajoutée (aplats par anatomie) ; seule la teinte des sous-couches d\'étage, plafonnée à 24°, change sur 6 visages', false);
  pair('details', 2300, 520, '03-details-dessus-du-crane', 'Détails : dessus du crâne', 'afro · curly · short · spiky · long en gros plan', true);
  await overlay();
  const { rows, faces, cov, same } = await report();
  const lines = [
    '# Rapport de vérification — forme des cheveux sur le crâne', '',
    `Corpus : ${faces} visages (10 coiffures × 8 visages imposés ; le reste tiré au hasard, graines 61000 + 17 k). Code : \`src/verify/hair-form.ts\`.`, '',
    '| couche | contrôle | visages | écarts | erreurs | valeur max. mesurée | marge minimale (limite − valeur) |', '|---|---|---:|---:|---:|---:|---:|',
    ...rows.map((r) => `| ${r.layer} | \`${r.id}\` | ${r.n} | ${r.fail} | ${r.err} | ${r.worst.toFixed(3)} | ${r.margin.toFixed(3)} |`), '',
    '« écarts » = contrôles non satisfaits (erreur ou avertissement) ; « marge minimale » = écart le plus serré à la limite DE CE VISAGE (les limites varient avec la coiffure) ; négative = dépassement. `fill-style-scope` compte des mèches de remplissage (plafond par coiffure) ; `fill-clears-free-ear-*` des mèches dans l\'oreille (tolérance 3).', '',
    '## Part NUE de la moitié extérieure de la coque (8 visages par coiffure)', '',
    '| coiffure | avant moy. | avant max | après moy. | après max |', '|---|---:|---:|---:|---:|', ...cov, '',
    '« avant » = mêmes visages, formes de remplissage exclues ; zones clairsemées voulues (éclaircissement) hors mesure. Coiffures non listées dans `FILL` : inchangées par conception.', '',
    `Identité du reste de la chevelure : ${same}.`, '',
  ];
  writeFileSync(`${OUT}/rapport-verification.md`, lines.join('\n'));
}

if (MODE === 'render') renderRaw(process.argv[3] ?? `${OUT}/apres`);
else await compose();

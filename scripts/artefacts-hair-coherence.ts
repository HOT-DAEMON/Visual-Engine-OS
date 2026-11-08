import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { generateRandomFace, type RandomFace } from '../src';
import { hairGeometry } from '../src/face/hair';
import { rasterPng } from './lib/raster';
import { layout, render, toWorld, type Cell } from './lib/proof';
import { hairFaceSpec, type CleanStyle } from './lib/hair-faces';

/**
 * Preuves de la COHÉRENCE CHEVEUX ↔ TÊTE étendue (`docs/HAIR-COHERENCE.md`) : portée au niveau du POLYGONE, attaches posées sur le crâne,
 * ton de racine, vent borné, vocabulaire de coiffure.
 *
 *   npx tsx scripts/artefacts-hair-coherence.ts render <dossier>   planches brutes avec LE CODE COURANT (sans diagnostic ni rapport)
 *   npx tsx scripts/artefacts-hair-coherence.ts compose            « après » = code courant ; « avant » = artefacts/hair-coherence/avant/ (commit 1596835)
 *
 * « Avant » : `git worktree add <dir> 1596835`, lien `node_modules`, ce script copié, puis `render <dir>/avant`. Mêmes graines, mêmes options.
 * Aucune planche n'est retouchée ; `diagnostic` et `rapport` n'existent que pour le code courant (leurs modules n'existent pas à l'origine).
 */
const MODE = process.argv[2] ?? 'compose';
const OUT = 'artefacts/hair-coherence';
const FONT = 'Inter, DejaVu Sans, sans-serif';
const txt = (x: number, y: number, s: string, size = 14, fill = '#222', anchor = 'start', weight = 400): string =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${s.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;
const BG = '#f4f1ea';

// ---------------------------------------------------------------- rendu brut
function renderRaw(dir: string): void {
  mkdirSync(dir, { recursive: true });
  // 1. Têtes entières : 4 visages par coiffure, graines propres à ce lot.
  const sets: [string, CleanStyle[]][] = [['tetes-courtes', ['short', 'spiky', 'curly', 'afro']], ['tetes-longues', ['bob', 'long', 'braids']]];
  for (const [name, styles] of sets) {
    const C = 4, CW = 300, CH = 400;
    const items = styles.flatMap((st) => Array.from({ length: C }, (_, j) => ({ st, j })));
    const L = layout(items.length, C, CW, CH, 0.62, (i) => hairFaceSpec(items[i]!.st, items[i]!.j + 5, { engine: 'v2', seed: 12000 + i * 29, identity: (i * 5) % 8 }));
    writeFileSync(`${dir}/${name}.png`, render(L.objects, C * CW, styles.length * CH, '', BG));
  }
  // 2. Attaches : chignon et queue, 5 visages chacun, plus grand (placement sur le crâne, rayon, éventail).
  {
    const rows: CleanStyle[] = ['bun', 'ponytail'];
    const items = rows.flatMap((st) => Array.from({ length: 5 }, (_, j) => ({ st, j })));
    const L = layout(items.length, 5, 420, 520, 0.68, (i) => hairFaceSpec(items[i]!.st, items[i]!.j + 1, { engine: 'v2', seed: 13000 + i * 41, identity: (i * 3) % 8 }));
    writeFileSync(`${dir}/attaches.png`, render(L.objects, 5 * 420, rows.length * 520, '', BG));
  }
  // 3. Détails : dessus du crâne en gros plan.
  {
    const rows: CleanStyle[] = ['short', 'bob', 'curly', 'afro', 'spiky'];
    const L = layout(rows.length, rows.length, 460, 520, 1.15, (i) => hairFaceSpec(rows[i]!, 3, { engine: 'v2', seed: 14000 + i * 37, identity: i }));
    writeFileSync(`${dir}/details.png`, render(L.objects, rows.length * 460, 520, '', BG));
  }
  // 4. Vent : même visage, vent fort de gauche à droite, trois coiffures.
  {
    const rows: CleanStyle[] = ['short', 'long', 'curly'];
    const L = layout(rows.length, rows.length, 460, 560, 0.74, (i) => hairFaceSpec(rows[i]!, 2, { engine: 'v2', seed: 15000 + i * 53, identity: i + 2, hair: { wind: { x: 0.9, y: -0.3, flex: 1 } } }));
    writeFileSync(`${dir}/vent.png`, render(L.objects, rows.length * 460, 560, '', BG));
  }
  console.log(`planches brutes : ${dir}`);
}

// ---------------------------------------------------------------- diagnostic (code courant seulement)
async function overlay(): Promise<void> {
  const { reachBudget } = await import('../src/face/hair/reach');
  const rows: CleanStyle[] = ['short', 'bob', 'curly', 'ponytail'];
  const CW = 520, CH = 640;
  const L = layout(rows.length, rows.length, CW, CH, 0.8, (i) => hairFaceSpec(rows[i]!, 3, { engine: 'v2', seed: 16000 + i * 19, identity: i }));
  const path = (c: Cell, p: { x: number; y: number }[]): string => `M${p.map((q) => toWorld(c, q.x, q.y).map((v) => v.toFixed(1)).join(' ')).join('L')}Z`;
  let ov = '';
  L.cells.forEach((c) => {
    const g = hairGeometry(c.face.params, c.lm)!;
    const S = g.boundary.skull, st = c.face.params.hair.style as CleanStyle;
    const B = reachBudget(st, S, c.lm.W, c.lm.H);
    // Contour du crâne (gris, pointillé) ; portée admise = contour décalé de `side` et plafonné à `yTop` (rouge).
    const skull: { x: number; y: number }[] = [], reach: { x: number; y: number }[] = [];
    for (let i = 0; i <= 40; i++) { const y = Math.max(B.yTop, S.topY + ((S.chinY - S.topY) * i) / 40); skull.push({ x: S.a(S.topY + ((S.chinY - S.topY) * i) / 40), y: S.topY + ((S.chinY - S.topY) * i) / 40 }); reach.push({ x: S.a(Math.max(S.topY, y)) + B.side, y }); }
    const mirror = (a: { x: number; y: number }[]): { x: number; y: number }[] => [...a, ...[...a].reverse().map((q) => ({ x: -q.x, y: q.y }))];
    ov += `<path d="${path(c, mirror(skull))}" stroke="#555" stroke-width="1.6" stroke-dasharray="6 4" fill="none"/>`;
    ov += `<path d="${path(c, mirror(reach))}" stroke="#b42318" stroke-width="1.8" fill="none"/>`;
    // Mèches construites sous borne (bleu) : leur polygone doit rester dans la ligne rouge.
    g.locks.filter((l) => l.bounded && l.layer !== 'over').forEach((l) => (ov += `<path d="${path(c, l.poly)}" stroke="#1f6feb" stroke-width="1" fill="rgba(31,111,235,0.07)"/>`));
  });
  // Pas de texte (`render` n'embarque pas de police) : légende dans `artefacts/hair-coherence/README.md`.
  writeFileSync(`${OUT}/05-diagnostic-portee.png`, render(L.objects, rows.length * CW, CH, ov, BG));
}

// ---------------------------------------------------------------- rapport de vérification
interface Row { readonly id: string; readonly layer: string; n: number; fail: number; err: number; worst: number; limit: number }
async function report(N: number): Promise<{ rows: Row[]; faces: number }> {
  const { checkHairCoherence } = await import('../src/verify/hair-coherence');
  const { verifyFace } = await import('../src/verify');
  const STYLES: CleanStyle[] = ['buzz', 'short', 'spiky', 'curly', 'afro', 'bob', 'long', 'ponytail', 'bun', 'braids'];
  const rows = new Map<string, Row>();
  let faces = 0;
  const corpus: RandomFace[] = [];
  for (let s = 0; s < N; s++) corpus.push(generateRandomFace(61000 + s * 17));
  for (const st of STYLES) for (let k = 0; k < 14; k++) { const sp = hairFaceSpec(st, k, { engine: 'v2', seed: 41000 + k * 31 + STYLES.indexOf(st) * 11 }); corpus.push(generateRandomFace(sp.seed, sp.opts)); }
  // Une série avec vent fort : la borne de vent doit tenir aussi.
  for (const st of STYLES) for (let k = 0; k < 4; k++) { const sp = hairFaceSpec(st, k, { engine: 'v2', seed: 43000 + k * 31 + STYLES.indexOf(st) * 11, hair: { wind: { x: 0.8, y: -0.2, flex: 0.9 } } }); corpus.push(generateRandomFace(sp.seed, sp.opts)); }
  for (const f of corpus) {
    if (f.params.hair.style === 'bald') continue;
    faces++;
    for (const c of checkHairCoherence(f)) {
      const r = rows.get(c.id) ?? { id: c.id, layer: c.layer, n: 0, fail: 0, err: 0, worst: 0, limit: c.limit };
      r.n++;
      if (!c.ok) { r.fail++; if (c.severity === 'error') r.err++; r.worst = Math.max(r.worst, Math.abs(c.value)); }
      rows.set(c.id, r);
    }
  }
  if (!verifyFace(generateRandomFace(61000)).checks.some((c) => c.id === 'lock-envelope-bound')) throw new Error('checkHairCoherence n\'est pas branché dans verifyFace');
  return { rows: [...rows.values()].sort((a, b) => a.layer.localeCompare(b.layer) || a.id.localeCompare(b.id)), faces };
}

const b64 = (p: string): string => readFileSync(p).toString('base64');
const sheet = (name: string, w: number, h: number, body: string): void => {
  const full = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${BG}"/>${body}</svg>`;
  writeFileSync(`${OUT}/${name}.png`, rasterPng(full, { fonts: true, fitWidth: Math.min(2000, w) }));
  console.log(`${OUT}/${name}.png`);
};
const img = (p: string, x: number, y: number, w: number, h: number): string => `<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${b64(p)}"/>`;

async function compose(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const A = `${OUT}/apres`, V = `${OUT}/avant`;
  renderRaw(A);
  if (!existsSync(`${V}/tetes-courtes.png`)) throw new Error(`planches « avant » absentes : ${V} (voir l'en-tête du script)`);
  const pair = (file: string, w: number, h: number, name: string, title: string, sub: string, stack = false): void => {
    const gap = 30, top = 86;
    const head = txt(24, 36, title, 24, '#111', 'start', 700) + txt(24, 60, sub, 14, '#555');
    if (stack) {
      sheet(name, w + 48, 2 * h + top + gap + 44, head + txt(24, top - 8, 'AVANT (commit 1596835)', 15, '#b42318', 'start', 700) + img(`${V}/${file}.png`, 24, top, w, h) +
        txt(24, top + h + gap + 8, 'APRÈS', 15, '#067647', 'start', 700) + img(`${A}/${file}.png`, 24, top + h + gap + 20, w, h));
      return;
    }
    sheet(name, 2 * w + gap + 48, h + top + 24, head +
      txt(24 + w / 2, top - 8, 'AVANT (commit 1596835)', 15, '#b42318', 'middle', 700) + txt(24 + w + gap + w / 2, top - 8, 'APRÈS', 15, '#067647', 'middle', 700) +
      img(`${V}/${file}.png`, 24, top, w, h) + img(`${A}/${file}.png`, 24 + w + gap, top, w, h));
  };
  pair('tetes-courtes', 600, 800, '01a-tetes-short-spiky-curly-afro', 'Têtes entières — coupes courtes et volumineuses', 'short · spiky · curly · afro, 4 visages chacun, mêmes graines avant/après');
  pair('tetes-longues', 600, 600, '01b-tetes-bob-long-tresses', 'Têtes entières — cheveux pendants et tresses', 'bob · long · braids, 4 visages chacun, mêmes graines avant/après');
  pair('attaches', 1000, 520, '02-attaches-chignon-queue', 'Attaches : chignon et queue de cheval', 'posées sur le crâne, au-dessus de l\'oreille, rayon et éventail bornés', true);
  pair('details', 1500, 339, '03-details-dessus-du-crane', 'Détails : dessus du crâne', 'short · bob · curly · afro · spiky en gros plan (portée au niveau du polygone, ton de racine)', true);
  pair('vent', 690, 560, '04-vent-borne-par-la-portee', 'Vent fort (x 0,9 ; y −0,3 ; souplesse 1)', 'short · long · curly : le vent déplace les mèches, il ne les sort plus de leur portée', false);
  await overlay();

  const { rows, faces } = await report(Number(process.env.FACES ?? 200));
  const lines = [
    '# Rapport de vérification — cohérence cheveux ↔ tête', '',
    `Corpus : ${faces} visages chevelus (naturels, graines 61000 + 17 k ; 14 par coiffure imposée ; 4 par coiffure sous vent fort). Code : \`src/verify/hair-coherence.ts\`.`, '',
    '| couche | contrôle | visages | écarts | erreurs | pire valeur | limite |', '|---|---|---:|---:|---:|---:|---:|',
    ...rows.map((r) => `| ${r.layer} | \`${r.id}\` | ${r.n} | ${r.fail} | ${r.err} | ${r.worst.toFixed(3)} | ${r.limit.toFixed(3)} |`), '',
    '« écarts » = contrôles non satisfaits (erreur ou avertissement) ; « erreurs » = gravité `error`. Un chiffre non nul n\'est pas masqué : voir `docs/HAIR-COHERENCE-REMAINING.md`.', '',
  ];
  writeFileSync(`${OUT}/rapport-verification.md`, lines.join('\n'));
  const colour = (r: Row): string => (r.fail === 0 ? '#067647' : r.err ? '#b42318' : '#b54708');
  let y = 90;
  let body = txt(24, 36, 'Vérification du rendu — trois couches', 24, '#111', 'start', 700) + txt(24, 60, `${faces} visages chevelus · géométrie, anatomie, style (src/verify/hair-coherence.ts)`, 14, '#555');
  const layerName: Record<string, string> = { geometry: 'GÉOMÉTRIE', anatomy: 'ANATOMIE', style: 'STYLE' };
  let last = '';
  for (const r of rows) {
    if (r.layer !== last) { last = r.layer; y += 12; body += txt(24, y, layerName[r.layer] ?? r.layer, 14, '#111', 'start', 700); y += 22; }
    const w = 520 * (1 - r.fail / Math.max(1, r.n));
    body += txt(24, y + 12, r.id, 13, '#222') + `<rect x="260" y="${y}" width="520" height="16" rx="3" fill="#e5e1d8"/><rect x="260" y="${y}" width="${w.toFixed(1)}" height="16" rx="3" fill="${colour(r)}"/>` +
      txt(796, y + 13, `${r.n - r.fail}/${r.n}${r.fail ? `  (pire ${r.worst.toFixed(3)} / limite ${r.limit.toFixed(3)})` : ''}`, 12, '#444');
    y += 26;
  }
  sheet('06-rapport-verification', 1160, y + 20, body);
}

if (MODE === 'render') renderRaw(process.argv[3] ?? `${OUT}/apres`);
else await compose();

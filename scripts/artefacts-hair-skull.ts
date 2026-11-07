import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { generateRandomFace, type RandomFace } from '../src';
import { hairGeometry } from '../src/face/hair';
import { rasterPng } from './lib/raster';
import { layout, render, toWorld, type Cell } from './lib/proof';
import { hairFaceSpec, type CleanStyle } from './lib/hair-faces';

/**
 * Preuves de la COHÉRENCE CRÂNE ↔ CHEVEUX (`docs/HAIR-SKULL.md`, `docs/HAIR-BACK-MASS.md`, `docs/HAIR-SKULL-VERIFY.md`).
 *
 *   npx tsx scripts/artefacts-hair-skull.ts render <dossier>     rend les planches brutes avec LE CODE COURANT
 *   npx tsx scripts/artefacts-hair-skull.ts compose              rend « après » (code courant), l'assemble avec `avant/` + rapport dans artefacts/hair-skull/
 *
 * Les planches « avant » viennent d'un worktree du commit d'origine (`git worktree add … HEAD`), avec les mêmes graines et les mêmes options :
 * `render` y est lancé avec ce même script copié. Aucune planche n'est retouchée.
 */
const MODE = process.argv[2] ?? 'compose';
const OUT = 'artefacts/hair-skull';
const STYLES: CleanStyle[] = ['buzz', 'short', 'spiky', 'curly', 'afro', 'bob', 'long', 'ponytail', 'bun', 'braids'];
const FONT = 'Inter, DejaVu Sans, sans-serif';
const txt = (x: number, y: number, s: string, size = 14, fill = '#222', anchor = 'start', weight = 400): string =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${s.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;

// ---------------------------------------------------------------- rendu brut
function renderRaw(dir: string): void {
  mkdirSync(dir, { recursive: true });
  const C = 4, CW = 300, CH = 400;
  // 1. Têtes entières : 10 coiffures × 4 visages (v2, axes cohérents avec la coiffure), deux planches de 5 coiffures.
  for (const [name, styles] of [['tetes-a', STYLES.slice(0, 5)], ['tetes-b', STYLES.slice(5)]] as const) {
    const items = styles.flatMap((st) => Array.from({ length: C }, (_, j) => ({ st, j })));
    const L = layout(items.length, C, CW, CH, 0.62, (i) => hairFaceSpec(items[i]!.st, items[i]!.j + 2, { engine: 'v2', seed: 7000 + i * 23, identity: (i * 3) % 8 }));
    writeFileSync(`${dir}/${name}.png`, render(L.objects, C * CW, styles.length * CH, '', '#f4f1ea'));
  }
  // 2. Cheveux longs : long / bob / queue de cheval × 5 visages (le cas de la masse noire derrière la tête).
  {
    const rows: CleanStyle[] = ['long', 'bob', 'ponytail'];
    const items = rows.flatMap((st) => Array.from({ length: 5 }, (_, j) => ({ st, j })));
    const L = layout(items.length, 5, 420, 560, 0.7, (i) => hairFaceSpec(items[i]!.st, items[i]!.j + 3, { engine: 'v2', seed: 900 + i * 17, identity: (i * 3) % 8 }));
    writeFileSync(`${dir}/longs.png`, render(L.objects, 5 * 420, rows.length * 560, '', '#f4f1ea'));
  }
  // 3. Détails : haut du crâne en gros plan (dôme, tempes, cônes) pour 5 coiffures.
  {
    const rows: CleanStyle[] = ['short', 'spiky', 'curly', 'long', 'ponytail'];
    const L = layout(rows.length, rows.length, 460, 520, 1.15, (i) => hairFaceSpec(rows[i]!, 4, { engine: 'v2', seed: 8100 + i * 31, identity: i }));
    writeFileSync(`${dir}/details.png`, render(L.objects, rows.length * 460, 520, '', '#f4f1ea'));
  }
  console.log(`planches brutes : ${dir}`);
}

// ---------------------------------------------------------------- surcouche diagnostic (code courant seulement)
function overlay(): void {
  const rows: CleanStyle[] = ['long', 'bob', 'short', 'curly'];
  const CW = 520, CH = 640;
  const L = layout(rows.length, rows.length, CW, CH, 0.8, (i) => hairFaceSpec(rows[i]!, 4, { engine: 'v2', seed: 1087 + i * 11, identity: i }));
  const path = (c: Cell, p: { x: number; y: number }[]): string => `M${p.map((q) => toWorld(c, q.x, q.y).map((v) => v.toFixed(1)).join(' ')).join('L')}Z`;
  let ov = '';
  L.cells.forEach((c) => {
    const g = hairGeometry(c.face.params, c.lm)!;
    const S = g.boundary.skull;
    // contour du crâne (demi-largeur a(y)), coque, masse arrière
    const skull: { x: number; y: number }[] = [];
    for (let i = 0; i <= 40; i++) { const y = S.topY + ((S.chinY - S.topY) * i) / 40; skull.push({ x: S.a(y), y }); }
    for (let i = 40; i >= 0; i--) { const y = S.topY + ((S.chinY - S.topY) * i) / 40; skull.push({ x: -S.a(y), y }); }
    ov += `<path d="${path(c, skull)}" stroke="#555" stroke-width="1.6" stroke-dasharray="6 4" fill="none"/>`;
    g.base.forEach((p) => (ov += `<path d="${path(c, p)}" stroke="#1f6feb" stroke-width="2" fill="none"/>`));
    if (g.backBase) ov += `<path d="${path(c, g.backBase)}" stroke="#17a34a" stroke-width="2.4" fill="rgba(23,163,74,0.08)"/>`;
  });
  // Pas de texte ici : `render` n'embarque pas de police. Légende : `artefacts/hair-skull/README.md` (gris pointillé = crâne, bleu = coque, vert = masse arrière ; de gauche à droite : long, bob, short, curly).
  writeFileSync(`${OUT}/04-diagnostic-crane-coque-masse.png`, render(L.objects, rows.length * CW, CH, ov, '#f4f1ea'));
}

// ---------------------------------------------------------------- rapport de vérification
interface Row { readonly id: string; readonly layer: string; n: number; fail: number; err: number; worst: number; limit: number }
async function report(N: number): Promise<{ rows: Row[]; faces: number }> {
  // Import tardif : le worktree « avant » (commit d'origine) n'a pas ce module, et n'en a besoin qu'en mode `render`.
  const { checkHairSkull } = await import('../src/verify/hair-skull');
  const { verifyFace } = await import('../src/verify');
  const rows = new Map<string, Row>();
  let faces = 0;
  // Corpus 1 : visages tirés au naturel. Corpus 2 : chaque coiffure IMPOSÉE (axes v2 cohérents), 14 visages par coiffure : les coiffures rares y sont aussi couvertes.
  const corpus: RandomFace[] = [];
  for (let s = 0; s < N; s++) corpus.push(generateRandomFace(52000 + s * 13));
  for (const st of STYLES) for (let k = 0; k < 14; k++) { const sp = hairFaceSpec(st, k, { engine: 'v2', seed: 31000 + k * 29 + STYLES.indexOf(st) * 7 }); corpus.push(generateRandomFace(sp.seed, sp.opts)); }
  for (const f of corpus) {
    if (f.params.hair.style === 'bald') continue;
    faces++;
    for (const c of checkHairSkull(f)) {
      const r = rows.get(c.id) ?? { id: c.id, layer: c.layer, n: 0, fail: 0, err: 0, worst: 0, limit: c.limit };
      r.n++;
      if (!c.ok) { r.fail++; if (c.severity === 'error') r.err++; r.worst = Math.max(r.worst, Math.abs(c.value)); }
      rows.set(c.id, r);
    }
  }
  // Le contrôle est bien branché sur la vérification d'ensemble : `verifyFace` doit contenir ses identifiants.
  const wired = verifyFace(generateRandomFace(52000)).checks.some((c) => c.id === 'skull-shell-bound' || c.id === 'free-reach-bound');
  if (!wired) throw new Error('checkHairSkull n\'est pas branché dans verifyFace');
  return { rows: [...rows.values()].sort((a, b) => a.layer.localeCompare(b.layer) || a.id.localeCompare(b.id)), faces };
}

const b64 = (p: string): string => readFileSync(p).toString('base64');
const sheet = (name: string, w: number, h: number, body: string, bg = '#f4f1ea'): void => {
  const full = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${bg}"/>${body}</svg>`;
  writeFileSync(`${OUT}/${name}.png`, rasterPng(full, { fonts: true, fitWidth: Math.min(2000, w) }));
  console.log(`${OUT}/${name}.png`);
};
const img = (p: string, x: number, y: number, w: number, h: number): string => `<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${b64(p)}"/>`;

async function compose(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const A = `${OUT}/apres`, V = `${OUT}/avant`;
  renderRaw(A); // « après » = code courant, toujours régénéré (non versionné) ; « avant » = commit d'origine, versionné.
  if (!existsSync(`${V}/tetes-a.png`)) throw new Error(`planches « avant » absentes : ${V} (voir l'en-tête du script)`);
  const pair = (file: string, w: number, h: number, name: string, title: string, sub: string, stack = false): void => {
    const gap = 30, top = 86;
    const head = txt(24, 36, title, 24, '#111', 'start', 700) + txt(24, 60, sub, 14, '#555');
    if (stack) {
      const body = head + txt(24, top - 8, 'AVANT (commit bf036dd)', 15, '#b42318', 'start', 700) + img(`${V}/${file}.png`, 24, top, w, h) +
        txt(24, top + h + gap + 8, 'APRÈS', 15, '#067647', 'start', 700) + img(`${A}/${file}.png`, 24, top + h + gap + 20, w, h);
      sheet(name, w + 48, 2 * h + top + gap + 44, body);
      return;
    }
    const body = head +
      txt(24 + w / 2, top - 8, 'AVANT (commit bf036dd)', 15, '#b42318', 'middle', 700) + txt(24 + w + gap + w / 2, top - 8, 'APRÈS', 15, '#067647', 'middle', 700) +
      img(`${V}/${file}.png`, 24, top, w, h) + img(`${A}/${file}.png`, 24 + w + gap, top, w, h);
    sheet(name, 2 * w + gap + 48, h + top + 24, body);
  };
  pair('tetes-a', 600, 1000, '01a-tetes-buzz-short-spiky-curly-afro', 'Têtes entières — coupes courtes et volumineuses', 'buzz · short · spiky · curly · afro, 4 visages chacun, mêmes graines avant/après');
  pair('tetes-b', 600, 1000, '01b-tetes-bob-long-queue-chignon-tresses', 'Têtes entières — cheveux longs et attachés', 'bob · long · ponytail · bun · braids, 4 visages chacun, mêmes graines avant/après');
  pair('longs', 1000, 800, '02-cheveux-longs-masse-noire', 'Cheveux longs : la masse noire derrière la tête', 'long / bob / queue de cheval : plus de bavoir noir sous le menton, plus de couvercle plat, plus de cornes');
  pair('details', 1500, 339, '03-details-dome-tempes', 'Détails : dôme de la coque, tempes, cônes', 'short · spiky · curly · long · ponytail en gros plan', true);
  overlay();

  const { rows, faces } = await report(Number(process.env.FACES ?? 200));
  const lines = [
    '# Rapport de vérification crâne ↔ cheveux', '',
    `Corpus : ${faces} visages chevelus (200 tirés au naturel, graines 52000 + 13 k, plus 14 par coiffure imposée, axes v2 cohérents). Code : \`src/verify/hair-skull.ts\`.`, '',
    '| couche | contrôle | visages | écarts | erreurs | pire valeur | limite |', '|---|---|---:|---:|---:|---:|---:|',
    ...rows.map((r) => `| ${r.layer} | \`${r.id}\` | ${r.n} | ${r.fail} | ${r.err} | ${r.worst.toFixed(3)} | ${r.limit.toFixed(3)} |`), '',
    '« écarts » = contrôles non satisfaits (erreur ou avertissement) ; « erreurs » = ceux de gravité `error`. Un chiffre non nul n\'est pas masqué : voir `docs/HAIR-SKULL-REMAINING.md`.', '',
  ];
  writeFileSync(`${OUT}/rapport-verification.md`, lines.join('\n'));
  // image du rapport
  const colour = (r: Row): string => (r.fail === 0 ? '#067647' : r.err ? '#b42318' : '#b54708');
  let y = 90;
  let body = txt(24, 36, 'Vérification du rendu — trois couches', 24, '#111', 'start', 700) + txt(24, 60, `${faces} visages chevelus · géométrie, anatomie, style (src/verify/hair-skull.ts)`, 14, '#555');
  const layerName: Record<string, string> = { geometry: 'GÉOMÉTRIE', anatomy: 'ANATOMIE', style: 'STYLE' };
  let last = '';
  for (const r of rows) {
    if (r.layer !== last) { last = r.layer; y += 12; body += txt(24, y, layerName[r.layer] ?? r.layer, 14, '#111', 'start', 700); y += 22; }
    const w = 520 * (1 - r.fail / Math.max(1, r.n));
    body += txt(24, y + 12, r.id, 13, '#222') + `<rect x="260" y="${y}" width="520" height="16" rx="3" fill="#e5e1d8"/><rect x="260" y="${y}" width="${w.toFixed(1)}" height="16" rx="3" fill="${colour(r)}"/>` +
      txt(796, y + 13, `${r.n - r.fail}/${r.n}${r.fail ? `  (pire ${r.worst.toFixed(3)} / limite ${r.limit.toFixed(3)})` : ''}`, 12, '#444');
    y += 26;
  }
  sheet('05-rapport-verification', 1160, y + 20, body);
}

if (MODE === 'render') renderRaw(process.argv[3] ?? `${OUT}/apres`);
else await compose();

/**
 * Preuves visuelles du moteur de crâne en profil → artefacts/skull-profile/ (images PNG + verification.json + bench).
 * Usage : npx tsx scripts/artefacts-skull.ts [graine=7]. Tout est déterministe : relancer reproduit les mêmes pixels.
 * Les étiquettes (texte) sont posées PAR CE SCRIPT autour du SVG du moteur : le moteur, lui, n'émet aucun <text> (liste blanche SVG).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { compileScene, generateRandomFace } from '../src';
import { faceLandmarks } from '../src/face';
import { generateRandomProfile } from '../src/generation/random-skull';
import { renderProfile, type ProfileRender } from '../src/skull/render';
import { verifyProfile } from '../src/verify/skull';
import { rasterPng } from './lib/raster';

const SEED = Number(process.argv[2] ?? 7);
const OUT = 'artefacts/skull-profile';
mkdirSync(OUT, { recursive: true });
const png = (name: string, svg: string, w: number): void => writeFileSync(`${OUT}/${name}`, rasterPng(svg, { fonts: true, fitWidth: w }));
const inner = (svg: string): string => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
const T = (x: number, y: number, s: number, t: string, o = ''): string => `<text x="${x}" y="${y}" font-family="DejaVu Sans" font-size="${s}" ${o.includes('fill="') ? '' : 'fill="#3a2a22"'} ${o}>${t}</text>`;
const P = generateRandomProfile(SEED, { hair: 'short' });
const opts = { skin: P.skin, hair: P.hair, width: 900 } as const;

// 01 — profil fini, 02 — coiffure dégageant la nuque, os, anatomie.
const skin = renderProfile(P.face.params, P.skull, opts);
png('01-profil-peau.png', skin.svg, 900);
const under = renderProfile(P.face.params, { ...P.skull, hair: 'undercut', napeHairline: 0.8 }, opts);
png('02-profil-nuque-degagee.png', under.svg, 900);
png('04-os-seul.png', renderProfile(P.face.params, P.skull, { ...opts, mode: 'bone' }).svg, 900);

// 03 — anatomie : os + tissus mous + repères, étiquetés (colonnes gauche/droite reliées par un trait).
function labelled(r: ProfileRender): string {
  const { box, geo } = r;
  const H = geo.H, ml = 0.42 * H, mr = 0.55 * H;
  const vb = `${box.x - ml} ${box.y} ${box.w + ml + mr} ${box.h}`;
  const right: { id: string; y: number; sx: number; sy: number }[] = [], left: typeof right = [];
  for (const t of geo.bone.tissue) (t.dir === 'x-' || t.id === 'menton' ? right : left).push({ id: t.id, y: t.skin.y, sx: t.skin.x, sy: t.skin.y });
  const place = (a: typeof right, x: number, anchor: string): string => {
    a.sort((p, q) => p.y - q.y);
    let last = -1e9;
    return a.map((p) => { const y = Math.max(p.y, last + 0.032 * H); last = y; return `<polyline points="${p.sx},${p.sy} ${x - (anchor === 'start' ? 0.01 : -0.01) * H},${y - 0.006 * H}" fill="none" stroke="#9a8d80" stroke-width="0.8"/>${T(x, y, 0.024 * H, p.id, `text-anchor="${anchor}"`)}`; }).join('');
  };
  const ids = ['porion', 'gonion', 'condyle', 'mastoid', 'orbitale', 'zygomaxillare', 'nasospinale', 'prosthion', 'infradentale', 'gnathion'];
  const extra = ids.map((k) => { const p = geo.bone.lm[k]!; return `<circle cx="${p.x}" cy="${p.y}" r="${0.006 * H}" fill="#2f6fd0"/>${T(p.x + 0.01 * H, p.y - 0.008 * H, 0.02 * H, k, 'fill-opacity="0.9"')}`; }).join('');
  const cerv = geo.bone.vertebrae.map((v) => T(v.c.x - 0.012 * H, v.c.y + 0.006 * H, 0.02 * H, v.id, 'fill="#fff"')).join('');
  const lx = box.x + box.w + 0.04 * H, ly = box.y + box.h - 0.1 * H;
  const legend = `${T(lx, ly, 0.028 * H, 'Anatomie du profil', 'font-weight="bold"')}${T(lx, ly + 0.04 * H, 0.021 * H, 'trait rouge : tissu mou (os → peau)')}${T(lx, ly + 0.07 * H, 0.021 * H, 'point bleu : repère osseux')}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="1200" height="${Math.round((1200 * box.h) / (box.w + ml + mr))}"><rect x="${box.x - ml}" y="${box.y}" width="${box.w + ml + mr}" height="${box.h}" fill="#f3efe7"/>${inner(r.svg).replace(/^<rect[^>]*\/>/, '')}${place(right, box.x + box.w + 0.04 * H, 'start')}${place(left, box.x - 0.02 * H, 'end')}${extra}${cerv}${legend}</svg>`;
}
png('03-anatomie-os-tissus-reperes.png', labelled(renderProfile(P.face.params, P.skull, { ...opts, mode: 'anatomy' })), 1200);

// 05 — cohérence face/profil : même personne, mêmes hauteurs (lignes guides = repères du visage de FACE).
const face = generateRandomFace(SEED, { structure: true });
const fc = compileScene({ width: Math.ceil(face.width), height: Math.ceil(face.height), objects: face.objects });
if (fc.ok) {
  // Les repères du profil sont calculés sur un hôte de référence de hauteur `hostH` ; le visage réel a une autre taille : facteur k = S·hostH / hauteur réelle (les fractions sont indépendantes de l'échelle).
  const g = skin.geo, S = g.frame.S, k = (S * g.frame.hostH) / face.height, hw = face.width * k, hh = face.height * k, H = g.H;
  const lm = faceLandmarks(face.params, face.width, face.height);
  const gap = 0.12 * H, px = skin.box.x, py = 0;
  const lines: [string, number][] = [['sommet', 0], ['ligne des yeux', g.frame.f.eye], ['base du nez', g.frame.f.sub], ['bouche', g.frame.f.stomion], ['menton', 1]];
  const totalW = hw + gap + skin.box.w, top = Math.min(skin.box.y, 0) - 0.04 * H, bot = skin.box.y + skin.box.h;
  const guides = lines.map(([n, f]) => `<line x1="0" x2="${totalW + 0.3 * H}" y1="${f * H}" y2="${f * H}" stroke="#d23a3a" stroke-width="1" stroke-dasharray="6 4"/>${T(totalW + 0.02 * H, f * H - 0.006 * H, 0.026 * H, n, 'fill="#d23a3a"')}`).join('');
  void lm; void py; void px;
  const combo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${top} ${totalW + 0.45 * H} ${bot - top}" width="1300" height="${Math.round((1300 * (bot - top)) / (totalW + 0.45 * H))}"><rect y="${top}" width="${totalW + 0.45 * H}" height="${bot - top}" fill="#f3efe7"/><svg x="0" y="0" width="${hw}" height="${hh}" viewBox="${-face.width / 2} ${-face.height / 2} ${face.width} ${face.height}">${inner(fc.svg)}</svg><svg x="${hw + gap}" y="${skin.box.y}" width="${skin.box.w}" height="${skin.box.h}" viewBox="${skin.box.x} ${skin.box.y} ${skin.box.w} ${skin.box.h}">${inner(skin.svg).replace(/^<rect[^>]*\/>/, '')}</svg>${guides}${T(0.01 * H, top + 0.03 * H, 0.03 * H, `Même graine (${SEED}) : face (gauche) et profil (droite) — mêmes hauteurs`, 'font-weight="bold"')}</svg>`;
  png('05-coherence-face-profil.png', combo, 1300);
}

// 06 — diversité (8 graines) ; 07 — coiffures ; 08 — gros plan nuque.
const cell = (r: ProfileRender, i: number, cols: number, w: number, h: number, label: string): string => `<g transform="translate(${(i % cols) * w} ${Math.floor(i / cols) * h})"><svg width="${w}" height="${h}" viewBox="${r.box.x} ${r.box.y} ${r.box.w} ${r.box.h}">${inner(r.svg).replace(/^<rect[^>]*\/>/, '')}</svg>${T(8, h - 8, 14, label)}</g>`;
const sheet = (cells: string[], cols: number, w: number, h: number): string => `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * w}" height="${Math.ceil(cells.length / cols) * h}"><rect width="100%" height="100%" fill="#f3efe7"/>${cells.join('')}</svg>`;
const seeds8 = [11, 23, 35, 47, 59, 71, 83, 95];
png('06-diversite-8-tetes.png', sheet(seeds8.map((s, i) => { const p = generateRandomProfile(s); return cell(renderProfile(p.face.params, p.skull, { skin: p.skin, hair: p.hair, width: 300 }), i, 4, 320, 380, `graine ${s} · ${p.skull.hair}`); }), 4, 320, 380), 1280);
const styles = ['none', 'short', 'undercut', 'updo'] as const;
png('07-coiffures-nuque.png', sheet(styles.map((h, i) => cell(renderProfile(P.face.params, { ...P.skull, hair: h, napeHairline: 0.75 }, { ...opts, width: 300 }), i, 4, 320, 380, `coiffure : ${h}`)), 4, 320, 380), 1280);
const nb = skin.geo;
const crop = renderProfile(P.face.params, { ...P.skull, hair: 'undercut', napeHairline: 0.85 }, opts);
const x0 = nb.frame.x.back - 0.12 * nb.H, y0 = nb.neck.yTop - 0.38 * nb.H, cw = 0.62 * nb.H, ch = nb.neck.yBase - y0 + 0.02 * nb.H;
png('08-gros-plan-nuque.png', crop.svg.replace(/viewBox="[^"]*"/, `viewBox="${x0} ${y0} ${cw} ${ch}"`).replace(/width="\d+" height="\d+"/, `width="700" height="${Math.round((700 * ch) / cw)}"`), 700);

// 09 — vérification sur 200 têtes (trois couches) ; 10 — bancs.
const fails: Record<string, number> = {}, warns: Record<string, number> = {};
let ok = 0, checks = 0;
const t0 = Date.now();
for (let s = 1; s <= 200; s++) {
  const p = generateRandomProfile(s * 97);
  const r = verifyProfile(p.face.params, p.skull, { skin: p.skin, hair: p.hair });
  if (r.ok) ok++;
  checks = r.checks.length;
  for (const c of r.failures) fails[c.id] = (fails[c.id] ?? 0) + 1;
  for (const c of r.warnings) warns[c.id] = (warns[c.id] ?? 0) + 1;
}
const ref = verifyProfile(P.face.params, P.skull, { skin: P.skin, hair: P.hair });
writeFileSync(`${OUT}/verification.json`, JSON.stringify({ heads: 200, passed: ok, checksPerHead: checks, errors: fails, warnings: warns, msPerHead: +((Date.now() - t0) / 200).toFixed(1), referenceHead: { seed: SEED, ok: ref.ok, checks: ref.checks.map((c) => ({ layer: c.layer, id: c.id, value: +c.value.toFixed(4), limit: c.limit, ok: c.ok, severity: c.severity })) } }, null, 2));
console.log(`artefacts écrits dans ${OUT} — vérification : ${ok}/200 sans erreur`, fails, warns);

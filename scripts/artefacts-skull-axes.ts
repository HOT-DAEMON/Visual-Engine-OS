/**
 * Preuves visuelles de la dérivation du crâne depuis la face, du profil branché (yeux, sourcils, cheveux, barbe) et des contrôles croisés
 * → artefacts/skull-axes/ (PNG + verification.json). Usage : npx tsx scripts/artefacts-skull-axes.ts. Déterministe.
 * Les étiquettes (texte) sont posées PAR CE SCRIPT autour des SVG du moteur (le moteur n'émet aucun <text>).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { compileScene } from '../src';
import { generateRandomProfile, type RandomProfile } from '../src/generation/random-skull';
import { deriveSkull } from '../src/skull/derive';
import { renderProfile } from '../src/skull/render';
import { verifyProfile } from '../src/verify/skull';
import { rasterPng } from './lib/raster';

const OUT = 'artefacts/skull-axes';
mkdirSync(OUT, { recursive: true });
const png = (name: string, svg: string, w: number): void => writeFileSync(`${OUT}/${name}`, rasterPng(svg, { fonts: true, fitWidth: w }));
const T = (x: number, y: number, s: number, t: string, c = '#3a2a22'): string => `<text x="${x}" y="${y}" font-family="DejaVu Sans" font-size="${s}" fill="${c}">${t}</text>`;
/**
 * Pose un SVG du moteur dans une case (x, y, w, h). Chaque SVG est rastérisé SEUL puis incrusté en image : plusieurs profils dans une même page SVG
 * partageraient leurs identifiants de dégradés (`sk-hair-grad`, `sk-iris`…) et prendraient les couleurs du premier.
 */
function tile(svg: string, x: number, y: number, w: number, h: number): string {
  const px = Math.round(w * 2);
  const b64 = rasterPng(svg, { fitWidth: px }).toString('base64');
  return `<image x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${b64}"/>`;
}
const faceSvg = (P: RandomProfile): string => {
  const c = compileScene({ width: Math.ceil(P.face.width), height: Math.ceil(P.face.height), objects: P.face.objects });
  if (!c.ok) throw new Error(c.issues.join('; '));
  // La scène est centrée sur l'origine : cadrage explicite (marge de 25 % pour les cheveux qui débordent) ; fond posé par le script.
  const W = P.face.width, H = P.face.height, m = 0.25;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-W * (0.5 + m)} ${-H * (0.5 + m * 0.6)} ${W * (1 + 2 * m)} ${H * (1 + 1.2 * m)}" width="${W * (1 + 2 * m)}" height="${H * (1 + 1.2 * m)}"><rect x="${-W}" y="${-H}" width="${2 * W}" height="${2 * H}" fill="#f3efe7"/>${c.svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</svg>`;
};
const prof = (P: RandomProfile, over: Partial<{ face: RandomProfile['face']['params'] }> = {}): ReturnType<typeof renderProfile> =>
  renderProfile(over.face ?? P.face.params, P.skull, { skin: P.skin, hair: P.hair, eye: P.eye, width: 600, background: '#f3efe7' });
const sheet = (w: number, h: number, body: string): string => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#f3efe7"/>${body}</svg>`;

// 01 — même graine : face à gauche, profil à droite, avec la chaîne de dérivation (largeur → indice → longueur).
{
  const seeds = [7, 8, 9, 12, 21, 33];
  const cw = 620, ch = 440;
  const body = seeds.map((s, i) => {
    const P = generateRandomProfile(s);
    const d = P.derivation, x = (i % 2) * cw, y = Math.floor(i / 2) * ch;
    const r = prof(P);
    return tile(faceSvg(P), x + 2, y + 60, 250, 300) + tile(r.svg, x + 250, y + 30, 360, 380)
      + T(x + 10, y + 20, 14, `graine ${s} · W/H ${d.aspect.toFixed(2)} → largeur ${d.breadthH.toFixed(2)}H · indice ${d.ci.applied.toFixed(3)} (cible ${d.ci.target.toFixed(3)}, libre ${d.ci.free >= 0 ? '+' : ''}${d.ci.free.toFixed(3)}) → L ${d.lengthH.toFixed(3)}H`)
      + T(x + 10, y + 428, 12, `${P.face.params.hair.style} · barbe ${P.face.params.facialHair.beard} · moustache ${P.face.params.facialHair.mustache}`, '#6b5a4c');
  }).join('');
  png('01-derivation-face-profil.png', sheet(cw * 2, ch * 3, body), 1400);
}
// 02 — variation libre BORNÉE : un même visage, tirages libres -1 / 0 / +1 sur l'indice et tous les axes dérivés.
{
  const P = generateRandomProfile(8);
  const draws = [-1, -0.5, 0, 0.5, 1];
  const body = draws.map((v, i) => {
    const D = deriveSkull(P.face.params, P.face.width / P.face.height, { ...P.skull }, { ci: v, axes: { vaultHeight: v, frontalBulge: v, foreheadSlope: v, zygoma: v, neckDepth: v } });
    const r = renderProfile(P.face.params, D.skull, { skin: P.skin, hair: P.hair, eye: P.eye, width: 400, background: '#f3efe7' });
    return tile(r.svg, i * 330, 30, 330, 400) + T(i * 330 + 8, 20, 13, `libre ${v >= 0 ? '+' : ''}${v} · indice ${D.ci.applied.toFixed(3)} · L ${D.lengthH.toFixed(3)}H`);
  }).join('');
  png('02-variation-libre-bornee.png', sheet(1650, 440, body), 1650);
}
// 03 — toutes les coiffures du moteur de cheveux de la face, projetées en profil (même visage, même crâne) ; 04 — pilosité.
{
  const P = generateRandomProfile(8);
  const styles = ['buzz', 'short', 'spiky', 'curly', 'afro', 'bob', 'long', 'ponytail', 'bun', 'braids'] as const;
  const body = styles.map((st, i) => {
    const face = { ...P.face.params, hair: { ...P.face.params.hair, style: st, texture: 'auto' as const, fringe: i % 2 ? ('sweep' as const) : ('straight' as const) } };
    return tile(prof(P, { face }).svg, (i % 5) * 330, Math.floor(i / 5) * 420 + 28, 330, 392) + T((i % 5) * 330 + 8, Math.floor(i / 5) * 420 + 20, 13, st);
  }).join('');
  png('03-coiffures-profil.png', sheet(1650, 850, body), 1650);
  const fhs = [{ beard: 'stubble', mustache: 'none', sideburns: 'none' }, { beard: 'short', mustache: 'thin', sideburns: 'short' }, { beard: 'full', mustache: 'full', sideburns: 'long' }, { beard: 'long', mustache: 'handlebar', sideburns: 'mutton' }, { beard: 'goatee', mustache: 'pencil', sideburns: 'none' }] as const;
  const b2 = fhs.map((f, i) => {
    const face = { ...P.face.params, facialHair: { ...P.face.params.facialHair, ...f, length: 0.55, density: 0.85 } };
    return tile(prof(P, { face }).svg, i * 330, 28, 330, 392) + T(i * 330 + 8, 20, 12, `${f.beard} / ${f.mustache} / ${f.sideburns}`);
  }).join('');
  png('04-pilosite-profil.png', sheet(1650, 430, b2), 1650);
}
// 05 — œil et sourcil : gros plan profil pour 5 yeux de face différents (taille, cils, iris).
{
  const body = [7, 12, 21, 33, 40].map((s, i) => {
    const P = generateRandomProfile(s);
    const r = prof(P), e = r.shapes.eye!, H = r.geo.H;
    // Gros plan : resvg plante quand un filtre du SVG tombe entièrement hors de la zone rendue (viewBox resserré) ; on rastérise donc le profil ENTIER
    // en grand, puis on recadre l'image par un <svg> imbriqué (viewBox en pixels de l'image).
    const full = 3000, sc = full / r.box.w;
    const b64 = rasterPng(r.svg, { fitWidth: full }).toString('base64');
    const crop = `${((e.cx - 0.22 * H - r.box.x) * sc).toFixed(1)} ${((e.cy - 0.2 * H - r.box.y) * sc).toFixed(1)} ${(0.34 * H * sc).toFixed(1)} ${(0.34 * H * sc).toFixed(1)}`;
    const inner = `<svg x="${i * 330}" y="30" width="330" height="330" viewBox="${crop}"><image width="${full}" height="${(r.box.h * sc).toFixed(1)}" href="data:image/png;base64,${b64}"/></svg>`;
    return inner + T(i * 330 + 8, 20, 12, `graine ${s} · fente ${(P.eye.heightH * 100).toFixed(1)} % H · cils ${P.eye.lashUpper.count}`);
  }).join('');
  png('05-oeil-sourcil-profil.png', sheet(1650, 370, body), 1650);
}
// Vérification : 3 couches + croisée, 300 graines.
const fails: Record<string, number> = {}, warns: Record<string, number> = {};
let bad = 0;
const N = 300;
const t0 = performance.now();
for (let s = 1; s <= N; s++) {
  const P = generateRandomProfile(s);
  const rep = verifyProfile(P.face.params, P.skull, { skin: P.skin, hair: P.hair, eye: P.eye, faceEyeHeightH: P.eye.heightH, faceSize: { width: P.face.width, height: P.face.height }, derivation: P.derivation });
  if (!rep.ok) bad++;
  for (const f of rep.failures) fails[f.id] = (fails[f.id] ?? 0) + 1;
  for (const f of rep.warnings) warns[f.id] = (warns[f.id] ?? 0) + 1;
}
writeFileSync(`${OUT}/verification.json`, JSON.stringify({ seeds: N, invalid: bad, errors: fails, warnings: warns, msPerHead: Math.round((performance.now() - t0) / N) }, null, 2));
console.log('artefacts →', OUT, { invalid: bad, errors: fails, warnings: warns });

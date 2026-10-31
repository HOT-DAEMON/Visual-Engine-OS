/**
 * Artefacts des VOLUMES 3D du corps : planches PNG (vues libres, écorché par couches, hiérarchie, atomes, morphologies, mains, posture, tête complète,
 * comparaison aux références) + rapport de vérification (3 couches) + mesures de temps. `npx tsx scripts/artefacts-volume.ts` → artefacts/body-volumes/
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { compileScene, generateRandomFace } from '../src';
import { ARCHETYPES, anchorFromFace, bodyMarkup, composeFigure, type BodyInput, type NeckAnchor } from '../src/body';
import { bodyVolumes, renderVolumes, volumeMarkup, type Camera, type VolumeInput } from '../src/body/volume';
import { generateRandomProfile } from '../src/generation/random-skull';
import { renderProfile } from '../src/skull/render';
import { verifyVolumes } from '../src/verify';
import { clearCaches } from '../src/perf';
import { rasterPng } from './lib/raster';

const OUT = 'artefacts/body-volumes';
mkdirSync(OUT, { recursive: true });
const BG = '#3b4157';
const cam = (yaw: number, pitch = 0): Camera => ({ yaw, pitch, pivot: { x: 0, y: 0, z: 0 } });
const T = (x: number, y: number, t: string, s = 15, c = '#e8ecf5'): string => `<text x="${x}" y="${y}" fill="${c}" font-family="DejaVu Sans" font-size="${s}" text-anchor="middle">${t}</text>`;
let uidN = 0;
const uid = (): string => `u${uidN++}`;
/** Ancre de référence : visage n°11 (le même que les artefacts du corps précédents). */
const host = (seed: number) => { const f = generateRandomFace(seed, { id: 'f', transform: { x: 190, y: 62, scale: 0.27 } }); const o = f.objects[0] as any; const sc = compileScene({ width: 380, height: 700, background: BG, objects: f.objects }); if (!sc.ok) throw new Error(sc.issues.join()); return { o, svg: sc.svg, a: anchorFromFace(o.face, o.width, o.height) as NeckAnchor }; };
const H11 = host(11);
/** Peau du corps = peau du visage (même personne) ; le visage 11 fournit aussi l'ancre du cou. */
const SKIN: string = H11.o.material.color;
const view = (body: BodyInput, vp: VolumeInput, o: Parameters<typeof renderVolumes>[1], a: NeckAnchor = H11.a) => volumeMarkup(body, a, vp, { ...o, uid: o.uid ?? uid() });
/** Cellule : le corps (repère hôte) rogné à ses bornes puis posé dans une case ; légende en dessous. */
const CW = 400, CH = 760;
const cell = (i: number, m: ReturnType<typeof view>, cap: string, cw = CW, ch = CH): string => {
  const b = m.bounds, w = b.x1 - b.x0, h = b.y1 - b.y0, k = Math.min((cw - 20) / w, (ch - 50) / h), vb = `${b.x0} ${b.y0} ${w} ${h}`;
  return `<svg x="${i * cw + (cw - w * k) / 2}" y="${10 + (ch - 50 - h * k) / 2}" width="${w * k}" height="${h * k}" viewBox="${vb}">${m.svg}</svg>${T(i * cw + cw / 2, ch - 14, cap)}`;
};
const sheet = (name: string, cells: string[], cw = CW, ch = CH, fit = 2000): void => { const W = cw * cells.length; writeFileSync(`${OUT}/${name}.png`, rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${ch}" width="${W}" height="${ch}"><rect width="${W}" height="${ch}" fill="${BG}"/>${cells.join('')}</svg>`, { fonts: true, fitWidth: Math.min(fit, W) })); };
const MUSC: BodyInput = { age: 28, sex: 1, adiposity: 0.07, muscularity: 0.85 };
const LEAN: BodyInput = { age: 28, sex: 1, adiposity: 0.04, muscularity: 0.6 };
const FEM: BodyInput = { age: 27, sex: -1, adiposity: 0.18, muscularity: 0.35 };
const o0 = { skin: SKIN } as const;

// 01 — vues libres (la tête du moteur de visage est posée en vue de face)
{
  const yaws = [0, 35, 90, 145, 180, -90];
  sheet('01-vues-libres', yaws.map((y, i) => { const m = view(MUSC, {}, { ...o0, camera: cam(y, -3) }); return cell(i, m, y === 0 ? 'face (avec la tête du moteur de visage)' : `yaw ${y}°`); }));
  // Tête en vue de face : composition avec la scène du visage.
  const fm = view(MUSC, {}, { ...o0, camera: cam(0) }), full = composeFigure(H11.svg, { back: fm.svg, front: '' });
  writeFileSync(`${OUT}/01b-face-avec-tete.png`, rasterPng(full, { fitWidth: 760 }));
}
// 02 — écorché par couches : on retire les couches superficielles pour montrer rhomboïdes, infra-épineux, omoplate…
for (const [tag, yaw] of [['face', 0], ['dos', 180]] as const)
  sheet(`02-ecorche-couches-${tag}`, [[99, 'tout'], [6, 'sans tendons/veines'], [5, 'sans trapèze, pectoraux, clavicule'], [4, 'couches profondes'], [3, 'noyau + os']].map(([h, cap], i) => cell(i, view(LEAN, {}, { ...o0, camera: cam(yaw), hideFromLayer: h as number, forceTier: true }), String(cap))));
// 03 — hiérarchie de présentation 0 → 3 (face et dos)
sheet('03-hierarchie-niveaux', [0, 1, 2, 3].map((l, i) => cell(i, view(MUSC, {}, { ...o0, camera: cam(0), level: l as 0 | 1 | 2 | 3, forceTier: l >= 2 }), `niveau ${l}`)).concat([0, 3].map((l, i) => cell(4 + i, view(MUSC, {}, { ...o0, camera: cam(180), level: l as 0 | 3 }), `dos · niveau ${l}`))));
// 04 — atomes : un volume = une couleur (face, 3/4, profil, dos)
sheet('04-atomes-volumes', [0, 40, 90, 180].map((y, i) => cell(i, view(MUSC, {}, { ...o0, camera: cam(y), mode: 'atoms', level: 3, joints: true, forceTier: true }), `atomes · yaw ${y}°`)));
// 05 — morphologies
const names = Object.keys(ARCHETYPES) as (keyof typeof ARCHETYPES)[];
sheet('05-morphologies', names.slice(0, 7).map((n, i) => cell(i, view(ARCHETYPES[n] as BodyInput, {}, { ...o0, camera: cam(25) }), n, 360)), 360);
sheet('05b-morphologies', names.slice(7).map((n, i) => cell(i, view(ARCHETYPES[n] as BodyInput, {}, { ...o0, camera: cam(25) }), n, 360)), 360);
// 06 — bras, mains, doigts relâchés, sphères d'articulation, tendons et veines
{
  const poses: [string, BodyInput][] = [
    ['relâché (défaut)', LEAN], ['paume en avant, doigts écartés', { ...LEAN, pose: { left: { pronation: -1, spread: 0.9 }, right: { pronation: -1, spread: 0.9 } } } as BodyInput],
    ['coudes fléchis 60°, dos de la main', { ...LEAN, pose: { left: { elbowFlex: 60, pronation: 0.6, abduction: 18 }, right: { elbowFlex: 60, pronation: 0.6, abduction: 18 } } } as BodyInput],
    ['poings à moitié fermés', { ...LEAN, pose: { left: { curl: [0.5, 0.7, 0.75, 0.8, 0.85] }, right: { curl: [0.5, 0.7, 0.75, 0.8, 0.85] } } } as BodyInput]];
  const zoom = (i: number, b: BodyInput, cap: string, joints: boolean, yaw: number): string => { const m = view(b, { fingerRelax: 0.8 }, { ...o0, camera: cam(yaw), joints, forceTier: true }); const a = H11.a, vb = `${-0.15 * a.h} ${a.baseY + 0.3 * a.h} ${0.85 * a.h * 1.3} ${1.9 * a.h}`; return `<svg x="${i * 400}" y="10" width="400" height="700" viewBox="${vb.split(' ').map((q, j) => (j === 0 ? Number(q) + 0.55 * a.h : q)).join(' ')}">${m.svg}</svg>${T(i * 400 + 200, 745, cap)}`; };
  sheet('06-bras-mains', poses.map(([c, b], i) => zoom(i, b, c, i === 1, i === 2 ? 25 : 0)), 400, 760);
  sheet('06b-mains-profil-et-dos', poses.map(([c, b], i) => zoom(i, b, `${c} · yaw ${[90, 150, 60, 180][i]}°`, true, [90, 150, 60, 180][i] as number)), 400, 760);
}
// 07 — posture : courbures, thorax, ventre, fessiers, contrapposto, balancement des bras
{
  const P = (label: string, b: BodyInput, vp: VolumeInput, yaw: number) => [label, b, vp, yaw] as const;
  const cases = [P('courbures par défaut', LEAN, {}, 90), P('lordose lombaire +1, cyphose −1', LEAN, { spine: { lumbar: 1, thoracic: -1, cervical: 0.5 } }, 90), P('cyphose dorsale +1 (voussé)', LEAN, { spine: { thoracic: 1, cervical: 1 } }, 90), P('ventre 0,7', { ...LEAN, adiposity: 0.3 }, { torso: { belly: 0.7 } }, 90), P('fessiers +1, thorax profond', FEM, { torso: { glute: 1, thoraxDepth: 1 } }, 90), P('contrapposto marqué (face)', LEAN, { contrapposto: { amount: 1, side: 1, twist: 0.6 }, swing: { left: 22, right: -18 } }, 0), P('contrapposto (dos)', LEAN, { contrapposto: { amount: 1, side: -1, twist: 0.6 } }, 180)];
  sheet('07-posture-courbures', cases.map(([c, b, vp, y], i) => cell(i, view(b, vp, { ...o0, camera: cam(y), trunkOnly: y === 90 }), c, 330, 700)), 330, 700);
}
// 08 — tête complète : même personne en face et en profil (moteur de visage + moteur de crâne)
{
  const tiles = [7, 12, 33].map((s) => {
    const P = generateRandomProfile(s), c = compileScene({ width: Math.ceil(P.face.width), height: Math.ceil(P.face.height), objects: P.face.objects });
    if (!c.ok) throw new Error(c.issues.join());
    const W = P.face.width, Hh = P.face.height, mg = 0.25, face = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-W * (0.5 + mg)} ${-Hh * (0.5 + mg * 0.6)} ${W * (1 + 2 * mg)} ${Hh * (1 + 1.2 * mg)}" width="${W * (1 + 2 * mg)}" height="${Hh * (1 + 1.2 * mg)}"><rect x="${-W}" y="${-Hh}" width="${2 * W}" height="${2 * Hh}" fill="${BG}"/>${c.svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</svg>`;
    const pr = renderProfile(P.face.params, P.skull, { skin: P.skin, hair: P.hair, eye: P.eye, width: 600, background: BG });
    const img = (svg: string, x: number, w: number): string => `<image x="${x}" y="40" width="${w}" height="640" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${rasterPng(svg, { fitWidth: 700 }).toString('base64')}"/>`;
    return [img(face, 0, 400), img(pr.svg, 400, 400)].join('') + T(400, 715, `graine ${s} : face + profil`);
  });
  sheet('08-tete-complete', tiles.map((t, i) => `<g transform="translate(${i * 800} 0)">${t}</g>`), 800, 760, 2400);
}
// 09 — comparaison aux références : ref-02 (couleurs) ↔ face, ref-04 (écorché face + profil) ↔ face + profil
{
  const b64 = (f: string): string => `data:image/jpeg;base64,${readFileSync(`references/anatomy/${f}`).toString('base64')}`;
  const ref = (f: string, i: number, w = 1): string => `<image x="${i * CW + 10}" y="20" width="${CW * w - 20}" height="${CH - 70}" preserveAspectRatio="xMidYMid meet" href="${b64(f)}"/>`;
  const vm = ARCHETYPES.veryMuscular as BodyInput;
  sheet('09-comparaison-references', [ref('ref-02-homme-muscles-colores.jpg', 0) + T(CW / 2, CH - 14, 'ref-02'), cell(1, view(vm, {}, { ...o0, camera: cam(0), forceTier: true }), 'volumes · face · veryMuscular'), ref('ref-04-homme-ecorche-profil-face.jpg', 2) + T(2.5 * CW, CH - 14, 'ref-04 (profil + face)'), cell(3, view(vm, {}, { ...o0, camera: cam(90) }), 'volumes · profil'), cell(4, view(vm, {}, { ...o0, camera: cam(0) }), 'volumes · face'), ref('ref-01-femme-zbrush-3vues.jpg', 5) + T(5.5 * CW, CH - 14, 'ref-01'), cell(6, view(FEM, {}, { ...o0, camera: cam(180) }), 'volumes · dos · femme')]);
}

// ── Vérification (3 couches) sur tous les archétypes + mesures de temps ────────────────────────────────────────────────────────────────
const a = H11.a, report: Record<string, unknown> = {};
for (const n of names) { const b = ARCHETYPES[n] as BodyInput, set = bodyVolumes(b, a), r = verifyVolumes(set, b, a); report[n] = { ok: r.ok, failures: r.failures.map((c) => `${c.id}: ${c.detail}`), measures: Object.fromEntries(Object.entries(set.measures).map(([k, v]) => [k, +(v as number).toFixed(3)])) }; }
const ref0 = verifyVolumes(bodyVolumes(MUSC, a), MUSC, a);
const t = (fn: () => void, n: number): number => { const s = performance.now(); for (let i = 0; i < n; i++) fn(); return (performance.now() - s) / n; };
clearCaches();
let k = 0;
const geoCold = t(() => { k++; bodyVolumes({ ...MUSC, muscularity: 0.5 + k * 1e-4 } as BodyInput, a); }, 30);
const setW = bodyVolumes(MUSC, a);
const rFull = t(() => { k++; renderVolumes(setW, { skin: SKIN, camera: cam(k % 360), uid: 'p' }); }, 30), rFast = t(() => { k++; renderVolumes(setW, { skin: SKIN, camera: cam(k % 360), uid: 'p', quality: 'fast' }); }, 30);
const mFull = renderVolumes(setW, { skin: SKIN, uid: 'p' }), mFast = renderVolumes(setW, { skin: SKIN, uid: 'p', quality: 'fast' });
const warm = t(() => volumeMarkup(MUSC, a, {}, { skin: SKIN, camera: cam(30), uid: 'w' }), 200);
const old2d = t(() => { k++; bodyMarkup({ ...MUSC, muscularity: 0.5 + k * 1e-4 } as BodyInput, a, { skin: SKIN }); }, 30);
const bb = mFull.bounds, rw = 400, rh = Math.round((rw * (bb.y1 - bb.y0)) / (bb.x1 - bb.x0));
const ras = (m: typeof mFull): number => { let r = 0; return t(() => { r++; rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bb.x0} ${bb.y0} ${bb.x1 - bb.x0} ${bb.y1 - bb.y0}" width="${rw}" height="${rh}"><!--${r}${Math.random()}-->${m.svg}</svg>`, { fonts: false }); }, 8); };
const rasFull = ras(mFull), rasFast = ras(mFast);
const timings = { volumesGeometryColdMs: +geoCold.toFixed(2), renderFullMs: +rFull.toFixed(2), renderFastMs: +rFast.toFixed(2), markupWarmMs: +warm.toFixed(4), body2dGeometryPlusSvgColdMs: +old2d.toFixed(2), svgBytesFull: mFull.svg.length, svgBytesFast: mFast.svg.length, rasterFull400pxMs: +rasFull.toFixed(1), rasterFast400pxMs: +rasFast.toFixed(1), volumesDrawnFull: mFull.drawn };
writeFileSync(`${OUT}/rapport.json`, JSON.stringify({ verificationMuscular: { ok: ref0.ok, checks: ref0.checks }, archetypes: report, timingsMs: timings }, null, 1));
console.log(JSON.stringify(timings), 'verif muscular', ref0.ok, 'archetypes KO:', Object.entries(report).filter(([, v]) => !(v as any).ok).map(([n, v]) => `${n}: ${(v as any).failures.join(' | ')}`));

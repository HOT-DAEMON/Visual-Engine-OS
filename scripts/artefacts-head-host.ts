import { mkdirSync, writeFileSync } from 'node:fs';
import { compileScene, generateRandomFace, SceneSpec } from '../src';
import { placedEyesByHost } from '../src/anatomy/placed';
import { hostFace } from '../src/render/face';
import { head3dSubject, hostEyesOf } from '../src/render/head-3d';
import { HeadRenders, verifyHeadSubject } from '../src/head-turntable/verify-head';
import { ROLL_PROBE } from '../src/head-turntable/verify-roll';
import { eyeOverlap, hostOverlap } from '../src/head-turntable/verify-host';
import type { HostSpec } from '../src/schema';
import { rasterPng } from './lib/raster';

/**
 * Preuves visuelles : recouvrement à 0° (tête 3D sur le dessin de face de l'hôte), yeux de l'hôte (forme, taille, regard), reliefs du cou (SCM, platysma, clavicule), roulis, tête complète,
 * et le rapport de vérification (`rapport.json`). Tout vient du rendu RÉEL (`compileScene`, kind `head_3d`), jamais d'un montage.
 */
const OUT = 'artefacts/tete-hote-cou-roulis', BG = '#2b3042', SEEDS = [11, 42, 77, 3];
mkdirSync(OUT, { recursive: true });
const inner = (svg: string): string => svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>'));
const txt = (x: number, y: number, s: string, size = 13, fill = '#e8ecf6', anchor = 'start'): string => `<text x="${x}" y="${y}" font-family="Inter, DejaVu Sans, sans-serif" font-size="${size}" fill="${fill}" text-anchor="${anchor}">${s.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;
const sheet = (name: string, w: number, h: number, body: string): void => {
  const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${BG}"/>${body}</svg>`;
  if (process.env.DUMP) writeFileSync(`/tmp/${name}.svg`, full);
  writeFileSync(`${OUT}/${name}.png`, rasterPng(full, { fonts: true, fitWidth: Math.min(2400, w) }));
};
/** Découpe d'une scène compilée : la zone (x, y, w, h) de la scène, posée en (px, py) à l'échelle k, sur fond blanc. */
let clips = 0;
const panel = (svg: string, x: number, y: number, w: number, h: number, px: number, py: number, k = 1): string => {
  const id = `clip${++clips}`;   // découpe par clipPath (et non par <svg viewBox> imbriqué : resvg plante sur certains recadrages de planches lourdes)
  return `<g transform="translate(${px - x * k} ${py - y * k}) scale(${k})"><clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff"/><g clip-path="url(#${id})">${inner(svg)}</g></g>`;
};

function scene(seed: number, head: Record<string, unknown> | null, hostAt = { x: 400, y: 420 }): { svg: string; objects: unknown[]; host: HostSpec; H: number } {
  const f = generateRandomFace(seed, { id: 'f0', transform: { ...hostAt, scale: 1 } } as never);
  const objects = [...f.objects, ...(head ? [{ kind: 'head_3d', id: 't0', host: 'f0', resolution: 2, ...head }] : [])];
  const r = compileScene({ width: 800, height: 800, background: '#ffffff', objects } as never) as { ok: boolean; svg: string; issues: string[] };
  if (!r.ok) throw new Error(r.issues.join('\n'));
  const host = SceneSpec.parse({ width: 800, height: 800, objects }).objects.find((o) => o.kind === 'host') as HostSpec;
  return { svg: r.svg, objects, host, H: hostFace(host).lm.H };
}
const subject = (seed: number) => {
  const { objects, host } = scene(seed, null), sc = SceneSpec.parse({ width: 800, height: 800, objects });
  return head3dSubject(host, { skull: {}, variation: { ci: 0, axes: {} }, hair: undefined, hairline: 'host' }, undefined, hostEyesOf(host, placedEyesByHost(sc).get('f0') ?? []));
};

// 01 + 02 : recouvrement à 0° et yeux ; mesures lues des contrôles.
let b1 = txt(20, 28, 'Recouvrement à 0° : dessin de face de l\'hôte (haut) ; avec la tête 3D à 55 % par-dessus (bas)', 17), b2 = txt(20, 28, 'Yeux : hôte (haut) vs tête 3D à 0° (bas) — forme, taille, regard', 17);
SEEDS.forEach((seed, i) => {
  const A = scene(seed, null), B = scene(seed, { yaw: 0, pitch: 0, transform: { x: 400, y: 420, scale: 1 } }), { spec } = subject(seed);
  B.svg.length; const H = A.H, head = scene(seed, { yaw: 0, pitch: 0, transform: { x: 400, y: 420 - 0.55 * H, scale: H / 240 } });
  const headG = head.svg.slice(head.svg.lastIndexOf('<g transform'), head.svg.lastIndexOf('</svg>')), over = A.svg.replace(/<\/svg>\s*$/, `<g opacity="0.55">${headG}</g></svg>`);
  const r0 = new HeadRenders(spec).at(0, true), o = hostOverlap(spec, r0)!, L = eyeOverlap(spec, r0, -1)!, R = eyeOverlap(spec, r0, 1)!, x = 20 + i * 410;
  b1 += panel(A.svg, 200, 170, 400, 530, x, 50, 1) + panel(over, 200, 170, 400, 530, x, 600, 1) + txt(x, 1150, `graine ${seed} : IoU ${o.iou.toFixed(3)} · peau ${o.skinCover.toFixed(3)}`, 13);
  const ey = 420 + hostFace(A.host).lm.eyeY, hd = scene(seed, { yaw: 0, pitch: 0, transform: { x: 400, y: 420 - 0.55 * H, scale: H / 240 } });
  b2 += panel(A.svg, 200, Math.round(ey) - 70, 400, 140, x, 50, 1) + panel(hd.svg, 200, Math.round(ey) - 70, 400, 140, x, 200, 1) + txt(x, 360, `graine ${seed} : regard Δ ${L.gaze.toFixed(4)} / ${R.gaze.toFixed(4)} U · paupières → encre ${L.meanD.toFixed(4)}`, 12);
});
sheet('01-recouvrement-0deg', 1680, 1180, b1);
sheet('02-yeux-hote-vs-3d', 1680, 380, b2);

// 03 : reliefs du cou (SCM, platysma, clavicule) à trois lacets.
let b3 = txt(20, 28, 'Cou 3D : SCM (creux interne/externe, cordes), platysma, clavicules et fosse sus-sternale, lus du moteur de cou', 17);
[11, 3, 77].forEach((seed, r) => [0, 35, 70].forEach((yaw, c) => {
  const s = scene(seed, { yaw, pitch: 0, transform: { x: 400, y: 40, scale: 1.7 } }, { x: -3000, y: -3000 });
  b3 += panel(s.svg, 150, 300, 500, 250, 20 + c * 520, 62 + r * 290, 1) + txt(24 + c * 520, 54 + r * 290, `graine ${seed} · lacet ${yaw}°`, 13);
}));
sheet("03-cou-reliefs", 1580, 910, b3);

// 04 : roulis (lacet × roulis), tête entière. 05 : tête complète en rotation.
let b4 = txt(20, 28, 'Roulis (inclinaison latérale autour de l\'axe du nez ; > 0 = vers la droite de l\'image) : le cou se plie, sa base reste de niveau', 17);
[0, 45, 90].forEach((yaw, r) => [-30, 0, 30].forEach((roll, c) => {
  const s = scene(11, { yaw, pitch: 10, roll, transform: { x: 400, y: 120, scale: 1.4 } }, { x: -3000, y: -3000 });
  b4 += panel(s.svg, 160, 100, 480, 560, 20 + c * 500, 50 + r * 580, 1) + txt(30 + c * 500, 72 + r * 580, `lacet ${yaw}° · roulis ${roll}°`, 12, '#1d2233');
}));
sheet('04-roulis', 1540, 1800, b4);
let b5 = txt(20, 28, 'Tête complète : crâne, visage, yeux de l\'hôte, oreilles, cou et ses reliefs — lacet 0 → 180° (tangage 17,7°)', 17);
[11, 42].forEach((seed, r) => [0, 45, 90, 135, 180].forEach((yaw, c) => {
  const s = scene(seed, { yaw, pitch: 17.7, transform: { x: 400, y: 120, scale: 1.4 } }, { x: -3000, y: -3000 });
  b5 += panel(s.svg, 160, 100, 480, 560, 20 + c * 400, 50 + r * 520, 0.82) + txt(30 + c * 400, 72 + r * 520, `graine ${seed} · lacet ${yaw}°`, 12, '#1d2233');
}));
sheet('05-tete-complete', 2060, 1100, b5);

// Rapport de vérification : les 3 couches, par graine ; contrôles hôte / cou / roulis détaillés.
const rep = SEEDS.map((seed) => {
  const { spec, lengthH } = subject(seed), t = verifyHeadSubject({ id: `s${seed}`, spec, lengthH }), all = t.layers.flatMap((l) => l.checks);
  const pick = all.filter((c) => /head\.(host|neck|roll)\./.test(c.id));
  return { seed, controles: all.length, echecs: all.filter((c) => !c.ok).map((c) => ({ id: c.id, valeur: c.value, severite: c.kind })), hote_cou_roulis: pick.map((c) => ({ id: c.id, valeur: +Number(c.value).toFixed(4), ok: c.ok })), roulis_sonde_deg: ROLL_PROBE };
});
writeFileSync(`${OUT}/rapport.json`, JSON.stringify(rep, null, 1));
console.log(rep.map((r) => `${r.seed}: ${r.controles} contrôles, échecs ${r.echecs.map((e) => e.id).join(',') || '—'}`).join('\n'));

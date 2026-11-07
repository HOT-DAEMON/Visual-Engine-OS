import { mkdirSync, writeFileSync } from 'node:fs';
import { compileScene, expandScene, generateRandomFace, SceneSpec } from '../src';
import { eyeRelations, toHostFrame, type PlacedEye } from '../src/anatomy/relations';
import { openingGeometry, openingPolygon } from '../src/geometry/eye';
import { noseGeometry } from '../src/face';
import { faceComponents } from '../src/render/face/components';
import { hostFace } from '../src/render/face';
import { neckPath } from '../src/render/neck';
import { verifyPipeline } from '../src/verify';
import type { HostSpec } from '../src/schema';
import { rasterPng } from './lib/raster';

/** Preuves visuelles : tête + corps via compileScene (kind `body`), enfants de la tête isolés sur le rendu réel, relations œil ↔ orbite mesurées. */
const OUT = 'artefacts/tete-pipeline';
mkdirSync(OUT, { recursive: true });
const BG = '#2b3042';
const inner = (svg: string): string => svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>'));
const poly = (p: readonly { x: number; y: number }[]): string => p.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(2)} ${q.y.toFixed(2)}`).join('') + 'Z';
const txt = (x: number, y: number, s: string, size = 13, fill = '#e8ecf6', anchor = 'start'): string => `<text x="${x}" y="${y}" font-family="Inter, DejaVu Sans, sans-serif" font-size="${size}" fill="${fill}" text-anchor="${anchor}">${s.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;
const sheet = (name: string, w: number, h: number, body: string): void => { const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${BG}"/>${body}</svg>`; if (/NaN|undefined|Infinity/.test(full)) throw new Error(`${name} : valeur non finie dans le SVG : ${full.match(/.{40}(NaN|undefined|Infinity).{20}/)?.[0]}`); if (process.env.DUMP) writeFileSync(`/tmp/${name}.svg`, full);
  if (process.env.DUMP) writeFileSync(`/tmp/${name}.svg`, full);
  writeFileSync(`${OUT}/${name}.png`, rasterPng(full, { fonts: true, fitWidth: Math.min(2000, w) })); };

/** Scène d'un visage + (option) corps ; `cx, cy` = position du centre de l'hôte, `s` = échelle. Identifiants uniques par cellule. */
function cell(seed: number, i: number, cx: number, cy: number, s: number, body: Record<string, unknown> | null) {
  const f = generateRandomFace(seed, { id: `f${i}`, transform: { x: cx, y: cy, scale: s } });
  const input = { width: 4000, height: 4000, background: null, objects: [...f.objects, ...(body ? [{ kind: 'body', id: `b${i}`, host: `f${i}`, body }] : [])] };
  const r = compileScene(input);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  const scene = SceneSpec.parse(input);
  const host = scene.objects.find((o) => o.kind === 'host') as HostSpec;
  return { f, input, scene, host, svg: r.svg, lm: hostFace(host).lm, params: hostFace(host).params };
}

// ---- 01 : tête + corps par le pipeline principal --------------------------------------------------------------------------------
{
  const CW = 520, CH = 700;
  const cases: { seed: number; label: string; body: Record<string, unknown> }[] = [
    { seed: 11, label: 'adulte · sex +1 · musculature 0,6', body: { age: 28, sex: 1, muscularity: 0.6, adiposity: 0.25 } },
    { seed: 42, label: 'adulte · sex −0,8 · adiposité 0,45', body: { age: 34, sex: -0.8, muscularity: 0.25, adiposity: 0.45 } },
    { seed: 3, label: 'enfant 8 ans (aucun dimorphisme)', body: { age: 8, sex: 0, muscularity: 0.1, adiposity: 0.2 } },
  ];
  const parts = cases.map((c, i) => {
    const probe = generateRandomFace(c.seed, { id: 'p', transform: { x: 0, y: 0, scale: 1 } }).height;
    const s = 125 / probe, cell0 = cell(c.seed, i, CW / 2, 40 + 62.5, s, c.body);
    const rep = verifyPipeline(cell0.input);
    const by = (l: string) => rep.checks.filter((k) => k.layer === l);
    const sum = ['geometry', 'anatomy', 'style'].map((l) => `${l} ${by(l).filter((k) => k.ok).length}/${by(l).length}`).join(' · ');
    return `<g transform="translate(${i * CW} 0)"><svg x="0" y="0" width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}">${inner(cell0.svg)}</svg>${txt(CW / 2, 660, c.label, 14, '#e8ecf6', 'middle')}${txt(CW / 2, 682, `vérification : ${sum}${rep.ok ? '  ✔' : '  ✘'}`, 12, rep.ok ? '#9fe3b0' : '#ff9a9a', 'middle')}</g>`;
  });
  sheet('01-tete-corps-pipeline', CW * 3, CH, parts.join(''));
}

// ---- 02 : chaque enfant de la tête isolé sur le rendu réel -----------------------------------------------------------------------
{
  const PW = 360, PH = 470, S = 1.0;
  const c = cell(11, 0, 0, 0, 1, null);
  const { lm, params } = c;
  const g = noseGeometry(params, lm);
  const comps = faceComponents(params, lm, g).components;
  const polysOf = (ids: string[]): string => comps.filter((k) => ids.includes(k.id)).flatMap((k) => k.polys).map((p) => poly(p)).join('');
  const eyes = expandScene(c.scene).flatMap((o) => (o.kind === 'eye' ? [o] : []));
  const aperture = eyes.map((e) => poly(openingPolygon(openingGeometry(e.shape, e.canthi), 48).map((p) => toHostFrame(p, { eye: e, world: e.transform, host: c.host.transform })))).join('');
  const orbit = (['left', 'right'] as const).map((sd) => `<ellipse cx="${lm.orbit[sd].cx}" cy="${lm.orbit[sd].cy}" rx="${lm.orbit[sd].rx}" ry="${lm.orbit[sd].ry}"/>`).join('');
  const panels: { name: string; canon: string; d: string; extra?: string }[] = [
    { name: 'tête / crâne', canon: 'head · cranium', d: polysOf(['head']) },
    { name: 'orbites', canon: 'orbit', d: '', extra: orbit },
    { name: 'yeux (ouverture)', canon: 'eye', d: aperture },
    { name: 'nez (+ pointe, ailes)', canon: 'nose', d: polysOf(['nose', 'tip', 'alaL', 'alaR']) },
    { name: 'bouche (repères des lèvres)', canon: 'mouth', d: `M${-lm.lips.half} ${lm.lips.topY}H${lm.lips.half}V${lm.lips.bottomY}H${-lm.lips.half}Z` },
    { name: 'menton / mâchoire', canon: 'chin · mandible', d: polysOf(['chin']) },
    { name: 'oreilles', canon: 'ear', d: polysOf(['earL', 'earR']) },
    { name: 'cheveux', canon: 'hair', d: polysOf(['hair']) },
    { name: 'cou (tracé réel ; haut caché derrière la tête)', canon: 'neck', d: neckPath(params, lm) },
  ];
  const cols = 3, rowsN = Math.ceil(panels.length / cols);
  const body = panels.map((p, i) => {
    const x = (i % cols) * PW, y = Math.floor(i / cols) * (PH + 34);
    const view = `${-lm.W * 0.62} ${-lm.H * 0.56} ${lm.W * 1.24} ${lm.H * 1.3}`;
    const overlay = `<g fill="#ff3d81" fill-opacity="0.38" stroke="#ffe14d" stroke-width="1.6">${p.d ? `<path d="${p.d}" fill-rule="evenodd"/>` : ''}</g>${p.extra ? `<g fill="none" stroke="#ffe14d" stroke-width="1.8" stroke-dasharray="5 3">${p.extra}</g>` : ''}`;
    return `<g transform="translate(${x} ${y})"><svg x="0" y="0" width="${PW}" height="${PH}" viewBox="${view}"><rect x="-1000" y="-1000" width="2000" height="2000" fill="#d9dce6"/>${inner(c.svg)}${overlay}</svg>${txt(PW / 2, PH + 20, `${p.name}  ·  id canonique : ${p.canon}`, 12.5, '#e8ecf6', 'middle')}</g>`;
  }).join('');
  void S;
  sheet('02-composants-enfants-tete', PW * cols, rowsN * (PH + 34), body);
}

// ---- 03 : relations œil ↔ orbite (géométrique / anatomique / visuelle) -----------------------------------------------------------
{
  const PW = 560, PH = 330;
  const seeds = [11, 1, 20, 35];
  const body = seeds.map((seed, i) => {
    const c = cell(seed, i, 0, 0, 1, null);
    const { lm } = c;
    const eyes = expandScene(c.scene).flatMap((o) => (o.kind === 'eye' ? [o] : []));
    let marks = '', lines: string[] = [];
    for (const e of eyes) {
      const pe: PlacedEye = { eye: e, world: e.transform, host: c.host.transform };
      const rs = eyeRelations(pe, lm), side = e.shape.outerSide === 'left' ? 'left' : 'right';
      const orbitR = rs.find((r) => r.id.startsWith('eye.in-orbit'))!;
      const ok = orbitR.value <= 1;
      const ap = poly(openingPolygon(openingGeometry(e.shape, e.canthi), 48).map((p) => toHostFrame(p, pe)));
      const o = lm.orbit[side];
      marks += `<ellipse cx="${o.cx}" cy="${o.cy}" rx="${o.rx}" ry="${o.ry}" fill="none" stroke="#ffe14d" stroke-width="1.6" stroke-dasharray="6 4"/><path d="${ap}" fill="${ok ? '#36d98a' : '#ff4d4d'}" fill-opacity="0.45" stroke="${ok ? '#0b6b3d' : '#7a0000'}" stroke-width="1.4"/><circle cx="${lm.innerCanthus[side].x}" cy="${lm.innerCanthus[side].y}" r="3" fill="#3da5ff" stroke="#fff" stroke-width="1"/>`;
      lines.push(`${side === 'left' ? 'G' : 'D'} : orbite ${orbitR.value.toFixed(2)} (≤ 1) · canthus ${rs[0]!.value.toFixed(2)} px · iris couvert ${(rs.find((r) => r.id.startsWith('lid.iris-coverage'))!.value * 100).toFixed(0)} %`);
    }
    marks += `<line x1="${-lm.W / 2}" x2="${lm.W / 2}" y1="${lm.browLimitY}" y2="${lm.browLimitY}" stroke="#b78bff" stroke-width="1.2" stroke-dasharray="3 3"/><line x1="${-lm.W / 2}" x2="${lm.W / 2}" y1="${lm.lowerLimitY}" y2="${lm.lowerLimitY}" stroke="#b78bff" stroke-width="1.2" stroke-dasharray="3 3"/>`;
    // Recadrage par masque (clipPath) et non par viewBox imbriquée : resvg plante sur des régions de filtre rognées par un viewBox serré.
    const k = PW / lm.W, vx = -lm.W * 0.5, vy = lm.eyeY - lm.H * 0.22;
    const x = (i % 2) * PW, y = Math.floor(i / 2) * (PH + 70);
    return `<g transform="translate(${x} ${y})"><clipPath id="clip3-${i}"><rect x="0" y="0" width="${PW}" height="${PH}"/></clipPath><g clip-path="url(#clip3-${i})"><rect x="0" y="0" width="${PW}" height="${PH}" fill="#d9dce6"/><g transform="scale(${k}) translate(${-vx} ${-vy})">${inner(c.svg)}${marks}</g></g>${txt(8, PH + 18, `graine ${seed}`, 13, '#ffe14d')}${lines.map((l, n) => txt(8, PH + 36 + n * 16, l, 12)).join('')}</g>`;
  }).join('');
  sheet('03-relations-oeil-orbite', PW * 2, (PH + 70) * 2, body + txt(8, (PH + 70) * 2 - 6, 'jaune pointillé : orbite (repères du visage) · vert/rouge : ouverture de l’œil dedans/dehors · bleu : canthus interne · violet : limites arcade / nez', 11, '#b9c0d6'));
}
void 0;
console.log(`artefacts écrits dans ${OUT}`);

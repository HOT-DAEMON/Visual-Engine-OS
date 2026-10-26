import { resolveAppearance } from '../appearance';
import { luminance, mix } from '../core/color';
import { el, num } from '../core/svg';
import { FaceParams } from '../schema';
import { skullGeometry, type SkullGeo } from './geometry';
import { boneLayer } from './render-anatomy';
import { faceDetails, lipsLayer, neckDetails, type Ink } from './render-detail';
import { profileEar } from './render-ear';
import { hairLayer } from './render-hair';
import { beardShape, type BeardShape } from './beard-shape';
import type { ProfileEyeData } from './eye-data';
import { hairShape, type HairShape } from './hair-shape';
import { eyeLayer, profileEyeGeometry, type ProfileEyeGeo } from './render-eye';
import { paintFacialHair, paintHair } from './render-hairs';
import { bezierChain, chainPath, type Bez } from './spline';
import type { CPoint, V2 } from './types';

/**
 * RENDU DU PROFIL, sans filtre ni bruit (performance : voir docs/PERF-3.md) — uniquement des chemins, des dégradés linéaires/radiaux et des
 * croissants d'ombre/lumière obtenus par différence symétrique (`evenodd`) de la silhouette et de sa copie décalée, comme l'oreille du moteur.
 * Modes : `skin` (illustration finie, style cel), `anatomy` (peau translucide + os + tissus mous + repères), `bone` (os seul).
 */
export type ProfileMode = 'skin' | 'anatomy' | 'bone';
export interface ProfileOptions { readonly mode?: ProfileMode; readonly skin?: string; readonly hair?: string; readonly width?: number; readonly background?: string | null; readonly markers?: boolean; /** Œil de la face (moteur d'yeux) : si fourni, l'œil et le sourcil de profil en sont déduits. */ readonly eye?: ProfileEyeData }
export interface ProfileRender { readonly svg: string; readonly width: number; readonly height: number; readonly geo: SkullGeo; readonly box: { x: number; y: number; w: number; h: number }; readonly shapes: { readonly hair: HairShape | null; readonly beard: BeardShape | null; readonly eye: ProfileEyeGeo | null } }

const LIGHT = { x: 0.62, y: -0.52, z: 0.58 };
const shift = (ch: readonly Bez[], dx: number, dy: number): Bez[] => ch.map((b) => ({ p0: mv(b.p0, dx, dy), c1: mv(b.c1, dx, dy), c2: mv(b.c2, dx, dy), p3: mv(b.p3, dx, dy) }));
const mv = (p: CPoint, dx: number, dy: number): CPoint => ({ ...p, x: p.x + dx, y: p.y + dy });

/** Encre du profil pour une peau donnée : plus sombre sur peau foncée (contraste ≥ 4 : vérifié par `verifyProfile`). */
export function profileInk(skinHex: string, hairHex: string, faceIn: unknown): Ink {
  const face = FaceParams.parse(faceIn);
  const ra = resolveAppearance(skinHex, face.skin);
  const tone = mix(ra.base, ra.shadow, 0.2);
  // `mix` mélange en lumière linéaire : 0,78 donnait un gris moyen ; ~0,94 donne un brun très sombre (ni noir pur, ni gris).
  const k = luminance(ra.base) < 0.3 ? 0.985 : 0.94;
  return { line: mix(tone, '#120806', k), soft: mix(tone, '#4a2a22', 0.6), hair: mix(hairHex, '#000000', 0.25), shade: mix(tone, '#2a0f10', 0.7) };
}

export function renderProfile(faceIn: unknown, skIn: unknown, o: ProfileOptions = {}): ProfileRender {
  const face = FaceParams.parse(faceIn);
  const H = 420;
  const g = skullGeometry(face, skIn, H);
  const mode = o.mode ?? 'skin';
  const skinHex = o.skin ?? '#efc8a8';
  const ra = resolveAppearance(skinHex, face.skin);
  // `ra.shadow` est une teinte d'ombre saturée (rouge) : elle sert au calcul, jamais telle quelle en grande surface ; les aplats d'ombre sont ramenés vers la base (cel doux).
  const tone = mix(ra.base, ra.shadow, 0.2);
  const ink = profileInk(skinHex, o.hair ?? '#4a3222', face);
  const { x, f } = g.frame;
  const hairC = o.hair ?? '#4a3222';
  const auto = mode === 'skin' && g.params.hair === 'auto';
  const hs = auto ? hairShape(g, face.hair, g.params.napeHairline) : null;
  const bs = mode === 'skin' ? beardShape(g, face.facialHair, face.hair) : null;
  const eyeG = mode === 'skin' && o.eye ? profileEyeGeometry(g, o.eye) : null;
  const hair = mode === 'skin' && !auto ? hairLayer(g, hairC, LIGHT, ink.line) : null;
  const hairPaint = hs ? paintHair(hs, face.hair, H, ink.line) : null;
  const hx = hs ? Math.min(...[...hs.mass, ...hs.extra.flat()].map((p) => p.x), hs.bun ? hs.bun.cx - hs.bun.r : 0) - 0.02 * H : 0;
  const left = Math.min(x.back * 1.12, g.neck.back[0]!.x, hx || 0) - 0.1 * H - (g.params.hair === 'updo' ? 0.05 * H : 0);
  const right = x.tip + 0.14 * H;
  const top = Math.min((g.params.hair === 'updo' && mode === 'skin' ? -0.17 : -0.06) * H, hs ? hs.top - 0.03 * H : 0);
  const bottom = Math.max(g.neck.yBase + 0.03 * H, hs ? hs.bottom + 0.03 * H : 0, bs ? bs.bottom + 0.03 * H : 0);
  const box = { x: left, y: top, w: right - left, h: bottom - top };
  const W = o.width ?? 640;
  const Hpx = Math.round((W * box.h) / box.w);
  const sd = chainPath(g.chain, true);
  const open = chainPath(g.chain, false);
  // Silhouette prolongée sous la coupe : les croissants d'ombre ne dessinent pas de bande le long du bas.
  // Contour prolongé SOUS la coupe par deux points ajoutés (les points d'origine ne bougent pas : les croissants restent alignés sur la vraie silhouette).
  const bb = g.sil[0] as CPoint, bf = g.sil[g.sil.length - 1] as CPoint;
  const extChain = bezierChain([{ x: bb.x, y: bb.y + 0.4 * H, s: 1 }, ...g.sil, { x: bf.x, y: bf.y + 0.4 * H, s: 1 }], false);
  const tall = (dx: number, dy: number): string => chainPath(shift(extChain, dx, dy), true);
  const d = 0.032 * H;
  const lnorm = Math.hypot(LIGHT.x, LIGHT.y);
  const lx = LIGHT.x / lnorm, ly = LIGHT.y / lnorm;
  const defs: string[] = [el('clipPath', { id: 'sk-sil' }, [el('path', { d: sd })])];
  const neck = g.neck;
  const th = neck.throat;
  const go = g.bone.lm.gonion as V2, gn = g.bone.lm.gnathion as V2;
  void 0;
  defs.push(el('linearGradient', { id: 'sk-jawsh', x1: 0, y1: num(H), x2: 0, y2: num(th.y + 0.2 * H), gradientUnits: 'userSpaceOnUse' }, [el('stop', { offset: 0, 'stop-color': ra.shadow, 'stop-opacity': 0.95 }), el('stop', { offset: 1, 'stop-color': ra.shadow, 'stop-opacity': 0 })]));
  const radial = (id: string, c: string, a: number): string => el('radialGradient', { id }, [el('stop', { offset: 0, 'stop-color': c, 'stop-opacity': a }), el('stop', { offset: 1, 'stop-color': c, 'stop-opacity': 0 })]);
  defs.push(radial('sk-soc', tone, 0.5), radial('sk-cheek', tone, 0.28), radial('sk-blush', '#e0566a', 0.14), radial('sk-hl', ra.highlight, 0.7));
  const body: string[] = [];
  const earLayer = mode === 'skin' && !(hs && hs.style === 'long') ? profileEar(g, face, skinHex, ra, LIGHT) : null;
  const lips = mode === 'skin' ? lipsLayer(g, mix(ra.base, '#c4505a', 0.38), ink.line) : [];
  if (earLayer) defs.push(...earLayer.defs);
  const eyeOut = eyeG && o.eye ? eyeLayer(g, o.eye, ink) : null;
  if (eyeOut) defs.push(...eyeOut.defs);
  if (hairPaint) defs.push(...hairPaint.defs);
  if (mode === 'skin') {
    body.push(...(hair?.back ?? []), ...(hairPaint?.back ?? []));
    body.push(el('path', { d: sd, fill: ra.base }));
    const clip = { 'clip-path': 'url(#sk-sil)' };
    const xc = x.nasion - 0.012 * H, yc = f.eye * H;
    const sh: string[] = [
      el('path', { d: `${tall(lx * d, ly * d)}${tall(0, 0)}`, 'fill-rule': 'evenodd', fill: tone, opacity: 0.9 }),
      el('path', { d: `${tall(-lx * d * 0.8, -ly * d * 0.8)}${tall(0, 0)}`, 'fill-rule': 'evenodd', fill: ra.light, opacity: 0.9 }),
      el('path', { d: `M${num(gn.x - 0.01 * H)} ${num(H)}L${num(th.x)} ${num(th.y)}Q${num(th.x - 0.01 * H)} ${num(th.y + 0.1 * H)} ${num(th.x - 0.05 * H)} ${num(th.y + 0.15 * H)}Q${num(go.x + 0.09 * H)} ${num(go.y + 0.1 * H)} ${num(go.x - 0.005 * H)} ${num(go.y + 0.1 * H)}L${num(go.x - 0.02 * H)} ${num(go.y)}Q${num((go.x + gn.x) / 2)} ${num(gn.y + 0.02 * H)} ${num(gn.x - 0.01 * H)} ${num(H)}Z`, fill: tone, opacity: 0.8 }),
      el('ellipse', { cx: num(xc - 0.03 * H), cy: num(yc - 0.004 * H), rx: num(0.075 * H), ry: num(0.06 * H), fill: 'url(#sk-soc)' }),
      el('ellipse', { cx: num(x.nasion - 0.15 * H), cy: num(f.eye * H + 0.16 * H), rx: num(0.1 * H), ry: num(0.08 * H), fill: 'url(#sk-cheek)' }),
      el('ellipse', { cx: num(x.nasion - 0.11 * H), cy: num(f.eye * H + 0.115 * H), rx: num(0.07 * H), ry: num(0.05 * H), fill: 'url(#sk-blush)' }),
      el('ellipse', { cx: num(x.front - 0.075 * H), cy: num(f.supra * H - 0.01 * H), rx: num(0.045 * H), ry: num(0.075 * H), fill: 'url(#sk-hl)' }),
      el('ellipse', { cx: num(x.nasion - 0.14 * H), cy: num(f.eye * H + 0.08 * H), rx: num(0.05 * H), ry: num(0.028 * H), fill: 'url(#sk-hl)' }),
    ];
    body.push(el('g', clip, sh));
    body.push(el('g', {}, [...lips, ...faceDetails(g, ink, !eyeOut), ...neckDetails(g, ink)]));
    if (bs) body.push(el('g', {}, paintFacialHair(bs, face.facialHair, face.hair.color, H, ink.line)));
    if (eyeOut) body.push(el('g', {}, eyeOut.markup));
    body.push(el('path', { d: open, fill: 'none', stroke: ink.line, 'stroke-width': num(H * 0.0058), 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    body.push(...(hair?.front ?? []), ...(hairPaint?.front ?? []));
    if (earLayer) body.push(earLayer.markup);
  } else {
    const c = { bone: mode === 'bone' ? '#efe6d2' : '#f1e9d6', line: '#4a3a2c', shade: '#cfc3ab', marker: '#d23a3a', landmark: '#2f6fd0' };
    if (mode === 'anatomy') body.push(el('path', { d: sd, fill: ra.base, opacity: 0.32 }), el('path', { d: open, fill: 'none', stroke: ink.line, 'stroke-width': num(H * 0.0048), 'stroke-dasharray': `${num(H * 0.012)} ${num(H * 0.006)}`, opacity: 0.8 }));
    body.push(...boneLayer(g, c, o.markers ?? mode === 'anatomy'));
  }
  const bg = o.background === undefined ? '#f3efe7' : o.background;
  const svg = el('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: `${num(box.x)} ${num(box.y)} ${num(box.w)} ${num(box.h)}`, width: W, height: Hpx, role: 'img', 'aria-label': `Tête de profil, mode ${mode}` }, [
    ...(bg ? [el('rect', { x: num(box.x), y: num(box.y), width: num(box.w), height: num(box.h), fill: bg })] : []), el('defs', {}, defs), ...body,
  ]);
  return { svg, width: W, height: Hpx, geo: g, box, shapes: { hair: hs, beard: bs, eye: eyeG } };
}

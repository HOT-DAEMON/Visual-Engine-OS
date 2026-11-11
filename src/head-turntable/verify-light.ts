import { cullFarEar } from './engines/ear-cull';
import { buildParts } from './parts';
import { PART } from './mesh';
import { alaDeviationDeg, alaWeight } from './nose-light';
import { reliefLight } from './paint';
import { rasterize } from './raster';
import { defaultFrame, renderHead } from './render';
import { contrastRatio, hex, relLum } from './color';
import { norm, v3 } from './math';
import { REGION, type HeadTurnSpec, type TurnRender, type View } from './types';
import { check, type Check } from './verify-types';
import { deltaL, lightModelOf, tonesOf, type LightModel } from '../relief';

/**
 * COUCHE DE VÉRIFICATION DE LA TÊTE ÉCLAIRÉE (géométrie · anatomie · style), au-dessus des trois couches de `verify-head.ts` : elle ne mesure que ce que l'éclairage ajoute.
 *  - GÉOMÉTRIE : la lumière est FIXE dans la scène, pas dans la tête → quel que soit le lacet / le tangage, la moitié de l'image tournée vers la lumière est la plus claire ; l'éclairage ne change jamais la silhouette.
 *  - ANATOMIE : les ailes du nez se fondent dans la face (normale éclairée ≤ 35° de celle de la face : pas de disque) ; l'ombre du menton tombe sur le HAUT du cou ; les cheveux ne tombent pas au noir.
 *  - STYLE : l'encre n'est ni mangée ni ajoutée par la lumière, aucun pixel noir pur, aplats en cel, écart ombre-lumière dans la plage des références (0,12 – 0,55 OKLab ; cel 0,21–0,30, peint 0,40–0,50).
 * Bornes : [réf] plage des planches d'éclairage, [canon] anatomie, [rendu] tolérance de rastérisation ; écrites avant la mesure (`docs/HEAD-TURNTABLE-LIGHT-VERIFY.md`).
 */
const G = 'geometry', A = 'anatomy', S = 'style';
const VIEWS: readonly View[] = [{ yaw: 0, pitch: 0 }, { yaw: 45, pitch: 0 }, { yaw: 90, pitch: 0 }, { yaw: 45, pitch: 30 }];
const lum = (r: TurnRender, k: number): number => 0.2126 * r.rgba[4 * k]! + 0.7152 * r.rgba[4 * k + 1]! + 0.0722 * r.rgba[4 * k + 2]!;
/** Peau du visage et du crâne seulement : le cou fond vers l'ombre à sa base (conception de la planche, `paint.ts`), il fausserait la partition gauche / droite à 90°. */
const isSkin = (r: TurnRender, k: number): boolean => r.ids[k]! > 0 && r.regions[k] === REGION.skin;

/** Rapport de luminance moyenne de la peau : moitié de l'image TOURNÉE VERS la lumière / moitié opposée (coupure au centre de la boîte de la peau). */
export function sideRatio(r: TurnRender, towardRight: boolean): number {
  let x0 = r.w, x1 = 0; for (let k = 0; k < r.w * r.h; k++) if (isSkin(r, k)) { const x = k % r.w; if (x < x0) x0 = x; if (x > x1) x1 = x; }
  const cx = (x0 + x1) / 2; let a = 0, na = 0, b = 0, nb = 0;
  for (let k = 0; k < r.w * r.h; k++) if (isSkin(r, k)) { const right = k % r.w >= cx, l = lum(r, k); if (right === towardRight) { a += l; na++; } else { b += l; nb++; } }
  return na && nb ? a / na / (b / nb) : NaN;
}

/** Contrôles de l'éclairage de la tête `spec` sous `model` (les rendus se font ici : 4 vues éclairées + 1 vue de référence sans lumière). */
export function litChecks(spec: HeadTurnSpec, model: LightModel, shadowTint: string | null = null, heightPx = 420): Check[] {
  const c: Check[] = [], fr = defaultFrame(heightPx), ink = hex(spec.palette.ink), opts = { frame: fr, ss: 2 };
  const lit = VIEWS.map((v) => renderHead(v, spec, { ...opts, light: model, shadowTint })), plain = renderHead(VIEWS[1]!, spec, opts);
  // GÉOMÉTRIE
  // De PROFIL (90°) la peau visible est une paroi latérale : avec une lumière presque frontale les deux moitiés sont à parité (mesuré 0,99 à 30° d'azimut) → information, pas blocage.
  VIEWS.forEach((v, i) => c.push(check(G, `lit.side.${v.yaw}.${v.pitch}`, `Vue ${v.yaw}° / ${v.pitch}° : luminance de la peau du côté tourné vers la lumière / côté opposé [la lumière est fixe dans la scène]`, sideRatio(lit[i]!, model.dir.x > 0), 1.04, 30, v.yaw >= 90 ? 'info' : 'hard')));
  let diff = 0; for (let k = 0; k < plain.w * plain.h; k++) if ((plain.ids[k] !== 0) !== (lit[1]!.ids[k] !== 0)) diff++;
  c.push(check(G, 'lit.silhouette', 'Silhouette éclairée = silhouette sans lumière à 45° (pixels différents) [l\'éclairage ne touche pas la géométrie]', diff, 0, 0));
  // ANATOMIE : ailes du nez, ombre du menton, plancher des cheveux
  const v30: View = { yaw: 30, pitch: 0 }, g = rasterize(cullFarEar(buildParts(spec), v30), v30, { w: fr.w * 2, h: fr.h * 2, ppu: fr.ppu * 2, ox: fr.ox * 2, oy: fr.oy * 2 });
  const samples: { p: { x: number; y: number; z: number }; n: { x: number; y: number; z: number } }[] = [];
  for (let k = 0; k < g.w * g.h; k++) if (g.id[k] === PART.bump) { const p = v3(g.P[3 * k]!, g.P[3 * k + 1]!, g.P[3 * k + 2]!); if (alaWeight(spec, p) >= 0.999) samples.push({ p, n: norm(v3(g.N[3 * k]!, g.N[3 * k + 1]!, g.N[3 * k + 2]!)) }); }
  c.push(check(A, 'lit.ala.count', 'Pixels d\'aile du nez vus à 30° (sans eux, le contrôle ne mesure rien)', samples.length, 30, 1e9));
  c.push(check(A, 'lit.ala.normal', 'Ailes du nez : écart max entre la normale ÉCLAIRÉE et celle de la face (°) [canon : l\'aile se fond dans la joue ; brute : ≈ 90°]', alaDeviationDeg(spec, samples), 0, 35));
  const key = lightModelOf({ azimuthDeg: 300, elevationDeg: 60, shadowHardness: 0.9, sourceSize: 0.15 }, { style: 'cel2' }), rl = reliefLight(spec, g, { lineU: 0.022, ppuHi: fr.ppu * 2, light: key }, key, v30);
  let y0 = Infinity, y1 = -Infinity; for (let k = 0; k < g.w * g.h; k++) if (g.id[k] === PART.neck) { y0 = Math.min(y0, g.P[3 * k + 1]!); y1 = Math.max(y1, g.P[3 * k + 1]!); }
  let nTop = 0, sTop = 0; for (let k = 0; k < g.w * g.h; k++) if (g.id[k] === PART.neck && g.P[3 * k + 1]! < y0 + 0.35 * (y1 - y0)) { nTop++; if (rl.cast[k]! > 0.5) sTop++; }
  c.push(check(A, 'lit.chin.shadow', 'Haut du cou (35 % supérieurs) : part à l\'ombre portée sous une clé haute (300° / 60°) [le menton projette sur le cou]', nTop ? sTop / nTop : NaN, 0.05, 0.9));
  const rH = lit[2]!, hairL: number[][] = [], inkNear = (r: TurnRender, k: number, t: number): boolean => Math.hypot(r.rgba[4 * k]! - ink[0], r.rgba[4 * k + 1]! - ink[1], r.rgba[4 * k + 2]! - ink[2]) < t;
  for (let k = 0; k < rH.w * rH.h; k++) if (rH.ids[k] && rH.regions[k] === REGION.hair && !inkNear(rH, k, 40)) hairL.push([rH.rgba[4 * k]!, rH.rgba[4 * k + 1]!, rH.rgba[4 * k + 2]!]);
  hairL.sort((a, b) => relLum(a) - relLum(b));
  c.push(check(A, 'lit.hair.floor', 'Cheveux à 90° : contraste WCAG du 5e centile des cheveux (hors trait) contre l\'encre [canon : la mèche à l\'ombre se lit encore devant le trait ; chauve : NaN → non mesuré]', hairL.length > 50 ? contrastRatio(hairL[Math.floor(0.05 * hairL.length)]!, ink) : 99, 1.1, 99));
  // STYLE
  let inkPlain = 0, inkLost = 0; for (let k = 0; k < plain.w * plain.h; k++) if (plain.ids[k] && plain.regions[k] !== REGION.hair && Math.hypot(plain.rgba[4 * k]! - ink[0], plain.rgba[4 * k + 1]! - ink[1], plain.rgba[4 * k + 2]! - ink[2]) < 40) { inkPlain++; if (!inkNear(lit[1]!, k, 40)) inkLost++; }
  c.push(check(S, 'lit.ink.kept', 'Encre à 45° : part des pixels d\'encre de la vue sans lumière que la lumière a recouverts, hors cheveux (sombres : ils ressemblent à l\'encre) [le trait n\'est jamais mangé]', inkPlain ? inkLost / inkPlain : NaN, 0, 0.05));
  let black = 0; for (const r of lit) for (let k = 0; k < r.w * r.h; k++) if (r.ids[k] && r.rgba[4 * k]! + r.rgba[4 * k + 1]! + r.rgba[4 * k + 2]! < 12) black++;
  c.push(check(S, 'lit.pixels.black', 'Pixels noirs purs (valeur NaN peinte) dans les 4 vues éclairées', black, 0, 0));
  const t = tonesOf(spec.palette.skin, model, { shadow: shadowTint });
  c.push(check(S, 'lit.dL', 'Écart ombre-lumière de la peau (ΔL OKLab) [réf : cel 0,21–0,30, peint 0,40–0,50]', deltaL(t.lit, t.shadow), 0.12, 0.55));
  const bins = new Map<number, number>(); let ns = 0, r1 = lit[1]!;
  for (let k = 0; k < r1.w * r1.h; k++) if (r1.ids[k] && r1.regions[k] === REGION.skin) { const q = ((r1.rgba[4 * k]! >> 4) << 8) | ((r1.rgba[4 * k + 1]! >> 4) << 4) | (r1.rgba[4 * k + 2]! >> 4); bins.set(q, (bins.get(q) ?? 0) + 1); ns++; }
  const top = [...bins.values()].sort((a, b) => b - a).slice(0, 8).reduce((a, b) => a + b, 0);
  c.push(check(S, 'lit.tones.flat', 'Peau à 45° : part des pixels dans les 8 teintes (quantifiées à 16) les plus peuplées [cel : aplats ; peint : dégradé, information]', ns ? top / ns : NaN, model.style === 'soft' ? 0 : 0.6, 1, model.style === 'soft' ? 'info' : 'hard'));
  return c;
}

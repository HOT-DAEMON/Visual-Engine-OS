import { faceLandmarks, noseGeometry } from '../face';
import { convexHull } from '../face/nose/underview';
import { polyArea } from '../face/poly';
import { REGION } from '../relief/field';
import { lightModelOf } from '../relief/model';
import { litUnderview, underviewRelief, type UnderviewLit, type UnderviewRelief } from '../relief/underview';
import { parseHex } from '../core/color';
import { NOSE_REFS } from '../face/nose/refs.generated';
import { check, type Check } from './types';
import type { RandomFace } from '../generation/random-face';

/**
 * VÉRIFICATION DU RENDU ÉCLAIRÉ DU NEZ VU DE DESSOUS (`src/relief/underview.ts` + `face/nose/base-mass.ts`) : les contrôles qui n'existaient que comme TESTS deviennent des règles.
 *  geometry : profondeur finie, aucun trou dans la silhouette (un pixel vide entouré de pixels pleins sur ses quatre axes).
 *  anatomy  : UNE masse (solidité de la silhouette = aire / aire de l'enveloppe convexe) et pas de « tige » (rapport du plus étroit au plus large sur la partie médiane de la hauteur) :
 *             c'est la signature du défaut « champignon » (deux plaques + tige) ; narines en cavités (présentes et plus profondes que la peau voisine) dès 20° de tangage.
 *  style    : le rendu n'est pas un aplat (écart-type de luminance) ; l'ombre portée ne noie pas le nez (part de pixels très sombres bornée). `warn` pour le style.
 * Pure : `noseLitReliefChecks` / `noseLitStyleChecks` prennent le rendu en entrée pour que les tests y injectent un défaut (fixture v1) et constatent qu'il est détecté.
 * Bornes MESURÉES (scripts, 4 nez × 4 tangages, ppu 2) : 4 nez × 4 tangages : solidité ≥ 0,889 et col ≥ 0,70 à 40–60° ; défaut v1 solidité ≤ 0,799 et col ≤ 0,208. Puis 120 visages tirés à 40° (seeds s × 977) : solidité ≥ 0,793, col ≥ 0,784 ; le COL est le discriminant fort (v1 ≈ 0,2), la solidité reste large (0,75).
 */
export const NOSE_LIT_LIMITS = { solidityMin: 0.75, neckMin: 0.45, holesMax: 3, mushroomFromPitch: 40, lumStdMin: 12, darkShareMax: 0.35, darkFrac: 0.3 } as const;

export interface Silhouette { readonly solidity: number; readonly neck: number; readonly holes: number; readonly area: number }

/** Silhouette du nez (pixels de région nez) : solidité, rapport du col, trous. */
export function silhouetteOf(r: Pick<UnderviewRelief, 'field' | 'grid'>, ppu = 2): Silhouette {
  const { w, h } = r.grid, d = r.field.depth, reg = r.field.region, mask = (k: number): boolean => d[k] !== -Infinity && reg[k] === REGION.nose;
  const lo = new Int32Array(h).fill(w), hi = new Int32Array(h).fill(-1); let area = 0;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (mask(j * w + i)) { area++; if (i < lo[j]!) lo[j] = i; if (i > hi[j]!) hi[j] = i; }
  if (area === 0) return { solidity: 0, neck: 0, holes: 0, area: 0 };
  const rows: number[] = []; for (let j = 0; j < h; j++) if (hi[j]! >= 0) rows.push(j);
  const j0 = rows[0]!, j1 = rows[rows.length - 1]!, span = Math.max(1, j1 - j0);
  const pts: { x: number; y: number }[] = []; for (const j of rows) { pts.push({ x: lo[j]!, y: j }, { x: hi[j]! + 1, y: j }); }
  const solidity = area / Math.max(1, Math.abs(polyArea(convexHull(pts))));
  let widest = 0, narrow = Infinity;
  for (const j of rows) { const wd = hi[j]! - lo[j]! + 1; widest = Math.max(widest, wd); if (j >= j0 + 0.25 * span && j <= j1 - 0.2 * span) narrow = Math.min(narrow, wd); }
  let holes = 0;   // pixel vide dont les quatre axes (rayon 8 px) rencontrent un pixel de nez
  const R = Math.max(2, Math.round(4 * ppu)), seen = (i: number, j: number, di: number, dj: number): boolean => { for (let s = 1; s <= R; s++) { const x = i + di * s, y = j + dj * s; if (x < 0 || y < 0 || x >= w || y >= h) return false; if (mask(y * w + x)) return true; } return false; };
  for (let j = j0; j <= j1; j += 2) for (let i = lo[j]!; i <= hi[j]!; i += 2) if (!mask(j * w + i) && seen(i, j, 1, 0) && seen(i, j, -1, 0) && seen(i, j, 0, 1) && seen(i, j, 0, -1)) holes++;
  return { solidity, neck: narrow === Infinity ? 0 : narrow / widest, holes, area };
}

export function noseLitReliefChecks(r: UnderviewRelief, pitchDeg: number, ppu = 2): Check[] {
  const L = NOSE_LIT_LIMITS, area2 = (ppu / 2) ** 2, s = silhouetteOf(r, ppu), finite = r.field.depth.every((v) => v === -Infinity || Number.isFinite(v)), out: Check[] = [];
  out.push(check('geometry', 'nose-lit-finite', '==', Number(finite), 1, 'la carte de profondeur du nez contient une valeur non finie'));
  out.push(check('geometry', 'nose-lit-no-holes', '<=', s.holes, L.holesMax, 'la silhouette éclairée du nez contient des trous (pixels vides entourés de nez)'));
  if (pitchDeg >= L.mushroomFromPitch) {   // de face (≤ 20°) la silhouette du défaut v1 ressemble encore à un nez : la signature n'apparaît qu'à partir de 40° (mesuré, tests/nose-lit-verify.test.ts)
  out.push(check('anatomy', 'nose-lit-single-mass', '>=', s.solidity, L.solidityMin, 'la silhouette éclairée n\'est pas une masse unique (plaques d\'ailes séparées : défaut « champignon »)'));
  out.push(check('anatomy', 'nose-lit-no-stalk', '>=', s.neck, L.neckMin, 'la silhouette éclairée a un col étroit (columelle en tige sous un chapeau)'));
  }
  if (pitchDeg >= 20) {
    let cn = 0, cs = 0, ns = 0, nn = 0;
    for (let k = 0; k < r.grid.w * r.grid.h; k++) { const d = r.field.depth[k]!; if (d === -Infinity) continue; if (r.cavity[k]) { cs += d; cn++; } else if (r.field.region[k] === REGION.nose) { ns += d; nn++; } }
    out.push(check('anatomy', 'nose-lit-nostril-cavities', '>=', cn, pitchDeg >= L.mushroomFromPitch ? 16 * area2 : 1, 'les narines ne forment pas de cavités visibles dans le rendu éclairé'));
    out.push(check('anatomy', 'nose-lit-cavity-deeper', '<=', cn && nn ? cs / cn - ns / nn : -1, -1e-6, 'les cavités de narine ne sont pas plus profondes que la peau voisine'));
  }
  return out;
}

/** `skinLum` : luminance de la peau de l'hôte (0–255) ; « presque noir » est relatif à elle, sinon une peau foncée serait toujours en faute. */
/**
 * Séparation des narines / largeur de la silhouette (mesurée sur la silhouette du rendu, pas sur l'ancienne enveloppe) : plage des dessins de la réf. 03 (0,38–0,50) ; `warn`.
 * ÉCART CONNU : le nez par défaut est à 0,30, même avec `nostrils.columella` = 1 on n'atteint que 0,365 (scripts, docs/NOSE-BASE-MASS.md) : la loi de placement des narines (`nostrils.ts`) est à changer.
 */
export function noseSeparationCheck(r: Pick<UnderviewRelief, 'field' | 'grid'>, nostrilGapPx: number, ppu: number): Check {
  const { w, h } = r.grid; let lo = w, hi = -1;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = j * w + i; if (r.field.depth[k] !== -Infinity && r.field.region[k] === REGION.nose) { if (i < lo) lo = i; if (i > hi) hi = i; } }
  const s = hi < lo ? 0 : nostrilGapPx / ((hi - lo + 1) / ppu), m = NOSE_REFS.r03.separationOverNoseW;
  const outside = Math.max(0, m.min - s, s - m.max);   // distance à la plage (0 = dedans) : `check` n'a pas de comparaison par intervalle
  return check('style', 'nose-lit-nostril-separation', '<=', outside, 0, `séparation des narines ${s.toFixed(3)} hors de la plage mesurée sur la réf. 03 (${m.min}–${m.max})`, 'warn');
}

export function noseLitStyleChecks(l: Pick<UnderviewLit, 'field' | 'grid' | 'rgba'>, skinLum: number): Check[] {
  const L = NOSE_LIT_LIMITS, N = l.grid.w * l.grid.h; let n = 0, mu = 0, mu2 = 0, dark = 0;
  for (let k = 0; k < N; k++) {
    if (l.field.depth[k] === -Infinity || l.field.region[k] !== REGION.nose) continue;
    const y = 0.2126 * l.rgba[k * 4]! + 0.7152 * l.rgba[k * 4 + 1]! + 0.0722 * l.rgba[k * 4 + 2]!; n++; mu += y; mu2 += y * y; if (y < L.darkFrac * skinLum) dark++;
  }
  const sd = n ? Math.sqrt(Math.max(0, mu2 / n - (mu / n) ** 2)) : 0;
  return [
    check('style', 'nose-lit-not-flat', '>=', sd, L.lumStdMin, 'le nez éclairé est un aplat (écart-type de luminance trop faible)', 'warn'),
    check('style', 'nose-lit-shadow-not-black', '<=', n ? dark / n : 1, L.darkShareMax, 'trop de pixels du nez sont presque noirs (ombre qui noie la forme)', 'warn'),
  ];
}

/** Même lumière de référence que les artefacts du nez ; résolution réduite (2 px/px) : le contrôle porte sur la forme, pas sur le détail. */
const LIGHT = lightModelOf({ azimuthDeg: 300, elevationDeg: 45, color: '#ffffff', intensity: 1, sourceSize: 0.3 }, { style: 'soft' });

/** 1,5 px/px : ≈ 110 ms par visage (2 px/px : ≈ 180 ms ; `verifyFace` est appelé en boucle par les tests). Les seuils de pixels sont ramenés à la surface (ppu/2)². */
const VERIFY_PPU = 1.5;

export function checkNoseLit(face: RandomFace, pitchDeg = 40): Check[] {
  const nose = noseGeometry(face.params, faceLandmarks(face.params, face.width, face.height));
  const skin = (face.objects[0] as unknown as { material: { color: string } }).material.color, [r, g, b] = parseHex(skin);
  const lit = litUnderview(nose, { pitchDeg }, skin, LIGHT, { ppu: VERIFY_PPU, shadow: face.params.skin.light.shadow });
  return [...noseLitReliefChecks(lit, pitchDeg, VERIFY_PPU), ...noseLitStyleChecks(lit, 0.2126 * r + 0.7152 * g + 0.0722 * b), noseSeparationCheck(lit, nose.nostrils.right.c.x - nose.nostrils.left.c.x, VERIFY_PPU)];
}

export { underviewRelief };

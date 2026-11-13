import { encodePngRgba } from '../core/png';
import { parseHex } from '../core/color';
import type { NoseGeometry } from '../face';
import { rotateProject3, noseView, lobuleZ, alaZ } from '../face/nose/underview';
import { UNDERVIEW_MODEL, type UnderviewModel } from '../face/nose/underview-model';
import { inPoly, polyBox, type Poly } from '../face/poly';
import { ambientOcclusion, castShadow } from './cast';
import { REGION, normalsOf, type Grid, type ReliefField } from './field';
import { shadeAt, tonesOf, type LightModel } from './model';

/**
 * VUE DE DESSOUS ÉCLAIRÉE PAR LE MOTEUR UNIQUE (`src/relief`). Avant : des aplats de la peau de l'hôte (rendu diagnostique, docs/NOSE-UNDERVIEW.md §6).
 * Ici la vue de dessous produit une CARTE DE PROFONDEUR (`ReliefField`, mêmes conventions que `headRelief` : x droite, y bas, z vers l'observateur),
 * puis les MÊMES fonctions que la tête l'éclairent : `normalsOf`, `castShadow`, `ambientOcclusion`, `shadeAt`, `tonesOf`. Aucun éclairage n'est créé ici.
 *
 * Surfaces (z en fraction de la projection de la pointe, `UnderviewModel`) :
 *  · lobule : dôme (`lobuleZ`) · ailes : rampe de `alarTop` à `alarBase` (`alaZ`) — les deux déjà définies et ajustées dans `face/nose/underview.ts` ;
 *  · COLUMELLE comme MASSE : bande entre les narines, de z = 0 au sous-nez à `lobuleRim` à sa jonction avec le lobule, section arrondie. CONSTRUCTION plausible,
 *    NON MESURÉE (aucune référence ne quantifie la columelle vue de dessous : voir docs/NOSE-UNDERVIEW-LIT.md) ;
 *  · narines : cavités (z = projection × (nostril − 0,45)) découpées dans les autres surfaces ; · plan de peau z = 0 qui reçoit les ombres portées.
 * Un lissage de la profondeur (2 passes de moyenne normalisée) raccorde les surfaces : les ailes ne sont plus des plaques à arêtes vives.
 */
export interface UnderviewViewParams { readonly pitchDeg: number; readonly yawDeg?: number; readonly rollDeg?: number; readonly model?: UnderviewModel }
export interface UnderviewRelief { readonly field: ReliefField; readonly grid: Grid; /** 1 sur les pixels de cavité de narine. */ readonly cavity: Uint8Array }
export interface UnderviewLit extends UnderviewRelief { readonly rgba: Uint8ClampedArray; readonly lit: Float32Array; readonly cast: Float32Array; readonly png: Buffer }

/** Pas d'échantillonnage (en pixels de grille) : < 1 pour qu'aucun trou ne subsiste après projection (une rotation ne dilate jamais). */
const STEP = 0.4;

export function underviewRelief(nose: NoseGeometry, view: UnderviewViewParams, ppu = 4): UnderviewRelief {
  const m = view.model ?? UNDERVIEW_MODEL, yaw = view.yawDeg ?? 0, roll = view.rollDeg ?? 0, pv = nose.baseY, P = nose.tip.projectionPx;
  // Cadre : boîte de l'enveloppe projetée (même rotation que `noseView`), élargie de 45 % de la largeur du nez pour recevoir les ombres.
  const nv = noseView(nose, view.pitchDeg, yaw, m, roll), xs = nv.envelope.map((q) => q.x), ys = nv.envelope.map((q) => q.y), mg = 0.45 * nose.widthPx;
  const g: Grid = { x0: Math.min(...xs) - mg, y0: Math.min(...ys) - mg, ppu, w: Math.ceil((Math.max(...xs) - Math.min(...xs) + 2 * mg) * ppu), h: Math.ceil((Math.max(...ys) - Math.min(...ys) + 2 * mg) * ppu) };
  const depth = new Float32Array(g.w * g.h).fill(-Infinity), region = new Uint8Array(g.w * g.h), cavity = new Uint8Array(g.w * g.h);
  const nostrils: Poly[] = [nose.nostrils.left.poly, nose.nostrils.right.poly];
  const inNostril = (x: number, y: number): boolean => inPoly(nostrils[0]!, x, y) || inPoly(nostrils[1]!, x, y);
  const splat = (x: number, y: number, z: number, reg: number, cav = 0): void => {
    const q = rotateProject3({ x, y, z }, pv, view.pitchDeg, yaw, roll), i = Math.floor((q.x - g.x0) * ppu), j = Math.floor((q.y - g.y0) * ppu);
    if (i < 0 || j < 0 || i >= g.w || j >= g.h) return;
    const k = j * g.w + i; if (q.z > depth[k]!) { depth[k] = q.z; region[k] = reg; cavity[k] = cav; }
  };
  const fill = (poly: Poly | null, box: { x: number; y: number; w: number; h: number }, z: (x: number, y: number) => number, reg: number, skipNostril: boolean, cav = 0): void => {
    const st = STEP / ppu;
    for (let y = box.y; y <= box.y + box.h; y += st) for (let x = box.x; x <= box.x + box.w; x += st) {
      if (poly && !inPoly(poly, x, y)) continue;
      if (skipNostril && inNostril(x, y)) continue;
      splat(x, y, z(x, y), reg, cav);
    }
  };
  // 1 · plan de peau z = 0 (reçoit les ombres) · 2 · lobule · 3 · ailes · 4 · columelle · 5 · cavités
  const hw = nose.widthPx;
  fill(null, { x: -2.0 * hw, y: nose.tip.c.y - 1.6 * hw, w: 4.0 * hw, h: nose.baseY - nose.tip.c.y + 2.8 * hw }, () => 0, REGION.cheek, true);
  fill(nose.tip.poly, polyBox(nose.tip.poly), (x, y) => lobuleZ(nose, m, x, y), REGION.nose, true);
  for (const side of [-1, 1] as const) { const a = side === 1 ? nose.alae.right : nose.alae.left; fill(a.poly, polyBox(a.poly), (_x, y) => alaZ(nose, side, m, y), REGION.nose, true); }
  const col = nose.regions.columella;
  fill(col.poly, polyBox(col.poly), (x, y) => {
    const t = Math.min(1, Math.max(0, (y - col.topY) / Math.max(1e-6, col.bottomY - col.topY))), s = 1 - t * t * (3 - 2 * t);   // 1 à la jonction lobule, 0 au sous-nez
    const round = 1 - 0.35 * Math.min(1, (x / Math.max(1e-6, col.half)) ** 2);                                                  // section arrondie
    return P * m.lobuleRim * s * round;
  }, REGION.nose, true);
  for (const poly of nostrils) fill(poly, polyBox(poly), () => P * (m.nostril - 0.45), REGION.nose, false, 1);
  despeckle(g, depth, cavity, 0.12 * P);
  smoothDepth(g, depth, 2);
  const n = normalsOf(g, depth);
  return { field: { x0: g.x0, y0: g.y0, ppu, w: g.w, h: g.h, depth, nx: n.nx, ny: n.ny, nz: n.nz, region }, grid: g, cavity };
}

/**
 * Retire les pixels « trous » : un pixel hors cavité plus bas que la médiane de ses 8 voisins de plus de `tol` est un trou d'échantillonnage (le plan de peau qui
 * transparaît entre deux surfaces qui se touchent), pas une surface. Il prend la médiane. Les cavités de narine sont protégées.
 */
function despeckle(g: Grid, depth: Float32Array, cavity: Uint8Array, tol: number): void {
  const src = depth.slice(), buf: number[] = [];
  for (let y = 1; y < g.h - 1; y++) for (let x = 1; x < g.w - 1; x++) {
    const k = y * g.w + x; if (src[k] === -Infinity || cavity[k]) continue;
    buf.length = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (dx === 0 && dy === 0) continue; const v = src[k + dy * g.w + dx]!; if (v !== -Infinity) buf.push(v); }
    if (buf.length < 5) continue;
    buf.sort((a, b) => a - b); const med = buf[buf.length >> 1]!;
    if (src[k]! < med - tol) depth[k] = med;
  }
}

/** Moyenne 3×3 normalisée (les pixels vides ne contribuent pas et ne sont pas remplis) : raccorde les surfaces sans mordre sur la silhouette. */
function smoothDepth(g: Grid, depth: Float32Array, passes: number): void {
  for (let p = 0; p < passes; p++) {
    const src = depth.slice();
    for (let y = 1; y < g.h - 1; y++) for (let x = 1; x < g.w - 1; x++) {
      const k = y * g.w + x; if (src[k] === -Infinity) continue;
      let s = 0, c = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const v = src[k + dy * g.w + dx]!; if (v !== -Infinity) { s += v; c++; } }
      depth[k] = s / c;
    }
  }
}

/** Éclaire la vue de dessous avec le `LightModel` de la tête : ombre portée, AO, tons de la peau de l'hôte, lumière de contour. Même formules que `headLit`. */
export function litUnderview(nose: NoseGeometry, view: UnderviewViewParams, skin: string, model: LightModel, o: { ppu?: number; ao?: number } = {}): UnderviewLit {
  const rel = underviewRelief(nose, view, o.ppu ?? 4), { field: f, grid: g, cavity } = rel, hw = nose.widthPx;
  const cast = castShadow(g, f.depth, model.dir, { reach: 0.55 * hw, penumbra: 0.14 + 0.6 * model.soft }), ao = ambientOcclusion(g, f.depth, 0.12 * hw, 0.25 * hw), tones = tonesOf(skin, model);
  const N = g.w * g.h, rgba = new Uint8ClampedArray(N * 4), lit = new Float32Array(N), aoK = o.ao ?? 0.55, base = parseHex(skin), rc = parseHex(model.rimColor), lc = parseHex(model.color);
  for (let k = 0; k < N; k++) {
    if (f.depth[k] === -Infinity) continue;
    const s = shadeAt(model, { x: f.nx[k]!, y: f.ny[k]!, z: f.nz[k]! }, cast[k]!, Math.min(1, ao[k]! * aoK * (cavity[k] ? 1.8 : 1)));
    lit[k] = s.lit;
    for (let c = 0; c < 3; c++) {
      const m0 = tones.shadowMul[c]! + (tones.lightMul[c]! - tones.shadowMul[c]!) * s.lit, m1 = m0 + (tones.coreMul[c]! - m0) * s.core;
      const a = Math.min(1, s.rim * 0.9 + s.spec * 0.5), screen = (rc[c]! * s.rim * 0.9 + lc[c]! * s.spec * 0.5) / Math.max(1e-3, s.rim * 0.9 + s.spec * 0.5);
      rgba[k * 4 + c] = Math.min(255, base[c]! * m1 * (1 - a) + screen * a);
    }
    rgba[k * 4 + 3] = 255;
  }
  return { ...rel, rgba, lit, cast, png: encodePngRgba(g.w, g.h, rgba) };
}

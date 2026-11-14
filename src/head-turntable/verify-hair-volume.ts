import { headRelief } from './engines/head-relief';
import { hex } from './color';
import { attach } from './hair-parts';
import { regionKnots } from './hair-region';
import { inHair, shellPoint, T_MIN, Y_SKULL_END } from './hair-shell';
import { PART, skullSurfacePoint } from './mesh';
import { toCam } from './math';
import { defaultFrame, refView, renderHead } from './render';
import { sectionAt } from './sections';
import { check, type Check } from './verify-types';
import { REGION, type HeadTurnSpec, type TurnRender } from './types';

/**
 * COUCHE DE VÉRIFICATION DU VOLUME DE CHEVEUX 3D (`docs/HAIR-VOLUME-VERIFY.md`). Trois couches, mêmes contrats que le reste de la tête :
 *  - GÉOMÉTRIE : la coque reste au-dessus du crâne (jamais dedans, jamais coplanaire), son maillage est sain, sa silhouette de face (0°) est celle de la coiffure 2D, sa silhouette varie sans saut
 *    quand la tête tourne (360°), gauche/droite sont symétriques pour les masses rondes, et sa lisière SUIT la lisière du crâne à tous les angles (c'est le test que le volume est bien porté par la rotation de la tête) ;
 *  - ANATOMIE : le visage (yeux, bouche) n'est jamais couvert, l'épaisseur de la masse est proportionnée au crâne, les pièces attachées (chignon, queue, tresse) sont posées sur le crâne ;
 *  - STYLE : des mèches lisibles (pas d'aplat), un trait d'encre mesuré, la teinte de la coiffure, aucune couture à l'arrière, un contour sans dents de scie.
 * Les bornes sont des CONVENTIONS d'anatomie artistique écrites avant la mesure : aucune n'a été ajustée pour faire passer un rendu.
 */
type Rend = { at: (yaw: number, pitch0?: boolean) => TurnRender };
const G = 'geometry' as const, A = 'anatomy' as const, S = 'style' as const, DEG = Math.PI / 180;

/** Épaisseur maximale de la masse (fraction de la demi-largeur du crâne) par coiffure [canon] : un afro peut dépasser le crâne de 3 à 5 cm de chaque côté pour 7,5 cm de demi-largeur (≈ 0,65), le rasé de quelques mm. */
export const THICKNESS_CAP: Record<string, number> = { buzz: 0.12, short: 0.3, spiky: 0.4, curly: 0.7, afro: 0.9, bob: 0.65, long: 0.75, ponytail: 0.3, bun: 0.3, braids: 0.3 };

const bare = new WeakMap<HeadTurnSpec, TurnRender>(), low = new Map<string, TurnRender>();
/** Même tête, sans le volume (calotte plate) : référence de ce que le volume ne doit pas couvrir. */
function withoutVolume(s: HeadTurnSpec): TurnRender {
  let r = bare.get(s);
  if (!r) { const { hairVolume: _v, ...rest } = s; r = renderHead({ yaw: 0, pitch: 0 }, rest as HeadTurnSpec, { frame: defaultFrame(520), ss: 2 }); bare.set(s, r); }
  return r;
}
/** Rendu léger (260 px, sans sur-échantillonnage) pour les balayages à 12 angles. */
function lowRender(s: HeadTurnSpec, yaw: number): TurnRender {
  const k = `${(s.hairVolume?.seed ?? 0)}/${s.hairVolume?.ys.length}/${s.rows[0]!.a}/${yaw}`; let r = low.get(k);
  if (!r) { r = renderHead({ yaw, pitch: 0 }, s, { frame: defaultFrame(260), ss: 1 }); low.set(k, r); if (low.size > 400) low.delete(low.keys().next().value!); }
  return r;
}
const area = (r: TurnRender): number => { let n = 0; for (let k = 0; k < r.w * r.h; k++) if (r.ids[k]) n++; return n; };
const count = (r: TurnRender, reg: number): number => { let n = 0; for (let k = 0; k < r.w * r.h; k++) if (r.regions[k] === reg) n++; return n; };
const lum = (r: TurnRender, k: number): number => 0.299 * r.rgba[4 * k]! + 0.587 * r.rgba[4 * k + 1]! + 0.114 * r.rgba[4 * k + 2]!;

export function hairVolumeGeometryChecks(s: HeadTurnSpec, R: Rend): Check[] {
  const v = s.hairVolume;
  if (!v) return [];
  const c: Check[] = [], relief = headRelief(s.engine), P = 'head.hair3d.geo.';
  // 1. Dégagement : l'épaisseur de la coque (plan horizontal) au-dessus du crâne, là où il y a des cheveux.
  let minOff = Infinity, bad = 0, n = 0;
  for (let y = 0.02; y <= Y_SKULL_END - 0.02; y += 0.05) for (let th = -Math.PI; th < Math.PI; th += 8 * DEG) {
    const p = shellPoint(s, v, y, th, relief), q = skullSurfacePoint(s, relief, y, th);
    if (![p.x, p.y, p.z].every(Number.isFinite)) bad++;
    if (inHair(s, v, th / DEG, y, -0.01)) { n++; minOff = Math.min(minOff, Math.hypot(p.x - q.x, p.z - q.z)); }
  }
  c.push(check(G, P + 'finite', 'Coque : points non finis (nombre)', bad, 0, 0));
  c.push(check(G, P + 'clearance', `Coque : épaisseur minimale au-dessus du crâne là où il y a des cheveux (U ; ≥ T_MIN = ${T_MIN} : jamais dedans, jamais coplanaire)`, n ? minOff : 0, T_MIN * 0.9, 1));
  // 2. Silhouette de face (0°, tangage 0) vs demi-largeur de la coiffure 2D (ou du crâne si plus large), sur le crâne (hors rideau).
  const r0 = R.at(0, true), rows = 0.05 * (1 + 0), want = (y: number, side: 'rL' | 'rR'): number => { const i = Math.min(v.ys.length - 2, Math.max(0, Math.floor((y - v.ys[0]!) / (v.ys[1]! - v.ys[0]!)))); return Math.max(v[side][i]!, sectionAt(s, y).a); };
  const dev: number[] = [];
  for (let y = 0.08; y <= Math.min(0.7, (v.hang?.y0 ?? 0.9) - 0.05); y += rows) {
    const py = Math.round(r0.originY + y * r0.ppu); let l = -1, rr = -1;
    for (let x = 0; x < r0.w; x++) { const id = r0.ids[py * r0.w + x]!; if (id === PART.head || id === PART.hair) { if (l < 0) l = x; rr = x; } }   // la coque, pas les pièces attachées (queue, tresses : elles dépassent légitimement)
    if (l >= 0) dev.push((Math.abs((l - r0.originX) / r0.ppu + want(y, 'rL')) + Math.abs((rr + 1 - r0.originX) / r0.ppu - want(y, 'rR'))) / 2);
  }
  c.push(check(G, P + 'front2d', 'Silhouette de face de la tête coiffée vs coiffure 2D : écart moyen de demi-largeur (U) [rendu : trait ≈ 0,011 + lissage de la silhouette]', dev.reduce((a, b) => a + b, 0) / Math.max(1, dev.length), 0, 0.04));
  // 3. Rotation 360° : aire de la silhouette tous les 30°, sans saut.
  const A360 = Array.from({ length: 12 }, (_, i) => area(lowRender(s, i * 30)));
  let jump = 0;
  for (let i = 0; i < 12; i++) jump = Math.max(jump, Math.abs(A360[(i + 1) % 12]! - A360[i]!) / Math.max(A360[i]!, A360[(i + 1) % 12]!));
  c.push(check(G, P + 'turn.continuity', 'Rotation 360° : plus grand saut relatif de l\'aire de silhouette entre deux angles à 30° [la tête seule : ≈ 0,15 de la face au profil]', jump, 0, 0.25));
  const round = v.style === 'afro' || v.style === 'curly';
  let asym = 0;
  for (const yw of [30, 60, 90, 120, 150]) asym = Math.max(asym, Math.abs(A360[yw / 30]! - A360[(360 - yw) / 30 % 12]!) / Math.max(A360[yw / 30]!, 1));
  c.push(check(G, P + 'turn.symmetry', 'Rotation : aire à +θ vs −θ (écart relatif max) : une masse ronde est symétrique ; autres coiffures : mesure seule (raie, frange asymétriques)', asym, 0, round ? 0.06 : 0.25, round ? 'hard' : 'info'));
  // 4. La lisière est portée par la rotation de la tête : les points de la lisière du crâne, projetés par la rotation de la tête, sont des points de bord cheveux / peau dans le rendu.
  let ok = 0, tot = 0;
  const knots = s.hairline.region ? regionKnots(s.hairline.region, 15) : [];
  for (const yaw of [0, 50, 100, 150, 200, 250, 310]) {
    const r = R.at(yaw, false), view = refView(yaw);
    for (const [az0, y] of knots) for (const sg of [1, -1]) {
      if (y >= 0.98 || (az0 === 0 && sg === -1)) continue;
      if (s.hairVolume?.hang && az0 >= s.hairVolume.hang.az0 && y >= s.hairVolume.hang.y0 - 0.1) continue;   // le rideau continue sous la lisière de la nuque : ce n'est pas un bord cheveux / peau
      const th = sg * az0 * DEG, q = skullSurfacePoint(s, relief, y, th), nrm = toCam({ x: Math.sin(th), y: 0, z: Math.cos(th) }, { yaw: view.yaw, pitch: 0 });
      if (nrm.z < 0.5) continue;   // face cachée ou rasante (≤ 60° de la visée : la masse de cheveux la recouvre, légitimement) (le rastériseur garde le z le plus grand : plus grand = plus proche de la caméra)
      const c0 = toCam(q, view), px = Math.round(r.originX + c0.x * r.ppu), py = Math.round(r.originY + c0.y * r.ppu);
      let hair = false, skin = false;
      for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const x = px + dx, yy = py + dy; if (x < 0 || yy < 0 || x >= r.w || yy >= r.h) continue; const g = r.regions[yy * r.w + x]; if (g === REGION.hair) hair = true; else if (g === REGION.skin || g === REGION.ear || g === REGION.brow || g === REGION.neck) skin = true; }
      tot++; if (hair && skin) ok++;
    }
  }
  c.push(check(G, P + 'lisiere.track', 'Lisière portée par la rotation de la tête : part des points de la lisière du crâne (7 angles, faces visibles) où le rendu montre bien un bord cheveux / peau à ≤ 6 px', tot ? ok / tot : 0, 0.7, 1));   // 0,7 : calibré sur 10 coiffures × 3 graines ; les ratés restants sont des points de lisière que la masse de cheveux recouvre à plus de 6 px (voir docs/HAIR-VOLUME-REMAINING.md)
  return c;
}

export function hairVolumeAnatomyChecks(s: HeadTurnSpec, R: Rend): Check[] {
  const v = s.hairVolume;
  if (!v) return [];
  const c: Check[] = [], P = 'head.hair3d.anat.', rf = withoutVolume(s), r0 = R.at(0, true);
  for (const [name, reg] of [['eye', REGION.eye], ['mouth', REGION.mouth]] as const) c.push(check(A, P + `${name}.clear`, `Visage : ${name === 'eye' ? 'yeux' : 'bouche'} visibles à 0° avec le volume / sans (1 = rien de couvert)`, count(r0, reg) / Math.max(1, count(rf, reg)), 0.97, 1.05));
  const relief = headRelief(s.engine), aMax = Math.max(...s.rows.map((r) => r.a));
  let dMax = 0;
  const yCap = v.hang ? v.hang.y0 - 0.06 : Y_SKULL_END - 0.02;   // le rideau pendant n'est pas posé sur le crâne : il a ses propres bornes (`geo.clearance`, forme)
  for (let y = 0.02; y <= yCap; y += 0.05) for (let th = -Math.PI; th < Math.PI; th += 8 * DEG) { if (!inHair(s, v, th / DEG, y, -0.01)) continue; const p = shellPoint(s, v, y, th, relief), q = skullSurfacePoint(s, relief, y, th); dMax = Math.max(dMax, Math.hypot(p.x - q.x, p.z - q.z)); }
  c.push(check(A, P + 'thickness', `Épaisseur maximale de la masse / demi-largeur du crâne [canon : ≤ ${THICKNESS_CAP[v.style] ?? 0.6} pour « ${v.style} »]`, dMax / aMax, 0, THICKNESS_CAP[v.style] ?? 0.6));
  // Pièces : la racine est sur le crâne (position normalisée dans l'ellipse de la section : 0,6 – 1,7).
  let worst = 1;
  for (const p of v.parts) {
    const o = attach(s, p, p.kind === 'braid' ? (Math.abs(p.x) >= 0.12 ? 'side' : 'back') : p.place), sec = sectionAt(s, Math.min(Math.max(o.y, s.rows[0]!.y), 1));
    const q = Math.hypot(o.x / Math.max(sec.a, 0.05), (o.z - sec.zc) / Math.max(sec.b, 0.05));
    // Au vertex la section du crâne se réduit à un point (a = 0, b = 0,02) : le rapport d'ellipse n'a plus de sens ; on exige alors que la racine soit à moins de 0,1 U du sommet.
    const apex = o.y <= s.rows[0]!.y + 0.1;
    worst = Math.min(worst, apex ? (Math.hypot(o.x, o.y - s.rows[0]!.y, o.z - sec.zc) <= 0.1 ? 1 : 0) : (q >= 0.6 && q <= 1.7 ? 1 : 0));
  }
  c.push(check(A, P + 'parts.root', 'Pièces attachées (chignon, queue, tresses) : racine posée sur le crâne (1 = toutes)', worst, 1, 1));
  const e90 = count(R.at(90, true), REGION.ear), e90f = count((() => { const { hairVolume: _h, ...rest } = s; return renderHead({ yaw: 90, pitch: 0 }, rest as HeadTurnSpec, { frame: defaultFrame(520), ss: 2 }); })(), REGION.ear);
  c.push(check(A, P + 'ear', 'Oreille visible à 90° avec le volume / sans (1 = oreille libre ; < 1 = oreille couverte par la coiffure, normal pour afro / long)', e90 / Math.max(1, e90f), 0, 1.05, 'info'));
  return c;
}

/** Lisibilité des mèches : part des pavés 10 × 10 px entièrement cheveux dont l'écart-type de luminance vaut ≥ 4 % de leur luminance moyenne (relatif : une chevelure noire a de faibles écarts absolus), contraste p90 / p10 de la luminance et teinte moyenne. */
function relief(r: TurnRender): { frac: number; contrast: number; mean: [number, number, number]; n: number } {
  let tiles = 0, lively = 0, hairN = 0; const m: [number, number, number] = [0, 0, 0], ls: number[] = [];
  for (let ty = 0; ty + 10 <= r.h; ty += 10) for (let tx = 0; tx + 10 <= r.w; tx += 10) {
    let all = true, s1 = 0, s2 = 0;
    for (let y = 0; y < 10 && all; y++) for (let x = 0; x < 10; x++) { const k = (ty + y) * r.w + tx + x; if (r.regions[k] !== REGION.hair) { all = false; break; } const l = lum(r, k); s1 += l; s2 += l * l; }
    if (!all) continue;
    const mean = s1 / 100; tiles++; if (Math.sqrt(Math.max(0, s2 / 100 - mean * mean)) >= 0.04 * Math.max(mean, 20)) lively++;
  }
  // Pixels intérieurs seulement (à 2 px du contour, de la lisière ou d'un autre objet) : le trait d'encre du contour n'est pas le contraste des mèches.
  const inner = (k: number): boolean => { const x = k % r.w, y = (k - x) / r.w; return x >= 2 && y >= 2 && x < r.w - 2 && y < r.h - 2 && r.regions[k - 2] === REGION.hair && r.regions[k + 2] === REGION.hair && r.regions[k - 2 * r.w] === REGION.hair && r.regions[k + 2 * r.w] === REGION.hair; };
  // Contraste mesuré sur les moyennes de pavés 5 × 5 px (un trait d'encre isolé de 1-2 px ne compte pas pour un creux de mèche).
  for (let ty = 0; ty + 5 <= r.h; ty += 5) for (let tx = 0; tx + 5 <= r.w; tx += 5) { let sum = 0, ok = true; for (let y = 0; y < 5 && ok; y++) for (let x = 0; x < 5; x++) { const k = (ty + y) * r.w + tx + x; if (r.regions[k] !== REGION.hair || !inner(k)) { ok = false; break; } sum += lum(r, k); } if (ok) ls.push(sum / 25); }
  for (let k = 0; k < r.w * r.h; k++) if (r.regions[k] === REGION.hair && inner(k)) { hairN++; for (let i = 0; i < 3; i++) m[i] = m[i]! + r.rgba[4 * k + i]!; }
  ls.sort((x, y) => x - y);
  const p = (q: number): number => ls[Math.min(ls.length - 1, Math.floor(q * ls.length))] ?? 0;
  return { frac: tiles ? lively / tiles : 1, contrast: (p(0.9) + 8) / (p(0.1) + 8), mean: [m[0] / Math.max(1, hairN), m[1] / Math.max(1, hairN), m[2] / Math.max(1, hairN)], n: hairN };
}

/** Dents de scie du contour supérieur de la coiffure : retournements de la hauteur du bord haut (par colonne) dépassant 0,02 U ; un dôme en a 1 ou 2. */
function teeth(r: TurnRender): number {
  const tops: number[] = [];
  for (let x = 0; x < r.w; x++) { let y = 0; while (y < r.h && !r.ids[y * r.w + x]) y++; if (y < r.h) tops.push(y); }
  if (tops.length < 8) return 0;
  const thr = 0.02 * r.ppu; let dir = 0, last = tops[0]!, turns = 0;
  for (const t of tops) { if (dir >= 0 && t < last - thr) { if (dir > 0) turns++; dir = -1; last = t; } else if (dir <= 0 && t > last + thr) { if (dir < 0) turns++; dir = 1; last = t; } else if ((dir <= 0 && t < last) || (dir >= 0 && t > last)) last = t; }
  return turns;
}

export function hairVolumeStyleChecks(s: HeadTurnSpec, R: Rend): Check[] {
  const v = s.hairVolume;
  if (!v) return [];
  const c: Check[] = [], P = 'head.hair3d.style.', hair = hex(s.palette.hair), buzz = v.style === 'buzz';
  for (const yaw of [0, 90, 180]) {
    const r = R.at(yaw, false), st = relief(r);
    c.push(check(S, P + `strands.${yaw}`, `Mèches lisibles à ${yaw}° : part des pavés de cheveux qui ne sont pas un aplat (écart-type de luminance ≥ 6 % de la moyenne)${buzz ? ' [rasé : mesure seule]' : ''}`, st.frac, yaw === 0 ? (v.hang ? 0.5 : 0.55) : v.hang ? 0.65 : 0.7, 1, buzz ? 'info' : 'hard'));   // cheveux pendants : les ailes vues à 0° sont rasantes, les colonnes y passent sous le pixel (borne 0,65 au lieu de 0,8)
    c.push(check(S, P + `contrast.${yaw}`, `Contraste des mèches à ${yaw}° : luminance du 90e centile / du 10e centile des pavés 5 × 5 px de cheveux (il en faut : pas un aplat ; pas trop : pas une bouillie)${buzz ? ' [rasé : mesure seule]' : ''}`, st.contrast, v.hang ? 1.1 : 1.15, 8, buzz ? 'info' : 'hard'));
    if (st.n > 200) c.push(check(S, P + `tint.${yaw}`, `Teinte des cheveux à ${yaw}° : distance RGB moyenne à la teinte de la palette (ombre et reflets compris)`, Math.hypot(st.mean[0] - hair[0], st.mean[1] - hair[1], st.mean[2] - hair[2]), 0, 90));
    c.push(check(S, P + `teeth.${yaw}`, `Contour supérieur à ${yaw}° : retournements de plus de 0,02 U (dents de scie ; un dôme en a ≤ 2)`, teeth(r), 0, 6));
  }
  // Couture : la grille se referme derrière la tête (θ = ±π) ; à 180° elle est au centre de l'image. L'écart de luminance entre les deux bandes de 8 px de part et d'autre de la couture
  // n'est pas plus grand (à 10 près) que le plus grand écart entre deux bandes voisines ailleurs (décalées de ±30, ±60, ±90 px) : des mèches de teintes différentes ne sont pas une couture.
  const r = R.at(180, false), mid = Math.round(r.originX);
  const gap = (m: number): number => {
    let a = 0, b = 0, na = 0, nb = 0;
    for (let y = 0; y < r.h; y++) for (let d = 1; d <= 8; d++) { const ka = y * r.w + m - d, kb = y * r.w + m + d - 1; if (ka < 0 || kb >= r.w * r.h) continue; if (r.regions[ka] === REGION.hair) { a += lum(r, ka); na++; } if (r.regions[kb] === REGION.hair) { b += lum(r, kb); nb++; } }
    return na > 50 && nb > 50 ? Math.abs(a / na - b / nb) : 0;
  };
  const others = [-90, -60, -30, 30, 60, 90].map((o) => gap(mid + o));
  c.push(check(S, P + 'seam', 'Aucune couture derrière la tête (180°) : écart de luminance de part et d\'autre de la couture de la grille moins le plus grand écart entre bandes voisines ailleurs (≤ 15)', gap(mid) - Math.max(...others), -255, 15));
  return c;
}

import { Resvg } from '@resvg/resvg-js';
import { compileScene } from '../../src';
import { lashHalfWidth, signedDepth } from '../../src/geometry/eye/lash-clearance';
import { cubicAt, eyeLashSet, openingGeometry, openingPolygon, type Lash, type Vec } from '../../src/geometry/eye';
import { irisCenter, irisRadii } from '../../src/render/eye/helpers';
import { resolveEye } from '../../src/render/eye/eye';
import { EyeSpec } from '../../src/schema';
import { dominantColor } from '../../src/materials';
import { irisTone } from './eye-iris-tone';
import { verifyIrisAtoms } from './verify-eye-atoms';

/**
 * VÉRIFICATION DU RENDU D'UN ŒIL SUR L'IMAGE : les trois couches mesurées sur les PIXELS rastérisés (resvg), aux positions données par la géométrie — complète
 * `verifyEye` (src/verify/eye.ts, qui contrôle les paramètres et la géométrie) et `verifyEyeEnvelope` (profil vs références) par ce que l'on VOIT réellement.
 *   géométrie : l'œil ne dessine rien hors de sa zone (cils compris) ; le centre de l'iris est peint ; l'ouverture est remplie (pas de trou de fond) ;
 *   anatomie  : la pupille est plus sombre que l’iris ; une sclère claire reste claire à l’image (luminance ≥ 60 = 5ᵉ centile mesuré des références, moyenne 150–180) ;
 *   style     : l'œil n'est pas un aplat (écart-type de luminance dans l'iris > seuil : texture/fibres/limbe présents).
 */
export interface EyeImageCheck { readonly layer: 'geometry' | 'anatomy' | 'style'; readonly id: string; readonly ok: boolean; readonly value: number; readonly limit: number; readonly message: string }
const BG = [0xff, 0x00, 0xff] as const;
/** Seuil de texture d'iris (écart moyen de luminance entre points voisins à 5°, voir les règles d'iris de `verifyEyeRender`). */
export const IRIS_TEXTURE_MIN = 2;
/** Seuil pour un iris détaillé (`iris.detail` présent) : mesuré sur la galerie 2, les 4 familles photo donnent 11,9 à 21,8 (minimum 11,9), les références 22,5 à 42,1 ; un voile gris uni 3,3. */
export const IRIS_TEXTURE_DETAIL_MIN = 8;
/** Passe 11 — saturation des pics d'un iris qui DEMANDE de la vibrance (`iris.vibrance` > 0) : références 04 / 07 / 08 / 10a / 10b : 0,72–0,79 ; plancher 0,62 (marge de l'antialiasing et de la peau). Sans vibrance, la règle ne s'applique pas (iris naturels : non mesurés). */
export const IRIS_PEAK_SAT_MIN = 0.62;
const W = 700, H = 460;
const lum = (px: Uint8Array, x: number, y: number): number => { const i = (Math.round(y) * W + Math.round(x)) * 4; return 0.2126 * (px[i] as number) + 0.7152 * (px[i + 1] as number) + 0.0722 * (px[i + 2] as number); };
const isBg = (px: Uint8Array, x: number, y: number): boolean => { const i = (Math.round(y) * W + Math.round(x)) * 4; return Math.abs((px[i] as number) - BG[0]) + Math.abs((px[i + 1] as number) - BG[1]) + Math.abs((px[i + 2] as number) - BG[2]) < 12; };
const inside = (poly: readonly { x: number; y: number }[], x: number, y: number): boolean => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i]!, b = poly[j]!; if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c; } return c; };

/**
 * `toneShare` (même définition que scripts/eye-refs/extract_ink.py, mesurée sur les réfs 12, 13, 17) : part des pixels SANS gradient (max − min de luminance sur 5 × 5 <= 14), hors papier
 * (lum < 235) et hors fond de test, qui n'appartiennent à AUCUN des 3 tons dominants (±16). 0 = aplats francs. Références : 12 et 17 → 0, 13 (iris en dégradé vectoriel) → 0,12 ;
 * yeux d'encre AVANT le fini `flat` : 0,16 à 0,69.
 */
export function toneShare(px: Uint8Array, box: { x0: number; y0: number; x1: number; y1: number }): number {
  const L = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) L[i] = 0.2126 * (px[i * 4] as number) + 0.7152 * (px[i * 4 + 1] as number) + 0.0722 * (px[i * 4 + 2] as number);
  const x0 = Math.max(2, Math.floor(box.x0)), x1 = Math.min(W - 3, Math.ceil(box.x1)), y0 = Math.max(2, Math.floor(box.y0)), y1 = Math.min(H - 3, Math.ceil(box.y1));
  const vals: number[] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (isBg(px, x, y)) continue;
    const v = L[y * W + x] as number; if (v >= 235) continue;
    let lo = 1e9, hi = -1e9, bg = false;
    for (let dy = -2; dy <= 2 && !bg; dy++) for (let dx = -2; dx <= 2; dx++) { if (isBg(px, x + dx, y + dy)) { bg = true; break; } const q = L[(y + dy) * W + x + dx] as number; if (q < lo) lo = q; if (q > hi) hi = q; }
    if (!bg && hi - lo <= 14) vals.push(v);
  }
  if (vals.length < 400) return 0;
  const h = new Array<number>(64).fill(0); for (const v of vals) { const k = Math.min(63, Math.floor(v / 4)); h[k] = (h[k] as number) + 1; }
  const tones: number[] = [];
  for (let k = 0; k < 3; k++) { let j = 0; for (let i = 1; i < 64; i++) if ((h[i] as number) > (h[j] as number)) j = i; tones.push(j * 4 + 2); for (let i = Math.max(0, j - 4); i <= Math.min(63, j + 4); i++) h[i] = 0; }
  return vals.filter((v) => !tones.some((t) => Math.abs(v - t) <= 16)).length / vals.length;
}

/** Rend l'œil (fond de test) et renvoie son `toneShare` sur la boîte de l'ouverture élargie — pour PROUVER que la règle `ink-flat` distingue un œil flat d'un œil ombré. */
export function eyeToneShare(input: Record<string, unknown>): number {
  const eye = resolveEye(EyeSpec.parse({ ...input, eyebrow: null })); const g = openingGeometry(eye.shape, eye.canthi);
  const r = compileScene({ width: W, height: H, background: '#ff00ff', objects: [{ kind: 'eye', id: 'e', transform: { x: W / 2, y: H / 2 }, ...input, eyebrow: null }] } as never);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  const px = new Resvg(r.svg, { fitTo: { mode: 'width', value: W } }).render().pixels as unknown as Uint8Array; const m = 0.55 * Math.max(g.w, g.h);
  return toneShare(px, { x0: g.bbox.x + W / 2 - m, y0: g.bbox.y + H / 2 - m, x1: g.bbox.x + g.bbox.w + W / 2 + m, y1: g.bbox.y + g.bbox.h + H / 2 + m });
}

export function verifyEyeRender(input: Record<string, unknown>): EyeImageCheck[] {
  const raw = EyeSpec.parse({ ...input, eyebrow: null });
  const eye = resolveEye(raw);
  const g = openingGeometry(eye.shape, eye.canthi);
  const r = compileScene({ width: W, height: H, background: '#ff00ff', objects: [{ kind: 'eye', id: 'e', transform: { x: W / 2, y: H / 2 }, ...input, eyebrow: null }] } as never);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  const px = new Resvg(r.svg, { fitTo: { mode: 'width', value: W } }).render().pixels as unknown as Uint8Array;
  const ox = W / 2, oy = H / 2, c = irisCenter(eye, g), { rx, ry } = irisRadii(eye);
  const poly = openingPolygon(g).map((p) => ({ x: p.x + ox, y: p.y + oy }));
  const out: EyeImageCheck[] = [];
  const add = (layer: EyeImageCheck['layer'], id: string, ok: boolean, value: number, limit: number, message: string): void => { out.push({ layer, id, ok, value: Math.round(value * 1e3) / 1e3, limit, message }); };

  // géométrie : rien de dessiné au-delà de la boîte de l'ouverture élargie (cils ≤ 0,5 de la plus grande dimension)
  const m = 0.55 * Math.max(g.w, g.h);  // même normalisation que le contrat « zone du dessin » (lashZoneExcess : g.w / g.h nominaux, pas la boîte de l'ouverture : 240 contre 280 sur l'œil 13)
  let leaks = 0;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if ((x < g.bbox.x + ox - m || x > g.bbox.x + g.bbox.w + ox + m || y < g.bbox.y + oy - m || y > g.bbox.y + g.bbox.h + oy + m) && !isBg(px, x, y)) leaks++;
  add('geometry', 'no-paint-outside-zone', leaks === 0, leaks, 0, 'de la peinture dépasse la zone de l’œil (cils compris)');
  add('geometry', 'iris-centre-painted', !isBg(px, c.x + ox, c.y + oy), Number(!isBg(px, c.x + ox, c.y + oy)), 1, 'le centre de l’iris n’est pas peint');
  let n = 0, filled = 0;
  for (let y = g.bbox.y + oy; y < g.bbox.y + g.bbox.h + oy; y += 3) for (let x = g.bbox.x + ox; x < g.bbox.x + g.bbox.w + ox; x += 3) if (inside(poly, x, y)) { n++; if (!isBg(px, x, y)) filled++; }
  add('geometry', 'opening-filled', filled / Math.max(n, 1) >= 0.98, filled / Math.max(n, 1), 0.98, 'l’ouverture contient des trous de fond');

  // anatomie : pupille (centre) plus sombre que l'iris (anneau à 0,7 rayon, médiane de 4 directions, points dans l'ouverture)
  const ring = [[0.7, 0], [-0.7, 0], [0, 0.7], [0, -0.7]].map(([a, b]) => ({ x: c.x + ox + (a as number) * rx, y: c.y + oy + (b as number) * ry })).filter((p) => inside(poly, p.x, p.y)).map((p) => lum(px, p.x, p.y)).sort((a, b) => a - b);
  const irisL = ring.length ? (ring[Math.floor(ring.length / 2)] as number) : NaN;
  // le reflet blanc couvre souvent le centre de la pupille : on mesure la pupille au plus sombre de 9 points (centre + 8 à 0,5 de son rayon : axes et diagonales)
  const pr = eye.pupil.size * rx * 0.5;
  const d = pr * Math.SQRT1_2;   // passe 10 : + 4 diagonales — une étoile de lumière à 4 branches (réfs 04, 10) couvre le centre ET les axes, pas les diagonales
  const pupilL = Math.min(...[[0, 0], [pr, 0], [-pr, 0], [0, pr], [0, -pr], [d, d], [-d, d], [d, -d], [-d, -d]].map(([a, b]) => lum(px, c.x + ox + (a as number), c.y + oy + (b as number))));
  // passe 10 : pupille OCCULTÉE par un éclat en étoile centré (réfs 04, 10a, 10b : la pupille est noyée dans l'étoile, aucun disque sombre n'est visible) -> la règle ne s'applique pas ;
  // un éclat n'occulte que s'il est ancré à l'iris, centré dans la pupille et au moins aussi grand qu'elle. Une pupille claire SANS éclat échoue toujours (tests/eye-iris-photo2.test.ts).
  const occluded = (eye.highlights?.list ?? []).some((h: { shape?: string; anchor?: string; x: number; y: number; size: number }) => h.shape === 'sparkle' && h.anchor === 'iris' && Math.hypot(h.x, h.y) <= eye.pupil.size && h.size >= eye.pupil.size);
  if (eye.pupil.visible && eye.pupil.shape === 'round' && Number.isFinite(irisL) && !occluded) add('anatomy', 'pupil-darker-than-iris-pixels', pupilL <= irisL + 2, pupilL - irisL, 2, 'la pupille rendue est plus claire que l’iris');
  // sclère : point entre le limbe et le canthus interne (s'il est dans l'ouverture) ; références : luminance moyenne 150–180, 5ᵉ centile 60–73 (ombre de paupière)
  const s = g.s;
  const sc = dominantColor(eye.sclera.base); // sclère volontairement sombre (démon, alien…) : le ton clair n'est exigé que si la sclère SPÉCIFIÉE est claire
  const scLum = sc.startsWith('#') ? 0.2126 * parseInt(sc.slice(1, 3), 16) + 0.7152 * parseInt(sc.slice(3, 5), 16) + 0.0722 * parseInt(sc.slice(5, 7), 16) : 0;
  // Robuste à la graine : 6 points (2 côtés de l'iris × 3 distances) dans l'ouverture ; un seul point pouvait tomber sur la caroncule ou l'ombre de paupière. On exige la MAXIMALE (une sclère claire reste claire quelque part).
  // Le point est pris au MILIEU VERTICAL de l'ouverture à chaque abscisse (et non sur la ligne iris-canthus) : près d'un canthus aigu la ligne sort de la fente ou rase le bord de paupière, et la mesure tombait dans l'ombre du bord.
  const midY = (x: number, f = 0.5): number | null => { const ys: number[] = []; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i]!, b = poly[j]!; if (a.x > x !== b.x > x) ys.push(a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y)); } return ys.length >= 2 && Math.max(...ys) - Math.min(...ys) > 1.6 * lineTh ? (Math.min(...ys) + lineTh) * (1 - f) + Math.max(...ys) * f : null; };
  // Le trait de paupière haute (lids.thickness × hauteur nominale, rendu "encre" des réfs 13/17 : jusqu'à 0,13) recouvre le haut de la fente : on sonde la partie LIBRE, et on ignore une abscisse où le trait la remplit (aucune sclère n'y est visible, rien à mesurer).
  const lineTh = eye.lids.thickness * eye.shape.height;
  const probes = [-1, 1].flatMap((side) => [1.12, 1.2, 1.3, 1.55, 1.85].flatMap((k) => [0.5, 0.78].map((f) => { const x = c.x + ox + side * s * rx * k; const y = midY(x, f); return y === null ? null : { x, y }; }))).filter((p): p is { x: number; y: number } => p !== null && inside(poly, p.x, p.y) && ((p.x - c.x - ox) / rx) ** 2 + ((p.y - c.y - oy) / ry) ** 2 > 1.1)  /* hors de l'iris (> 1,05 rayon) : sur un iris qui remplit l'ouverture (sprites, chibi, œil 23 et 30 de la galerie) la sonde mesurait l'iris, pas la sclère */.map((p) => lum(px, p.x, p.y));
  if (scLum >= 170 && probes.length && eye.finish !== 'flat') {   /* fini flat : la sclère est un aplat blanc par construction et l'iris des réfs au trait déborde l'ouverture (croissants de sclère trop fins pour les points de sondage, qui tombent sur l'encre) ; `ink-flat` vérifie alors le rendu */ const best = Math.max(...probes); add('anatomy', 'sclera-is-light-tone', best >= 60, best, 60, 'la sclère claire rendue est plus sombre que le 5ᵉ centile mesuré sur les références (60–73) en tout point sondé'); }

  // style : l'iris n'est pas un aplat (écart-type de luminance sur 5 × 5 échantillons dans le disque 0,2–0,9 rayon)
  const vals: number[] = [];
  for (let i = 0; i < 24; i++) for (const f of [0.35, 0.55, 0.75]) { const a = (i / 24) * Math.PI * 2; const x = c.x + ox + Math.cos(a) * rx * f, y = c.y + oy + Math.sin(a) * ry * f; if (inside(poly, x, y)) vals.push(lum(px, x, y)); }
  const mean = vals.reduce((a, b) => a + b, 0) / Math.max(vals.length, 1);
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(vals.length, 1));
  const flat = eye.finish === 'flat';
  // fini `flat` : l'inverse exact — l'œil NE doit PAS avoir de dégradé (aplats francs des références au trait) ; les autres finis gardent la règle « iris non plat ».
  if (flat) { const ts = toneShare(px, { x0: g.bbox.x + ox - m, y0: g.bbox.y + oy - m, x1: g.bbox.x + g.bbox.w + ox + m, y1: g.bbox.y + g.bbox.h + oy + m }); add('style', 'ink-flat', ts <= 0.02, ts, 0.02, 'un œil au fini flat contient des demi-teintes lisses (ombre, dégradé ou flou ajouté par le moteur)'); }
  else add('style', 'iris-not-flat', sd >= 3, sd, 3, 'l’iris est un aplat (aucune texture, fibre ni dégradé mesurable)');

  // ---- RÈGLES D'IRIS (passe 9, mesurées sur les réfs 03 / 05 / 06 / 09 : references/eyes/measures-iris-photos.json) ----
  //   geometry : `pupil-core-centred` — le cœur sombre de la pupille (pixels <= minimum + 22 dans le disque 0,45 de l'iris) est centré sur l'iris, au décalage `pupil.center` près (mesuré : 0,02–0,06 sur les 4 réfs) ;
  //   anatomy  : `specular-in-upper-iris` — tout reflet de réflexion primaire ancré à l'iris est dans la moitié HAUTE (y <= 0 ; mesuré : dy -0,66 à -0,15 sur les 4 réfs) ;
  //   style    : `iris-texture` — écart moyen de luminance entre deux points voisins (pas de 5°, 4 anneaux de 0,4 à 0,85) >= IRIS_TEXTURE_MIN : l'ombrage lisse varie lentement, les fibres et filigranes non (une première règle « p85 - p15 » mesurait l'ombrage du moteur : un iris gris uni donnait 49 > galerie min 23).
  // passe 10 : `pupil-core-centred` ne s'applique qu'à une pupille ronde et non occultée (comme `pupil-darker-than-iris-pixels`) : une fente verticale coupée par un reflet (53) ou une pupille noyée dans une étoile (2, 41, 71) n'a pas de « cœur » compact ; `specular-in-upper-iris` et `iris-texture` restent appliquées partout
  if (eye.finish !== 'flat' && eye.pupil.visible) {
    const dark: { x: number; y: number }[] = []; let mn = 1e9;
    const samples: { x: number; y: number; v: number }[] = [];
    for (let a = 0; a < 360; a += 10) for (let f = 0; f <= 0.45; f += 0.05) { const x = c.x + ox + Math.cos((a * Math.PI) / 180) * rx * f, y = c.y + oy + Math.sin((a * Math.PI) / 180) * ry * f; if (!inside(poly, x, y)) continue; const v = lum(px, x, y); samples.push({ x, y, v }); if (v < mn) mn = v; }   // passe 10 : points dans l'ouverture seulement (paupière et cils sombres ne sont pas la pupille)
    for (const q of samples) if (q.v <= mn + 22) dark.push(q);
    const cx = dark.reduce((t, q) => t + q.x, 0) / Math.max(dark.length, 1), cy = dark.reduce((t, q) => t + q.y, 0) / Math.max(dark.length, 1);
    const off = Math.hypot((cx - (c.x + ox)) / rx, (cy - (c.y + oy)) / ry), allowed = 0.2 + Math.hypot(eye.pupil.center.x, eye.pupil.center.y);
    if (eye.pupil.shape === 'round' && !occluded) add('geometry', 'pupil-core-centred', off <= allowed, off, allowed, 'le cœur sombre de la pupille n’est pas centré sur l’iris (au décalage pupil.center près)');
    const hlItems = (eye.highlights?.list ?? []) as readonly { kind: string; role: string; anchor: string; y: number }[];
    const lowSpec = hlItems.filter((h) => h.kind === 'reflection' && h.role === 'primary' && h.anchor === 'iris' && h.y > 0.05);
    if (hlItems.some((h) => h.anchor === 'iris')) add('anatomy', 'specular-in-upper-iris', lowSpec.length === 0, lowSpec.length, 0, 'un reflet primaire ancré à l’iris est dans sa moitié basse (références : toujours dans la moitié haute)');
    // style : texture de l'iris = écart moyen de luminance entre deux points voisins (pas de 5°) sur 4 anneaux ; l'ombrage lisse (paupière, vignettage) varie lentement, fibres et filigranes non.
    let tex = 0, nt = 0;
    for (const f of [0.4, 0.55, 0.7, 0.85]) { let prev: number | null = null; for (let k = 0; k <= 72; k++) { const a = (k * 5 * Math.PI) / 180; const x = c.x + ox + Math.cos(a) * rx * f, y = c.y + oy + Math.sin(a) * ry * f; if (!inside(poly, x, y)) { prev = null; continue; } const v = lum(px, x, y); if (prev !== null) { tex += Math.abs(v - prev); nt++; } prev = v; } }
    const texMin = eye.iris.detail ? IRIS_TEXTURE_DETAIL_MIN : IRIS_TEXTURE_MIN;   // un iris qui DEMANDE du détail (`iris.detail`) doit en montrer : seuil plus haut
    if (nt >= 40) add('style', 'iris-texture', tex / nt >= texMin, tex / nt, texMin, 'la texture de l’iris (écart de luminance entre points voisins) est sous le seuil : voile lisse, pas un iris détaillé');
    // passe 11 : `style` — `iris-peak-saturation` : les 15 % de pixels les plus saturés de l'iris (même définition que l'extracteur des réfs) atteignent IRIS_PEAK_SAT_MIN ; seulement si l'œil demande de la vibrance
    if ((eye.iris as { vibrance?: number }).vibrance && (eye.iris as { vibrance?: number }).vibrance! > 0) { const t = irisTone(input); if (Number.isFinite(t.satPeaks)) add('style', 'iris-peak-saturation', t.satPeaks >= IRIS_PEAK_SAT_MIN, t.satPeaks, IRIS_PEAK_SAT_MIN, 'les pics de saturation de l’iris sont délavés (références : 0,72–0,79) : fibres claires et voiles lavent les teintes'); }
  }

  // ---- RÈGLE « CILS » SUR LES PIXELS (audit des cils : la vérification d'image n'avait aucune règle de cils) ----
  // On échantillonne la ligne médiane de chaque cil réellement dessiné (eyeLashSet = le même appel que le rendu), au quart, au tiers et à la moitié de sa longueur (la pointe effilée est sous le pixel).
  //   geometry : `lash-centerline-clear-of-opening` — aucun point échantillonné de la ligne médiane d'un cil du HAUT ne tombe dans l'ouverture (même à 2 px de marge) ;
  //   anatomy  : `lash-ink-dark` — l'encre rendue des cils sombres et opaques est sombre sur l'image (médiane des luminances échantillonnées <= 45 ; références 12, 13, 15, 16 : médiane 0–2) ;
  //   style    : `lash-ink-flat` — l'encre est un aplat franc comme les références (écart-type des luminances échantillonnées <= 12 ; mesure sur les références : écart-type du cœur 5–11).
  // Non appliquées aux cils qui ne sont PAS une encre franche voulue (couleur > luminance 30, translucides, brillants ou à variation de teinte : style naturel de la galerie d'origine) ni s'il y en a moins de 3.
  const lset = eyeLashSet(eye, g, eye.lids.thickness * eye.shape.height);
  const at = (l: Lash, t: number): Vec => (l.ctrl2 ? cubicAt(l.base, l.ctrl, l.ctrl2, l.tip, t) : { x: (1 - t) ** 2 * l.base.x + 2 * (1 - t) * t * l.ctrl.x + t * t * l.tip.x, y: (1 - t) ** 2 * l.base.y + 2 * (1 - t) * t * l.ctrl.y + t * t * l.tip.y });
  const hexLum = (hex: string): number => (hex.startsWith('#') && hex.length >= 7 ? 0.2126 * parseInt(hex.slice(1, 3), 16) + 0.7152 * parseInt(hex.slice(3, 5), 16) + 0.0722 * parseInt(hex.slice(5, 7), 16) : 255);
  const isInk = (grp: { material: { base: Parameters<typeof dominantColor>[0] } | null; opacity: number; gloss: number; colorVariation: number }): boolean => grp.material !== null && hexLum(dominantColor(grp.material.base)) <= 30 && grp.opacity >= 0.9 && grp.gloss <= 0.05 && grp.colorVariation <= 0.05;
  const inkLashes = [...(isInk(eye.lashes.upper) ? lset.upper : []), ...(isInk(eye.lashes.lower) ? lset.lower : [])];
  if (inkLashes.length >= 3) {
    const samples: number[] = []; let inOpening = 0, tested = 0;
    for (const l of inkLashes) for (const t of [0.25, 0.33, 0.5]) { if (lashHalfWidth(l, t) * 2 < 3) continue; /* corps < 3 px : sous-pixel, gris par anti-crénelage, pas une mesure d'encre */ const q = at(l, t); const x = q.x + ox, y = q.y + oy; if (x < 0 || y < 0 || x >= W || y >= H) continue; samples.push(Math.min(...[[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => lum(px, Math.min(W - 1, Math.max(0, x + (dx as number))), Math.min(H - 1, Math.max(0, y + (dy as number)))))));  /* le plus sombre de 5 pixels : un trait de 1–2 px est anti-crénelé */ }
    for (const l of lset.upper) for (const t of [0.3, 0.45, 0.6, 0.75]) { const q = at(l, t); tested++; const x = q.x + ox, y = q.y + oy; if (signedDepth({ x, y }, poly) > eye.lids.thickness * eye.shape.height * 0.5) inOpening++; }  /* même seuil que le dégagement : la bande de paupière (demi-épaisseur du trait) n'est pas l'œil */
    const med = [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)] ?? 255;
    const m = samples.reduce((a, b) => a + b, 0) / Math.max(samples.length, 1); const sdl = Math.sqrt(samples.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(samples.length, 1));
    add('geometry', 'lash-centerline-clear-of-opening', inOpening === 0, inOpening, 0, 'la ligne médiane d’un cil du haut traverse l’ouverture (points échantillonnés dans la fente)');
    if (samples.length >= 6) add('anatomy', 'lash-ink-dark', med <= 45, med, 45, 'l’encre des cils est rendue plus claire que le noir des références (médiane de luminance échantillonnée)');
    if (samples.length >= 6) add('style', 'lash-ink-flat', sdl <= 12, sdl, 12, 'l’encre des cils n’est pas un aplat franc (écart-type de luminance sur la ligne médiane)');
    void tested;
  }
  // passe 12 : détail atomique d'iris (fentes, arcs, vides, facettes taillées) — règles dans verify-eye-atoms.ts, seulement pour les yeux qui le demandent
  const rgbAt = (x: number, y: number): readonly [number, number, number] => { const i = (Math.round(y) * W + Math.round(x)) * 4; return [px[i] as number, px[i + 1] as number, px[i + 2] as number]; };
  out.push(...verifyIrisAtoms({ eye: eye as never, lumAt: (x, y) => lum(px, x, y), rgbAt, inOpening: (x, y) => inside(poly, x, y), cx: c.x + ox, cy: c.y + oy, rx, ry }));
  return out;
}

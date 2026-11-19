import { dirToCam, dot, norm, v3 } from './math';
import { alaOf } from './parts';
import { sectionAt, surfaceZ } from './sections';
import type { GBuf } from './raster';
import { PART } from './mesh';
import type { LightModel } from '../relief/model';
import type { HeadTurnSpec, V3, View } from './types';

/**
 * ADOUCISSEMENT DES NORMALES DES AILES DU NEZ (éclairage uniquement). Les ailes sont des ellipsoïdes : leurs normales, sphériques, donnent à chacune son propre terminateur,
 * qui se lit sous la lumière comme deux DISQUES clairs posés sur la joue (planche `artefacts/head3d-lit-v2/`, avant / après). Le moteur du visage de face les traite comme des bosses
 * douces (gaussiennes, `relief/head.ts`) : ici la normale de l'aile est ramenée vers celle de la surface de la face sous elle, de sorte que l'aile s'y fonde (rondeur résiduelle,
 * pas de terminateur propre). La silhouette, la profondeur (ombre portée, occlusion) et le mode « planche » (sans lumière) ne changent pas.
 */
const BLEND = 0.85;

/** Poids 0 … 1 de l'aile en un point (repère tête), pour des ellipsoïdes d'ailes DÉJÀ calculés (`alaOf` résout un point fixe : on ne le refait pas par pixel). */
export function alaWeigher(spec: HeadTurnSpec): (p: V3) => number {
  const wings = ([1, -1] as const).map((sg) => alaOf(spec, sg));
  return (p) => {
    let w = 0;
    for (const a of wings) { const q = Math.hypot((p.x - a.c.x) / a.ex, (p.y - a.c.y) / a.ey, (p.z - a.c.z) / a.ez), d = (Math.abs(1 - q) - 0.15) / 0.15; w = Math.max(w, d <= 0 ? 1 : d < 1 ? 1 - d * d * (3 - 2 * d) : 0); }
    return w;
  };
}

/** Poids 0 … 1 de l'aile en un point de la surface (tête, repère tête) : 1 sur la coque de l'ellipsoïde (± 0,15 de rayon normalisé : tolérance du maillage et de l'interpolation), décroissant jusqu'à 0 à ± 0,3. */
export function alaWeight(spec: HeadTurnSpec, p: V3): number { return alaWeigher(spec)(p); }

/** Normale de la face (repère tête) à (x, y) : dérivées de `surfaceZ` par différences centrées. */
export function faceNormalAt(spec: HeadTurnSpec, x: number, y: number): V3 {
  const e = 0.004, zx = (surfaceZ(sectionAt(spec, y), x + e) - surfaceZ(sectionAt(spec, y), x - e)) / (2 * e), zy = (surfaceZ(sectionAt(spec, y + e), x) - surfaceZ(sectionAt(spec, y - e), x)) / (2 * e);
  return norm(v3(-zx, -zy, 1));
}

/** Normale éclairée d'un pixel : celle du maillage `nh`, adoucie vers la face si le point est sur une aile. */
export function softenedNormal(spec: HeadTurnSpec, p: V3, nh: V3): V3 {
  const w = alaWeight(spec, p) * BLEND;
  if (w <= 0) return nh;
  const f = faceNormalAt(spec, p.x, p.y);
  return norm(v3(nh.x + (f.x - nh.x) * w, nh.y + (f.y - nh.y) * w, nh.z + (f.z - nh.z) * w));
}

/** Écart angulaire (degrés) entre la normale éclairée et celle de la face, au maximum sur les points `ps` des ailes : mesure d'anatomie (une aile fondue dans la joue : ≤ 35°). */
export function alaDeviationDeg(spec: HeadTurnSpec, samples: readonly { p: V3; n: V3 }[], soften = true): number {
  let m = 0;
  for (const { p, n } of samples) {   // coque de l'aile seulement (pas le flanc du nez, dans la zone de fondu) if (alaWeight(spec, p) < 0.999) continue;
    const f = faceNormalAt(spec, p.x, p.y), s = soften ? softenedNormal(spec, p, n) : n; m = Math.max(m, (Math.acos(Math.max(-1, Math.min(1, dot(s, f)))) * 180) / Math.PI); }
  return m;
}

/**
 * Profondeur ALLÉGÉE pour l'ombre portée et l'occlusion : l'aile en ellipsoïde dépasse de 0,02 U de la face, ce qui trace un anneau sombre (occlusion) et une ombre propre autour d'elle — le second défaut du « disque ».
 * La saillie de l'aile (au-dessus de la face, mesurée suivant z tête, projetée sur la profondeur caméra) est réduite de 80 % × son poids. Le tampon `g` n'est pas modifié (contours, texture : inchangés).
 */
export function litDepth(spec: HeadTurnSpec, g: GBuf, view: View): Float32Array {
  const d = Float32Array.from(g.depth), cz = dirToCam(v3(0, 0, 1), view).z, weigh = alaWeigher(spec);
  for (let k = 0; k < d.length; k++) {
    if (g.id[k] !== PART.bump) continue;
    const p = v3(g.P[3 * k]!, g.P[3 * k + 1]!, g.P[3 * k + 2]!), w = weigh(p);
    if (w <= 0) continue;
    d[k] = d[k]! - 0.8 * w * Math.max(0, p.z - surfaceZ(sectionAt(spec, p.y), p.x)) * cz;
  }
  return d;
}

/**
 * OCCLUSION DU REBOND sur les ailes (éclairage uniquement). La lumière de rebond (`bounceAt`) est coupée par un SEUIL d'occlusion (cel : palier franc). L'aile, qui dépasse de la joue, a une occlusion plus basse que la joue voisine (mesuré, pyramide 45° :
 * 0,60 contre 0,75) : elle franchit le seuil et reçoit le rebond que la joue n'a pas, ce qui trace un OVALE clair à bord net sur la joue dans l'ombre (docs/NOSE-ALAR-SPOT.md, ablation : sans rebond la tache disparaît).
 * Comme pour la normale et la profondeur (BLEND, `litDepth`), l'aile reçoit ici l'occlusion de la FACE qui l'entoure : pour chaque pixel d'aile, la moyenne de l'occlusion des pixels de peau trouvés dans 8 directions à moins de `reachPx`, retenue si elle est PLUS haute (un pli réel sous l'aile reste occulté),
 * fondue par le poids de l'aile. `ao` n'est pas modifié (le terme direct `shadeAt` garde l'occlusion de l'aile) ; seul le tableau rendu sert à `bounceAt`.
 */
export function bounceAo(spec: HeadTurnSpec, g: GBuf, ao: Float32Array, reachPx: number): Float32Array {
  const out = Float32Array.from(ao), weigh = alaWeigher(spec), { w: W, h: H } = g, dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]] as const;
  for (let k = 0; k < W * H; k++) {
    if (g.id[k] !== PART.bump) continue;
    const w = weigh(v3(g.P[3 * k]!, g.P[3 * k + 1]!, g.P[3 * k + 2]!)); if (w <= 0) continue;
    const x = k % W, y = (k - x) / W; let sum = 0, n = 0;
    for (const [dx, dy] of dirs) for (let r = 2; r <= reachPx; r++) { const xx = x + dx * r, yy = y + dy * r; if (xx < 0 || yy < 0 || xx >= W || yy >= H) break; const j = yy * W + xx; if (g.id[j] === PART.head) { sum += ao[j]!; n++; break; } }
    if (n) out[k] = ao[k]! + (Math.max(ao[k]!, sum / n) - ao[k]!) * w;
  }
  return out;
}

/**
 * CONTINUITÉ DU TERMINATEUR sur les ailes (éclairage uniquement ; docs/NOSE-ALAR-SPOT-2.md). L'aile est une partie de la face : la décision éclairé / ombre de l'ombrage cel (seuil franc de n·l) se prend sur la FACE, la rondeur de l'aile ne fait que déplacer le terminateur de `TERMINATOR_MARGIN` (en cosinus).
 * Mesuré à 60° (pyramide, 3 graines) : la normale adoucie à 85 % garde 15 % de la normale de l'ellipsoïde, qui franchit le seuil là où la joue autour est à l'ombre (part éclairée de l'aile 0,02–0,25 contre 0,00 pour la joue) : OVALE clair à bord net, posé sur la joue.
 * `n` (normale adoucie de l'aile) et `nFace` (normale de la face au même point), tous deux en repère CAMÉRA : on ramène `n·dir` dans `[nFace·dir − M, nFace·dir + M]`, fondu par le poids `w` de l'aile, en ajoutant la composante nécessaire le long de la lumière.
 */
export const TERMINATOR_MARGIN = 0.04;
export function terminatorClamp(n: V3, nFace: V3, w: number, dir: V3, margin = TERMINATOR_MARGIN): V3 {
  const tw = dot(n, dir), tf = dot(nFace, dir), target = tw + (Math.min(tf + margin, Math.max(tf - margin, tw)) - tw) * w;
  if (Math.abs(target - tw) < 1e-9) return n;
  let o = n;
  for (let i = 0; i < 4; i++) { const e = target - dot(o, dir); if (Math.abs(e) < 1e-9) break; o = norm(v3(o.x + e * dir.x, o.y + e * dir.y, o.z + e * dir.z)); }   // la renormalisation défait une part de l'écart : 4 passes suffisent (écart < 1e-6)
  return o;
}

/** Normale ÉCLAIRÉE (repère caméra) d'un point de `PART.bump` : adoucie vers la face (`BLEND`), puis continuité du terminateur sur les ailes. Les ellipsoïdes d'ailes ne sont résolus qu'UNE fois (l'ancien appel par pixel de `softenedNormal` refaisait `alaOf`). */
export function wingLighter(spec: HeadTurnSpec, view: View, L: Pick<LightModel, 'dir'>): (p: V3, nh: V3) => V3 {
  const weigh = alaWeigher(spec);
  return (p, nh) => {
    const w = weigh(p);
    if (w <= 0) return dirToCam(nh, view, 'head', p.y);
    const f = faceNormalAt(spec, p.x, p.y), ws = w * BLEND, ns = norm(v3(nh.x + (f.x - nh.x) * ws, nh.y + (f.y - nh.y) * ws, nh.z + (f.z - nh.z) * ws));
    return terminatorClamp(dirToCam(ns, view, 'head', p.y), dirToCam(f, view, 'head', p.y), w, L.dir);
  };
}

/**
 * MESURE d'anatomie / de style pour la règle `eng.nose.alar-terminator` : sur la coque de l'aile la plus visible (échantillon de la surface de l'ellipsoïde tournée vers la caméra, repère tête), part des points dont la décision éclairé / ombre
 * (cel : `n·dir − bias` au-dessus de 0,012) DIFFÈRE de celle de la face au même point ET dont l'écart de n·l à la face dépasse `TERMINATOR_MARGIN` (un point à moins de la marge du seuil peut basculer : c'est le déplacement permis du terminateur). `soften` = `false` rejoue l'état sans la continuité (adoucissement à 85 % seul), pour prouver que la règle détecte l'ancien défaut.
 */
export function wingTerminatorGap(spec: HeadTurnSpec, view: View, L: Pick<LightModel, 'dir' | 'bias'>, continuity = true, n = 24): number {
  const lit = (nc: V3): boolean => dot(nc, L.dir) - L.bias > 0.012;
  let best = { vis: -1, gap: 0 };
  for (const sg of [1, -1] as const) {
    const a = alaOf(spec, sg), weigh = alaWeigher(spec); let vis = 0, bad = 0;
    for (let i = 1; i < n; i++) for (let j = 0; j < 2 * n; j++) {
      const th = (Math.PI * i) / n, ph = (Math.PI * j) / n, u = v3(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)), p = v3(a.c.x + a.ex * u.x, a.c.y + a.ey * u.y, a.c.z + a.ez * u.z);
      if (p.z < surfaceZ(sectionAt(spec, p.y), p.x) || weigh(p) < 0.999) continue;                 // pas la coque cachée dans la face
      const nh = norm(v3(u.x / a.ex, u.y / a.ey, u.z / a.ez)), nCam = dirToCam(nh, view, 'head', p.y); if (nCam.z <= 0.05) continue;   // tournée vers la caméra
      const f = faceNormalAt(spec, p.x, p.y), ws = BLEND, ns = norm(v3(nh.x + (f.x - nh.x) * ws, nh.y + (f.y - nh.y) * ws, nh.z + (f.z - nh.z) * ws)), nSoft = dirToCam(ns, view, 'head', p.y), nF = dirToCam(f, view, 'head', p.y);
      const nW = continuity ? terminatorClamp(nSoft, nF, 1, L.dir) : nSoft;
      vis++; if (lit(nW) !== lit(nF) && Math.abs(dot(nW, L.dir) - dot(nF, L.dir)) > TERMINATOR_MARGIN + 1e-6) bad++;   // décision différente ET écart de n·l au-delà de la marge tolérée (la bande de ± marge autour du seuil de la face reste permise)
    }
    if (vis > best.vis) best = { vis, gap: vis ? bad / vis : 0 };
  }
  return best.gap;
}

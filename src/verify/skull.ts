import { faceLandmarks } from '../face/landmarks';
import { skullGeometry, type SkullGeo } from '../skull/geometry';
import { profileInk, renderProfile, type ProfileMode } from '../skull/render';
import { SkullParams, type V2 } from '../skull/types';
import { FaceParams } from '../schema';
import { check, report, type Check, type Report } from './types';

/**
 * VÉRIFICATION DU RENDU EN PROFIL — trois couches chiffrées (même contrat que `verifyFace`) :
 *  - geometry : nombres finis, contour sans auto-intersection, os STRICTEMENT à l'intérieur de la peau, ordre vertical des repères, hauteurs
 *    identiques à la vue de face, angle gonial identique à celui du visage de face ;
 *  - anatomy  : plan de Francfort, ligne E des lèvres, tiers du visage, projection du nez, angle naso-labial, cervico-mentonnier, profondeurs de tissu,
 *    oreille (hélix/lobule) alignée sur les repères, nuque dégagée si la coiffure le promet ;
 *  - style    : aucun filtre (coût), palette cel bornée, trait d'encre homogène et contrasté, poids du SVG.
 * `error` fait échouer le rapport, `warn` signale un défaut esthétique sans l'invalider.
 */
const DEG = 180 / Math.PI;
const inside = (p: V2, poly: readonly V2[]): boolean => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i] as V2, b = poly[j] as V2;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
};
const ccw = (a: V2, b: V2, c: V2): number => (c.y - a.y) * (b.x - a.x) - (b.y - a.y) * (c.x - a.x);
const crosses = (a: V2, b: V2, c: V2, d: V2): boolean => ccw(a, c, d) * ccw(b, c, d) < 0 && ccw(a, b, c) * ccw(a, b, d) < 0;
const angleAt = (v: V2, a: V2, b: V2): number => { const u = Math.atan2(a.y - v.y, a.x - v.x), w = Math.atan2(b.y - v.y, b.x - v.x); let d = Math.abs(u - w) * DEG; if (d > 180) d = 360 - d; return d; };
const lum = (hex: string): number => { const c = [1, 3, 5].map((i) => { const v = parseInt(hex.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * (c[0] as number) + 0.7152 * (c[1] as number) + 0.0722 * (c[2] as number); };

export function checkProfileGeometry(g: SkullGeo, face: FaceParams): Check[] {
  const { H, poly, frame: fr, bone } = g;
  const out: Check[] = [];
  const finite = poly.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)) && g.sil.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  out.push(check('geometry', 'profile-finite', '==', Number(finite), 1, 'le contour de profil contient une valeur non finie'));
  let hits = 0;
  const pts = poly.filter((_, i) => i % 2 === 0);
  for (let i = 0; i < pts.length - 1; i++) for (let j = i + 3; j < pts.length - 1; j++) if (crosses(pts[i] as V2, pts[i + 1] as V2, pts[j] as V2, pts[j + 1] as V2)) hits++;
  out.push(check('geometry', 'profile-no-self-intersection', '==', hits, 0, 'le contour de profil se coupe lui-même'));
  const closed = [...poly, poly[0] as V2];
  const lm = bone.lm;
  const boneIds = Object.keys(lm).filter((k) => k.endsWith(':bone') || ['nasospinale', 'prosthion', 'infradentale', 'gnathion', 'gonion', 'condyle', 'coronoid', 'mastoid', 'orbitale', 'zygomaxillare'].includes(k));
  const outside = boneIds.filter((k) => !inside(lm[k] as V2, closed)).length + bone.vertebrae.filter((v) => !inside(v.c, closed) || !inside(v.spine, closed)).length;
  out.push(check('geometry', 'bone-inside-skin', '==', outside, 0, 'un repère osseux sort de la peau (os plus large que la tête)'));
  const thin = bone.tissue.filter((t) => !(t.depth > 0) || Math.hypot(t.bone.x - t.skin.x, t.bone.y - t.skin.y) < 0.99 * t.depth).length;
  out.push(check('geometry', 'tissue-positive', '==', thin, 0, 'une profondeur de tissu est nulle ou négative'));
  const s = (id: string): number => (g.skin.get(id) as V2).y;
  const order = ['glabella', 'nasion', 'subnasale', 'stomion', 'sublabiale', 'pogonion', 'menton'].map(s);
  out.push(check('geometry', 'landmark-vertical-order', '==', Number(order.every((y, i) => i === 0 || y > (order[i - 1] as number))), 1, 'les repères du profil ne sont pas ordonnés du front au menton'));
  const flm = faceLandmarks(face, fr.hostH * 0.8, fr.hostH);
  const base = flm.chinY + fr.hostH / 2;
  const dh = Math.max(Math.abs(s('subnasale') / H - (flm.noseBaseY + fr.hostH / 2) / base), Math.abs(s('stomion') / H - (flm.mouthY + fr.hostH / 2) / base), Math.abs(s('menton') / H - 1));
  out.push(check('geometry', 'heights-match-front', '<=', dh, 1e-9, 'les hauteurs du profil diffèrent de celles de la vue de face (deux géométries incompatibles)'));
  out.push(check('geometry', 'gonial-matches-front', '<=', Math.abs(bone.gonialDeg - bone.gonialRequestedDeg), 0.5, 'l’angle gonial du profil diffère de celui du visage de face (°)'));
  const minY = Math.min(...poly.map((p) => p.y));
  out.push(check('geometry', 'nothing-above-vertex', '<=', -minY, 0.01 * H, 'le contour dépasse le sommet du crâne'));
  return out;
}

export function checkProfileAnatomy(g: SkullGeo, face: FaceParams): Check[] {
  const { H, frame: fr, neck, bone } = g;
  const out: Check[] = [];
  const P = (id: string): V2 => g.skin.get(id) as V2;
  const L = bone.lm;
  out.push(check('anatomy', 'frankfurt-plane', '<=', Math.abs((L.porion as V2).y - (L.orbitale as V2).y) / H, 0.03, 'porion et orbitale ne sont pas à la même hauteur (plan de Francfort)'));
  const tip = P('pronasale'), pg = P('pogonion');
  const eAt = (y: number): number => tip.x + ((pg.x - tip.x) * (y - tip.y)) / (pg.y - tip.y);
  const up = (P('labraleSup').x - eAt(P('labraleSup').y)) / H, lo = (P('labraleInf').x - eAt(P('labraleInf').y)) / H;
  out.push(check('anatomy', 'e-line-upper-lip', '<=', up, 0.006, 'la lèvre supérieure dépasse la ligne E'));
  out.push(check('anatomy', 'e-line-lower-lip', '<=', lo, 0.008, 'la lèvre inférieure dépasse la ligne E'));
  const upper = (P('subnasale').y - P('glabella').y) / H, lower = (P('menton').y - P('subnasale').y) / H;
  out.push(check('anatomy', 'facial-thirds', '>=', Math.min(upper / lower, lower / upper), 0.6, 'étage moyen / inférieur du visage déséquilibrés', 'warn'));
  const nl = P('subnasale').y - P('nasion').y;
  out.push(check('anatomy', 'nasal-projection', '>=', (tip.x - P('subnasale').x) / nl, 0.4, 'projection de la pointe du nez trop faible (rapport à la longueur nasale)', 'warn'));
  out.push(check('anatomy', 'nasal-projection-max', '<=', (tip.x - P('subnasale').x) / nl, 0.8, 'projection de la pointe du nez excessive', 'warn'));
  const col = g.sil[g.sil.findIndex((p) => p.id === 'subnasale') - 1] as V2;
  const nla = angleAt(P('subnasale'), col, P('philtrum'));
  out.push(check('anatomy', 'nasolabial-angle-min', '>=', nla, 70, 'angle naso-labial trop fermé (°)', 'warn'));
  out.push(check('anatomy', 'nasolabial-angle-max', '<=', nla, 135, 'angle naso-labial trop ouvert (°)', 'warn'));
  const front = neck.front;
  const cm = angleAt(neck.throat, front[1] as V2, front[3] as V2);
  out.push(check('anatomy', 'cervicomental-matches', '<=', Math.abs(cm - face.neck.cervicomentalDeg), 12, 'l’angle cervico-mentonnier mesuré s’écarte du paramètre (°)', 'warn'));
  const nd = neck.depth / H;
  out.push(check('anatomy', 'neck-depth-range', '>=', nd, 0.3, 'cou trop fin en profil', 'warn'));
  out.push(check('anatomy', 'neck-depth-range-max', '<=', nd, 0.56, 'cou trop épais en profil', 'warn'));
  const dMin = Math.min(...bone.tissue.map((t) => t.depth)) / H, dMax = Math.max(...bone.tissue.map((t) => t.depth)) / H;
  out.push(check('anatomy', 'tissue-depth-min', '>=', dMin, 0.005, 'profondeur de tissu implausible (trop mince)'));
  out.push(check('anatomy', 'tissue-depth-max', '<=', dMax, 0.07, 'profondeur de tissu implausible (trop épaisse)'));
  out.push(check('anatomy', 'mastoid-behind-porion', '<=', (L.mastoid as V2).x, 0, 'la mastoïde doit être derrière le conduit auditif'));
  out.push(check('anatomy', 'head-length-range', '>=', (fr.x.front - fr.x.back) / H, 0.7, 'tête trop courte (longueur / hauteur)', 'warn'));
  out.push(check('anatomy', 'head-length-range-max', '<=', (fr.x.front - fr.x.back) / H, 0.92, 'tête trop longue (longueur / hauteur)', 'warn'));
  if (g.params.hair === 'undercut' || g.params.hair === 'updo') {
    const nape = fr.f.inion * H + 0.02 * H;
    out.push(check('anatomy', 'nape-exposed', '>=', neck.yC7 - nape, 0.1 * H, 'la coiffure doit dégager la nuque (≥ 0,1 H entre l’implantation et C7)'));
  }
  return out;
}

export function checkProfileStyle(svg: string, mode: ProfileMode, skinHex: string, inkHex: string): Check[] {
  const out: Check[] = [];
  out.push(check('style', 'no-filters', '==', (svg.match(/<filter /g) ?? []).length, 0, 'le profil n’émet aucun filtre (coût de rastérisation)'));
  const fills = new Set([...svg.matchAll(/fill="(#[0-9a-fA-F]{6})"/g)].map((m) => (m[1] as string).toLowerCase()));
  out.push(check('style', 'cel-palette', '<=', fills.size, mode === 'skin' ? 40 : 14, 'trop de teintes d’aplat distinctes pour un rendu cel', 'warn'));
  const ratio = (Math.max(lum(skinHex), lum(inkHex)) + 0.05) / (Math.min(lum(skinHex), lum(inkHex)) + 0.05);
  // Le contraste maximal possible avec un trait noir dépend de la peau (peau foncée : ≈ 3) : on exige 4, ou 80 % du maximum atteignable si celui-ci est plus bas.
  const maxRatio = (lum(skinHex) + 0.05) / 0.05;
  out.push(check('style', 'ink-contrast', '>=', ratio, Math.min(4, 0.8 * maxRatio), 'le trait d’encre contraste trop peu avec la peau', 'warn'));
  // Traits fins seulement (les bandes larges d'ombre/reflet de cheveux ne sont pas des traits d'encre).
  const widths = [...svg.matchAll(/stroke-width="([0-9.]+)"/g)].map((m) => Number(m[1])).filter((w) => w > 0 && w <= 6);
  out.push(check('style', 'stroke-homogeneity', '<=', Math.max(...widths) / Math.max(1e-6, Math.min(...widths)), 14, 'rapport des épaisseurs de trait trop grand (trait incohérent)', 'warn'));
  out.push(check('style', 'svg-size', '<=', svg.length / 1024, 160, 'SVG trop lourd (ko)', 'warn'));
  return out;
}

/** Rapport complet d'une tête de profil. */
export function verifyProfile(faceIn: unknown, skIn: unknown = {}, opts: { skin?: string; hair?: string } = {}): Report {
  const face = FaceParams.parse(faceIn);
  const sk = SkullParams.parse(skIn);
  const g = skullGeometry(face, sk, 420);
  const mode: ProfileMode = 'skin';
  const r = renderProfile(face, sk, { mode, ...(opts.skin ? { skin: opts.skin } : {}), ...(opts.hair ? { hair: opts.hair } : {}) });
  const skin = opts.skin ?? '#efc8a8';
  return report([...checkProfileGeometry(g, face), ...checkProfileAnatomy(g, face), ...checkProfileStyle(r.svg, mode, skin, profileInk(skin, opts.hair ?? '#4a3222', face).line)]);
}

import { resolveAppearance } from '../appearance';
import { compileContact, MAX_PEAK, MIN_CONTACT, resolveRims, type ContactMetric } from '../contact';
import { faceLandmarks, noseGeometry, rightSamples, skinRegions, type FaceLandmarks, type NoseGeometry } from '../face';
import { inPoly, polyArea, type Poly } from '../face/poly';
import type { RandomFace } from '../generation/random-face';
import { lightVector } from '../lighting/light';
import { faceComponents } from '../render/face/components';
import { skinShading, type SkinShading } from '../skin';
import { parseHex } from '../core/color';
import { check, type Check } from './types';

/** Lumière de référence des mesures (celle des scènes par défaut) : toutes les valeurs de ce fichier sont reproductibles. */
export const REFERENCE_LIGHT = { azimuthDeg: 330, elevationDeg: 55, color: '#ffffff', intensity: 1 } as const;

/** Tout ce que les contrôles du moteur de visage mesurent : calculé une fois, lu par les trois couches. */
export interface EngineContext {
  readonly face: RandomFace;
  readonly lm: FaceLandmarks;
  readonly nose: NoseGeometry;
  readonly contacts: ContactMetric[];
  readonly shading: SkinShading;
  readonly rims: ReturnType<typeof resolveRims>;
  readonly rimComponents: ReturnType<typeof faceComponents>['components'];
}

export function engineContext(face: RandomFace): EngineContext {
  const p = face.params;
  const lm = faceLandmarks(p, face.width, face.height);
  const nose = noseGeometry(p, lm);
  const L = lightVector(REFERENCE_LIGHT);
  const skin = (face.objects[0] as { material: { color: string } }).material.color;
  const ra = resolveAppearance(skin, p.skin);
  const { components, receivers } = faceComponents(p, lm, nose);
  const contacts = compileContact('verify', components, (({ master: _m, ...c }) => c)(p.lighting.contacts), p.lighting.contacts.master, L, ra.shadow, receivers, lm.W / 300).metrics;
  return { face, lm, nose, contacts, shading: skinShading(p.skinMaterial, L, skinRegions(lm, nose), ra, skin), rims: resolveRims(components, p.lighting.rims, ra), rimComponents: components };
}

const finite = (p: readonly { x: number; y: number }[]): boolean => p.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y));
const angleDeg = (a: { x: number; y: number }, b: { x: number; y: number }): number => (Math.acos(Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y) / (Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y) || 1)))) * 180) / Math.PI;

/** COUCHE GÉOMÉTRIE du moteur de visage : nombres finis, polygones non dégénérés, contour continu et monotone, longueur du visage, ombres ni flottantes ni collées. */
export function engineGeometry(c: EngineContext): Check[] {
  const { lm, nose, contacts } = c;
  const o: Check[] = [];
  const polys: Poly[] = [nose.tip.poly, nose.alae.left.poly, nose.alae.right.poly, nose.nostrils.left.poly, nose.nostrils.right.poly, nose.silhouette];
  o.push(check('geometry', 'nose-finite', '==', polys.every(finite) && finite(nose.profile) ? 1 : 0, 1, 'un sommet du nez n\'est pas fini'));
  o.push(check('geometry', 'nose-polys-nondegenerate', '>=', Math.min(...polys.map((p) => Math.abs(polyArea(p)))), 1, 'un polygone du nez est dégénéré (aire < 1 px²)'));
  // Continuité C1 du contour : à chaque raccord, la tangente sortante de la cubique i et la tangente entrante de la cubique i+1 sont alignées (≤ 3°).
  const segs = lm.outline.right;
  let worst = 0;
  for (let i = 0; i < segs.length - 1; i++) {
    const a = segs[i]!;
    const b = segs[i + 1]!;
    worst = Math.max(worst, angleDeg({ x: a.p3.x - a.p2.x, y: a.p3.y - a.p2.y }, { x: b.p1.x - b.p0.x, y: b.p1.y - b.p0.y }));
  }
  o.push(check('geometry', 'outline-c1', '<=', worst, 3, 'le contour a une cassure de tangente (raccord de cubiques)'));
  const ys = rightSamples(lm.outline).map((q) => q.y);
  o.push(check('geometry', 'outline-monotone', '<=', Math.max(0, ...ys.slice(1).map((y, i) => (ys[i] as number) - y)), 1e-6, 'l\'ordonnée du contour recule (le contour se replie)'));
  // La hauteur du visage est fixe : le bas du menton = H/2 + abaissement exact, quelle que soit la hauteur du menton.
  o.push(check('geometry', 'face-length-fixed', '==', lm.outline.bottomY, lm.H / 2 + lm.jaw.drop, 'la hauteur du menton a modifié la longueur du visage', 'error', 1e-6));
  for (const m of contacts) {
    o.push(check('geometry', `contact-not-sticker:${m.id}`, '<=', m.peak, MAX_PEAK, `ombre de contact « ${m.id} » trop forte : la pièce semble collée`));
    o.push(check('geometry', `contact-not-floating:${m.id}`, '>=', m.contactShare, MIN_CONTACT, `ombre de contact « ${m.id} » sans occlusion au contact : l'objet flotte`));
    o.push(check('geometry', `contact-gap:${m.id}`, '<=', m.gapPx, 0.25 * m.sizePx + 0.5, `ombre portée de « ${m.id} » détachée de son composant`, 'warn'));
  }
  for (const r of c.rims.values()) {
    o.push(check('geometry', `rim-bounded:${r.id}`, '<=', r.intensity, 1, `lumière de contour de « ${r.id} » hors [0, 1]`));
    o.push(check('geometry', `rim-received-bounded:${r.id}`, '<=', r.received, 0.5, `lumière de contour reçue par « ${r.id} » trop forte (un voisin ne doit pas la voler)`));
  }
  return o;
}

/** COUCHE ANATOMIE : le nez, le menton et la mâchoire à leur place, les enfants dans le visage. */
export function engineAnatomy(c: EngineContext): Check[] {
  const { lm, nose } = c;
  const o: Check[] = [];
  const a = (id: string, cmp: '<=' | '>=' | '==', v: number, lim: number, msg: string, sev: 'error' | 'warn' = 'error'): void => void o.push(check('anatomy', id, cmp, v, lim, msg, sev));
  a('nose-root-below-brow', '>=', nose.root.y - lm.browLimitY, 0, 'la racine du nez est au-dessus de la limite des sourcils');
  a('nose-root-above-eyeline', '<=', nose.root.y - lm.eyeY, 0, 'la racine du nez est sous la ligne des yeux');
  a('nose-root-between-canthi', '<=', nose.root.half, Math.abs(lm.innerCanthus.right.x) * 0.9, 'la racine du nez mord sur les yeux');
  a('nose-tip-between', '>=', Math.min(nose.baseY - nose.tip.c.y, nose.tip.c.y - nose.root.y), 1, 'la pointe n\'est pas entre la racine et la base du nez');
  a('nose-above-mouth', '<=', nose.baseY, lm.lips.topY, 'le nez descend sur la bouche');
  const cover = (poly: Poly, ala: Poly): number => poly.filter((q) => inPoly(ala, q.x, q.y)).length / poly.length;
  a('nostrils-inside-alae', '>=', Math.min(cover(nose.nostrils.left.poly, nose.alae.left.poly), cover(nose.nostrils.right.poly, nose.alae.right.poly)), 0.95, 'une narine sort de son aile (point noir posé sur le nez)');
  a('nostrils-below-tip', '>=', Math.min(nose.nostrils.left.c.y, nose.nostrils.right.c.y) - nose.tip.c.y, 0, 'une narine est au-dessus de la pointe');
  // Orientation : le long de l'AXE d'une narine (incliné de `tiltDeg`), l'extrémité haute est plus près de la ligne médiane que l'extrémité basse.
  const converge = (n: typeof nose.nostrils.right): number => {
    if (n.tiltDeg <= 3) return 0;
    const t = (n.tiltDeg * Math.PI) / 180;
    const u = { x: -n.side * Math.sin(t), y: -Math.cos(t) };
    const k = n.poly.map((q) => ({ x: Math.abs(q.x), k: (q.x - n.c.x) * u.x + (q.y - n.c.y) * u.y }));
    const m = (p: { x: number }[]): number => p.reduce((s, q) => s + q.x, 0) / Math.max(1, p.length);
    return m(k.filter((q) => q.k < -0.5 * n.a)) - m(k.filter((q) => q.k > 0.5 * n.a));
  };
  a('nostrils-converge', '>=', Math.min(converge(nose.nostrils.left), converge(nose.nostrils.right)), -1e-6, 'l\'axe des narines diverge vers le haut');
  a('alae-wider-than-tip', '>=', nose.alae.right.outerX, nose.tip.rx * 1.4, 'les ailes ne dépassent pas la pointe');
  a('columella-between-nostrils', '>=', Math.min(...[nose.nostrils.left, nose.nostrils.right].map((n) => Math.min(...n.poly.map((q) => Math.abs(q.x))))), nose.columella.half * 0.9, 'une narine empiète sur la columelle');
  a('chin-sulcus-order', '>=', Math.min(lm.chin.sulcusY - lm.lips.bottomY, lm.chinY - lm.chin.sulcusY), 0, 'le sillon mentolabial n\'est pas entre la lèvre inférieure et le menton');
  a('chin-height-honoured', '<=', Math.abs(lm.chin.heightPx - lm.chin.requestedPx), Math.max(0.5, 0.04 * lm.H), 'la hauteur du menton demandée est écrasée par la lèvre inférieure', 'warn');
  a('jaw-wider-than-chin', '>=', lm.jaw.gonion.x, lm.outline.chinHalf, 'la mâchoire est plus étroite que le menton');
  a('gonial-angle-range', '>=', Math.min(lm.jaw.gonialDeg - 95, 140 - lm.jaw.gonialDeg), 0, 'angle mandibulaire hors de la plage humaine (95°–140°)');
  a('jaw-drop-bounded', '<=', lm.jaw.drop, Math.min(0.08 * lm.H, lm.lips.openH * 1.1 + 1e-6), 'abaissement de la mandibule plus grand que l\'ouverture de la bouche');
  a('mouth-inside-contour', '<=', lm.lips.half, 0.8 * lm.W / 2, 'la bouche touche le contour');
  return o;
}

/** COUCHE STYLE : peau non métallique, reflets larges, rugosité variée, transitions douces, reflets qui suivent la lumière. */
export function engineStyle(c: EngineContext): Check[] {
  const { shading: s, face } = c;
  const mat = face.params.skinMaterial;
  const o: Check[] = [];
  const cel = s.cel;
  // Chroma (max − min des canaux, 0–1) plutôt que la saturation HSL, instable près du blanc.
  const rgb = parseHex(s.specColor);
  const sat = (Math.max(...rgb) - Math.min(...rgb)) / 255;
  o.push(check('style', 'skin-specular-nonmetal', '<=', sat, 0.3, 'reflet de peau teinté (métallique) : il doit rester proche de la couleur de la lumière', 'error'));
  const rough = Object.values(mat.roughness);
  const mean = rough.reduce((a, b) => a + b, 0) / rough.length;
  const sd = Math.sqrt(rough.reduce((a, b) => a + (b - mean) ** 2, 0) / rough.length);
  o.push(check('style', 'skin-roughness-varies', '>=', sd, 0.04, 'rugosité quasi uniforme : la peau doit varier selon les régions', 'warn'));
  if (!cel) {
    o.push(check('style', 'skin-highlight-soft', '>=', Math.min(...s.spots.map((p) => p.soft)), 0.4, 'un reflet de peau a un bord dur'));
    o.push(check('style', 'skin-terminator-soft', '>=', s.terminatorWidth, 0.1, 'transition lumière / ombre trop brutale'));
  } else o.push(check('style', 'skin-cel-hard-terminator', '<=', s.terminatorWidth, 0.02, 'mode cel : le terminateur doit être net'));
  // Les reflets suivent la lumière : chaque reflet est décalé de sa région vers la source (produit scalaire ≥ 0).
  const regions = skinRegions(c.lm, c.nose);
  let worst = Infinity;
  for (const sp of s.spots) {
    const r = regions[sp.region].reduce((best, e) => (Math.hypot(e.cx - sp.e.cx, e.cy - sp.e.cy) < Math.hypot(best.cx - sp.e.cx, best.cy - sp.e.cy) ? e : best));
    worst = Math.min(worst, (sp.e.cx - r.cx) * s.dir.x + (sp.e.cy - r.cy) * s.dir.y);
  }
  o.push(check('style', 'skin-highlights-follow-light', '>=', worst, -1e-6, 'un reflet de peau s\'éloigne de la lumière'));
  return o;
}

/** Les trois couches du moteur de visage, dans l'ordre. */
export function checkFaceEngine(face: RandomFace): Check[] {
  const c = engineContext(face);
  return [...engineGeometry(c), ...engineAnatomy(c), ...engineStyle(c)];
}

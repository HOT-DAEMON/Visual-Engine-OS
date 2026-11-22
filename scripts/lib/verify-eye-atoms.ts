import type { EyeImageCheck } from './verify-eye-render';

/**
 * RÈGLES DE RENDU DU DÉTAIL ATOMIQUE D'IRIS (passe 12) — appelées par `verifyEyeRender` ; ne s'appliquent QU'AUX yeux qui demandent ce détail (`iris.detail.slits / arcs / embers / voids /
 * facets.cut`), tous les autres yeux gardent exactement leurs contrôles historiques. Mesurées sur les PIXELS, aux positions données par la géométrie :
 *   géométrie : `slits-radial` — les creux sombres de luminance suivent des RAYONS de l'iris (le même angle revient sur au moins 3 anneaux de 5) ;
 *               `arcs-concentric` — les arcs lumineux sont sur UN cercle (écart ROBUSTE du rayon du pic ≤ 0,06 de rayon d'iris, aux seuls angles où un arc existe) ;
 *   anatomie  : `iris-dark-share-plausible` — part de pixels sombres (L < 50) de l'iris hors pupille et reflets ≤ 0,6 (références : 0 à 0,37) : un iris n'est pas un vide ;
 *   style     : `atomic-edge-density` — gradient moyen de luminance dans l'iris >= 12 (niveaux / pixel, voisins à 1 pixel, rendu 700 px). MESURÉ sur le moteur : iris dépouillé du détail (fibres de base seules, sans reflet) 6,3–6,6 ; les 4 familles atomiques 21–30. Seuil entre les deux ; la mesure dépend de la résolution de rendu (non comparée aux photos).
 */
export interface AtomCtx {
  readonly eye: { iris: { detail: Record<string, any> | null }; pupil: { size: number; visible: boolean } };
  readonly lumAt: (x: number, y: number) => number;
  readonly rgbAt: (x: number, y: number) => readonly [number, number, number];
  readonly inOpening: (x: number, y: number) => boolean;
  readonly cx: number; readonly cy: number; readonly rx: number; readonly ry: number;
}
export const ATOM_EDGE_MIN = 12;
/** Seuil du gradient pour un iris dont le détail atomique est LÉGER (arcs et braises seuls, sans fentes, vides ni facettes taillées : cel-shading de la réf. 08, passe 13). Iris dépouillé : 6,3–6,6 ; lime-cyan en galeries 3 et 4 : 9,3–14,8. 9 = dépouillé + 2,4 : le détail doit se voir sans exiger le gradient d'un iris à fentes. */
export const ATOM_EDGE_MIN_LIGHT = 9;
export const ATOM_DARK_MAX = 0.6;
/** Luminance moyenne de l'iris (hors pupille et reflets) : références 89–169 (10a … 08a) ; marge d'environ 30 de chaque côté (passe 13 : le moteur était de 14 à 22 SOUS ses références). */
export const ATOM_LUM_MIN = 60;
export const ATOM_LUM_MAX = 200;
/** Part de pixels blancs purs (canal minimum > 235) du disque d'iris, reflets compris : références 0 à 0,108 (04 : 0,108 ; 10b : 0,092) ; plafond à ~ 2 × la plus haute. Les étoiles sont du blanc rayonnant et teinté, pas un iris couvert d'aplats blancs (passe 13). */
export const ATOM_WHITE_MAX = 0.2;
export const ARC_RADIUS_SD_MAX = 0.06;
export const SLIT_RING_MIN = 3;
const DEG = Math.PI / 180;

export function wantsAtoms(d: Record<string, any> | null): boolean { return !!d && !!(d.slits || d.arcs || d.embers || (d.voids && d.voids.length) || (d.facets && d.facets.cut > 0)); }

/** Angles (deg) des creux étroits de luminance sur l'anneau `rho` : valeur < moyenne glissante (24°) − 16, largeur <= 8°. */
function dips(c: AtomCtx, rho: number): number[] {
  const n = 720; const v: (number | null)[] = Array.from({ length: n }, (_, k) => { const a = (k * 0.5) * DEG; const x = c.cx + Math.cos(a) * c.rx * rho, y = c.cy + Math.sin(a) * c.ry * rho; return c.inOpening(x, y) ? c.lumAt(x, y) : null; });
  const out: number[] = []; const w = 48; let run: number[] = [];
  for (let k = 0; k < n; k++) {
    const cur = v[k]; let s = 0, m = 0; for (let j = -w / 2; j < w / 2; j++) { const q = v[(k + j + n) % n]; if (q !== null && q !== undefined) { s += q; m++; } }
    if (cur !== null && cur !== undefined && m > w / 2 && cur < s / m - 16) run.push(k); else { if (run.length && run.length * 0.5 <= 8) out.push(((run[0]! + run[run.length - 1]!) / 2) * 0.5); run = []; }
  }
  return out;
}

export function verifyIrisAtoms(c: AtomCtx): EyeImageCheck[] {
  const d = c.eye.iris.detail; if (!wantsAtoms(d)) return [];
  const out: EyeImageCheck[] = []; const add = (layer: EyeImageCheck['layer'], id: string, ok: boolean, value: number, limit: number, message: string): void => { out.push({ layer, id, ok, value: Math.round(value * 1e3) / 1e3, limit, message }); };
  const near = (a: number, list: number[], tol: number): boolean => list.some((b) => Math.abs(((a - b + 540) % 360) - 180) <= tol);

  if (d!.slits) {
    const rings = [0.45, 0.55, 0.65, 0.75, 0.85].map((r) => dips(c, r)); const base = rings[2]!;   // anneau central comme référence
    const radial = base.filter((a) => rings.filter((l, i) => i !== 2 && near(a, l, 3.5)).length + 1 >= SLIT_RING_MIN);
    const share = base.length ? radial.length / base.length : 0;
    add('geometry', 'slits-radial', base.length === 0 || share >= 0.5, share, 0.5, 'les creux sombres ne suivent pas des rayons de l’iris (angle non répété d’un anneau à l’autre)');
  }
  if (d!.arcs) {
    const rhos: number[] = [];
    for (let k = 0; k < 120; k++) {
      const a = (k * 3) * DEG; let best = -1, br = 0;
      for (let r = d!.arcs.ringRho - 0.2; r <= d!.arcs.ringRho + 0.2; r += 0.01) { const x = c.cx + Math.cos(a) * c.rx * r, y = c.cy + Math.sin(a) * c.ry * r; if (!c.inOpening(x, y)) { best = -1; break; } const [R, G, B] = c.rgbAt(x, y); const mx = Math.max(R, G, B); const L = mx === 0 ? 0 : ((mx - Math.min(R, G, B)) / mx) * (mx / 255) * 255; if (L > best) { best = L; br = r; } }   // score S x V : l'arc est coloré, les étoiles et bulles blanches ne le sont pas
      if (best >= 110) rhos.push(br);   // seulement là où un arc existe (les écarts entre arcs et les bulles ne sont pas des arcs)
    }
    // écart ROBUSTE (MAD x 1,4826) : les étoiles posées sur l'anneau et les bulles déplacent quelques pics sans déplacer l'anneau
    const med = (v: number[]): number => { const q = [...v].sort((a, b) => a - b); return q.length ? (q[Math.floor(q.length / 2)] as number) : 0; };
    const m0 = med(rhos); const sd = 1.4826 * med(rhos.map((r) => Math.abs(r - m0)));
    add('geometry', 'arcs-concentric', rhos.length < 30 || sd <= ARC_RADIUS_SD_MAX, sd, ARC_RADIUS_SD_MAX, 'les arcs lumineux ne sont pas portés par un cercle concentrique à l’iris');
  }
  // anatomie + style : un seul balayage du disque 0,12–0,9
  let n = 0, dark = 0, grad = 0, ng = 0, lumSum = 0, nAll = 0, white = 0;
  for (let k = 0; k < 90; k++) for (let r = Math.max(0.12, c.eye.pupil.size * 1.05); r <= 0.9; r += 0.03) {
    const a = (k * 4) * DEG; const x = c.cx + Math.cos(a) * c.rx * r, y = c.cy + Math.sin(a) * c.ry * r; if (!c.inOpening(x, y)) continue;
    const [R, G, B] = c.rgbAt(x, y); const mx = Math.max(R, G, B), mn = Math.min(R, G, B); nAll++; if (mn > 235) white++; if (mx / 255 > 0.93 && (mx === 0 ? 0 : (mx - mn) / mx) < 0.35) continue;
    n++; const lum = 0.2126 * R + 0.7152 * G + 0.0722 * B; lumSum += lum; if (lum < 50) dark++;
    const g = Math.abs(c.lumAt(x + 1, y) - c.lumAt(x - 1, y)) / 2 + Math.abs(c.lumAt(x, y + 1) - c.lumAt(x, y - 1)) / 2; grad += g; ng++;
  }
  if (n >= 60) add('style', 'iris-luminance-plausible', lumSum / n >= ATOM_LUM_MIN && lumSum / n <= ATOM_LUM_MAX, lumSum / n, ATOM_LUM_MIN, 'la luminance moyenne de l’iris sort de la plage des références (89–169, marge comprise) : iris trop sombre ou délavé');
  if (nAll >= 60) add('style', 'iris-white-share-plausible', white / nAll <= ATOM_WHITE_MAX, white / nAll, ATOM_WHITE_MAX, 'trop de blanc pur dans l’iris : les reflets étoilés couvrent l’iris en aplats blancs au lieu de rayonner (références : 0 à 0,108)');
  if (n >= 60) add('anatomy', 'iris-dark-share-plausible', dark / n <= ATOM_DARK_MAX, dark / n, ATOM_DARK_MAX, 'l’iris est presque entièrement noir (part de pixels sombres hors pupille et reflets au-delà de la plage des références)');
  const edgeMin = d!.slits || (d!.voids && d!.voids.length) || (d!.facets && d!.facets.cut > 0) ? ATOM_EDGE_MIN : ATOM_EDGE_MIN_LIGHT;
  if (ng >= 60) add('style', 'atomic-edge-density', grad / ng >= edgeMin, grad / ng, edgeMin, 'le détail atomique demandé n’apparaît pas à l’image : gradient de luminance de l’iris sous le seuil');
  return out;
}

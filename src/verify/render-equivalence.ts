import type { Raster } from '../regression/png';
import { check, type Check } from './types';

/**
 * COUCHE DE VÉRIFICATION D'ÉQUIVALENCE DE RENDU — prouve qu'une optimisation de vitesse n'a changé ni la forme, ni l'anatomie, ni le style.
 *
 * Elle compare un rendu de RÉFÉRENCE (chemin lent, spécification) à un rendu OPTIMISÉ, sur les trois couches du moteur :
 *  - géométrie  : les tracés (`d`, ellipses) du SVG sont identiques caractère pour caractère, et les silhouettes coïncident (IoU) ;
 *  - anatomie   : les contours (gradient de luminance) restent superposés (corrélation) et les traits sombres (yeux, sourcils, bouche,
 *                 cheveux) occupent les mêmes pixels (IoU) — un décalage d'un composant, même de 1–2 px, fait chuter ces mesures ;
 *  - style      : couleur moyenne, contraste global et ÉNERGIE DE GRAIN (haute fréquence des zones planes) restent dans des bornes serrées —
 *                 une peau lissée ou un grain trop fort est détecté.
 * * Toutes les grandeurs sont observables sur les pixels. Les bornes ont été calibrées sur 24 rendus (docs/PERF-2.md) et le contrôle négatif
 * (`shifted`) montre qu'elles échouent bien sur un défaut réel.
 */
export interface EquivalenceMetrics {
  readonly pathsIdentical: number;
  readonly silhouetteIoU: number;
  readonly edgeCorrelation: number;
  readonly darkFeatureIoU: number;
  readonly meanColorShift: number;
  readonly contrastRatio: number;
  readonly grainEnergyRatio: number;
}

/** Bornes par défaut (calibrées, voir docs/PERF-2.md §Vérification). */
export const EQUIVALENCE_LIMITS = { silhouetteIoU: 0.9995, edgeCorrelation: 0.985, darkFeatureIoU: 0.985, meanColorShift: 1.0, contrastLow: 0.98, contrastHigh: 1.02, grainLow: 0.8, grainHigh: 1.25 } as const;

const luma = (r: Raster): Float32Array => {
  const n = r.width * r.height; const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = 0.299 * (r.data[i * 4] as number) + 0.587 * (r.data[i * 4 + 1] as number) + 0.114 * (r.data[i * 4 + 2] as number);
  return out;
};

/** Gradient de Sobel (magnitude) d'une image de luminance ; bords à 0. */
function sobel(l: Float32Array, w: number, h: number): Float32Array {
  const g = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const gx = -l[i - w - 1]! - 2 * l[i - 1]! - l[i + w - 1]! + l[i - w + 1]! + 2 * l[i + 1]! + l[i + w + 1]!;
    const gy = -l[i - w - 1]! - 2 * l[i - w]! - l[i - w + 1]! + l[i + w - 1]! + 2 * l[i + w]! + l[i + w + 1]!;
    g[i] = Math.hypot(gx, gy);
  }
  return g;
}

function pearson(a: Float32Array, b: Float32Array): number {
  const n = a.length; let ma = 0; let mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]!; mb += b[i]!; }
  ma /= n; mb /= n;
  let sab = 0; let saa = 0; let sbb = 0;
  for (let i = 0; i < n; i++) { const x = a[i]! - ma; const y = b[i]! - mb; sab += x * y; saa += x * x; sbb += y * y; }
  return saa === 0 || sbb === 0 ? (saa === sbb ? 1 : 0) : sab / Math.sqrt(saa * sbb);
}

/** Intersection sur union de deux masques binaires (1 si les deux sont vides). */
function iou(a: Uint8Array, b: Uint8Array): number {
  let i = 0; let u = 0;
  for (let k = 0; k < a.length; k++) { const x = a[k]!; const y = b[k]!; if (x && y) i++; if (x || y) u++; }
  return u === 0 ? 1 : i / u;
}

/** Énergie haute fréquence des zones PLANES : écart quadratique moyen du laplacien là où le gradient de la référence est faible (< 12). */
function grainEnergy(l: Float32Array, flatGrad: Float32Array, w: number, h: number): number {
  let s = 0; let n = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (flatGrad[i]! >= 12) continue;
    const lap = 4 * l[i]! - l[i - 1]! - l[i + 1]! - l[i - w]! - l[i + w]!;
    s += lap * lap; n++;
  }
  return n === 0 ? 0 : Math.sqrt(s / n);
}

/** Extrait les tracés du SVG (attributs `d`, ellipses) dans l'ordre : la géométrie émise, sans les filtres. */
export function geometryOf(svg: string): string[] {
  return [...svg.matchAll(/<(?:path|ellipse|rect|circle)\b[^>]*?>/g)].map((m) => m[0].replace(/ (?:fill|filter|stroke|opacity|clip-path|mask)="[^"]*"/g, ''));
}

/** Mesures d'équivalence entre le rendu de référence et le rendu optimisé (mêmes dimensions). */
export function measureEquivalence(ref: Raster, opt: Raster, refSvg: string, optSvg: string): EquivalenceMetrics {
  if (ref.width !== opt.width || ref.height !== opt.height) throw new Error('rendus de tailles différentes');
  const { width: w, height: h } = ref;
  const la = luma(ref); const lb = luma(opt);
  const n = w * h;
  // Fond = couleur du coin haut-gauche de la référence ; silhouette = pixels qui s'en écartent.
  const bg = [ref.data[0]!, ref.data[1]!, ref.data[2]!];
  const mask = (r: Raster): Uint8Array => { const m = new Uint8Array(n); for (let i = 0; i < n; i++) m[i] = Math.abs(r.data[i * 4]! - bg[0]!) + Math.abs(r.data[i * 4 + 1]! - bg[1]!) + Math.abs(r.data[i * 4 + 2]! - bg[2]!) > 12 ? 1 : 0; return m; };
  const ma = mask(ref); const mb = mask(opt);
  const ga = sobel(la, w, h); const gb = sobel(lb, w, h);
  // Seuil RELATIF : moitié de la luminance médiane de la silhouette (un seuil absolu serait franchi par le grain sur une peau foncée).
  const hist = new Uint32Array(256); let inside = 0;
  for (let i = 0; i < n; i++) if (ma[i]) { hist[Math.min(255, Math.round(la[i]!))]!++; inside++; }
  let acc = 0; let med = 0; while (med < 255 && acc + hist[med]! < inside / 2) { acc += hist[med]!; med++; }
  const thr = 0.5 * med;
  const dark = (l: Float32Array): Uint8Array => { const m = new Uint8Array(n); for (let i = 0; i < n; i++) m[i] = l[i]! < thr && ma[i] ? 1 : 0; return m; };
  const darkB = new Uint8Array(n); for (let i = 0; i < n; i++) darkB[i] = lb[i]! < thr && (ma[i] || mb[i]) ? 1 : 0;
  // Statistiques de style sur la silhouette de la référence.
  let cnt = 0; const ra = [0, 0, 0]; const rb = [0, 0, 0]; let sa = 0; let sb = 0; let sa2 = 0; let sb2 = 0;
  for (let i = 0; i < n; i++) if (ma[i]) {
    cnt++;
    for (let c = 0; c < 3; c++) { ra[c]! += ref.data[i * 4 + c]!; rb[c]! += opt.data[i * 4 + c]!; }
    sa += la[i]!; sa2 += la[i]! * la[i]!; sb += lb[i]!; sb2 += lb[i]! * lb[i]!;
  }
  const c = Math.max(1, cnt);
  const sdA = Math.sqrt(Math.max(0, sa2 / c - (sa / c) ** 2)); const sdB = Math.sqrt(Math.max(0, sb2 / c - (sb / c) ** 2));
  const ea = grainEnergy(la, ga, w, h); const eb = grainEnergy(lb, ga, w, h);
  return {
    pathsIdentical: JSON.stringify(geometryOf(refSvg)) === JSON.stringify(geometryOf(optSvg)) ? 1 : 0,
    silhouetteIoU: iou(ma, mb),
    edgeCorrelation: pearson(ga, gb),
    darkFeatureIoU: iou(dark(la), darkB),
    meanColorShift: Math.max(...[0, 1, 2].map((k) => Math.abs(ra[k]! - rb[k]!) / c)),
    contrastRatio: sdA === 0 ? 1 : sdB / sdA,
    grainEnergyRatio: ea === 0 ? 1 : eb / ea,
  };
}

/** Les sept contrôles, répartis sur les trois couches du moteur. */
export function equivalenceChecks(m: EquivalenceMetrics, L: typeof EQUIVALENCE_LIMITS = EQUIVALENCE_LIMITS): Check[] {
  return [
    check('geometry', 'equiv-paths-identical', '==', m.pathsIdentical, 1, 'les tracés du SVG optimisé diffèrent de la référence'),
    check('geometry', 'equiv-silhouette-iou', '>=', m.silhouetteIoU, L.silhouetteIoU, 'la silhouette du rendu optimisé ne coïncide pas avec la référence'),
    check('anatomy', 'equiv-edge-correlation', '>=', m.edgeCorrelation, L.edgeCorrelation, 'les contours (yeux, nez, bouche, cheveux) ne sont plus superposés'),
    check('anatomy', 'equiv-dark-feature-iou', '>=', m.darkFeatureIoU, L.darkFeatureIoU, 'les traits sombres ne couvrent plus les mêmes pixels'),
    check('style', 'equiv-mean-color-shift', '<=', m.meanColorShift, L.meanColorShift, 'la couleur moyenne du rendu a dérivé'),
    check('style', 'equiv-contrast-ratio-low', '>=', m.contrastRatio, L.contrastLow, 'le contraste global a baissé'),
    check('style', 'equiv-contrast-ratio-high', '<=', m.contrastRatio, L.contrastHigh, 'le contraste global a augmenté'),
    check('style', 'equiv-grain-energy-low', '>=', m.grainEnergyRatio, L.grainLow, 'le grain de peau est devenu trop lisse'),
    check('style', 'equiv-grain-energy-high', '<=', m.grainEnergyRatio, L.grainHigh, 'le grain de peau est devenu trop fort'),
  ];
}

import type { EyeInput } from './random-eye-helpers';

/**
 * FAMILLES D'IRIS « PHOTO » (passe 9) : 4 familles ADDITIVES tirées des mesures pixel par pixel des réfs 03, 05, 06, 09
 * (`scripts/eye-refs/extract_iris_photos.py` -> `references/eyes/measures-iris-photos.json`). Elles s'ajoutent aux 6 de `eye-iris-families.ts`
 * (`IRIS_FAMILIES` est INCHANGÉ : les 148 yeux existants gardent leur identité) ; elles sont construites uniquement avec les systèmes existants
 * (`iris.layers`, `iris.detail`, `highlights.list`, `pupil`) : aucun moteur par référence.
 *
 * Ce qui est MESURÉ (constantes ci-dessous, comparées au JSON par tests/eye-iris-photo.test.ts) : pupille / iris, aspect de la pupille, aspect du limbe,
 * position + rayon du reflet principal, palette radiale (centre, médiane, limbe) et angulaire (haut / bas). Ce qui est INTERPRÉTÉ (artistique, non mesurable) :
 * le motif des filigranes / fougères, le nombre de rayons, la lueur.
 * Enseignement anatomique des mesures : le reflet spéculaire est toujours dans la moitié HAUTE de l'iris (dy -0,66 à -0,15) et la tache claire de caustique
 * (lumière qui traverse la cornée) est dans la moitié BASSE, du côté opposé (réf. 03 : dy +0,65, rayon 0,33 ; réf. 09 : dy +0,44) -> `bottomGlow`.
 */
export const PHOTO_IRIS_FAMILIES = ['slit-sunburst', 'ember-sky', 'gold-filigree', 'frost-fern'] as const;
export type PhotoIrisFamily = (typeof PHOTO_IRIS_FAMILIES)[number];

/**
 * Mesures reprises du JSON (référence -> famille). Les couleurs sont les QUARTILES sombre (`dark`) et clair (`bright`) de la luminance par bande radiale
 * (centre 0,125 · milieu 0,458 · limbe 0,875), pas la moyenne : la moyenne mélange fond et filigrane en un ton moyen qui n'existe pas dans l'image (premier essai :
 * iris délavés). `pupilAspectHW` = `null` quand la composante sombre est coupée par un reflet ou une traînée (05 : 0,912 ; 09 : 0,51 = trait de lumière horizontal) :
 * non consommé, documenté dans docs/EYES-PASS-9.md.
 */
type Tri = readonly [string, string, string];
export const PHOTO_IRIS_MEASURES: Record<PhotoIrisFamily, {
  readonly ref: string; readonly pupilOverIris: number; readonly pupilAspectHW: number | null; readonly irisAspect: number | null;
  readonly specular: { readonly dx: number; readonly dy: number; readonly r: number };
  readonly dark: Tri; readonly bright: Tri; readonly top: string; readonly bottom: string;
}> = {
  'slit-sunburst': { ref: '03', pupilOverIris: 0.232, pupilAspectHW: 1.471, irisAspect: 1.106, specular: { dx: -0.519, dy: -0.614, r: 0.184 }, dark: ['#8d2d17', '#85633d', '#1b1d24'], bright: ['#d19c64', '#f9e488', '#ebc979'], top: '#2d465b', bottom: '#f1db8e' },
  'ember-sky': { ref: '05', pupilOverIris: 0.174, pupilAspectHW: null, irisAspect: 0.947, specular: { dx: 0.177, dy: -0.238, r: 0.132 }, dark: ['#4c292b', '#7a3025', '#321414'], bright: ['#8eb5d8', '#d1a790', '#f5a577'], top: '#534857', bottom: '#e98754' },
  'gold-filigree': { ref: '06', pupilOverIris: 0.1, pupilAspectHW: 1.079, irisAspect: 0.929, specular: { dx: 0.181, dy: -0.314, r: 0.082 }, dark: ['#8a4118', '#6e2e13', '#4d1c0c'], bright: ['#f0cf3b', '#f9f755', '#cc8a35'], top: '#91491c', bottom: '#eedd4b' },
  'frost-fern': { ref: '09', pupilOverIris: 0.105, pupilAspectHW: null, irisAspect: 0.957, specular: { dx: 0.57, dy: -0.381, r: 0.103 }, dark: ['#112665', '#274993', '#15296c'], bright: ['#3b96dd', '#7ceeef', '#489cde'], top: '#2a5da2', bottom: '#4bb7e1' },
};

/** Pupille à aspect mesuré : `deform.squash` (< 0 = étirée, sx = 1 + 0,5·s, sy = 1 − s) et taille corrigée pour que le rayon d'aire équivalente reste le rayon mesuré. */
export function pupilFromMeasure(overIris: number, aspectHW: number | null): { shape: 'round'; size: number; squash: number } {
  const A = aspectHW ?? 1; const squash = (1 - A) / (1 + 0.5 * A);
  return { shape: 'round', size: overIris / Math.sqrt((1 + squash * 0.5) * (1 - squash)), squash };
}
export function pupilFor(f: PhotoIrisFamily): { shape: 'round'; size: number; squash: number } {
  const M = PHOTO_IRIS_MEASURES[f]; return pupilFromMeasure(M.pupilOverIris, M.pupilAspectHW);
}

type Layers = NonNullable<NonNullable<EyeInput['iris']>['layers']>;
type Highlights = NonNullable<NonNullable<EyeInput['highlights']>['list']>;
type Detail = NonNullable<NonNullable<EyeInput['iris']>['detail']>;
export interface PhotoIris {
  readonly layers: Layers; readonly highlights: Highlights; readonly detail: Detail;
  readonly pupil: { readonly shape: 'round'; readonly size: number; readonly squash: number };
  readonly irisAspect: number | null; readonly limbalRing: number; readonly fibers: number;
  /** Lueur d'iris (`iris.glow`) : teinte de la famille, pas le bleu glacé par défaut du schéma (qui délavait les iris chauds). */
  readonly glow: { readonly color: string; readonly strength: number } | null;
  /** Matériau de base de l'iris (dégradé radial : centre -> limbe) qui REMPLACE le matériau hérité de l'œil ; absent : celui de l'œil est gardé (familles de la passe 9). */
  readonly base?: readonly { readonly offset: number; readonly color: string }[];
  /** Saturation du disque d'iris (`iris.vibrance`, passe 11) ; absent : 0 (aucun filtre). */
  readonly vibrance?: number;
}

export function photoIrisFamily(f: PhotoIrisFamily, rnd: () => number): PhotoIris {
  const M = PHOTO_IRIS_MEASURES[f]; const [dC, dM, dL] = M.dark; const [bC, bM, bL] = M.bright; const pupil = pupilFor(f);
  const j = (v: number, s: number): number => v + (rnd() - 0.5) * 2 * s;     // jitter borné : deux yeux de la même famille ne sont pas identiques
  const spec = (k: number, sz: number, op = 1): Highlights[number] => ({ kind: 'reflection', anchor: 'iris', x: M.specular.dx * k + (rnd() - 0.5) * 0.06, y: M.specular.dy + (rnd() - 0.5) * 0.06, size: sz, opacity: op, confine: 'iris' }) as Highlights[number];
  const sparkle = (x: number, y: number, size: number): Highlights[number] => ({ shape: 'sparkle', anchor: 'iris', x, y, size, intensity: 0.8, confine: 'iris' }) as Highlights[number];
  const hl = (...extra: Highlights): Highlights => [{ ...spec(1, M.specular.r * 1.25 + 0.02 * rnd()), role: 'primary' } as Highlights[number], { ...spec(-0.78, M.specular.r * 0.62, 0.75), role: 'secondary', y: M.specular.dy - 0.04 } as Highlights[number], ...extra];
  switch (f) {
    case 'slit-sunburst': // 03 : base jaune clair, rayons sombres (fibres à fort contraste), calotte bleu-vert en haut (ombre de paupière + ciel), caustique pâle en bas, pupille brun-rouge étirée
      return {
        layers: [
          { color: bM, color2: bL, gradient: 'radial', opacity: 1 },
          { color: dC, mask: 'ring', inner: 0.04, outer: 0.2, feather: 0.4, opacity: 0.95, irregularity: 0.5 },
          { color: M.top, color2: '#3a8f78', mask: 'half', angleDeg: 0, gradient: 'radial', inner: 0.1, feather: 0.45, opacity: 0.95 },
          { color: '#3f9a82', mask: 'sector', angleDeg: 40, span: 70, inner: 0.35, outer: 0.9, feather: 0.6, opacity: 0.6, irregularity: 0.6 },
          { color: '#fff3c4', mask: 'spot', angleDeg: 180, inner: 0.55, outer: 0.8, spotRadius: 0.3, feather: 0.55, opacity: 0.85, glow: 0.3 },
        ],
        highlights: hl(sparkle(0.45, 0.3, 0.12)), pupil, irisAspect: M.irisAspect, limbalRing: 0.85, fibers: 96, glow: { color: '#ffe9a0', strength: 0.15 },
        detail: { density: 0.95, contrast: 0.9, collarette: { radius: 0.4, irregularity: 0.7, opacity: 0.5 }, innerZone: { color: dC, strength: 0.6 }, crypts: 6, limbal: { width: 0.2, strength: 0.8 }, topShade: 0.7, bottomGlow: { color: '#fff3c4', strength: 0.75 }, pupilHalo: 0.1, sparkles: 5 } as Detail,
      };
    case 'ember-sky': // 05 : fond brun-rouge sombre, accents orange vif en bas et à droite, calotte de ciel bleu-gris en haut (reflet de fenêtre), pupille ronde 0,17
      return {
        layers: [
          { color: dM, color2: dL, gradient: 'radial', opacity: 1 },
          { color: bL, mask: 'ring', inner: 0.4, outer: 0.92, feather: 0.4, irregularity: 0.9, opacity: 0.5, glow: 0.25 },
          { color: bL, mask: 'half', angleDeg: 180, gradient: 'radial', inner: 0.1, feather: 0.6, opacity: 0.7, glow: 0.3 },
          { color: bC, color2: '#3d4a78', mask: 'sector', angleDeg: j(8, 10), span: 105, gradient: 'radial', inner: 0.12, outer: 0.88, feather: 0.5, opacity: 0.92 },
        ],
        highlights: hl(sparkle(-0.4, 0.55, 0.1)), pupil, irisAspect: M.irisAspect, limbalRing: 0.7, fibers: 80, glow: { color: '#ffb36b', strength: 0.2 },
        detail: { density: 0.85, contrast: 0.8, collarette: { radius: 0.38, irregularity: 0.6, opacity: 0.45 }, innerZone: null, crypts: 8, limbal: { width: 0.22, strength: 0.7 }, topShade: 0.45, bottomGlow: { color: '#ffb36b', strength: 0.55 }, pupilHalo: 0.1, sparkles: 8 } as Detail,
      };
    case 'gold-filigree': // 06 : fond brun-orangé, filigrane jaune vif, collerette vive à r = 0,41, pupille minuscule, limbe presque noir
      return {
        layers: [
          { color: dC, color2: dL, gradient: 'radial', opacity: 1 },
          { color: bM, mask: 'ring', inner: 0.1, outer: 0.4, feather: 0.4, irregularity: 0.6, opacity: 0.5 },
          { color: bM, mask: 'ring', inner: 0.38, outer: 0.46, feather: 0.2, opacity: 0.95, glow: 0.7 },
          { color: bC, mask: 'ring', inner: 0.5, outer: 0.93, feather: 0.3, irregularity: 1, opacity: 0.55, glow: 0.5 },
        ],
        highlights: hl(sparkle(-0.3, 0.45, 0.1)), pupil, irisAspect: M.irisAspect, limbalRing: 0.95, fibers: 110, glow: { color: '#ffd34a', strength: 0.4 },
        detail: { density: 0.9, contrast: 0.75, collarette: { radius: 0.41, irregularity: 0.35, opacity: 0.85 }, innerZone: { color: bC, strength: 0.5 }, crypts: 4, accent: { color: '#fff0a8', reach: 0.35, spikes: 36, opacity: 0.5 }, limbal: { width: 0.18, strength: 0.9 }, topShade: 0.5, bottomGlow: { color: bM, strength: 0.6 }, pupilHalo: 0.2, sparkles: 12 } as Detail,
      };
    case 'frost-fern': // 09 : marine sombre, fougères cyan vif dans l'anneau externe, collerette fibreuse, pupille quasi noire, bas plus clair
      return {
        layers: [
          { color: dM, color2: dL, gradient: 'radial', opacity: 1 },
          { color: bC, mask: 'ring', inner: 0.1, outer: 0.3, feather: 0.4, opacity: 0.8 },
          { color: bM, mask: 'ring', inner: 0.3, outer: 0.78, feather: 0.35, irregularity: 0.9, opacity: 0.5, glow: 0.6 },
          { color: bL, mask: 'half', angleDeg: 180, gradient: 'radial', inner: 0.2, feather: 0.65, opacity: 0.35 },
          { color: '#e0f8ff', mask: 'ring', inner: 0.5, outer: 0.93, feather: 0.25, irregularity: 1, opacity: 0.5, glow: 0.6 },
        ],
        highlights: hl(sparkle(-0.35, -0.12, 0.14)), pupil, irisAspect: M.irisAspect, limbalRing: 0.9, fibers: 120, glow: { color: '#5ab8ff', strength: 0.35 },
        detail: { density: 0.9, contrast: 0.7, collarette: { radius: 0.5, irregularity: 0.8, opacity: 0.7 }, innerZone: { color: bC, strength: 0.55 }, crypts: 0, bubbles: { count: 8, size: 0.06, opacity: 0.8, zone: 'lower' }, limbal: { width: 0.2, strength: 0.8 }, topShade: 0.4, bottomGlow: { color: bL, strength: 0.6 }, pupilHalo: 0.25, sparkles: 10 } as Detail,
      };
  }
}

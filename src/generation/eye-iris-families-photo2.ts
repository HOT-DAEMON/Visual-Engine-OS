import type { EyeInput } from './random-eye-helpers';
import { pupilFromMeasure, type PhotoIris } from './eye-iris-families-photo';

/**
 * FAMILLES D'IRIS « PHOTO 2 » (passe 10) : 5 familles ADDITIVES tirées des mesures pixel par pixel des réfs 04, 07, 08 (deux yeux) et 10 (deux yeux)
 * (`scripts/eye-refs/extract_iris_photos.py` -> `references/eyes/measures-iris-photos.json`, ids 04, 07, 08a, 08b, 10a, 10b). Elles s'ajoutent aux 6 de
 * `eye-iris-families.ts` et aux 4 de `eye-iris-families-photo.ts` (aucune des deux listes n'est modifiée : les 248 yeux existants gardent leur identité) ;
 * construites avec les seuls systèmes en place (`iris.layers`, `iris.detail` dont `facets` / `bubbles` / `accent`, `highlights.list`, `pupil`) : aucun moteur par référence.
 *
 * MESURÉ (constantes ci-dessous, comparées au JSON par tests/eye-iris-photo2.test.ts) : pupille / iris, aspect de la pupille (quand une étoile ou un reflet ne la coupe pas),
 * aspect du limbe (corrigé en passe 10 : le repère de l'ellipse était lu à 90° en passe 9), reflet principal, quartiles sombre / clair (centre 0,125 · milieu 0,458 · limbe 0,875),
 * teintes du haut et du bas. INTERPRÉTÉ : motifs (facettes, rayons, bulles, nombre de pointes), lueurs, valeurs de `detail`.
 * 10a : limbe coupé par la paupière (0,785 non fiable) et pupille noyée dans l'étoile (0,044, sous le plancher du schéma 0,08 -> bornée à 0,08) ; 07 : pupille coupée par le double reflet (aspect non fiable).
 */
export const PHOTO2_IRIS_FAMILIES = ['prism-star', 'emerald-facets', 'lime-cyan', 'fire-halo', 'ice-star'] as const;
export type Photo2IrisFamily = (typeof PHOTO2_IRIS_FAMILIES)[number];

type Tri = readonly [string, string, string];
export const PHOTO2_IRIS_MEASURES: Record<Photo2IrisFamily, {
  readonly ref: string; readonly pupilOverIris: number; readonly pupilAspectHW: number | null; readonly irisAspect: number | null;
  readonly specular: { readonly dx: number; readonly dy: number; readonly r: number };
  readonly dark: Tri; readonly bright: Tri; readonly vivid: Tri; readonly sectors: readonly string[]; readonly top: string; readonly bottom: string;
}> = {
  'prism-star': { ref: '04', pupilOverIris: 0.259, pupilAspectHW: 0.99, irisAspect: 0.978, specular: { dx: -0.669, dy: -0.49, r: 0.145 }, dark: ['#565627', '#4a371c', '#0a1115'], bright: ['#d5d3a6', '#b6dfbe', '#9ad4b6'], vivid: ['#a59f54', '#a59c59', '#58c2b0'], sectors: ['#c08243', '#69a690', '#35dab9', '#1fe5d5', '#9ac97a', '#e89563', '#40aca7', '#ae8546'], top: '#6f6365', bottom: '#99bd83' },
  'emerald-facets': { ref: '07', pupilOverIris: 0.145, pupilAspectHW: null, irisAspect: 0.931, specular: { dx: 0.433, dy: -0.399, r: 0.146 }, dark: ['#0b4627', '#176537', '#09201d'], bright: ['#6a994c', '#afe690', '#7ed398'], vivid: ['#45a249', '#59c367', '#45c091'], sectors: ['#398346', '#91b470', '#26ad6c', '#3ec88b', '#6ddf95', '#2ed99f', '#35ae6d', '#188245'], top: '#255b3f', bottom: '#96dd9b' },
  'lime-cyan': { ref: '08a', pupilOverIris: 0.162, pupilAspectHW: 1.062, irisAspect: 1.08, specular: { dx: -0.825, dy: -0.034, r: 0.053 }, dark: ['#326269', '#279f97', '#3d6351'], bright: ['#b5a283', '#caf448', '#d4da64'], vivid: ['#76918f', '#adef5b', '#d3ee46'], sectors: ['#2ca9a5', '#26a49a', '#3bba86', '#6be485', '#defb40', '#c8f64c', '#b8ee4c', '#2fa6a0'], top: '#5fac75', bottom: '#caf54b' },
  'fire-halo': { ref: '10a', pupilOverIris: 0.044, pupilAspectHW: null, irisAspect: null, specular: { dx: 0.508, dy: -0.419, r: 0.072 }, dark: ['#392657', '#181225', '#160e20'], bright: ['#73a9d1', '#f6be75', '#b08ab0'], vivid: ['#4896e4', '#e66a3a', '#6a4d7e'], sectors: ['#564b74', '#d17035', '#e67d47', '#eda662', '#f5b36d', '#e95f36', '#d96033', '#7d4256'], top: '#342b3b', bottom: '#ca9299' },
  'ice-star': { ref: '10b', pupilOverIris: 0.116, pupilAspectHW: 0.935, irisAspect: 1.003, specular: { dx: 0.014, dy: -0.231, r: 0.139 }, dark: ['#2f365e', '#0a1020', '#1a2c50'], bright: ['#9f9fd9', '#6fd2e7', '#b8b7c6'], vivid: ['#6063bd', '#4fbde2', '#378ec5'], sectors: ['#4049a1', '#3695c2', '#38bee4', '#46daf2', '#59cee8', '#48c2e8', '#27a7df', '#3874ba'], top: '#2a2c4f', bottom: '#78a3bd' },
};
/** Réf. 08 : deux yeux de la même paire mesurés (08a 1,080 · 08b 1,202 : œil en perspective) -> l'aspect de `lime-cyan` est tiré ENTRE les deux valeurs mesurées. */
export const LIME_CYAN_ASPECT_RANGE = [1.08, 1.202] as const;
export const PHOTO2_PUPIL_FLOOR = 0.08;   // plancher du schéma (`pupil.size`) : 10a (0,044) y est ramené

export function pupilFor2(f: Photo2IrisFamily): { shape: 'round'; size: number; squash: number } {
  const M = PHOTO2_IRIS_MEASURES[f]; const p = pupilFromMeasure(M.pupilOverIris, M.pupilAspectHW);
  return { ...p, size: Math.max(PHOTO2_PUPIL_FLOOR, p.size) };
}

type Highlights = NonNullable<NonNullable<EyeInput['highlights']>['list']>;
type Detail = NonNullable<NonNullable<EyeInput['iris']>['detail']>;

export function photoIrisFamily2(f: Photo2IrisFamily, rnd: () => number): PhotoIris {
  const M = PHOTO2_IRIS_MEASURES[f]; const [dC, dM, dL] = M.dark; const [, bM, bL] = M.bright; const [vC, vM, vL] = M.vivid; const S = M.sectors; const pupil = pupilFor2(f);
  const j = (v: number, s: number): number => v + (rnd() - 0.5) * 2 * s;
  const spec = (k: number, sz: number, op = 1): Highlights[number] => ({ kind: 'reflection', anchor: 'iris', x: M.specular.dx * k + (rnd() - 0.5) * 0.06, y: M.specular.dy + (rnd() - 0.5) * 0.06, size: sz, opacity: op, confine: 'iris' }) as Highlights[number];
  const sparkle = (x: number, y: number, size: number, intensity = 0.9): Highlights[number] => ({ shape: 'sparkle', anchor: 'iris', x, y, size, intensity, confine: 'iris' }) as Highlights[number];   // passe 12 : `intensity` = halo (bloom) ; les grands éclats le réduisent (0,3) : sinon un voile gris lave l'iris
  /** ÉTOILE RAYONNANTE (passe 13) : corps `sparkle` + aiguilles (`rays`) + teinte des pointes et de l'aura (`tint`) + irrégularité déterministe (`jitter`) ; tailles calibrées sur `measures-iris-atoms.json` (Feret / rayon d'iris). */
  const flare = (x: number, y: number, size: number, o: Partial<Highlights[number]> = {}): Highlights[number] => ({ shape: 'sparkle', anchor: 'iris', x, y, size, intensity: 0.3, softness: 0.2, confine: 'iris', ...o }) as Highlights[number];
  /** Applique le rayonnement aux éclats `primary` / `secondary` d'une liste (les reflets-taches ne sont pas touchés). */
  const radiant = (l: Highlights, o: Partial<Highlights[number]>): Highlights => l.map((h) => (h.shape === 'sparkle' && h.role ? { softness: 0.2, ...h, ...o } : h) as Highlights[number]);
  // reflet principal : tache (réflexion de fenêtre : 04) ou ÉCLAT EN ÉTOILE (07, 10 : le reflet mesuré est un éclat, pas un blob)
  const hl = (star: boolean, ...extra: Highlights): Highlights => [
    star ? ({ ...sparkle(M.specular.dx, M.specular.dy, M.specular.r * 2.2, 0.3), role: 'primary' } as Highlights[number]) : ({ ...spec(1, M.specular.r * 1.25 + 0.02 * rnd()), role: 'primary' } as Highlights[number]),
    (star ? { ...sparkle(-M.specular.dx * 0.9 + (rnd() - 0.5) * 0.06, M.specular.dy + 0.04 + (rnd() - 0.5) * 0.06, M.specular.r * 2, 0.3), role: 'secondary' } : { ...spec(-0.7, M.specular.r * 0.6, 0.7), role: 'secondary', y: M.specular.dy + 0.05 }) as Highlights[number], ...extra];
  // 10b : SIX étoiles à six pointes en hexagone autour de la pupille (rayon 0,56 de l'iris, premier sommet à −90°) : l'étoile de la référence est répétée, pas unique.
  /** Écrasement vertical de l'hexagone (passe 12) : le sommet haut / bas à 0,7 sortait de la boîte de l'ouverture (règle `highlights-confined`) ; 0,8 = l'iris des enveloppes basses reste dans l'ouverture. */
  const HEX_SQUASH = 0.8;
  const hexStars = (size: number, tint: string): Highlights => Array.from({ length: 6 }, (_, k) => { const a = -Math.PI / 2 + (k * Math.PI) / 3; /* l'étoile du bas est rognée par la paupière inférieure (réf. 10b) : plus petite pour rester dans l'ouverture */ return flare(Math.cos(a) * 0.7, Math.sin(a) * 0.7 * HEX_SQUASH, k === 3 ? size * 0.7 : size, { points: 6, inner: 0.35, rays: 0.6, tint, jitter: 0.5, rotationDeg: k * 17, intensity: 0 }); });
  const stops = (a: string, b: string, c: string): readonly { offset: number; color: string }[] => [{ offset: 0, color: a }, { offset: 0.55, color: b }, { offset: 1, color: c }];
  switch (f) {
    case 'prism-star': // 04 : collerette dorée autour de la pupille, turquoise vif en haut à droite, orangé en bas à gauche, jaune-vert en bas (prisme), croix de lumière
      return {
        base: stops(vC, vM, dL),
        layers: [
          { color: vC, mask: 'ring', inner: 0.08, outer: 0.58, feather: 0.3, irregularity: 0.6, opacity: 0.92, glow: 0.4 },
          { color: S[3] as string, color2: S[2] as string, mask: 'sector', angleDeg: 112, span: 100, gradient: 'angular', inner: 0.55, outer: 0.93, feather: 0.5, opacity: 0.95, irregularity: 0.7 },
          { color: S[5] as string, mask: 'sector', angleDeg: j(225, 8), span: 70, inner: 0.55, outer: 0.92, feather: 0.5, opacity: 0.9, irregularity: 0.7 },
          { color: S[6] as string, mask: 'sector', angleDeg: 275, span: 50, inner: 0.35, outer: 0.9, feather: 0.5, opacity: 0.7, irregularity: 0.6 },
          { color: S[4] as string, mask: 'spot', angleDeg: 180, inner: 0.5, outer: 0.85, spotRadius: 0.28, feather: 0.6, opacity: 0.9, glow: 0.4 },
        ],
        highlights: [...hl(false), flare(0, 0, 0.4, { rays: 1.1, tint: '#ffd68a', jitter: 0.3 }), flare(0.38, 0.12, 0.2, { shape: 'star', points: 5, inner: 0.5, rays: 0.45, tint: '#9ff0e0', intensity: 0.4, jitter: 0.4 })], pupil, irisAspect: M.irisAspect, limbalRing: 0.9, fibers: 120, glow: { color: '#ffe9a0', strength: 0.1 },
        detail: { density: 1, contrast: 0.9, collarette: { radius: 0.4, irregularity: 0.7, opacity: 0.5 }, innerZone: { color: vC, strength: 0.4 }, crypts: 4, accent: { color: vC, reach: 0.5, spikes: 32, opacity: 0.6 }, facets: { count: 14, rings: 2, contrast: 0.6, dispersion: 0.5, rays: 6 }, slits: { count: 34, long: 6, widthDeg: 3.8, depth: 1, inner: 0.3, outer: 0.92, taper: 0.55, curve: 8 }, rainbow: { angleDeg: 215, span: 150, inner: 0.3, outer: 0.97, hueFrom: 315, hueTo: 75, streaks: 30, opacity: 0.8 }, limbal: { width: 0.14, strength: 0.8 }, topShade: 0.35, bottomGlow: { color: S[4] as string, strength: 0.5 }, pupilHalo: 0.1, sparkles: 12 } as Detail,
        lift: 0.38, vibrance: 0.223, // calibrée par bissection sur la saturation des pics mesurée (scripts/eye-refs/calibrate-vibrance.ts)
      };
    case 'emerald-facets': // 07 : gemme à facettes, vert franc partout, plus clair en bas, collerette claire à r = 0,46, bulles dans la moitié basse, limbe presque noir ; passe 14 : vide interne resserré (0,34 -> 0,22 : petite pupille à fin halo sombre comme la réf.), 36 facettes (cellules 50 -> 97 pour 105), `cut` 0,5
      return {
        base: stops(vC, vM, S[7] as string),
        layers: [
          { color: bM, mask: 'ring', inner: 0.4, outer: 0.58, feather: 0.4, irregularity: 0.6, opacity: 0.4, glow: 0.3 },
          { color: S[4] as string, mask: 'half', angleDeg: 180, gradient: 'radial', inner: 0.2, feather: 0.6, opacity: 0.7, glow: 0.3 },
          { color: S[0] as string, mask: 'half', angleDeg: 0, gradient: 'radial', inner: 0.2, feather: 0.5, opacity: 0.8 },
          { color: S[5] as string, mask: 'sector', angleDeg: 230, span: 70, inner: 0.3, outer: 0.9, feather: 0.5, opacity: 0.6, irregularity: 0.7 },
        ],
        highlights: [...radiant(hl(true), { size: 0.3, rays: 1.0, tint: '#8cf0a8', jitter: 0.3 }), flare(0.55, -0.3, 0.2, { shape: 'star', points: 5, inner: 0.5, rays: 0.45, tint: '#b6ffcb', jitter: 0.4 }), flare(-0.5, 0.25, 0.17, { shape: 'star', points: 5, inner: 0.5, rays: 0.35, tint: '#b6ffcb', jitter: 0.5 })], pupil, irisAspect: M.irisAspect, limbalRing: 0.85, fibers: 96, glow: { color: '#9af0b4', strength: 0.1 },
        detail: { density: 0.2, contrast: 0.4, collarette: { radius: 0.46, irregularity: 0.5, opacity: 0.5 }, innerZone: { color: dC, strength: 0.5 }, crypts: 0, facets: { count: 36, rings: 4, contrast: 0.8, dispersion: 0.1, rays: 0, cut: 0.5, shard: 0.3, dust: 0.5 }, bubbles: { count: 22, size: 0.088, opacity: 0.95, zone: 'lower', crisp: 0.8, sizeSpread: 0.5, rim: 0.65 }, voids: [{ inner: 0.1, outer: 0.22, strength: 0.95 }, { inner: 0.8, outer: 1, strength: 0.95 }], limbal: { width: 0.2, strength: 0.9 }, topShade: 0.5, bottomGlow: { color: S[4] as string, strength: 0.5 }, pupilHalo: 0.1, sparkles: 6 } as Detail,
        lift: 0.4, vibrance: 0.28, // calibrée par bissection sur la saturation des pics mesurée (scripts/eye-refs/calibrate-vibrance.ts)
      };
    case 'lime-cyan': // 08 : style cel-shading, citron en bas, vert plus froid en haut, cyan autour d'une pupille bleue ; aspect tiré entre les deux yeux mesurés
      return {
        base: stops(vC, vM, vL),
        layers: [
          { color: S[0] as string, mask: 'ring', inner: 0.12, outer: 0.5, feather: 0.4, opacity: 0.85, glow: 0.3 },
          { color: S[0] as string, mask: 'half', angleDeg: 0, gradient: 'radial', inner: 0.15, feather: 0.55, opacity: 0.7 },
          { color: S[4] as string, mask: 'spot', angleDeg: 180, inner: 0.45, outer: 0.85, spotRadius: 0.3, feather: 0.5, opacity: 0.85, glow: 0.4 },
        ],
        highlights: hl(false, sparkle(-0.3, -0.35, 0.1)), pupil, irisAspect: LIME_CYAN_ASPECT_RANGE[0] + rnd() * (LIME_CYAN_ASPECT_RANGE[1] - LIME_CYAN_ASPECT_RANGE[0]), limbalRing: 0.8, fibers: 20, glow: { color: '#caf448', strength: 0.15 },
        detail: { density: 0.35, contrast: 0.7, collarette: { radius: 0.45, irregularity: 0.4, opacity: 0.85 }, innerZone: { color: dC, strength: 0.6 }, crypts: 0, limbal: { width: 0.18, strength: 0.7 }, topShade: 0.35, bottomGlow: { color: S[4] as string, strength: 0.5 }, pupilHalo: 0.3, sparkles: 0, arcs: { ringRho: 0.62, width: 0.04, count: 3, duty: 1, color: '#ffe83a', opacity: 1 }, embers: { count: 16, ringRho: 0.4, spread: 0.12, size: 0.014, streak: 0, opacity: 0.9, color: '#8af2ff' } } as Detail,
        lift: 0.17, vibrance: 0.105, // calibrée par bissection sur la saturation des pics mesurée (scripts/eye-refs/calibrate-vibrance.ts)
      };
    case 'fire-halo': // 10a : fond violet presque noir, cœur bleu, anneau orange feu à r = 0,42, étoile à rayons blancs, braises
      return {
        base: stops(dC, dM, dL),
        layers: [
          { color: dM, mask: 'full', opacity: 0.3, feather: 0 },
          { color: vC, mask: 'ring', inner: 0.03, outer: 0.24, feather: 0.4, opacity: 0.8, glow: 0.4 },
          { color: '#ff9a5a', mask: 'ring', inner: 0.27, outer: 0.52, feather: 0.35, irregularity: 0.3, opacity: 1, glow: 0.6 },
          { color: vL, mask: 'ring', inner: 0.78, outer: 0.95, feather: 0.5, opacity: 0.55 },
        ],
        highlights: [...radiant(hl(true), { size: 0.2, rays: 1.0, tint: '#ffb070', jitter: 0.4 }), flare(0, 0, 0.42, { rays: 1.6, tint: '#ff9a55', jitter: 0.3 }), flare(-0.45, -0.2, 0.15, { shape: 'star', points: 5, inner: 0.5, rays: 0.9, tint: '#ffc890', intensity: 0.4, jitter: 0.5 })], pupil, irisAspect: M.irisAspect, limbalRing: 0.9, fibers: 8, glow: { color: vM, strength: 0.12 },
        detail: { density: 0.2, contrast: 0.2, collarette: { radius: 0.43, irregularity: 0.6, opacity: 0.4 }, innerZone: null, crypts: 0, accent: { color: vM, reach: 0.3, spikes: 6, opacity: 0.6 }, voids: [{ inner: 0.1, outer: 0.28, strength: 0.9 }, { inner: 0.84, outer: 1, strength: 0.7 }], embers: { count: 30, ringRho: 0.4, spread: 0.5, size: 0.024, streak: 1, opacity: 0.9, color: S[3] as string, shape: 'lance', scatter: 0.35 }, limbal: { width: 0.16, strength: 0.8 }, topShade: 0.3, bottomGlow: { color: vM, strength: 0.4 }, pupilHalo: 0.1, sparkles: 14 } as Detail,
        lift: 0.5, vibrance: 0.152, // calibrée par bissection sur la saturation des pics mesurée (scripts/eye-refs/calibrate-vibrance.ts)
      };
    case 'ice-star': // 10b : marine presque noire, cœur violet-bleu, anneau cyan givré à r = 0,46, collerette pâle au limbe, étoile à six pointes, éclats de glace
      return {
        base: stops(dC, dM, dL),
        layers: [
          { color: dM, mask: 'full', opacity: 0.9, feather: 0 },
          { color: vC, mask: 'ring', inner: 0.03, outer: 0.26, feather: 0.4, opacity: 0.75, glow: 0.4 },
          { color: vM, mask: 'ring', inner: 0.40, outer: 0.46, feather: 0.1, irregularity: 0.3, opacity: 1, glow: 0.5 },
          { color: vL, mask: 'ring', inner: 0.58, outer: 0.7, feather: 0.2, irregularity: 0.8, opacity: 0.2 },      // passe 11 : anneaux resserrés et nets -> le fond marine reste sombre entre eux (part sombre 0,06 -> ~0,2 ; réf. 0,297)
          { color: bL, mask: 'ring', inner: 0.86, outer: 0.95, feather: 0.15, irregularity: 0.8, opacity: 0.8 },
        ],
        highlights: [...radiant(hl(true), { size: 0.33, rays: 1.5, tint: '#9fe0ff', jitter: 0.3 }), flare(0, 0, 0.2, { points: 8, rays: 1.8, tint: '#cdb8ff', jitter: 0.3 }), ...hexStars(0.38, '#8fe3ff')], pupil, irisAspect: M.irisAspect, limbalRing: 0.85, fibers: 0, glow: { color: vM, strength: 0.12 },
        detail: { density: 0.02, contrast: 0.15, collarette: { radius: 0.46, irregularity: 0.5, opacity: 0.4 }, innerZone: null, crypts: 0, accent: { color: vM, reach: 0.7, spikes: 6, opacity: 0.85 }, arcs: { ringRho: 0.7, width: 0.05, count: 9, duty: 0.62, color: vM, opacity: 0.9 }, voids: [{ inner: 0.5, outer: 0.7, strength: 0.4 }, { inner: 0.74, outer: 0.92, strength: 0.4 }, { inner: 0.16, outer: 0.4, strength: 0.4 }], limbal: { width: 0.16, strength: 0.8 }, topShade: 0.3, bottomGlow: { color: vM, strength: 0.3 }, pupilHalo: 0.1, sparkles: 4 } as Detail,
        lift: 0.6, vibrance: 0.355, // calibrée par bissection sur la saturation des pics mesurée (scripts/eye-refs/calibrate-vibrance.ts)
      };
  }
}

/**
 * Cas de RÉGRESSION VISUELLE à graines fixes.
 *
 * Deux familles, avec une règle : les cas DIFFICILES ne sont JAMAIS retirés parce qu'ils sont gênants. Un cas difficile est un visage
 * qui a déjà cassé (ou qui pourrait casser) une hypothèse : bornes extrêmes, combinaisons qui s'additionnent, éclairage rasant.
 * Le garder comme référence permanente est ce qui empêche de « réparer » le moteur en ne regardant que ce qui passe facilement.
 *  - `standard` : tirages aléatoires à graine fixe (le moteur tel qu'il sera utilisé) ;
 *  - `hard`     : paramètres poussés aux bornes, chacun avec la raison pour laquelle il est difficile (`why`).
 * Les cas sont des DONNÉES (pas de code) : `patch` est une surcharge profonde de `FaceParams`, `focus` le cadrage.
 */
export type Focus = 'face' | 'nose' | 'lower' | 'chin' | 'eyes';
export interface VisualCase {
  readonly id: string;
  readonly kind: 'standard' | 'hard';
  readonly why: string;
  readonly seed: number;
  readonly patch?: Record<string, unknown>;
  readonly light?: { azimuthDeg?: number; elevationDeg?: number; intensity?: number };
  readonly focus?: Focus;
}

/** Graines fixes des tirages standard : ne jamais les renuméroter (les références en dépendent). */
export const STANDARD_SEEDS: readonly number[] = [11, 23, 37, 41, 59, 67, 71, 83, 97, 101, 113, 127, 139, 151, 163, 181];

const standard: VisualCase[] = STANDARD_SEEDS.map((seed, i) => ({
  id: `std-${String(i + 1).padStart(2, '0')}`, kind: 'standard', why: 'tirage aléatoire structuré à graine fixe', seed,
  focus: i % 4 === 3 ? 'lower' : i % 4 === 2 ? 'nose' : 'face',
}));

const S = { anatomyEngine: 'structured' };
const hard = (id: string, why: string, patch: Record<string, unknown>, extra: Partial<VisualCase> = {}): VisualCase => ({ id: `hard-${id}`, kind: 'hard', why, seed: 321, patch: { ...S, ...patch }, ...extra });

const HARD: VisualCase[] = [
  hard('01-machoire-etroite-menton-pointu', 'mâchoire minimale + convergence maximale : risque de bas de visage « en entonnoir » (déjà observé)', { jawWidth: 0.55, chinWidth: 0.08, jaw: { taper: 1, angle: 0.2 }, chin: { height: 0.24 } }),
  hard('02-machoire-carree-massive', 'os maximal + masséter + graisse : les quatre contributions de largeur s\'additionnent, le contour doit rester lisible', { jawWidth: 0.98, mandible: { bodyCurve: 0, lowerBorder: 1 }, softTissue: { masseter: { volume: 0.9, relief: 0.9 }, fat: 0.9 }, cheek: { volume: 0.9 } }),
  hard('03-bouche-ouverte-articulee', 'ouverture maximale + translation et avancée de la mandibule : lèvre inférieure, dents et menton doivent suivre ensemble', { mouth: { open: 1 }, deform: { articulation: { jawShift: 0.8, protrusion: 0.8 } } }, { focus: 'lower' }),
  hard('04-anime-stylisation-maximale', 'neuf contrôles de stylisation à 1 en mode anime : géométrie exagérée ET aplats à bords nets', { renderMode: 'anime', stylization: { chinProjection: 1, jawWidth: 1, angularity: 1, jawNeckContrast: 1, mouthSize: 1, cornerAsymmetry: 1, simplify: 1, outline: 1, detail: 0 } }),
  hard('05-encre-contours-maximaux', 'seuil global N&B : un détail fin peut disparaître ou se boucher', { renderMode: 'ink', stylization: { outline: 1, detail: 1 } }),
  hard('06-expression-caricaturale', 'colère + grimace + caricature maximales : trois déplacements qui se combinent sans s\'écraser', { deform: { expression: { anger: 1, grimace: 1, caricature: 1 } }, mouth: { open: 0.6 } }, { focus: 'lower' }),
  hard('07-lumiere-rasante', 'élévation 10° (minimum du schéma) : ombres longues, le nez et les orbites portent de grandes ombres', {}, { light: { azimuthDeg: 90, elevationDeg: 10, intensity: 1 } }),
  hard('08-contre-jour-faible', 'intensité 0,25 depuis l\'arrière : rien ne doit disparaître ni virer au noir plat', {}, { light: { azimuthDeg: 200, elevationDeg: 30, intensity: 0.25 } }),
  hard('09-nez-projection-maximale', 'nez long, large, pointe projetée au maximum : régions et ombres de la pointe', { nose: { length: 0.26, width: 0.3, tip: { projection: 1 } } }, { focus: 'nose' }),
  hard('10-nez-minimal', 'nez court et étroit, narines nulles : les régions deviennent minuscules (précision numérique)', { nose: { length: 0.08, width: 0.08, nostril: 0 } }, { focus: 'nose' }),
  hard('11-bouche-minuscule', 'bouche à sa largeur minimale et réduite par la stylisation : commissures, plis et philtrum se rapprochent', { mouth: { width: 0.16 }, stylization: { mouthSize: -1 } }, { focus: 'lower' }),
  hard('12-bouche-immense', 'bouche à sa largeur maximale et agrandie par la stylisation : doit rester bornée par le contour', { mouth: { width: 0.5, open: 0.5 }, stylization: { mouthSize: 1 } }, { focus: 'lower' }),
  hard('13-menton-extreme', 'menton haut et projeté au maximum sous une lèvre mince', { chin: { height: 0.24, projection: 1, dimple: 1, groove: 1 }, stylization: { chinProjection: 1 } }, { focus: 'chin' }),
  hard('14-cou-tendu-incline', 'angle cervico-mentonnier minimal, platysma et muscles maximaux, tête inclinée à 30°', { neck: { visible: true, cervicomentalDeg: 85, muscles: 1, platysma: 1, width: 0.8 }, deform: { articulation: { headPitchDeg: 30 } } }),
  hard('15-ouverture-plus-colere-plus-serrage', 'bouche ouverte + colère + mâchoires serrées : tout agit sur le masséter et la lèvre', { mouth: { open: 0.8 }, deform: { expression: { anger: 1 }, articulation: { clench: 1 } } }, { focus: 'lower' }),
  hard('16-tete-etroite-yeux-ecartes', 'yeux écartés au maximum sur une tête étroite : orbites et nez se rapprochent des bords du contour', { jawWidth: 0.55, eyeGap: 0.34, templeY: 0.22 }),
];

export const ALL_CASES: readonly VisualCase[] = [...standard, ...HARD];
export const HARD_CASES: readonly VisualCase[] = HARD;
export const STANDARD_CASES: readonly VisualCase[] = standard;

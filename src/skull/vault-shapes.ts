import { AZ_U } from './vault-mastoid';

/**
 * FORMES DE RELIEF DE LA VOÛTE (passe 2, `docs/SKULL-VAULT-2.md`) : arcade sourcilière, éminences frontales, crête métopique, chignon et protubérance occipitale,
 * muscle temporal, astérion. Source UNIQUE, lue par le relief 3D (`head-turntable/engines/vault-relief.ts`) ET par le contour de profil 2D (`skull/vault.ts`) : une seule
 * définition de forme, comme `vault-mastoid.ts`. Pure (aucune dépendance sauf la constante d'azimut). Chaque forme est un poids sans dimension (0 … 1) à multiplier par son
 * amplitude (`amp`, U ; tête de 230 mm ⇒ 0,010 U ≈ 2,3 mm), son paramètre signé et la transmission des tissus de sa région.
 * Hauteurs y : U de la tête, y vers le bas (0 = sommet) ; azimut az : ° (0 = face, 90 = côté, 180 = nuque), replié dans [0°, 180°] (la forme est symétrique).
 * Amplitudes et positions : conventions d'anatomie artistique (Gray ch. 4, Bridgman, Hogarth), NON mesurées sur des personnes ; calibrées par les bornes de
 * `verify-vault.ts` (saut ≤ 0,014 U entre échantillons, amplitude ≤ 0,06 U, rien à 4° du plan de face sous la glabelle).
 */
export const VAULT_SHAPE = {
  /** Arcade : axe y(az) = yG + y0 + drop·(az/azDrop)² (l'arcade descend vers l'angle externe de l'orbite) ; profil asymétrique en y (pente douce vers le front `up`, bord net sur l'orbite `down`) ; extinction entre azEnd − azFall et azEnd ; échelle par `browRidge` : ridgeLo + ridgeK·browRidge ; côté négatif (gouttière) à `sulcus` de l'amplitude. */
  arch: { amp: 0.018, y0: 0.004, drop: 0.05, azDrop: 56, azEnd: 58, azFall: 30, up: 0.03, down: 0.019, ridgeLo: 0.6, ridgeK: 0.8, sulcus: 0.5 },
  /** Éminences frontales : deux gaussiennes au-dessus de l'arcade (dyUp), à `az` du plan médian. */
  eminence: { amp: 0.028, dyUp: 0.135, sy: 0.07, az: 27, saz: 11 },
  /** Crête métopique : bande médiane (saz) entre le bregma (+ from) et la glabelle (− to), rampes `ramp`. */
  metopic: { amp: 0.012, saz: 4.5, from: 0.02, to: 0.05, ramp: 0.05 },
  /** Chignon : bosse de l'écaille à dyUp au-dessus de l'inion, centrée sur l'axe de la nuque. */
  bun: { amp: 0.03, dyUp: 0.16, sy: 0.085, saz: 26 },
  /** Protubérance occipitale externe d'amplitude propre. */
  inion: { amp: 0.014, sy: 0.036, saz: 10 },
  /** Crête temporale (σ = distance à la courbe `line.temporal`, U). */
  line: { amp: 0.012, sigma: 0.014 },
  /** Muscle temporal : volume sous la crête, centré à dyDown sous le ptérion, bord haut = la crête (adoucie sur `edge`), éteint à l'arcade zygomatique (à `drop` sous le ptérion, sur `fade`). */
  muscle: { amp: 0.016, dyDown: 0, az: 84, sy: 0.06, saz: 20, edge: 0.02, fade: 0.05, drop: 0.07 },
  /** Astérion : gaussienne sur le repère. */
  asterion: { amp: 0.014, sy: 0.024, az: 122, saz: 8 },
  /** Asymétrie de la mastoïde : part de `asymMastoid` sur la taille et sur l'amplitude. Asymétrie de hauteur pariétale : part de `asymParietalHeight` sur `parietalHeight`. */
  asym: { mastoidSize: 0.7, mastoidAmp: 0.5, parietalHeight: 1 },
} as const;

const g = (d: number, s: number): number => Math.exp(-0.5 * (d / s) ** 2);
const smooth = (t: number): number => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
/** Fusion douce de deux reliefs de même signe (reliefs comme creux) : norme 4, qui tend vers le MAXIMUM (le bourrelet commun ne double pas à la jonction : à valeurs égales ×1,19, contre ×2 pour une somme) et reste continue quand l'un des deux tend vers 0 ; somme sinon. */
export const softUnion = (a: number, b: number): number => (a > 0 && b > 0 ? (a ** 4 + b ** 4) ** 0.25 : a < 0 && b < 0 ? -((a ** 4 + b ** 4) ** 0.25) : a + b);

/** Échelle de l'arcade donnée par `browRidge` (0 … 1) : 0,6 … 1,4. Sans dimension. */
export const archScale = (browRidge: number): number => VAULT_SHAPE.arch.ridgeLo + VAULT_SHAPE.arch.ridgeK * browRidge;
/** Amplitude SIGNÉE de l'arcade (U) : torus (+) ou gouttière sus-orbitaire (−, plus douce). 0 si `browArch` = 0. */
export const archAmp = (browArch: number, browRidge: number): number => { const A = VAULT_SHAPE.arch; return A.amp * archScale(browRidge) * browArch * (browArch < 0 ? A.sulcus : 1); };
/** Hauteur (U) de l'axe de l'arcade à l'azimut az : descend vers l'angle externe de l'orbite. */
export const archAxisY = (az: number, yG: number): number => yG + VAULT_SHAPE.arch.y0 + VAULT_SHAPE.arch.drop * (az / VAULT_SHAPE.arch.azDrop) ** 2;

export function archShape(y: number, az: number, yG: number): number {
  const A = VAULT_SHAPE.arch, dy = y - archAxisY(az, yG);
  return g(dy, dy < 0 ? A.up : A.down) * smooth((A.azEnd - az) / A.azFall);
}
export const eminenceShape = (y: number, az: number, yG: number): number => { const E = VAULT_SHAPE.eminence; return g(y - (yG - E.dyUp), E.sy) * g(az - E.az, E.saz); };
export function metopicShape(y: number, az: number, yG: number, yB: number): number {
  const M = VAULT_SHAPE.metopic;
  return g(az, M.saz) * smooth((y - (yB + M.from)) / M.ramp) * smooth((yG - M.to - y) / M.ramp);
}
export const bunShape = (y: number, az: number, yI: number): number => { const B = VAULT_SHAPE.bun; return g(y - (yI - B.dyUp), B.sy) * g(az - 180, B.saz); };
export const inionShape = (y: number, az: number, yI: number): number => { const I = VAULT_SHAPE.inion; return g(y - yI, I.sy) * g(az - 180, I.saz); };
/** Muscle temporal : `yLine` = hauteur de la crête temporale à cet azimut (la fonction ne connaît pas la courbe) ; > 0 sous la crête seulement. */
export function muscleShape(y: number, az: number, yT: number, yLine: number): number {
  const M = VAULT_SHAPE.muscle;
  return g(y - (yT + M.dyDown), M.sy) * g(az - M.az, M.saz) * smooth((y - yLine) / M.edge) * (1 - smooth((y - (yT + M.drop)) / M.fade));
}
export const asterionShape = (y: number, az: number, yA: number): number => { const S = VAULT_SHAPE.asterion; return g(y - yA, S.sy) * g(az - S.az, S.saz); };

/** Hauteur (U) de la courbe (azimuts croissants) à l'azimut az, interpolée ; bornée aux extrémités. */
export function curveYAt(pts: readonly { y: number; az: number }[], az: number): number {
  if (az <= pts[0]!.az) return pts[0]!.y;
  for (let i = 0; i + 1 < pts.length; i++) { const a = pts[i]!, b = pts[i + 1]!; if (az <= b.az) return a.y + ((b.y - a.y) * (az - a.az)) / (b.az - a.az); }
  return pts[pts.length - 1]!.y;
}
/** 1° d'azimut en U au niveau de la largeur maximale (rappel de `vault-mastoid.ts`). */
export const AZIMUTH_U = AZ_U;

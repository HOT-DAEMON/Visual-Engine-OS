import { clamp01 } from '../core/math';
import { applyTemperature, softness } from '../lighting/rig';
import { lightVector, type LightInput } from '../lighting/light';
import { norm3, p3, dot3, type P3 } from '../body/volume/vec3';
import { parseHex } from '../core/color';
import { hexOf, labRgb, labToward, lch, toLab } from './oklab';

/**
 * MODÈLE DE LUMIÈRE UNIQUE (tête + corps). Il lit la même `LightSpec` que le moteur de visage (azimut, élévation, couleur, température, taille,
 * dureté, intensité) et la traduit en grandeurs de PIXEL : direction (espace vue : x droite, y bas, z vers l'observateur), largeur du terminateur,
 * style (peint / cel à 2 ou 3 tons), écart ombre-lumière en OKLab, teinte de l'ombre, lumière de contour, masque de projection (gobo).
 * Cause du « invisible » : l'ancien éclairage n'écartait que de ~5 % la luminance gauche/droite du visage (voir docs/LIGHT-VISIBLE-06.md).
 */
export type LitStyle = 'soft' | 'cel2' | 'cel3';
/** `warm` : ombre plus rouge et plus saturée (diffusion sous-cutanée, planches peintes 02/03/10) ; `cool` : ombre bleutée (planches 01/05). */
export type ShadowHue = 'warm' | 'cool';
export interface Gobo { readonly kind: 'blinds' | 'dapple'; readonly scale: number; readonly angleDeg: number; readonly duty: number }
export interface LightModel {
  readonly dir: P3; readonly color: string; readonly intensity: number; readonly soft: number; readonly hardness: number;
  readonly style: LitStyle; readonly dL: number; readonly shadowHue: ShadowHue; readonly ambient: string;
  readonly bias: number; readonly rim: number; readonly rimDir: P3; readonly rimColor: string; readonly bounce: number; readonly gobo: Gobo | null;
}
export interface ModelOpts { readonly style?: LitStyle; readonly shadowHue?: ShadowHue; readonly contrast?: number; readonly bias?: number; readonly rim?: number; readonly rimColor?: string; readonly bounce?: number; readonly gobo?: Gobo | null; readonly ambient?: string }
const SPEC_BASE: Pick<LightInput, 'azimuthDeg' | 'elevationDeg' | 'color' | 'intensity'> = { azimuthDeg: 330, elevationDeg: 55, color: '#ffffff', intensity: 1 };

/** Les cibles de contraste viennent des références : cel ≈ 0,21–0,30 (planches 01, 06), peint ≈ 0,40–0,50 (02, 03, 04, 05, 10) ; défaut : 0,28 pour un jour franc, jamais sous 0,12. */
export function lightModelOf(spec: Partial<LightInput> = {}, o: ModelOpts = {}): LightModel {
  const L = lightVector({ ...SPEC_BASE, ...spec }), style = o.style ?? 'soft', hard = L.hardness ?? 0.5;
  const dL = Math.max(0.12, (style === 'soft' ? 0.17 + 0.22 * hard : 0.26) * (o.contrast ?? 1) * Math.sqrt(clamp01(L.intensity)) + 0.04);
  const ambient = o.ambient ?? '#ffffff';
  return { dir: norm3(p3(L.x, L.y, L.z)), color: L.color, intensity: clamp01(L.intensity), soft: softness(L), hardness: hard, style, dL, shadowHue: o.shadowHue ?? (style === 'soft' ? 'warm' : 'cool'), ambient,
    bias: o.bias ?? 0,
    rim: o.rim ?? 0.35, rimDir: norm3(p3(-L.x, -L.y * 0.4 - 0.2, -0.6)), rimColor: o.rimColor ?? applyTemperature('#ffffff', 8500), bounce: o.bounce ?? 0.18, gobo: o.gobo ?? null };
}
const sstep = (a: number, b: number, x: number): number => { const t = clamp01((x - a) / Math.max(1e-6, b - a)); return t * t * (3 - 2 * t); };
export interface Shade { readonly lit: number; readonly core: number; readonly rim: number; readonly spec: number }
/**
 * Éclairage d'UN pixel. `cast` ∈ [0,1] : part d'ombre portée (0 = éclairé) ; `ao` : occlusion ambiante ; `gobo` : visibilité de la lumière (1 = pas de masque).
 * soft : terminateur progressif (largeur ∝ douceur de la source) · cel2 : 2 tons à bord net (planches 01, 06, 07) · cel3 : + ton de cœur d'ombre.
 */
export function shadeAt(m: LightModel, n: P3, cast: number, ao: number, gobo = 1): Shade {
  // `bias` (τ) : seuil du terminateur en cosinus. Les planches lisent le terminateur PLUS HAUT que la physique (τ > 0 : la face plane reste dans l'ombre quand la lumière rase) ; défaut 0 = physique.
  const ndl = dot3(n, m.dir) - m.bias, w = m.style === 'soft' ? 0.05 + 0.5 * m.soft : 0.012;
  const d = m.style === 'soft' ? sstep(-w, w + 0.28, ndl) : sstep(-w, w, ndl), cel = m.style !== 'soft';
  let lit = d * (1 - cast) * gobo;
  if (cel) lit = sstep(0.4, 0.6, lit) * (1 - 0.85 * sstep(0.5, 0.62, ao)); else lit *= 1 - 0.5 * ao; // cel : l'occlusion est un seuil (pli sombre franc), pas un dégradé
  // Cœur d'ombre : cel3 = bande franche côté opposé à la lumière ; soft = léger approfondissement ; cel2 = aucun.
  const core = m.style === 'cel3' ? (1 - sstep(-0.6, -0.32, ndl + m.bias)) * (1 - lit) : m.style === 'soft' ? (1 - sstep(-0.9, -0.1, ndl + m.bias)) * (1 - lit) * 0.35 : 0;
  const fr = (1 - Math.max(0, n.z)) ** 2.6, rim = fr * sstep(0.0, 0.55, dot3(n, m.rimDir)) * m.rim * (1 - 0.7 * lit);
  const h = norm3(p3(m.dir.x, m.dir.y, m.dir.z + 1)), spec = Math.max(0, dot3(n, h)) ** (6 + 40 * (1 - m.soft)) * lit * 0.5 * m.intensity;
  return { lit: clamp01(lit), core: clamp01(core), rim: clamp01(rim), spec: clamp01(spec) };
}
/** Teinte imposée : on garde sa teinte et sa saturation, mais sa clarté ne dépasse jamais `base − ΔL` (les teintes d'ombre « proches de la couleur principale » étaient la cause du contraste de 5 %). */
function imposeShadow(base: string, imposed: string, dL: number): string { const b = toLab(base), c = toLab(imposed); return c.L <= b.L - dL ? imposed : hexOf(labRgb({ L: b.L - dL, a: c.a, b: c.b })); }
const mulOf = (from: string, to: string): [number, number, number] => { const a = parseHex(from), b = parseHex(to); return [Math.min(1, b[0] / Math.max(1, a[0])), Math.min(1, b[1] / Math.max(1, a[1])), Math.min(1, b[2] / Math.max(1, a[2]))]; };
/**
 * Tons d'une surface de couleur `base` sous `m` : ombre = base − ΔL (OKLab), chroma ×1,22 et teinte −20° (chaud : sous-cutané) ou +bleu (froid) ; cœur = ombre encore baissée.
 * `lightMul` / `shadowMul` / `coreMul` sont des multiplicateurs par canal (rendu en `mix-blend-mode: multiply` sur n'importe quelle couleur déjà dessinée).
 */
export interface Tones { readonly imposed: boolean; readonly lit: string; readonly shadow: string; readonly core: string; readonly lightMul: [number, number, number]; readonly shadowMul: [number, number, number]; readonly coreMul: [number, number, number] }
export function tonesOf(base: string, m: LightModel, imposed?: { readonly shadow?: string | null }): Tones {
  const lit = hexOf(parseHex(base).map((v, i) => Math.min(255, (v * parseHex(m.color)[i]!) / 255)));
  const cool = m.shadowHue === 'cool';
  // Teinte d'ombre IMPOSÉE par l'apparence (`Appearance.light.shadow`) : elle prime sur la dérivation (contrat de docs/APPEARANCE.md : « imposée = lue telle quelle »).
  const imp = imposed?.shadow ? imposeShadow(base, imposed.shadow, m.dL) : null, shadow = imp ?? (cool ? labToward(base, -m.dL, 270, 0.075, 0.42) : lch(base, -m.dL, 1.22, -20));
  const core = cool ? labToward(shadow, -m.dL * 0.4, 275, 0.08, 0.3) : lch(shadow, -m.dL * 0.45, 1.05, -8);
  const amb = parseHex(m.ambient), tint = (c: [number, number, number]): [number, number, number] => [c[0] * (0.82 + 0.18 * amb[0] / 255), c[1] * (0.82 + 0.18 * amb[1] / 255), c[2] * (0.82 + 0.18 * amb[2] / 255)];
  return { imposed: imp !== null, lit, shadow, core, lightMul: mulOf(base, lit), shadowMul: tint(mulOf(base, shadow)), coreMul: tint(mulOf(base, core)) };
}

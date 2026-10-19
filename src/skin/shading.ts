import { mix } from '../core/color';
import { clamp01 } from '../core/math';
import type { ResolvedAppearance } from '../appearance';
import type { Ellipse, SkinRegions } from '../face';
import { direction2D, halfVectorXY, type LightVector } from '../lighting/light';
import { falloff, intensityFor, softness } from '../lighting/rig';
import type { SkinMaterial, SkinRegionId } from '../schema';

/** Régions de la « zone T » : le reflet gras de `oiliness` s'y applique. */
const T_ZONE: ReadonlySet<SkinRegionId> = new Set(['forehead', 'nose', 'chin']);

/** Un reflet spéculaire d'une région : ellipse + force + douceur de bord + couleur. */
export interface SpecSpot {
  readonly region: SkinRegionId;
  readonly e: Ellipse;
  readonly alpha: number;
  /** Part du rayon qui est un fondu (0 = bord net, 1 = tout en dégradé). */
  readonly soft: number;
  readonly color: string;
}

/** Arrêt d'un dégradé : offset 0 (côté lumière) → 1 (côté ombre). */
export interface ShadeStop {
  readonly offset: number;
  readonly color: string;
  readonly alpha: number;
}

/**
 * Description NUMÉRIQUE de l'ombrage de la peau (aucun SVG) : ce que le matériau fait de la lumière. Séparée du rendu pour être
 * testée : sous deux lumières différentes les reflets bougent avec elle ; la rugosité d'une région pilote la taille et la
 * douceur de SON reflet, jamais la géométrie.
 */
export interface SkinShading {
  readonly dir: { readonly x: number; readonly y: number };
  /** Reflets : un par ellipse de région. */
  readonly spots: readonly SpecSpot[];
  /** Dégradé directionnel lumière → ombre (terminateur, avec diffusion sous-cutanée au milieu). */
  readonly terminator: readonly ShadeStop[];
  /** Largeur du terminateur (part de la traversée) : grande = transition douce. */
  readonly terminatorWidth: number;
  /** Ombrage de forme (bords du visage), opacité au bord. */
  readonly formEdge: number;
  readonly fresnelAlpha: number;
  /** Atténuation lumière proche / lointaine pour une source à distance finie. */
  readonly falloff: { readonly near: number; readonly far: number };
  readonly specColor: string;
  /** Mode d'ombrage de l'apparence : `cel` = bords nets. */
  readonly cel: boolean;
}

export function skinShading(mat: SkinMaterial, L: LightVector, regions: SkinRegions, ra: ResolvedAppearance, base: string): SkinShading {
  const dir = direction2D(L);
  const soft = softness(L);
  const I = intensityFor(L, 'skin');
  const H = halfVectorXY(L);
  const cel = ra.spec.shading.mode === 'cel';
  const sp = mat.specular;
  // Reflet DIÉLECTRIQUE : couleur de la lumière (valeur physique d'un non-métal), à peine teintée par la peau (`tint`).
  const specColor = ra.spec.reflection.tint ?? mix(L.color, base, sp.tint);
  const refl = ra.spec.reflection;
  const spots: SpecSpot[] = [];
  (Object.keys(mat.roughness) as SkinRegionId[]).forEach((id) => {
    const rough = mat.roughness[id];
    const oil = T_ZONE.has(id) ? 1 + 1.2 * mat.oiliness : 1;
    // Taille (part du rayon de la région) : une peau rugueuse a un reflet LARGE ; `broadness`, la grandeur apparente de la source
    // et le réglage `reflection.size` de l'apparence l'élargissent encore. Jamais étroit comme un métal poli (plancher 0,3).
    const size = Math.min(1.1, Math.max(0.3, (0.18 + 0.5 * rough) * (0.6 + 0.8 * sp.broadness) * (0.8 + 0.6 * soft) * (0.6 + 0.8 * refl.size)));
    // Intensité : décroît avec la rugosité (reflet plus diffus et moins brillant), croît avec la graisse de la zone T.
    // Les tempes et le cou sont des surfaces qui fuient vers le contour : leur reflet est atténué de 40 % (sinon un liseré doré borde la tête).
    const edge = id === 'temples' || id === 'neck' ? 0.6 : 1;
    const alpha = clamp01(I * sp.strength * (1 - 0.7 * rough) * oil * 0.34 * (2 * refl.intensity) * edge);
    for (const r of regions[id]) {
      // Le reflet se décale vers le vecteur médian (même formule physique que le matériau générique) : il suit la lumière.
      spots.push({ region: id, e: { cx: r.cx + H.x * r.rx * 0.5, cy: r.cy + H.y * r.ry * 0.5, rx: r.rx * size, ry: r.ry * size }, alpha, soft: cel ? 0.04 : clamp01(0.55 + 0.4 * rough + 0.15 * soft), color: specColor });
    }
  });
  // Terminateur : position (0,45 + 0,25 · L.z : une lumière plus frontale éclaire davantage), largeur croissante avec la douceur du
  // matériau ET de la lumière. Au milieu, la diffusion sous-cutanée rougit la transition (la peau n'est pas un plâtre).
  const width = cel ? 0.01 : clamp01(0.12 + 0.5 * mat.softness * (0.5 + 0.5 * soft));
  const t0 = 0.45 + 0.25 * L.z;
  // Diffusion sous-cutanée : une rougeur CHAUDE mais retenue (mélange 30 % avec un rouge sang) — plus saturée, elle forme des taches au lieu d'une transition.
  const sss = mat.subsurface.color ?? mix(ra.shadow, '#c25048', 0.3);
  const shadowA = clamp01(0.22 + 0.5 * I * (0.4 + 0.6 * (L.hardness ?? 0.5)));
  const sssA = clamp01(mat.subsurface.strength * 0.32 * (0.6 + 0.8 * mat.subsurface.width));
  const terminator: ShadeStop[] = cel
    ? [{ offset: 0, color: ra.shadow, alpha: 0 }, { offset: t0, color: ra.shadow, alpha: 0 }, { offset: t0, color: ra.shadow, alpha: shadowA * 0.85 }, { offset: 1, color: ra.shadow, alpha: shadowA }]
    : [
        { offset: 0, color: ra.shadow, alpha: 0 },
        { offset: clamp01(t0 - width / 2), color: ra.shadow, alpha: 0 },
        { offset: clamp01(t0), color: sss, alpha: sssA },
        { offset: clamp01(t0 + width / 2), color: ra.shadow, alpha: shadowA * 0.6 },
        { offset: 1, color: ra.shadow, alpha: shadowA },
      ];
  return {
    dir,
    spots,
    terminator,
    terminatorWidth: width,
    formEdge: 0.3 * (0.65 + 0.35 * (1 - L.z)),
    fresnelAlpha: sp.fresnel * 0.28 * I,
    falloff: falloff(L),
    specColor,
    cel,
  };
}

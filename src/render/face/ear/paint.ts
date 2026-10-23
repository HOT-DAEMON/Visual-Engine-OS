import { mix } from '../../../core/color';
import type { ResolvedAppearance } from '../../../appearance';
import type { LightVector } from '../../../lighting/light';
import type { EarMaterialKind, FaceEars } from '../../../schema/face-ear';

/**
 * PEINTURE DE L'OREILLE : les MATÉRIAUX (§1.3) sont définis ICI, séparément de la géométrie. Une famille (elfe → reptilien) change la géométrie
 * sans toucher ce fichier ; un matériau (peau → céramique) change ce fichier sans toucher la géométrie.
 */
export interface EarPaint {
  readonly kind: EarMaterialKind;
  /** Couleur de base de la surface (peau du visage ou teinte du matériau). */
  readonly base: string;
  readonly shade: string;
  readonly lit: string;
  readonly highlight: string;
  /** Rétro-éclairage des parties fines (rougeur du bord, SURF-04). */
  readonly translucent: string;
  readonly translucency: number;
  readonly glow: number;
  readonly glowColor: string;
  /** Brillance spéculaire (0 = mate) et rugosité. */
  readonly gloss: number;
  readonly rough: number;
  readonly look: 'realistic' | 'anime';
}

const TINT: Record<EarMaterialKind, string | null> = { skin: null, cartilage: '#e7b9a6', scaly: '#6b8f5e', membrane: '#b07a9a', ceramic: '#e9e3d6', crystal: '#9fd8ff', hybrid: '#8aa0c8' };
const GLOSS: Record<EarMaterialKind, number> = { skin: 0.12, cartilage: 0.1, scaly: 0.3, membrane: 0.18, ceramic: 0.85, crystal: 0.95, hybrid: 0.4 };

export function earPaint(e: FaceEars, kind: EarMaterialKind, skin: string, ra: ResolvedAppearance): EarPaint {
  const tint = e.material.tint ?? TINT[kind];
  const base = tint === null ? skin : kind === 'skin' || kind === 'cartilage' ? mix(skin, tint, 0.3) : tint;
  const a = ra.spec;
  void a;
  // Le matériau de l'oreille garde les teintes d'ombre/lumière de la PEAU du visage (cohérence d'éclairage avec le visage).
  const shade = mix(ra.shadow, base, 0.35);
  const lit = mix(ra.light, base, 0.35);
  const thin = kind === 'ceramic' || kind === 'crystal' ? 0.15 : 1;
  return { kind, base, shade, lit, highlight: ra.highlight, translucent: mix(base, '#ff5a3c', 0.55), translucency: e.material.translucency * thin, glow: e.material.glow, glowColor: kind === 'crystal' ? '#bfe9ff' : '#7df9ff', gloss: GLOSS[kind] * (1 - 0.6 * e.material.roughness), rough: e.material.roughness, look: e.style.look };
}

/** Direction de lumière (azimut, élévation en degrés) pour `feDistantLight` : azimut mesuré dans le plan de l'image (y vers le bas), élévation au-dessus du plan. */
export const lightAngles = (L: LightVector): { azimuth: number; elevation: number } => ({ azimuth: (Math.atan2(L.y, L.x) * 180) / Math.PI, elevation: (Math.asin(Math.max(-1, Math.min(1, L.z))) * 180) / Math.PI });

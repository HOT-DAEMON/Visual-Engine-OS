import type { FaceParamsInput } from '../../schema';

/**
 * PROFILS DE STYLISATION NOMMÉS : des réglages complets (mode de rendu + 9 contrôles) rangés sous un nom, pour reproduire un style
 * sans recopier neuf nombres. Un profil est une DONNÉE (pas de code) : il est appliqué par fusion sur les paramètres, puis
 * `applyStylization` (idempotent) fait le reste ; les relations anatomiques (menton < mâchoire, bouche dans le contour…) sont donc
 * préservées pour chaque profil (testé : tests/stylization-profiles.test.ts). `realiste` est le profil NEUTRE (aucune exagération).
 */
export type StylizationProfileName = 'realiste' | 'sobre' | 'anime' | 'manga-angulaire' | 'caricature' | 'encre';

export const STYLIZATION_PROFILES: Readonly<Record<StylizationProfileName, Pick<FaceParamsInput, 'renderMode' | 'stylization'>>> = {
  realiste: { renderMode: 'realistic', stylization: {} },
  sobre: { renderMode: 'realistic', stylization: { simplify: 0.3, outline: 0.2, detail: 0.8 } },
  anime: { renderMode: 'anime', stylization: { chinProjection: 0.3, jawWidth: 0.1, simplify: 0.8, outline: 0.7, detail: 0.3 } },
  'manga-angulaire': { renderMode: 'anime', stylization: { chinProjection: 0.5, angularity: 0.9, jawNeckContrast: 0.5, simplify: 0.9, outline: 0.9, detail: 0.2 } },
  caricature: { renderMode: 'realistic', stylization: { chinProjection: 0.8, jawWidth: 0.7, mouthSize: 0.6, cornerAsymmetry: 0.4, jawNeckContrast: 0.6, detail: 1 } },
  encre: { renderMode: 'ink', stylization: { simplify: 1, outline: 1, detail: 0.5 } },
};

/** Paramètres de visage fusionnés avec un profil (le profil l'emporte sur `renderMode` et sur chaque contrôle qu'il nomme). */
export function withProfile(base: FaceParamsInput, name: StylizationProfileName): FaceParamsInput {
  const p = STYLIZATION_PROFILES[name];
  return { ...base, renderMode: p.renderMode, stylization: { ...(base.stylization ?? {}), ...(p.stylization ?? {}) } };
}

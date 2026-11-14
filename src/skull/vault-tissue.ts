/**
 * TISSUS DE LA VOÛTE — séparation os / parties molles. Le relief osseux (crête, tubérosité, suture) n'apparaît à la surface de la peau qu'ATTÉNUÉ par ce qui le recouvre :
 * périoste, galéa aponévrotique, tissu sous-cutané, peau, cheveux ; et, aux tempes, le muscle temporal. Chaque région porte une épaisseur relative `r` (1 = pariétal) ;
 * la transmission τ = (1,35 − 0,7·scalp·r) × (1 + 0,6·boneShow), bornée [0,25 ; 1,6], vaut EXACTEMENT 1 pour scalp = 0,5, r = 1, boneShow = 0 (calibrage d'origine des bosses).
 * `scalp` est le paramètre d'épaisseur de tissu du crâne déjà présent (`SkullParams.scalp`) : il est désormais consommé par le modelé 3D, pas seulement par le profil 2D.
 */
export type VaultRegion = 'frontal' | 'glabella' | 'parietal' | 'temporal' | 'mastoid' | 'occipital' | 'vertex';

export const TISSUE_LAYERS = ['os', 'périoste', 'galéa', 'sous-cutané', 'peau', 'cheveux'] as const;
/** Épaisseur relative des parties molles par région (1 = pariétal). Conventions d'anatomie artistique (Richer, Zuckerkandl : mince au front et à la mastoïde, épais aux tempes et à la nuque). */
export const SOFT_TISSUE: Readonly<Record<VaultRegion, number>> = { frontal: 0.7, glabella: 0.4, parietal: 1, temporal: 1.7, mastoid: 0.5, occipital: 1.1, vertex: 0.8 };

export const TISSUE_T = { base: 1.35, k: 0.7, show: 0.6, min: 0.25, max: 1.6 } as const;

export function transmission(region: VaultRegion, scalp: number, boneShow: number): number {
  const t = (TISSUE_T.base - TISSUE_T.k * scalp * SOFT_TISSUE[region]) * (1 + TISSUE_T.show * boneShow);
  return Math.min(TISSUE_T.max, Math.max(TISSUE_T.min, t));
}

/** Couches (mm) au-dessus de l'os pour une région : peau, sous-cutané, galéa aponévrotique, périoste (+ muscle temporal aux tempes). Total = 5,5 mm × épaisseur relative (pariétal ≈ 5,5 mm ; temporal ≈ 9,4 mm avec le muscle ; glabelle ≈ 2,2 mm). Os de la voûte : ≈ 6 mm (table externe, diploé, table interne). Conventions d'anatomie artistique. */
export interface TissueLayer { readonly id: (typeof TISSUE_LAYERS)[number] | 'muscle temporal'; readonly mm: number }
export const SOFT_BASE_MM = 5.5, VAULT_BONE_MM = 6, HEAD_MM = 230;
export function tissueStack(region: VaultRegion): readonly TissueLayer[] {
  const r = SOFT_TISSUE[region], mm = SOFT_BASE_MM * r, layers: TissueLayer[] = [
    { id: 'peau', mm: 0.36 * mm }, { id: 'sous-cutané', mm: 0.4 * mm }, { id: 'galéa', mm: 0.2 * mm }, { id: 'périoste', mm: 0.04 * mm }];
  if (region === 'temporal') layers.splice(3, 0, { id: 'muscle temporal', mm: 0.45 * mm });   // le muscle s'ajoute : il ne remplace pas les couches du cuir chevelu
  return [...layers, { id: 'os', mm: VAULT_BONE_MM }];
}
/** Profondeur de l'os sous la peau (U) : total des parties molles (sans l'os) ramené à la tête de 230 mm. */
export const boneDepthU = (region: VaultRegion): number => tissueStack(region).filter((l) => l.id !== 'os').reduce((s, l) => s + l.mm, 0) / HEAD_MM;

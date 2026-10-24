/**
 * Archétypes de coiffure : une coiffure = une liste de MASSES (régions du cuir chevelu). Chaque masse porte son champ
 * d'écoulement (balayage, poussée, relevé, tirage arrière), sa longueur et sa raideur ; les paquets et les brins en
 * sont tirés (`hierarchy.ts`). Longueurs en fraction de H, largeurs en fraction de W, `s` : −1 gauche … +1 droite de l'image,
 * `t` : 0 = ligne d'implantation, 1 = sommet du crâne.
 */
export type MassClass = 'bang' | 'side' | 'crown' | 'back' | 'tail' | 'braid' | 'row';

export interface MassDef {
  readonly name: string;
  readonly cls: MassClass;
  readonly share: number;
  readonly s: readonly [number, number];
  readonly t: readonly [number, number];
  readonly rear?: boolean;
  readonly len: readonly [number, number];
  /** Balayage latéral (+ vers la droite de l'image) ; `out` : poussée loin du centre (signe de x). */
  readonly sweep: number;
  readonly out: number;
  readonly lift: number;
  readonly back: number;
  readonly stiff: number;
  readonly w: number;
  readonly sharp: number;
  readonly curl?: number;
  readonly wave?: number;
  readonly tone: number;
  /** Épaisseur de l'enveloppe de volume au-dessus du crâne (fraction de W). */
  readonly reach?: number;
  /** Limite basse : `brow` = au-dessus des sourcils ; `eye` = peut recouvrir l'œil (mèche voulue) ; `free` = sans limite. */
  readonly limit?: 'brow' | 'eye' | 'free';
  /** Profondeur de retombée sur le front : 0 = reste à l'implantation, 1 = descend jusqu'aux sourcils (défaut : frange 1, sommet 0,5). */
  readonly depth?: number;
  /** Pente latérale de cette profondeur (par unité de s, + = plus profond à droite de l'image) : bord de frange en diagonale. */
  readonly slope?: number;
}

export interface Archetype { readonly masses: readonly MassDef[]; readonly gravity?: number; readonly puff?: number }

const m = (name: string, cls: MassClass, share: number, s: [number, number], t: [number, number], len: [number, number], f: Partial<MassDef> = {}): MassDef =>
  ({ name, cls, share, s, t, len, sweep: 0, out: 0, lift: 0, back: 0, stiff: 0.5, w: 0.05, sharp: 0.7, tone: 0, ...f });

/** Base commune : dessous du crâne (sombre) + côtés plaqués. */
const under = (len: number): MassDef[] => [
  m('under', 'back', 0.1, [-0.9, 0.9], [0.1, 0.9], [len, len * 1.2], { rear: true, back: 0.5, w: 0.07, tone: -0.35, stiff: 0.4 }),
];

export const ARCHETYPES: Record<string, Archetype> = {
  // 1 — épis ébouriffés, raie centrale, mèches qui retombent sur le front (blond, cravate).
  tousled: { masses: [
    ...under(0.2),
    m('crown', 'crown', 0.4, [-0.9, 0.9], [0.45, 1], [0.12, 0.2], { out: 0.9, lift: 0.7, stiff: 0.8, w: 0.045, wave: 0.12, sharp: 0.95 }),
    m('bangs', 'bang', 0.35, [-0.8, 0.8], [0.05, 0.5], [0.13, 0.2], { out: 0.7, lift: 0.1, stiff: 0.55, w: 0.04, sharp: 0.95, wave: 0.1, limit: 'eye' }),
    m('sides', 'side', 0.25, [-1, 1], [0.0, 0.4], [0.1, 0.18], { out: 0.5, stiff: 0.5, w: 0.04, sharp: 0.9 }),
  ] },
  // 2 — grande mèche balayée sur le front jusqu'au sourcil gauche, côtés courts, oreilles dégagées.
  side_sweep: { masses: [
    ...under(0.14),
    m('swoop', 'bang', 0.45, [-0.7, 0.9], [0.05, 0.6], [0.2, 0.3], { sweep: -1.1, lift: 0.1, stiff: 0.9, w: 0.06, sharp: 0.95, limit: 'brow', depth: 0.85, slope: -0.45 }),
    m('top', 'crown', 0.3, [-0.9, 0.9], [0.5, 1], [0.1, 0.16], { sweep: -0.8, lift: 0.4, stiff: 0.9, w: 0.06, sharp: 0.9, depth: 0.45, slope: -0.3 }),
    m('sides', 'side', 0.25, [-1, 1], [0, 0.35], [0.05, 0.09], { out: 0.3, back: 0.4, stiff: 0.9, w: 0.04 }),
  ] },
  // 3 — peigné vers l'arrière, volume devant, côtés courts (blond clair).
  swept_back: { masses: [
    ...under(0.14),
    m('front', 'crown', 0.5, [-0.8, 0.8], [0.05, 0.7], [0.14, 0.22], { back: 1, lift: 0.7, out: 0.2, stiff: 0.95, w: 0.055, sharp: 0.85, depth: 0.12 }),
    m('top', 'crown', 0.25, [-0.9, 0.9], [0.6, 1], [0.1, 0.16], { back: 0.9, lift: 0.3, stiff: 0.9, w: 0.05 }),
    m('sides', 'side', 0.25, [-1, 1], [0, 0.35], [0.05, 0.09], { back: 0.8, out: 0.2, stiff: 0.95, w: 0.04 }),
  ] },
  // 4 — chignon haut + côtés rasés (undercut) + une mèche longue devant l'oreille.
  bun_undercut: { masses: [
    ...under(0.1),
    m('combed', 'crown', 0.45, [-0.7, 0.7], [0.1, 0.9], [0.1, 0.16], { back: 1.2, lift: 0.9, stiff: 0.95, w: 0.05, depth: 0.1 }),
    m('bun', 'tail', 0.3, [-0.1, 0.1], [0.95, 1], [0.07, 0.1], { back: 0.2, lift: 1, curl: 0.55, stiff: 0.7, w: 0.05, sharp: 0.4, limit: 'free' }),
    m('long lock', 'side', 0.1, [-1, -0.8], [0, 0.2], [0.34, 0.42], { out: 0.1, stiff: 0.35, w: 0.03, sharp: 0.9, limit: 'free' }),
  ] },
  // 5 — frange noire épaisse jusqu'aux sourcils, oreilles couvertes.
  messy_bangs: { masses: [
    ...under(0.2),
    m('bangs', 'bang', 0.5, [-0.85, 0.85], [0.02, 0.5], [0.16, 0.24], { out: 0.55, stiff: 0.45, w: 0.045, sharp: 0.95, limit: 'brow' }),
    m('crown', 'crown', 0.3, [-0.9, 0.9], [0.45, 1], [0.1, 0.16], { out: 0.6, lift: 0.4, stiff: 0.6, w: 0.05, sharp: 0.9 }),
    m('sides', 'side', 0.2, [-1, 1], [0, 0.4], [0.2, 0.3], { out: 0.2, stiff: 0.3, w: 0.04, limit: 'free' }),
  ] },
  // 6 — ondulations balayées en arrière et sur le côté.
  wavy_swept: { masses: [
    ...under(0.18),
    m('waves', 'crown', 0.55, [-0.9, 0.9], [0.05, 1], [0.16, 0.24], { sweep: 0.5, back: 0.7, lift: 0.5, wave: 0.28, stiff: 0.8, w: 0.055, sharp: 0.8, depth: 0.3 }),
    m('sides', 'side', 0.25, [-1, 1], [0, 0.4], [0.1, 0.16], { back: 0.6, out: 0.3, wave: 0.2, stiff: 0.6, w: 0.045 }),
    m('fringe', 'bang', 0.2, [-0.6, 0.6], [0.05, 0.4], [0.1, 0.15], { sweep: 0.6, wave: 0.25, stiff: 0.7, w: 0.045, limit: 'brow' }),
  ] },
  // 7 — houppe relevé, côtés rasés, longue mèche devant la joue d'un côté.
  quiff_undercut: { masses: [
    ...under(0.09),
    m('quiff', 'crown', 0.6, [-0.7, 0.7], [0.05, 0.9], [0.18, 0.3], { back: 0.5, lift: 1.4, stiff: 0.95, w: 0.055, sharp: 0.95, depth: 0.1 }),
    m('cheek lock', 'side', 0.1, [0.8, 1], [0, 0.15], [0.36, 0.44], { out: 0, stiff: 0.3, w: 0.028, sharp: 0.95, limit: 'free' }),
    m('sides', 'side', 0.3, [-1, 1], [0, 0.3], [0.03, 0.06], { back: 0.6, stiff: 0.95, w: 0.04 }),
  ] },
  // 8 — chignon bas tressé de côté + mèches ondulées libres.
  braid_updo: { masses: [
    ...under(0.14),
    m('swept', 'crown', 0.45, [-0.9, 0.9], [0.05, 1], [0.15, 0.22], { sweep: 0.8, back: 0.8, lift: 0.4, wave: 0.2, stiff: 0.8, w: 0.05, depth: 0.2 }),
    m('braid', 'braid', 0.2, [0.6, 0.9], [0.1, 0.5], [0.35, 0.45], { sweep: 0.3, back: 0.9, stiff: 0.7, w: 0.04, sharp: 0.5, limit: 'free' }),
    m('loose', 'side', 0.2, [-1, -0.7], [0, 0.2], [0.3, 0.4], { out: 0.2, wave: 0.3, stiff: 0.3, w: 0.025, sharp: 0.95, limit: 'free' }),
  ] },
  // 9 — masse courte, volumineuse, pointes duveteuses.
  fluffy_messy: { gravity: 0.6, puff: 0.5, masses: [
    ...under(0.2),
    m('fluff', 'crown', 0.5, [-0.95, 0.95], [0.2, 1], [0.12, 0.2], { out: 1, lift: 0.8, stiff: 0.55, w: 0.05, wave: 0.18, sharp: 0.95 }),
    m('bangs', 'bang', 0.3, [-0.8, 0.8], [0.05, 0.5], [0.1, 0.17], { out: 0.6, stiff: 0.45, w: 0.045, sharp: 0.95, wave: 0.15, limit: 'brow' }),
    m('sides', 'side', 0.2, [-1, 1], [0, 0.4], [0.08, 0.14], { out: 0.7, stiff: 0.5, w: 0.04 }),
  ] },
  // 10 — noir, longues mèches de frange qui passent devant les yeux.
  messy_long_bangs: { masses: [
    ...under(0.2),
    m('long bangs', 'bang', 0.5, [-0.8, 0.8], [0.02, 0.5], [0.24, 0.34], { out: 0.5, stiff: 0.4, w: 0.045, sharp: 0.95, limit: 'eye' }),
    m('crown', 'crown', 0.3, [-0.9, 0.9], [0.45, 1], [0.1, 0.17], { out: 0.7, lift: 0.4, stiff: 0.6, w: 0.05 }),
    m('sides', 'side', 0.2, [-1, 1], [0, 0.4], [0.2, 0.3], { out: 0.2, stiff: 0.3, w: 0.04, limit: 'free' }),
  ] },
  // 11 — dessus lissé vers l'arrière, une mèche détachée tombe au centre du front.
  pompadour_strand: { masses: [
    ...under(0.1),
    m('slick', 'crown', 0.55, [-0.8, 0.8], [0.05, 0.9], [0.16, 0.26], { back: 0.9, lift: 1.1, stiff: 0.95, w: 0.055, sharp: 0.85, depth: 0.1 }),
    m('strand', 'bang', 0.08, [-0.15, 0.15], [0.1, 0.3], [0.2, 0.26], { stiff: 0.25, w: 0.022, sharp: 0.98, limit: 'brow' }),
    m('sides', 'side', 0.3, [-1, 1], [0, 0.3], [0.03, 0.06], { back: 0.7, stiff: 0.95, w: 0.04 }),
  ] },
  // 12 — rangées tressées plaquées vers un côté + une mèche libre.
  cornrows_side: { masses: [
    ...under(0.1),
    m('rows', 'row', 0.65, [-0.9, 0.9], [0.05, 1], [0.2, 0.28], { sweep: 0.9, back: 1, stiff: 0.98, w: 0.026, sharp: 0.5, limit: 'brow', depth: 0.1 }),
    m('free lock', 'side', 0.1, [-1, -0.85], [0, 0.2], [0.34, 0.42], { stiff: 0.3, w: 0.028, sharp: 0.95, limit: 'free' }),
  ] },
  // Archétypes de lisibilité demandés : mèche rebelle, couettes, coupe hime.
  rebel_lock: { masses: [
    ...under(0.14),
    m('base', 'crown', 0.55, [-0.9, 0.9], [0.05, 1], [0.1, 0.16], { back: 0.4, lift: 0.3, stiff: 0.8, w: 0.055 }),
    m('ahoge', 'crown', 0.06, [-0.1, 0.1], [0.95, 1], [0.16, 0.2], { lift: 1.5, sweep: 0.3, stiff: 0.85, w: 0.022, sharp: 0.98, limit: 'free', curl: 0.18 }),
  ] },
  twintails: { masses: [
    ...under(0.12),
    m('top', 'crown', 0.4, [-0.9, 0.9], [0.1, 1], [0.1, 0.15], { back: 0.8, lift: 0.4, stiff: 0.85, w: 0.055 }),
    m('tailL', 'tail', 0.2, [-0.95, -0.85], [0.35, 0.5], [0.4, 0.5], { out: 0.9, lift: 0.5, stiff: 0.4, w: 0.04, limit: 'free' }),
    m('tailR', 'tail', 0.2, [0.85, 0.95], [0.35, 0.5], [0.4, 0.5], { out: 0.9, lift: 0.5, stiff: 0.4, w: 0.04, limit: 'free' }),
  ] },
  hime: { gravity: 1.1, masses: [
    m('back', 'back', 0.25, [-0.9, 0.9], [0.1, 0.9], [0.5, 0.62], { rear: true, back: 0.3, stiff: 0.2, w: 0.06, tone: -0.3, limit: 'free' }),
    m('top', 'crown', 0.3, [-0.9, 0.9], [0.3, 1], [0.2, 0.3], { out: 0.9, stiff: 0.3, w: 0.06, limit: 'free' }),
    m('hime fringe', 'bang', 0.22, [-0.55, 0.55], [0.02, 0.3], [0.1, 0.13], { out: 0.1, stiff: 0.85, w: 0.05, sharp: 0.3, limit: 'brow' }),
    m('side locks', 'side', 0.23, [-1, 1], [0, 0.3], [0.45, 0.55], { out: 0.1, stiff: 0.25, w: 0.05, sharp: 0.5, limit: 'free' }),
  ] },
};

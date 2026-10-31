import type { Level } from '../types';
import type { P3 } from './vec3';

/** Section elliptique d'un volume : centre `c`, demi-axes `a` (le long de `u`) et `b` (le long de `w`), tangente `t` de l'axe. Repère (t,u,w) orthonormé. */
export interface Station { readonly c: P3; readonly a: number; readonly b: number; readonly t: P3; readonly u: P3; readonly w: P3 }
export type VKind = 'muscle' | 'bone' | 'fat' | 'skin' | 'joint' | 'tendon' | 'vein' | 'landmark';
export type VGroup = 'neck' | 'back' | 'chest' | 'abdomen' | 'pelvis' | 'shoulder' | 'arm' | 'forearm' | 'hand' | 'trunk' | 'joint';
/**
 * VOLUME : unité 3D indépendante et combinable (contrat de `volume/contracts.ts`). Chaque muscle a son propre volume, séparé dans la donnée ET
 * dans l'image. `layer` = classe de profondeur anatomique (0 squelette/noyau … 5 le plus superficiel) ; `level` = niveau de présentation (0 enveloppe,
 * 1 masses, 2 muscles individuels, 3 fibres/repères/mécanique).
 */
export interface Volume {
  readonly id: string; readonly name: string; readonly group: VGroup; readonly kind: VKind; readonly side: 'L' | 'R' | 'C';
  readonly parent: string | null; readonly level: Level; readonly layer: number; readonly tier?: number;
  readonly stations: readonly Station[];
  /** Angles θ (rad, section : π/2 = vers `w`) des fibres tracées le long du volume ; vide = aucune fibre. */
  readonly fibres: readonly number[];
  /** Décalage de ton (−1 ombre … +1 lumière) propre au tissu. */
  readonly tone: number;
  /** Tube mince dessiné au trait (tendon, veine) au lieu d'une enveloppe remplie. */
  readonly strand?: boolean;
  /** Origine / insertion (identifiants de repères osseux) : lues par la vérification anatomique. */
  readonly origin?: string; readonly insertion?: string;
  /** Hauteur de chair relative (0 = nue … 1) : la peau/graisse ne masque pas les muscles dont le palier est atteint. */
  readonly sphere?: boolean;
}
export interface VolumeSet {
  readonly volumes: readonly Volume[]; readonly byId: ReadonlyMap<string, Volume>;
  readonly measures: Readonly<Record<string, number>>;
  readonly landmarks: ReadonlyMap<string, P3>;
}

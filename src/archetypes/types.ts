import type { EyeSpec } from '../schema';

/**
 * Un archétype ne fixe que certaines branches du schéma (celles qui définissent son « identité
 * visuelle ») ; tout le reste de l'œil (forme de base non précisée, regard, expression, ancrage…)
 * garde la valeur que l'utilisateur a écrite. `sclera` et `eyebrow` sont remplacés ENTIÈREMENT
 * quand l'archétype les précise (ce sont des objets simples à écrire en un bloc) ; `shape`,
 * `iris`, `pupil`, `highlights`, `canthi`, `lashes` ne remplacent QUE les clés listées ici — le
 * reste de ces sous-objets garde sa valeur d'origine (voir `apply.ts`).
 */
export interface ArchetypeOverlay {
  readonly shape?: Partial<EyeSpec['shape']>;
  readonly sclera?: EyeSpec['sclera'];
  readonly iris?: Partial<EyeSpec['iris']>;
  readonly pupil?: Partial<EyeSpec['pupil']>;
  readonly highlights?: Partial<EyeSpec['highlights']>;
  readonly lashes?: { upper?: Partial<EyeSpec['lashes']['upper']>; lower?: Partial<EyeSpec['lashes']['lower']> };
  readonly eyebrow?: EyeSpec['eyebrow'];
  readonly canthi?: { inner?: Partial<EyeSpec['canthi']['inner']>; outer?: Partial<EyeSpec['canthi']['outer']> };
}

/** Construit un `ColorSource` radial à partir de paires (offset, couleur), opacité 1 implicite. */
export const radial = (stops: readonly [number, string][]) =>
  ({ type: 'radial', stops: stops.map(([offset, color]) => ({ offset, color, opacity: 1 })) }) as const;

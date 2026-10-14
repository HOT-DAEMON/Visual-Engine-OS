import { z } from 'zod';

/**
 * Archétype : un ensemble cohérent de valeurs par défaut (iris, pupille, sclère, cils, sourcil)
 * évoquant un type d'œil reconnaissable, au même titre qu'un préréglage de matériau (voir
 * materials/presets.ts). Résolu par `archetypes/apply.ts`, PAS par zod : contrairement à un
 * préréglage de matériau, un archétype touche plusieurs branches du schéma à la fois.
 * null (par défaut) : aucun effet, l'œil garde ses valeurs telles qu'écrites.
 */
export const EyeArchetype = z.enum(['realistic', 'reptile', 'feline', 'doll', 'alien', 'demon']).nullable();
export type EyeArchetypeName = NonNullable<z.infer<typeof EyeArchetype>>;

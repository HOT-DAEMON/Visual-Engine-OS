import { z } from 'zod';
import { Slug } from './primitives';
import { MaterialRef } from './color-material';
import { Transform } from './light-transform';
import { Place } from './host';
import { Shape } from './eye-shape';
import { Iris, Pupil, Highlights } from './eye-iris-pupil';
import { Lids } from './eye-lids';
import { Lashes } from './eye-lashes';
import { Canthi, EpicanthicFold } from './eye-canthi-fold';
import { Eyebrow } from './eye-eyebrow';
import { EyeGaze, Expression } from './eye-gaze-expression';
import { HeadTurn } from './eye-head-turn';
import { EyeArchetype } from './eye-archetype';
import { Microdetail } from './eye-microdetail';
import { Appearance } from './appearance';

export const EyeSpec = z
  .object({
    kind: z.literal('eye'),
    id: Slug,
    seed: z.number().int().min(0).max(0xffffffff).default(1),
    transform: Transform.default({}),
    shape: Shape.default({}),
    sclera: MaterialRef.default({ preset: 'matte', color: '#fbf8f3' }),
    iris: Iris.default({}),
    pupil: Pupil.default({}),
    gaze: EyeGaze.default({}),
    headTurn: HeadTurn.default({}),
    highlights: Highlights.default({}),
    lids: Lids.default({}),
    lashes: Lashes.default({}),
    canthi: Canthi.default({}),
    epicanthicFold: EpicanthicFold.default({}),
    /**
     * Expression faciale : recalcule à la volée (fonction pure, sans hasard) l'ouverture, le pli,
     * le sourcil et l'inclinaison du regard à partir de la valeur neutre. N'affecte ni les couleurs
     * ni la géométrie de l'iris/sclère. null ou intensity=0 : neutre, aucun effet.
     */
    expression: Expression.nullable().default(null),
    /** null : pas de sourcil. */
    eyebrow: Eyebrow.nullable().default({}),
    /**
     * Peau péri-oculaire (couleur du pli épicanthique et des ombres). null : matériau de l'hôte si
     * l'œil est posé sur un hôte, sinon peau claire par défaut. Doit correspondre à la peau autour.
     */
    skin: MaterialRef.nullable().default(null),
    /** `fast` (défaut) : ombres douces SANS filtre (≈ 4× plus rapide à rastériser, voir `render/eye/soft-shadow.ts`) ; `reference` : flou gaussien SVG historique. */
    renderQuality: z.enum(['fast', 'reference']).default('fast'),
    /** Moteur d'apparence partagé (ombre/lumière/contour dérivés, effets sur l'iris, étalonnage) — voir `render/eye/look.ts`. null : aucun. */
    appearance: Appearance.nullable().default(null),
    /** Microdétails de la sclère et des tissus (EYE-07) — voir `eye-microdetail.ts`. null : aucun (comportement historique). */
    microdetail: Microdetail.nullable().default(null),
    /** Préréglage de regard (voir eye-archetype.ts) : résolu AVANT l'expression, au rendu. */
    archetype: EyeArchetype.default(null),
    place: Place.optional(),
  })
  .strict();
export type EyeSpec = z.infer<typeof EyeSpec>;

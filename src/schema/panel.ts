import { z } from 'zod';
import { Slug } from './primitives';
import { MaterialRef } from './color-material';
import { Transform } from './light-transform';

export const PanelSpec = z
  .object({
    kind: z.literal('panel'),
    id: Slug,
    transform: Transform.default({}),
    width: z.number().min(4).max(4000).default(160),
    height: z.number().min(4).max(4000).default(100),
    cornerRadius: z.number().min(0).max(1000).default(8),
    material: MaterialRef,
  })
  .strict();
export type PanelSpec = z.infer<typeof PanelSpec>;

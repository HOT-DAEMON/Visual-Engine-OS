import { z } from 'zod';

/** Nombre fini quelconque (rejette NaN/Infinity), et fraction bornée à [0, 1]. */
export const Num = z.number().finite();
export const Unit = z.number().min(0).max(1);

export const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'couleur attendue au format #rrggbb');
export const Slug = z
  .string()
  .regex(/^[a-z][a-z0-9-]{0,47}$/, 'identifiant attendu : a-z, 0-9, tirets, 1re lettre a-z, 48 max');

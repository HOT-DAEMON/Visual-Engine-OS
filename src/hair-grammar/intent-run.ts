import { verifyComposed, type Verdict } from './compose-verify';
import { generate, type HairProfile } from './grammar';
import type { View } from './head';
import { applyIntent, type Intent } from './intent';
import type { LockSpec } from './lock';
import { repairCycle, type Attempt } from './repair';

/**
 * INTENTION → COIFFURE VÉRIFIÉE : `applyIntent` déforme les champs du profil, mais une intention poussée (volume +1, vent 1…) peut produire des
 * défauts que ni l'un ni l'autre ne voit (mèche sur l'œil, sur la bouche, axe qui se replie). `generateIntended` ferme la boucle : générer avec
 * l'intention, VÉRIFIER (géométrie · anatomie · style), puis lancer le cycle de réparation local — qui ne garde une correction que si le score
 * de défauts BAISSE. `initial` est le verdict avant réparation : le gain est mesurable et jamais négatif.
 */
export interface IntendedHair { readonly profile: HairProfile; readonly specs: LockSpec[]; readonly initial: Verdict; readonly verdict: Verdict; readonly journal: Attempt[] }

export function generateIntended(P: HairProfile, I: Intent, view: View, seed = 1, repair = true): IntendedHair {
  const { profile } = applyIntent(P, I);
  const specs0 = generate(profile, seed); const initial = verifyComposed(profile.head, specs0, view);
  if (!repair) return { profile, specs: specs0, initial, verdict: initial, journal: [] };
  const r = repairCycle(profile, specs0, view, seed);
  return { profile, specs: r.specs, initial, verdict: r.verdict, journal: r.journal };
}

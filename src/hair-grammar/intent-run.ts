import { verifyComposed, type Verdict } from './compose-verify';
import { branchHair } from './branch';
import { generate, type HairProfile } from './grammar';
import type { View } from './head';
import { applyIntent, type Intent } from './intent';
import { applyPart } from './part';
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
  const opts = { wind: I.wind ?? 0, ...(I.part !== undefined ? { part: I.part * profile.head.rx } : {}) };
  // Post-passes d'art direction : raie d'abord (elle déplace des racines), puis pointes libres (filles posées sur les mèches définitives).
  let specs0 = generate(profile, seed);
  if (I.part !== undefined) specs0 = applyPart(profile.head, specs0, I.part * profile.head.rx);
  if (I.tips) specs0 = branchHair(profile, specs0, { fray: { prob: Math.min(1, 0.8 * I.tips), n: [2, 2 + Math.round(2 * I.tips)] } }, seed);
  const initial = verifyComposed(profile.head, specs0, view, undefined, undefined, opts);
  if (!repair) return { profile, specs: specs0, initial, verdict: initial, journal: [] };
  const r = repairCycle(profile, specs0, view, seed, 12, opts);
  return { profile, specs: r.specs, initial, verdict: r.verdict, journal: r.journal };
}

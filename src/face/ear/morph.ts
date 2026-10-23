import { clamp } from '../../core/math';
import { mulberry32 } from '../../core/prng';
import type { FaceEars } from '../../schema/face-ear';
import { FAMILIES, FAMILY_ORDER } from './families';
import { STRUCTURES, type EarCorrection, type FlatMorph, type ResolvedEar, type StructureId } from './types';

/** Aplatit `morph` (`{pole:{height}}` → `pole.height`, `width` reste `width`). */
export function flattenMorph(m: FaceEars['morph']): FlatMorph {
  const out: FlatMorph = {};
  for (const [k, v] of Object.entries(m)) {
    if (typeof v === 'number') out[k] = v;
    else for (const [k2, v2] of Object.entries(v as Record<string, number>)) out[`${k}.${k2}`] = v2;
  }
  return out;
}

/** Clés morphologiques (toutes les déviations du schéma, avec leur étendue pour l'asymétrie). */
export const MORPH_KEYS: readonly string[] = Object.keys(flattenMorph({ pole: { height: 0, round: 0, lean: 0, tip: 0 }, posterior: { convexity: 0 }, width: 0, lobule: { length: 0, width: 0, attach: 0, sag: 0 }, tragus: { size: 0, projection: 0 }, antitragus: { size: 0, orientation: 0 }, notch: { depth: 0 }, helix: { thickness: 0, roll: 0 }, antihelix: { relief: 0, branchAngle: 0, upperLength: 0, lowerLength: 0 }, concha: { depth: 0, cymba: 0 }, scapha: { width: 0, depth: 0 }, crus: { thickness: 0 } } as never));

/** Poids des familles : `blend` borné, le reste à la famille principale ; ordre fixe. */
export function familyWeights(e: FaceEars): Partial<Record<FaceEars['family'], number>> {
  const w: Partial<Record<FaceEars['family'], number>> = {};
  let used = 0;
  for (const f of FAMILY_ORDER) {
    const v = f === e.family ? 0 : clamp(e.blend[f] ?? 0, 0, 1);
    if (v > 0) { w[f] = v; used += v; }
  }
  const scale = used > 1 ? 1 / used : 1;
  for (const f of Object.keys(w) as (keyof typeof w)[]) w[f] = (w[f] as number) * scale;
  w[e.family] = (w[e.family] ?? 0) + Math.max(0, 1 - used * scale);
  return w;
}

/**
 * Résolution d'une oreille : mélange des familles → déviations de l'utilisateur → asymétrie contrôlée (gauche ≠ droite, graine fixe) → plages de
 * famille (bornes de PRÉFÉRENCE, levées par l'exagération) → présence des structures. Pure et déterministe.
 */
export function resolveEar(e: FaceEars, side: -1 | 1): ResolvedEar {
  const weights = familyWeights(e);
  const corr: EarCorrection[] = [];
  const flat: FlatMorph = {};
  let widthRatio = 0;
  for (const f of FAMILY_ORDER) {
    const w = weights[f];
    if (!w) continue;
    widthRatio += w * FAMILIES[f].widthRatio;
    for (const [k, v] of Object.entries(FAMILIES[f].morph)) flat[k] = (flat[k] ?? 0) + w * v;
  }
  const user = flattenMorph(e.morph);
  const free = (Object.keys(weights) as (keyof typeof weights)[]).some((f) => FAMILIES[f as keyof typeof FAMILIES].symmetry === 'free' && (weights[f] ?? 0) >= 0.5);
  const rnd = mulberry32((e.seed ^ (side < 0 ? 0x1e57 : 0x5eed)) >>> 0);
  const spread = e.style.asymmetry * (free ? 0.6 : 0.25);
  for (const k of MORPH_KEYS) {
    const asym = (rnd() * 2 - 1) * spread;
    flat[k] = (flat[k] ?? 0) + (user[k] ?? 0) + asym;
  }
  // Plages de famille : la plage du mélange est l'enveloppe des plages des familles pondérées ≥ 0,5 ; l'exagération élargit la marge.
  const margin = 1 + 2 * e.style.exaggeration;
  for (const f of FAMILY_ORDER) {
    if ((weights[f] ?? 0) < 0.5) continue;
    for (const [k, [lo, hi]] of Object.entries(FAMILIES[f].ranges)) {
      const v = flat[k] ?? 0;
      const c = clamp(v, lo * margin, hi * margin);
      if (c !== v) corr.push({ id: `family-range:${f}:${k}`, param: `morph.${k}`, requested: v, applied: c, reason: `hors de la plage de la famille « ${f} » (levée par l'exagération)`, tier: 'preference' });
      flat[k] = c;
    }
  }
  for (const k of MORPH_KEYS) flat[k] = clamp(flat[k] ?? 0, -1.5, 1.5);
  const present = Object.fromEntries(STRUCTURES.map((s) => [s, presence(s, weights)])) as Record<StructureId, boolean>;
  // La longueur du lobule (−1 = absent) et sa présence sont liées : un lobule « absent » n'est pas dessiné.
  const matW = weights[e.family] ?? 1;
  const material = e.material.kind ?? FAMILIES[e.family].defaultMaterial;
  void matW;
  const maxEx = (Object.keys(weights) as (keyof typeof weights)[]).flatMap((f) => FAMILIES[f as keyof typeof FAMILIES].extensions);
  // Extensions : celles que le mélange rend compatibles (sinon corrigées → `strict` : une extension incompatible n'est pas construite).
  const extensions = e.extensions.filter((x) => {
    const ok = maxEx.includes(x.kind);
    if (!ok) corr.push({ id: `extension-incompatible:${x.kind}`, param: 'extensions', requested: 1, applied: 0, reason: `l'extension « ${x.kind} » n'est pas compatible avec cette famille`, tier: 'strict' });
    return ok;
  });
  return { side, weights, flat, widthRatio, present, material, extensions, corrections: corr };
}

/** Une structure existe si le poids cumulé des familles qui NE L'INTERDISENT PAS atteint 0,5 (`required` est la garantie de la famille : testée ⊆ présentes). */
function presence(s: StructureId, w: Partial<Record<string, number>>): boolean {
  let yes = 0;
  for (const f of FAMILY_ORDER) {
    const wf = w[f];
    if (wf && !FAMILIES[f].forbidden.includes(s)) yes += wf;
  }
  return yes >= 0.5;
}

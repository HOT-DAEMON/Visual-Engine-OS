import { FaceParams, type FaceParamsInput } from '../../schema';
import { measureFace } from './measures';

/**
 * CARTE D'INFLUENCE MESURÉE : pour chaque paramètre numérique du schéma, quelles mesures changent quand on le perturbe seul.
 * C'est la vérité de terrain contre laquelle les contrats DÉCLARÉS sont vérifiés : un contrat qui omet une influence réelle ment ;
 * un contrat qui en déclare une que personne ne mesure est signalé (« lecture morte »).
 * Perturbation : première valeur candidate acceptée par le schéma parmi `+0,25 ; −0,25 ; ×0,5 ; +5 ; −5 ; ±0,05 ; ±0,01` (un paramètre
 * qu'aucune candidate ne fait accepter est listé dans `skipped`, jamais ignoré en silence).
 */
export interface InfluenceMap {
  /** chemin de paramètre → mesures modifiées (|Δ| > 1e-9). */
  readonly influences: Readonly<Record<string, readonly string[]>>;
  readonly skipped: readonly string[];
  readonly measures: readonly string[];
}

/** Chemins des feuilles numériques d'un objet (`a.b.c`), dans l'ordre alphabétique (déterministe). */
export function numericLeaves(o: unknown, prefix = ''): string[] {
  if (typeof o === 'number') return [prefix];
  if (o === null || typeof o !== 'object' || Array.isArray(o)) return [];
  return Object.keys(o as object).sort().flatMap((k) => numericLeaves((o as Record<string, unknown>)[k], prefix ? `${prefix}.${k}` : k));
}

export const getPath = (o: unknown, path: string): number => path.split('.').reduce((c, k) => (c as Record<string, unknown>)[k], o) as number;

function withPath(o: Record<string, unknown>, path: string, v: number): Record<string, unknown> {
  const out = structuredClone(o);
  const ks = path.split('.');
  let c = out;
  for (const k of ks.slice(0, -1)) c = c[k] as Record<string, unknown>;
  c[ks[ks.length - 1] as string] = v;
  return out;
}

export function influenceMap(W = 300, H = 380, base: FaceParamsInput = {}): InfluenceMap {
  const p0 = FaceParams.parse({ anatomyEngine: 'structured', ears: { visible: true }, ...base });
  const m0 = measureFace(p0, W, H);
  const influences: Record<string, string[]> = {};
  const skipped: string[] = [];
  for (const path of numericLeaves(p0)) {
    const v0 = getPath(p0, path);
    let changed: string[] | null = null;
    for (const d of [(x: number) => x + 0.25, (x: number) => x - 0.25, (x: number) => x * 0.5, (x: number) => x + 5, (x: number) => x - 5, (x: number) => x + 0.05, (x: number) => x - 0.05, (x: number) => x + 0.01, (x: number) => x - 0.01]) {
      const r = FaceParams.safeParse(withPath(p0 as unknown as Record<string, unknown>, path, d(v0)));
      if (!r.success) continue;
      const m1 = measureFace(r.data, W, H);
      changed = Object.keys(m0).filter((k) => Math.abs((m1[k] ?? 0) - (m0[k] ?? 0)) > 1e-9);
      break;
    }
    if (changed === null) skipped.push(path); else influences[path] = changed;
  }
  return { influences, skipped, measures: Object.keys(m0) };
}

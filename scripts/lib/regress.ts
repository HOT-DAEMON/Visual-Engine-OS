import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_CASES, type VisualCase } from '../../src/regression/cases';
import { decodePng, type Raster } from '../../src/regression/png';
import { diffStats, type DiffStats } from '../../src/regression/diff';
import { cellSvg } from './board';
import { rasterPixels, rasterPng } from './raster';

/**
 * Régression visuelle : rendu d'un cas, comparaison à la référence stockée dans `references/visual/`.
 * Décision, du plus strict au plus tolérant :
 *   1. `exact`   : le SVG a le même sha1 que celui de la référence → rien n'a changé (pas de rastérisation) ;
 *   2. `close`   : le SVG diffère, mais l'image reste sous les SEUILS (RMS ≤ 1,5 ; pixels > 8/255 ≤ 0,2 %) → changement imperceptible, signalé ;
 *   3. `changed` : au-dessus des seuils → ÉCHEC : soit une régression, soit un changement voulu à confirmer par `npm run regress:update`.
 *   4. `missing`: pas de référence (à créer explicitement).
 * La mise à jour des références est TOUJOURS une action explicite (jamais déclenchée par un test).
 */
export const REF_DIR = join(process.cwd(), 'references', 'visual');
export const REF_W = 170; export const REF_H = 210;
export const THRESHOLDS = { rms: 1.5, fracOver8: 0.002 } as const;
export type Verdict = 'exact' | 'close' | 'changed' | 'missing';
export interface CaseResult { readonly id: string; readonly verdict: Verdict; readonly stats?: DiffStats; readonly svgSha: string }
interface Manifest { readonly size: { w: number; h: number }; readonly cases: Record<string, { svgSha1: string; kind: string; why: string }> }

export const sha1 = (s: string): string => createHash('sha1').update(s).digest('hex');

export function renderCase(c: VisualCase): { svg: string } {
  const { svg } = cellSvg({ seed: c.seed, patch: c.patch, light: c.light, focus: c.focus }, REF_W, REF_H);
  return { svg };
}

function manifest(): Manifest | null {
  const f = join(REF_DIR, 'manifest.json');
  return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as Manifest) : null;
}

export const loadRef = (id: string): Raster | null => {
  const f = join(REF_DIR, `${id}.png`);
  return existsSync(f) ? decodePng(readFileSync(f)) : null;
};

export function checkCase(c: VisualCase): CaseResult {
  const { svg } = renderCase(c);
  const svgSha = sha1(svg);
  const m = manifest()?.cases[c.id];
  const ref = loadRef(c.id);
  if (!m || !ref) return { id: c.id, verdict: 'missing', svgSha };
  if (m.svgSha1 === svgSha) return { id: c.id, verdict: 'exact', svgSha };
  const cur = rasterPixels(svg);
  const stats = diffStats(ref, { width: cur.width, height: cur.height, data: cur.pixels });
  return { id: c.id, verdict: stats.rms <= THRESHOLDS.rms && stats.fracOver8 <= THRESHOLDS.fracOver8 ? 'close' : 'changed', stats, svgSha };
}

/** Réécrit TOUTES les références (action explicite). */
export function updateRefs(cases: readonly VisualCase[] = ALL_CASES): void {
  mkdirSync(REF_DIR, { recursive: true });
  const out: Manifest['cases'] = {};
  for (const c of cases) {
    const { svg } = renderCase(c);
    writeFileSync(join(REF_DIR, `${c.id}.png`), rasterPng(svg));
    out[c.id] = { svgSha1: sha1(svg), kind: c.kind, why: c.why };
  }
  writeFileSync(join(REF_DIR, 'manifest.json'), JSON.stringify({ size: { w: REF_W, h: REF_H }, cases: out }, null, 1));
}

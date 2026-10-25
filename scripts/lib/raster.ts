import { Resvg } from '@resvg/resvg-js';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { clock } from '../../src/perf';

/**
 * Rastérisation avec cache DISQUE adressé par le contenu.
 *
 * Contrat : la clé est sha1(SVG complet + options) — le SVG contient tout ce qui détermine l'image (géométrie, couleurs, filtres),
 * donc deux SVG identiques donnent le même PNG (resvg est déterministe sur une même machine) et un SVG modifié d'un seul
 * attribut donne une autre clé : un cache périmé est IMPOSSIBLE par construction (pas d'invalidation à gérer).
 * `RASTER_CACHE=0` désactive le cache (mesures à froid) ; le dossier est `.cache/raster/` (ignoré par git).
 */
const DIR = join(process.cwd(), '.cache', 'raster');
export interface RasterOpts { readonly fonts?: boolean; readonly fitWidth?: number }
export const rasterStats = { hits: 0, misses: 0 };
const mem = new Map<string, Buffer>();

const keyOf = (svg: string, o: RasterOpts): string => createHash('sha1').update(svg).update(JSON.stringify(o)).digest('hex');

function engine(svg: string, o: RasterOpts): Resvg {
  // `loadSystemFonts` vaut `true` PAR DÉFAUT dans resvg-js : sans ce réglage explicite, chaque instance rescanne les polices du système (≈ 65 ms
  // mesurés, même pour un SVG minimal ; docs/PERF-2.md). Le moteur n'émet aucun <text> : les polices ne servent qu'aux planches étiquetées (`fonts: true`).
  return new Resvg(svg, { font: { loadSystemFonts: o.fonts === true }, ...(o.fitWidth ? { fitTo: { mode: 'width' as const, value: o.fitWidth } } : {}) });
}

/** PNG du SVG, depuis le cache (mémoire puis disque) ou rastérisé (durée comptée dans l'étape `raster`). */
export function rasterPng(svg: string, o: RasterOpts = {}): Buffer {
  const k = keyOf(svg, o);
  const useDisk = process.env.RASTER_CACHE !== '0';
  const m = mem.get(k);
  if (m && useDisk) { rasterStats.hits++; return m; }
  const file = join(DIR, `${k}.png`);
  if (useDisk && existsSync(file)) {
    rasterStats.hits++;
    const b = readFileSync(file);
    mem.set(k, b);
    return b;
  }
  rasterStats.misses++;
  const t0 = Number(process.hrtime.bigint()) / 1e6;
  const png = engine(svg, o).render().asPng();
  clock.add('raster', Number(process.hrtime.bigint()) / 1e6 - t0);
  if (useDisk) {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(file, png);
    mem.set(k, png);
  }
  return png;
}

/** Pixels RGBA bruts (jamais mis en cache : ils servent aux comparaisons pixel à pixel). */
export function rasterPixels(svg: string, o: RasterOpts = {}): { pixels: Uint8Array; width: number; height: number } {
  const r = engine(svg, o).render();
  return { pixels: r.pixels, width: r.width, height: r.height };
}

/** Le même SVG sans aucun attribut `filter` : sert à isoler le coût des filtres (rendu complet − rendu sans filtres). */
export const stripFilters = (svg: string): string => svg.replace(/ filter="url\(#[^)]*\)"/g, '');

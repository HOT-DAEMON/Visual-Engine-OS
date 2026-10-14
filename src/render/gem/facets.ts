import type { Vec } from '../../geometry/eye';

export interface GemFacet {
  readonly points: readonly Vec[];
  /** Éclaircissement (positif) ou assombrissement (négatif), motif fixe — pas de hasard. */
  readonly tone: number;
}

/**
 * Disque de facettes triangulaires façon pierre taillée : `n` quartiers radiaux, chacun coupé en
 * deux (facette interne + externe), alternant clair/sombre pour l'effet de taille. Motif entièrement
 * déterministe (aucun PRNG) : c'est la régularité qui fait le rendu « gemme », pas l'aléatoire.
 */
export function gemFacets(n: number, rOuter: number, rInner: number): GemFacet[] {
  const facets: GemFacet[] = [];
  for (let i = 0; i < n; i++) {
    const a0 = (2 * Math.PI * i) / n;
    const a1 = (2 * Math.PI * (i + 1)) / n;
    const outer0: Vec = { x: rOuter * Math.cos(a0), y: rOuter * Math.sin(a0) };
    const outer1: Vec = { x: rOuter * Math.cos(a1), y: rOuter * Math.sin(a1) };
    const inner0: Vec = { x: rInner * Math.cos(a0), y: rInner * Math.sin(a0) };
    const inner1: Vec = { x: rInner * Math.cos(a1), y: rInner * Math.sin(a1) };
    const center: Vec = { x: 0, y: 0 };
    const alt = i % 2 === 0 ? 1 : -1;
    facets.push({ points: [inner0, inner1, center], tone: alt * 0.12 });
    facets.push({ points: [inner0, outer0, outer1, inner1], tone: -alt * 0.22 + (outer1.x > 0 ? 0.05 : -0.05) });
  }
  return facets;
}

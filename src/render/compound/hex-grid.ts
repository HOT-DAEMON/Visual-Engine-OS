import type { Vec } from '../../geometry/eye';

/**
 * Grille hexagonale axiale (q, r) convertie en pixels, ne gardant que les centres dont le dôme
 * (rayon `facetRadius`) tient entièrement dans le disque de rayon `R`. Géométrie pure, sans SVG.
 */
export function hexGridCenters(R: number, facetRadius: number): Vec[] {
  const centers: Vec[] = [];
  const limit = Math.ceil(R / facetRadius) + 2;
  for (let q = -limit; q <= limit; q++) {
    for (let r = -limit; r <= limit; r++) {
      const x = facetRadius * 1.5 * q;
      const y = facetRadius * (Math.sqrt(3) * r + (Math.sqrt(3) / 2) * q);
      if (Math.hypot(x, y) <= R - facetRadius * 0.55) centers.push({ x, y });
    }
  }
  return centers;
}

/** Sommets d'un hexagone régulier (orientation pointe en haut) centré sur `c`. */
export function hexPoints(c: Vec, radius: number): Vec[] {
  const pts: Vec[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 180) * (60 * k - 90);
    pts.push({ x: c.x + radius * Math.cos(a), y: c.y + radius * Math.sin(a) });
  }
  return pts;
}

/**
 * Coût de rastérisation d'un SVG d'œil (passe 15). Remplace le seuil de poids en ko (`svg-weight`), mesuré comme un mauvais proxy :
 * le temps de rastérisation corrèle à 0,39 avec les ko et à 0,69 avec les filtres (EYES-PASS-14.md § 7). resvg paie à chaque APPLICATION d'un filtre
 * (pas à chaque définition), puis par tracé, puis par octet : ce sont les grandeurs du modèle.
 * Les coefficients (R² 0,45 sur 100 yeux : les filtres portent l'essentiel, les ko presque rien une fois les filtres comptés ; `nodes` est mesuré mais colinéaire avec les ko) viennent de `scripts/eye-refs/calibrate-svg-cost.ts` (moindres carrés sur le temps mesuré) ; `tests/eye-svg-cost.test.ts` les vérifie contre `references/eyes/measures-svg-cost.json`.
 */
export interface SvgFeatures { readonly filterApps: number; readonly nodes: number; readonly kb: number }

/** Grandeurs que resvg paie : applications de filtre, éléments dessinés, kilo-octets de SVG. */
export function svgFeatures(svg: string): SvgFeatures {
  return {
    filterApps: (svg.match(/ filter="url\(/g) ?? []).length,
    nodes: (svg.match(/<(path|ellipse|circle|rect|polygon|polyline|line)[ />]/g) ?? []).length,
    kb: svg.length / 1000,
  };
}

/** Coefficients du modèle linéaire (ms prédites sur la machine de calibration) — reportés depuis `measures-svg-cost.json`. */
export const SVG_COST_MODEL = { intercept: 14.884, filterApps: 3.003, kb: 0.045 } as const;
/** Plafond du coût prédit : ≈ 2,4 × la médiane mesurée (49 ms) ; le plus lourd des 100 yeux mesurés fait 127 ms. */
export const SVG_COST_MAX_MS = 120;

/** Temps de rastérisation prédit (ms, machine de calibration). */
export function svgCostMs(f: SvgFeatures, m: { intercept: number; filterApps: number; kb: number } = SVG_COST_MODEL): number {
  return m.intercept + m.filterApps * f.filterApps + m.kb * f.kb;
}

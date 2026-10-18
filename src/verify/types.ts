/**
 * Couche de VÉRIFICATION DU RENDU : trois familles de contrôles, toutes chiffrées et reproductibles.
 *  - `geometry` : cohérence géométrique (nombres finis, polygones non dégénérés, enveloppes, garde-fous du visage) ;
 *  - `anatomy`  : cohérence anatomique (enfants du visage à leur place, mèches attachées, oreilles, occlusions voulues) ;
 *  - `style`    : style artistique (cel : ≤ 3 tons + reflet à contour dur, palette, contraste, traits homogènes).
 * Un contrôle `error` fait échouer le rapport ; un contrôle `warn` signale un défaut esthétique sans l'invalider.
 */
export type VerifyLayer = 'geometry' | 'anatomy' | 'style';

export interface Check {
  readonly layer: VerifyLayer;
  readonly id: string;
  readonly severity: 'error' | 'warn';
  readonly ok: boolean;
  /** Valeur mesurée et limite appliquée (pour les artefacts de preuve). */
  readonly value: number;
  readonly limit: number;
  readonly message: string;
}

export interface Report {
  /** Vrai si aucun contrôle `error` n'échoue. */
  readonly ok: boolean;
  readonly checks: Check[];
  readonly failures: Check[];
  readonly warnings: Check[];
}

/** Fabrique d'un contrôle : `ok` = `value` respecte `limit` selon `cmp` ('<=' : value ≤ limit ; '>=' : value ≥ limit ; '==' : |value − limit| ≤ tol). */
export function check(layer: VerifyLayer, id: string, cmp: '<=' | '>=' | '==', value: number, limit: number, message: string, severity: 'error' | 'warn' = 'error', tol = 1e-6): Check {
  const ok = cmp === '<=' ? value <= limit + 1e-9 : cmp === '>=' ? value >= limit - 1e-9 : Math.abs(value - limit) <= tol;
  return { layer, id, severity, ok, value, limit, message };
}

export function report(checks: Check[]): Report {
  const failures = checks.filter((c) => !c.ok && c.severity === 'error');
  return { ok: failures.length === 0, checks, failures, warnings: checks.filter((c) => !c.ok && c.severity === 'warn') };
}

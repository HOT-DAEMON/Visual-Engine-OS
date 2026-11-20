import { VAULT_STRUCTURES } from '../skull/vault-registry';
import { headRelief } from './engines/head-relief';
import { caseSpec, proofCases, type ProofCase } from './vault-proof';

/**
 * AUDIT DE CONSOMMATION DES PARAMÈTRES DE LA VOÛTE (`docs/SKULL-VAULT-3.md`) : pour chaque cas de preuve (tous les paramètres exposés, bases comprises), on compare la TÊTE minimale et la TÊTE maximale
 * (mêmes graine, caméra, lumière) et on lit OÙ elles diffèrent : le relief (déplacement radial, maillage complet y × azimut) et les coupes (a, zf, zb : largeur, profondeur avant / arrière). Le résultat est comparé
 * à ce que le REGISTRE déclare (bandes de hauteur et d'azimut des structures qui portent le paramètre) : un paramètre exposé mais jamais lu, ou lu ailleurs que là où il est déclaré, est un défaut — une valeur qui
 * ne change aucun pixel n'est pas une mesure. Cet audit lit la géométrie ; la preuve en PIXELS reste `vault-proof.ts` (`measureProof`).
 */
/** Seuils de lecture : 0,0005 U ≈ 0,12 mm de tête (en dessous : queue de gaussienne, pas un relief) ; exposants de coupe : 0,01 (une superellipse ne change pas à l'œil en dessous). */
const D = Math.PI / 180, EPS = 5e-4, EPS_EXP = 0.01;
export interface AuditBox { readonly y: readonly [number, number]; readonly az: readonly [number, number] }
export interface AuditResult {
  readonly id: string;
  /** Plus grand écart de relief (U) et boîte (hauteur U, azimut °) où il dépasse EPS ; `null` = aucun relief ne change. */
  readonly relief: { readonly max: number; readonly box: AuditBox | null };
  /** Plus grand écart des coupes (U) et plage de hauteurs concernée ; `null` = aucune coupe ne change. */
  readonly rows: { readonly max: number; readonly y: readonly [number, number] | null; /** Plus grand écart des exposants de coupe (pf, qf, pb, qb). */ readonly exp: number };
  /** Union des bandes déclarées au registre (aucune : le paramètre n'est porté par aucune structure). */
  readonly declared: AuditBox | null;
  readonly consumed: boolean;
  /** Part de l'écart (relief) hors de la bande déclarée élargie de `MARGIN` ; 0 = tout est là où le registre l'annonce. Non évalué pour un écart de coupe (il n'a pas d'azimut propre). */
  readonly leak: number;
}
export const MARGIN = { y: 0.07, az: 14 } as const;

export function declaredBox(id: string): AuditBox | null {
  const s = VAULT_STRUCTURES.filter((q) => q.params.includes(id));
  if (!s.length) return null;
  return { y: [Math.min(...s.map((q) => q.influence.yBand[0])), Math.max(...s.map((q) => q.influence.yBand[1]))], az: [Math.min(...s.map((q) => q.influence.azBand[0])), Math.max(...s.map((q) => q.influence.azBand[1]))] };
}

export function auditCase(c: ProofCase, seed?: number): AuditResult {
  const lo = caseSpec(c, c.lo, seed), hi = caseSpec(c, c.hi, seed), rl = headRelief(lo.engine!)!, rh = headRelief(hi.engine!)!;
  const decl = declaredBox(c.id);
  let max = 0, y0 = 9, y1 = -9, a0 = 999, a1 = -999, out = 0, tot = 0;
  for (let y = 0.02; y <= 0.95; y += 0.01) for (let az = 0; az <= 180; az += 2) {
    const d = Math.abs(rl(y, az * D) - rh(y, az * D)); if (d <= EPS) continue;
    max = Math.max(max, d); y0 = Math.min(y0, y); y1 = Math.max(y1, y); a0 = Math.min(a0, az); a1 = Math.max(a1, az); tot += d;
    if (decl && (y < decl.y[0] - MARGIN.y || y > decl.y[1] + MARGIN.y || az < decl.az[0] - MARGIN.az || az > decl.az[1] + MARGIN.az)) out += d;
  }
  let rm = 0, r0 = 9, r1 = -9, em = 0;
  const n = Math.min(lo.rows.length, hi.rows.length);
  for (let i = 0; i < n; i++) {
    const a = lo.rows[i]!, b = hi.rows[i]!, d = Math.max(Math.abs(a.a - b.a), Math.abs(a.zf - b.zf), Math.abs(a.zb - b.zb));
    const ex = Math.max(...(['pf', 'qf', 'pb', 'qb'] as const).map((f) => Math.abs((a[f] ?? 0) - (b[f] ?? 0))));
    if (d > EPS || ex > EPS_EXP) { rm = Math.max(rm, d); em = Math.max(em, ex); r0 = Math.min(r0, a.y); r1 = Math.max(r1, a.y); }
  }
  const relief = { max, box: max > 0 ? { y: [y0, y1] as const, az: [a0, a1] as const } : null }, rows = { max: rm, exp: em, y: r1 >= r0 ? ([r0, r1] as const) : null };
  return { id: c.id, relief, rows, declared: decl, consumed: max > EPS || rm > EPS || em > EPS_EXP, leak: tot > 0 ? out / tot : 0 };
}
export const auditAll = (seed?: number): AuditResult[] => proofCases().map((c) => auditCase(c, seed));

import { compileScene } from '../../src';
import { EyeSpec } from '../../src/schema/eye';
import { generateExtraEye } from '../../src/generation/eye-gallery-ext';
import { generateExtra2Eye } from '../../src/generation/eye-gallery-ext2';
import { generateExtra3Eye } from '../../src/generation/eye-gallery-ext3';

/**
 * AUDIT DES PARAMÈTRES ORPHELINS DE L'ŒIL (passe 20), complémentaire de `eye-param-sweeps.ts` (60 balayages écrits à la main, mesurés en pixels) : il part du SCHÉMA, donc
 * ne peut rien oublier. Pour CHAQUE feuille de `EyeSpec` (nombre, énumération, booléen, couleur) : on la fait varier (bornes du schéma, milieu, autres valeurs) dans
 * plusieurs contextes — œil nu, yeux de galeries qui possèdent déjà la brique, contextes qui allument les conditions connues (pupille lobée / multiple, tête en `sphere`,
 * pli épicanthique, mèches, expression, microdétails…) — et on compare le SVG compilé. Une feuille qui ne change JAMAIS le SVG est un paramètre orphelin. Quand aucun contexte
 * ne l'allume, on cherche automatiquement le paramètre VOISIN qui la conditionne (`iris.detail.facets.shard` n'agit que si `cut` > 0) et on le consigne dans `gatedBy`.
 * Ce balayage est une condition NÉCESSAIRE (le SVG change) ; la preuve en pixels reste celle de `eye-param-sweeps.ts` et des tests de chaque passe.
 */
type Zod = any; // eslint-disable-line @typescript-eslint/no-explicit-any
type Obj = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export interface Leaf { readonly path: readonly string[]; readonly type: Zod; readonly optional: boolean }
export type Verdict = 'consumed' | 'orphan' | 'exempt';
export interface AuditReport { readonly leaves: number; readonly verdict: Record<string, Verdict>; readonly gatedBy: Record<string, string>; readonly orphans: string[] }

/** Feuilles qui ne se dessinent pas seules : l'identifiant et la pose sur un hôte (sans hôte, `place` ne change rien au SVG de l'œil). */
export const EXEMPT: Record<string, string> = { id: 'identifiant (jamais dessiné)', 'place.host': 'pose sur un hôte : sans hôte dans la scène, aucun effet', 'place.variation': 'pose sur un hôte : sans hôte dans la scène, aucun effet' };

const unwrap = (t: Zod): { t: Zod; optional: boolean } => { let optional = false; for (;;) { const n = t?._def?.typeName; if (n === 'ZodOptional') { optional = true; t = t._def.innerType; } else if (n === 'ZodDefault' || n === 'ZodNullable') t = t._def.innerType; else if (n === 'ZodEffects') t = t._def.schema; else break; } return { t, optional }; };
export function schemaLeaves(): Leaf[] {
  const out: Leaf[] = [];
  const walk = (raw: Zod, p: string[], opt: boolean): void => { const { t, optional } = unwrap(raw); const n = t?._def?.typeName;
    if (n === 'ZodObject') for (const [k, v] of Object.entries<Zod>(t.shape)) walk(v, [...p, k], opt || optional);
    else if (['ZodNumber', 'ZodEnum', 'ZodBoolean', 'ZodString'].includes(n)) out.push({ path: p, type: t, optional: opt || optional }); };
  walk(EyeSpec, [], false);
  return out;
}

const get = (o: Obj, p: readonly string[]): unknown => p.reduce<unknown>((a, k) => (a == null ? undefined : (a as Obj)[k]), o);
const setp = (o: Obj, p: readonly string[], v: unknown): boolean => { let a: Obj = o; for (let i = 0; i < p.length - 1; i++) { const nx = a[p[i] as string]; if (nx == null || typeof nx !== 'object') return false; a = nx as Obj; } a[p[p.length - 1] as string] = v; return true; };
const render = (spec: unknown): string | null => { try { const r = compileScene({ width: 400, height: 280, background: '#ffffff', objects: [{ transform: { x: 200, y: 140 }, ...(spec as Obj) }] } as never) as { ok: boolean; svg: string }; return r.ok ? r.svg : null; } catch { return null; } };
const merge = (a: unknown, b: unknown): unknown => { if (b === null || typeof b !== 'object' || Array.isArray(b)) return b; const o: Obj = { ...((a && typeof a === 'object' ? a : {}) as Obj) }; for (const [k, v] of Object.entries(b as Obj)) o[k] = merge(o[k], v); return o; };

/** Valeurs d'essai d'une feuille, différentes de `cur` : bornes du schéma, milieu, tiers ; autres membres d'une énumération ; bascule ; deux couleurs. */
export function candidates(lf: Leaf, cur: unknown): unknown[] {
  const tn = lf.type._def.typeName as string;
  if (tn === 'ZodNumber') { const ch = lf.type._def.checks as { kind: string; value?: number }[]; const c = typeof cur === 'number' ? cur : 0; const mn = ch.find((k) => k.kind === 'min')?.value ?? c - 1; const mx = ch.find((k) => k.kind === 'max')?.value ?? c + 1;
    const lo = Math.max(mn, -1e4), hi = Math.min(mx, 1e4); const int = ch.some((k) => k.kind === 'int'); return [lo, hi, (lo + hi) / 2, c + (hi - lo) * 0.3].map((v) => (int ? Math.round(v) : v)).filter((v) => v !== cur); }
  if (tn === 'ZodEnum') return (lf.type._def.values as string[]).filter((v) => v !== cur);
  if (tn === 'ZodBoolean') return [!cur];
  return cur === null || cur === undefined || (typeof cur === 'string' && /^#[0-9a-f]{3,8}$/i.test(cur)) ? ['#3a7bd5', '#d53a3a'] : [];
}

/** Contextes qui ALLUMENT les conditions connues (le balayage ne devine pas les interrupteurs de la pupille, du modèle de rotation, du pli, des mèches…). */
const BASE: Obj = { kind: 'eye', id: 'e', shape: { width: 240, height: 130 } };
const CONTEXTS: Obj[] = [
  BASE,
  merge(BASE, { appearance: {} }) as Obj,
  merge(BASE, { appearance: { texture: { kind: 'grain' }, shading: { mode: 'cel', highlightBand: 0.5, castShadow: 0.5 }, emission: { color: '#ff8844', intensity: 0.5 }, reflection: { intensity: 0.7 }, refraction: { strength: 0.6 }, glow: { intensity: 0.6 }, bloom: { intensity: 0.6 }, light: { shadow: '#223355', light: '#ffeecc', rim: '#88aaff' }, gradient: [{ offset: 0, color: '#334455' }, { offset: 1, color: '#ccddee' }] } }) as Obj,
  merge(BASE, { pupil: { shape: 'star' } }) as Obj, merge(BASE, { pupil: { shape: 'polygon' } }) as Obj, merge(BASE, { pupil: { shape: 'cross' } }) as Obj,
  merge(BASE, { pupil: { shape: 'slit_vertical', response: { model: 'vertical_slit' } } }) as Obj, merge(BASE, { pupil: { response: { model: 'circular' } } }) as Obj,
  merge(BASE, { pupil: { multiple: { count: 3 } } }) as Obj, merge(BASE, { pupil: { edge: { tint: '#ff3344' } } }) as Obj, merge(BASE, { pupil: { outlines: [{ width: 0.05, color: '#ff0000' }] } }) as Obj,
  merge(BASE, { headTurn: { model: 'sphere', yawDeg: 30, pitchDeg: 10, azimuthDeg: 22 }, gaze: { yawDeg: 10 } }) as Obj,
  merge(BASE, { epicanthicFold: { amount: 0.7 } }) as Obj, merge(BASE, { lashes: { upper: { clump: 0.8, count: 24 }, lower: { clump: 0.8, count: 10 } } }) as Obj,
  merge(BASE, { expression: { kind: 'angry', intensity: 0.6 } }) as Obj,
  merge(BASE, { microdetail: { vessels: {}, chroma: {}, tearFilm: {}, edge: {}, canthusLines: { outer: 0.5, count: 3, spread: 0.5, inner: 0.4 }, imperfections: 3, occlusion: 0.5 }, cornea: {} }) as Obj,
];

export function auditEyeParams(opts: { corpusPerGallery?: number } = {}): AuditReport {
  const leaves = schemaLeaves(); const n = opts.corpusPerGallery ?? 20;
  const corpus: Obj[] = [];
  for (let i = 0; i < n; i++) for (const g of [generateExtraEye, generateExtra2Eye, generateExtra3Eye]) { const p = EyeSpec.safeParse({ ...(g(i) as Obj), transform: { x: 0, y: 0 }, place: undefined }); if (p.success) corpus.push(p.data as Obj); }
  const pool: Obj[] = [...CONTEXTS.map((c) => EyeSpec.parse(c) as Obj), ...corpus];
  const verdict: Record<string, Verdict> = {}; const gatedBy: Record<string, string> = {};
  const changes = (base: Obj, baseSvg: string, lf: Leaf): boolean => { for (const c of candidates(lf, get(base, lf.path))) { const sp = structuredClone(base); if (!setp(sp, lf.path, c)) continue; const pr = EyeSpec.safeParse(sp); if (!pr.success) continue; const s = render(pr.data); if (s !== null && s !== baseSvg) return true; } return false; };
  const present = (b: Obj, lf: Leaf): boolean => (get(b, lf.path) !== undefined || (lf.optional && get(b, lf.path.slice(0, -1)) != null));
  for (const lf of leaves) { const key = lf.path.join('.');
    if (EXEMPT[key]) { verdict[key] = 'exempt'; continue; }
    verdict[key] = 'orphan';
    for (const b of pool) { if (!present(b, lf)) continue; const svg = render(b); if (svg && changes(b, svg, lf)) { verdict[key] = 'consumed'; break; } }
    // Effets à graine (marques de la sclère, vaisseaux…) : une graine peut ne rien tirer de visible ; on réessaie avec d'autres graines avant de conclure.
    for (const seed of [2, 3, 5, 11, 23]) { if (verdict[key] === 'consumed') break; for (const c of CONTEXTS) { const b = EyeSpec.parse({ ...c, seed }) as Obj; if (!present(b, lf)) continue; const svg = render(b); if (svg && changes(b, svg, lf)) { verdict[key] = 'consumed'; gatedBy[key] = `graine ${seed}`; break; } } }
    if (verdict[key] === 'consumed') continue;
    // Aucun contexte ne l'allume : chercher le paramètre voisin (même objet, puis objets frères) qui la conditionne.
    const parent = lf.path.slice(0, -1).join('.');
    const sibs = leaves.filter((l) => l !== lf && l.path.slice(0, -1).join('.') === parent);
    for (const b of pool.slice(0, 30)) { if (verdict[key] === 'consumed' || !present(b, lf)) continue;
      for (const sb of sibs) { if (verdict[key] === 'consumed' || get(b, sb.path) === undefined) continue;
        for (const sv of candidates(sb, get(b, sb.path)).slice(0, 3)) { const b2 = structuredClone(b); if (!setp(b2, sb.path, sv)) continue; const p2 = EyeSpec.safeParse(b2); if (!p2.success) continue; const svg2 = render(p2.data); if (svg2 && changes(p2.data as Obj, svg2, lf)) { verdict[key] = 'consumed'; gatedBy[key] = `${sb.path.join('.')}=${String(sv)}`; break; } } } }
  }
  return { leaves: leaves.length, verdict, gatedBy, orphans: Object.entries(verdict).filter(([, v]) => v === 'orphan').map(([k]) => k) };
}

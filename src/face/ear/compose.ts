import { mulberry32 } from '../../core/prng';
import type { z } from 'zod';
import { FaceEars } from '../../schema/face-ear';
import type { EarExtensionKind, EarFamily } from '../../schema/face-ear';
import { FAMILIES, FAMILY_ORDER } from './families';

/**
 * COMPOSITEUR D'OREILLES : produit, pour une graine, une oreille COMPLÈTE et cohérente en tirant dans l'espace des axes (≈ 38 axes morphologiques et de style),
 * des familles et de leurs mélanges, des extensions, des matériaux et des détails SURF-05. Ce n'est pas un catalogue : chaque graine compose une combinaison
 * nouvelle ; `scripts/ear-audit/diversity.ts` MESURE combien de ces combinaisons sont visiblement distinctes (aucune affirmation « infinie » sans mesure).
 *
 * Trois caractères (même grammaire, dosage différent) : `natural` (anatomie humaine plausible, variantes rares), `caricature` (structure humaine, proportions
 * poussées, exagération), `fantasy` (familles et mélanges, matières, extensions). Chaque groupe d'axes a SON flux pseudo-aléatoire : ajouter un groupe plus
 * tard ne déplace jamais les tirages des autres. La sortie passe par le schéma (`FaceEars.parse`) : aucune valeur hors plage.
 */
export type EarCharacter = 'natural' | 'caricature' | 'fantasy';
export type FaceEarsInput = z.input<typeof FaceEars>;
export interface ComposeOptions { readonly character?: EarCharacter; readonly family?: EarFamily; readonly surface?: boolean; readonly piercings?: boolean }

const SALT = 0x3a6e0c11;
const hash = (s: string): number => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const stream = (seed: number, name: string): (() => number) => mulberry32(((seed ^ SALT) + hash(name)) >>> 0);
const clampS = (v: number, m = 0.8): number => Math.max(-m, Math.min(m, v));
/** Écart signé quasi gaussien (somme de trois uniformes). */
const sg = (r: () => number, s: number): number => clampS(((r() + r() + r()) / 1.5 - 1) * s);
const pick = <T>(r: () => number, a: readonly T[]): T => a[Math.floor(r() * a.length)] as T;
const between = (r: () => number, lo: number, hi: number): number => lo + (hi - lo) * r();
const round = (v: number): number => Math.round(v * 1000) / 1000;

export function composeEar(seed: number, o: ComposeOptions = {}): z.output<typeof FaceEars> {
  const ch = o.character ?? 'natural';
  const sigma = ch === 'natural' ? 0.55 : ch === 'caricature' ? 0.95 : 0.8;
  const rare = ch === 'natural' ? 1 : ch === 'caricature' ? 3.2 : 2.2; // multiplicateur des variantes rares
  // ── Famille et mélange.
  const rf = stream(seed, 'family');
  let family: EarFamily = o.family ?? 'human';
  const blend: Partial<Record<EarFamily, number>> = {};
  if (!o.family && ch === 'fantasy') {
    family = pick(rf, FAMILY_ORDER);
    if (rf() < 0.55) { const other = pick(rf, FAMILY_ORDER.filter((f) => f !== family)); blend[other] = round(between(rf, 0.1, 0.55)); }
  } else if (!o.family && ch === 'natural' && rf() < 0.04) { family = 'elven'; blend.human = 0.5; }
  // ── Axes morphologiques : un flux par groupe.
  const G = (name: string, s = 1): (() => number) => { const r = stream(seed, name); return () => round(sg(r, sigma * s)); };
  const gp = G('pole'), gl = G('lobule'), gt = G('tragus', 0.8), ga = G('antihelix', 0.8), gc = G('concha', 0.8), gh = G('helix'), gs = G('scapha', 0.8), gx = G('misc');
  const rr = stream(seed, 'rare');
  const on = (p: number): number => (rr() < Math.min(0.9, p * rare) ? round(between(rr, 0.35, 0.95)) : 0);
  const morph0 = {
    pole: { height: gp(), round: gp(), lean: round(gp() * 0.7), tip: family === 'human' ? round(gp() * 0.35) : gp() },
    posterior: { convexity: gx() },
    width: round(gx() * 0.8),
    lobule: { length: gl(), width: gl(), attach: gl(), sag: round(gl() * 0.8), cleft: on(0.05), stretch: on(0.03) },
    tragus: { size: gt(), projection: gt(), tip: gt() },
    antitragus: { size: gt(), orientation: gt() },
    notch: { depth: gt() },
    helix: { thickness: gh(), roll: gh(), darwin: on(0.1), fold: on(0.05) },
    antihelix: { relief: ga(), branchAngle: ga(), upperLength: ga(), lowerLength: ga(), curvature: ga() },
    concha: { depth: gc(), cymba: gc(), wall: on(0.14) },
    scapha: { width: gs(), depth: gs() },
    crus: { thickness: gs(), angle: gs(), length: gs() },
    fossa: { depth: ga(), width: ga() },
  };
  // ── Passe 4 (EAR-01…07 restants) : flux PROPRES (`pass4`, `rare4`) → les tirages historiques ne bougent pas. Couplage anatomique simple : un lobule long est aussi plus charnu.
  const g4 = G('pass4', 0.8), r4 = stream(seed, 'rare4');
  const nick = (p: number): number => (r4() < Math.min(0.9, p * rare) ? -round(between(r4, 0.4, 0.9)) : 0);
  const v4 = { tors: g4(), cont: round(g4() * 0.5), scc: g4(), scg: g4(), ft: g4(), fc: g4(), cv: g4(), ct: round(g4() * 0.8), ctr: g4(), th: g4(), lv: g4() };
  const morph = {
    ...morph0,
    helix: { ...morph0.helix, torsion: v4.tors, continuity: nick(0.04) || v4.cont },
    scapha: { ...morph0.scapha, curvature: v4.scc, gradient: v4.scg },
    fossa: { ...morph0.fossa, tilt: v4.ft, curvature: v4.fc },
    concha: { ...morph0.concha, volume: v4.cv, tilt: v4.ct, transition: v4.ctr },
    tragus: { ...morph0.tragus, thickness: v4.th },
    lobule: { ...morph0.lobule, volume: round(clampS(0.4 * morph0.lobule.length + v4.lv * 0.8)) },
  };
  // ── Grammaire artistique.
  const rs = stream(seed, 'style');
  const style = {
    exaggeration: round(ch === 'caricature' ? between(rs, 0.45, 0.95) : ch === 'fantasy' ? between(rs, 0.2, 0.8) : between(rs, 0, 0.12)),
    fidelity: round(ch === 'natural' ? between(rs, 0.65, 1) : between(rs, 0.3, 1)),
    angularity: round(ch === 'natural' ? between(rs, 0, 0.3) : between(rs, 0, 0.85)),
    softness: round(between(rs, 0.15, 0.9)),
    asymmetry: round(ch === 'natural' ? between(rs, 0.05, 0.3) : between(rs, 0.1, 0.7)),
    detail: round(between(rs, 0.55, 0.95)),
    look: (ch === 'fantasy' && rs() < 0.4 ? 'anime' : 'realistic') as 'anime' | 'realistic',
  };
  // ── Attache.
  const rt = stream(seed, 'attach');
  const attach = { openingDeg: round(between(rt, ch === 'natural' ? 21 : 14, ch === 'natural' ? 36 : 48)), pitchDeg: round(between(rt, -8, 8)), rotationDeg: round(between(rt, -9, 9)), scale: round(between(rt, 0.88, 1.2)), insertion: round(rt()) };
  // ── Matériau et extensions (compatibles avec la famille et le mélange).
  const rm = stream(seed, 'material');
  const fams = [family, ...(Object.keys(blend) as EarFamily[])];
  const mats = [...new Set(fams.flatMap((f) => FAMILIES[f].materials))];
  const exts = [...new Set(fams.flatMap((f) => FAMILIES[f].extensions))] as EarExtensionKind[];
  const kind = ch === 'fantasy' ? pick(rm, mats) : undefined;
  const material = { ...(kind ? { kind } : {}), translucency: round(between(rm, 0.2, 0.85)), roughness: round(between(rm, 0.25, 0.8)), glow: kind === 'crystal' || (ch === 'fantasy' && rm() < 0.3) ? round(between(rm, 0.3, 0.9)) : 0 };
  const re = stream(seed, 'ext');
  const nExt = ch === 'fantasy' && exts.length ? Math.floor(re() * 3.2) : ch === 'caricature' && re() < 0.2 && exts.length ? 1 : 0;
  const extensions = Array.from({ length: nExt }, () => ({ kind: pick(re, exts), at: round(re()), length: round(between(re, 0.25, 0.85)), intensity: round(between(re, 0.3, 0.9)) }));
  // ── Détails SURF-05 (activés par tirage) et bijoux.
  const rd = stream(seed, 'surface');
  const sf = o.surface === false ? 0 : 1;
  const surface = { pigmentation: sf && rd() < 0.7 ? round(between(rd, 0.15, 0.85)) : 0, folds: sf && rd() < 0.45 ? round(between(rd, 0.3, 0.9)) : 0, pores: sf && rd() < 0.35 ? round(between(rd, 0.2, 0.7)) : 0, vessels: sf && rd() < 0.3 ? round(between(rd, 0.3, 0.9)) : 0, hair: sf && rd() < 0.2 ? round(between(rd, 0.3, 0.9)) : 0 };
  // Style cel : peu de tons. Un seul détail de surface (pigmentation, plis ou pilosité) ; pores et vaisseaux n'existent pas dans ce style.
  if (style.look === 'anime') { const keep = (['pigmentation', 'folds', 'hair'] as const).find((k) => surface[k] > 0); for (const k of Object.keys(surface) as (keyof typeof surface)[]) if (k !== keep) surface[k] = 0; if (extensions.length > 1) extensions.length = 1; }
  const rp = stream(seed, 'jewelry');
  const piercings = o.piercings !== false && rp() < (ch === 'natural' ? 0.18 : 0.35)
    ? [{ kind: pick(rp, ['ear_lobe_piercing', 'helix_piercing', 'tragus_piercing', 'conch_piercing'] as const), jewel: pick(rp, ['stud', 'ring', 'drop'] as const), size: round(between(rp, 0.05, 0.16)), hang: round(rp()), color: pick(rp, ['#d4af37', '#c0c0c0', '#b87333', '#e8e8f0'] as const) }]
    : [];
  return FaceEars.parse({ engine: 'morphology', family, blend, seed: Math.floor(stream(seed, 'seed')() * 0x7fffffff), morph, style, attach, material, extensions, surface, piercings });
}

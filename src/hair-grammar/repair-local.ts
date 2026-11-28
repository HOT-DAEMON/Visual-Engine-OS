import { awayEdits, sideOf } from './part-edits';
import { PART_SEVERITY, crossesPart } from './part-line';
import { joinLocks } from './branch';
import { emergeFrom } from './emerge';
import { familyOf, sampleLock, type HairProfile } from './grammar';
import { viewRayInHead, type View } from './head';
import { defectCost, lockDefects, type Marks } from './lock-check';
import { rotAbout, type LockSpec } from './lock';
import { paintLock } from './paint';
import { norm, prng, type V3 } from './vec';

/**
 * SOLVEUR LOCAL — projection de contrainte à ÉDITION MINIMALE. Les défauts d'une mèche (yeux / nez / bouche recouverts, axe qui se coupe) ne dépendent
 * d'aucune autre mèche : au lieu d'essayer des corrections dans un ordre fixe en payant une vérification globale (≈ 120 ms) par essai, on énumère un espace
 * d'éditions (cap dans l'image, racine, longueur, largeur, décollement, courbure, et leurs combinaisons), on les trie par COÛT D'ÉDITION croissant et on
 * prend la première qui ramène le coût de défauts LOCAL à zéro (≈ 1 ms par candidat). La mèche reste donc au plus près de l'intention artistique d'origine.
 * Le solveur exige un dégagement de 3 % de H autour des repères : une lame qui effleure l'œil n'est pas « corrigée ».
 */
export interface Edit { readonly name: string; readonly cost: number; readonly apply: (L: LockSpec) => LockSpec }
export interface Solved { readonly spec: LockSpec; readonly fix: string; readonly editCost: number; readonly before: number; readonly after: number; readonly tried: number }

const CLEARANCE = 0.03;
const pair = (a: Edit, b: Edit): Edit => ({ name: `${a.name} + ${b.name}`, cost: a.cost + b.cost + 0.05, apply: (L) => b.apply(a.apply(L)) });
const deg = (a: number): string => `${a > 0 ? '+' : '−'}${Math.abs(Math.round((a * 180) / Math.PI))}°`;

const aimEdit = (axis: V3, a: number): Edit => ({ name: `cap ${deg(a)} (axe de vue)`, cost: Math.abs(a), apply: (L) => ({ ...L, aim: norm(rotAbout(L.aim, axis, a)) }) });
const rootEdit = (d: number): Edit => ({ name: `racine ${d > 0 ? '+' : '−'}${Math.abs(d)}° d'azimut`, cost: Math.abs(d) / 25, apply: (L) => ({ ...L, root: { el: L.root.el, az: L.root.az + d } }) });
const lenEdit = (s: number): Edit => ({ name: `longueur ×${s}`, cost: (1 - s) * 1.2, apply: (L) => ({ ...L, length: L.length * s }) });
const widEdit = (s: number): Edit => ({ name: `largeur ×${s}`, cost: (1 - s) * 2, apply: (L) => ({ ...L, width: L.width * s }) });
const liftEdit = (s: number): Edit => ({ name: `décollement ×${s}`, cost: (1 - s) * 0.8, apply: (L) => ({ ...L, lift0: L.lift0 * s, lift1: L.lift1 * s }) });
const peelEdit = (s: number): Edit => ({ name: `détachement ×${s}`, cost: (1 - s) * 0.6, apply: (L) => { const [a, b, ...rest] = L.program ?? []; return a && b && b.kind === 'arc' ? { ...L, program: [a, { ...b, angle: b.angle * s }, ...rest] } : L; } });
const bendEdit = (s: number): Edit => ({ name: `courbure ×${s}`, cost: (1 - s) * 0.5, apply: (L) => ({ ...L, bend: L.bend * s }) });
const flickEdit = (s: number): Edit => ({ name: `retroussé ×${s}`, cost: (1 - s) * 0.4, apply: (L) => ({ ...L, flick: { ...L.flick, amt: L.flick.amt * s } }) });
const waveEdit = (s: number): Edit => ({ name: `ondulation ×${s}`, cost: (1 - s) * 0.4, apply: (L) => ({ ...L, wave: { ...L.wave, amp: L.wave.amp * s } }) });
const gravEdit = (s: number): Edit => ({ name: `gravité ×${s}`, cost: (1 - s) * 0.5, apply: (L) => ({ ...L, gravity: L.gravity * s }) });

/** Espace d'éditions d'une mèche pour un jeu de codes de défaut, trié par coût croissant. Une mèche émergente garde sa racine et son cap (imposés par sa mère). */
export function candidateEdits(P: HairProfile, L: LockSpec, view: View, codes: ReadonlySet<string>, seed: number): Edit[] {
  const axis = viewRayInHead(view); const child = !!L.parent; const fixedRoot = child || !!L.shellRoot;
  const aims = child ? [] : [0.15, -0.15, 0.3, -0.3, 0.5, -0.5, 0.75, -0.75, 1, -1].map((a) => aimEdit(axis, a));
  const roots = fixedRoot ? [] : [6, -6, 12, -12, 20, -20].map(rootEdit);
  const lens = [0.85, 0.7, 0.55, 0.4].map(lenEdit); const wids = [0.8, 0.6].map(widEdit); const lifts = [0.6, 0.3].map(liftEdit);
  const peels = child ? [0.5, 0.2, -0.5].map(peelEdit) : [];
  const curv = codes.has('geom.self') && !L.program ? [bendEdit(0.5), bendEdit(0.25), flickEdit(0.5), flickEdit(0), waveEdit(0.5), gravEdit(0.5), pair(bendEdit(0.5), flickEdit(0.5))] : [];
  const singles = [...aims, ...roots, ...lens, ...wids, ...lifts, ...peels, ...curv];
  const pairs: Edit[] = [];
  for (const a of [...aims, ...roots, ...curv]) for (const b of [...lens, ...wids, ...lifts]) pairs.push(pair(a, b));
  for (const a of lens) for (const b of lifts) pairs.push(pair(a, b));
  for (const a of peels) for (const b of lens) pairs.push(pair(a, b));
  const regen: Edit[] = codes.has('geom.self') ? [1, 2, 3].map((k) => ({ name: `régénérer (tirage ${k})`, cost: 3, apply: (S: LockSpec): LockSpec => { const F = familyOf(P, S.family); if (!F) return S; const i = Number(S.id.split('-').pop() ?? 0); return { ...sampleLock(P, F, i, prng(seed * 977 + k * 131 + i)), id: S.id, ...(S.weave ? { weave: S.weave } : {}) }; } })) : [];
  return [...singles, ...pairs, ...regen].sort((a, b) => a.cost - b.cost);
}

/** Coût de défauts LOCAL d'une mèche (avec dégagement) : somme des gravités. */
export function localCost(P: HairProfile, S: LockSpec, view: View, marks: Marks, parent?: LockSpec, part?: number): number {
  const p = paintLock(P.head, S, view);
  // Raie demandée : recouvrir son couloir est un défaut LOCAL (il ne dépend que de la mèche) ; sans lui, une correction d'œil pouvait pousser une mèche sur la raie (mesuré : graine 5, passe 4).
  return defectCost(lockDefects(P.head, view, p, marks, parent, CLEARANCE * view.s)) + (part !== undefined && p.layer !== 'back' && crossesPart(P.head, view, p, part) > 0 ? PART_SEVERITY : 0);
}

/**
 * Résout une mèche : première édition, par coût croissant, qui annule le coût local ; à défaut la meilleure amélioration stricte ; `null` si aucune.
 * Le coût d'édition autorisé croît avec la gravité du défaut (0,6 + coût de défaut) : un auto-croisement de mèche arrière (0,25) ne justifie pas de raccourcir la mèche de moitié.
 */
export function solveLock(P: HairProfile, specs: readonly LockSpec[], idx: number, view: View, marks: Marks, seed: number, part?: number): Solved | null {
  const L = specs[idx] as LockSpec; const parent = L.parent ? specs.find((s) => s.id === L.parent?.id) : undefined;
  const before = localCost(P, L, view, marks, parent, part); if (before <= 0) return null;
  const codes = new Set(lockDefects(P.head, view, paintLock(P.head, L, view), marks, parent, CLEARANCE * view.s).map((d) => d.code));
  const crosses = part !== undefined && crossesPart(P.head, view, paintLock(P.head, L, view), part) > 0;
  const budget = 0.6 + before; let best: Solved | null = null; let tried = 0;
  const edits = [...candidateEdits(P, L, view, codes, seed), ...(crosses ? awayEdits(sideOf(P.head, L, part as number)) : [])].sort((a, b) => a.cost - b.cost);
  for (const e of edits) {
    if (e.cost > budget) break;
    const S = e.apply(L); if (S === L) continue;
    const after = localCost(P, S, view, marks, parent, part); tried++;
    if (after < (best?.after ?? before) - 1e-9) best = { spec: S, fix: e.name, editCost: e.cost, before, after, tried };
    if (after <= 1e-9) break;
  }
  return best ? { ...best, tried } : null;
}

/** Re-dérive les mèches filles d'une mère modifiée : elles gardent leur position de naissance, leur détachement et leur tronçon droit, mais repartent du NOUVEAU point de la mère. */
export function refreshChildren(P: HairProfile, specs: readonly LockSpec[], parentId: string): LockSpec[] {
  const par = specs.find((s) => s.id === parentId); if (!par) return [...specs];
  return specs.map((s) => {
    // Une fille qui REJOINT une autre mèche est re-résolue (longueur et courbure) sur la nouvelle position de sa mère ET de sa cible.
    if (s.join && (s.parent?.id === parentId || s.join.id === parentId)) { const a = specs.find((x) => x.id === s.parent?.id); const b = specs.find((x) => x.id === s.join?.id); if (a && b && s.parent) return joinLocks(P.head, a, s.parent.t, b, s.join.t, { id: s.id, width: s.width, tone: s.tone }); }
    if (s.parent?.id !== parentId || !s.program) return s;
    const [a, b] = s.program; if (!a || !b || a.kind !== 'straight' || b.kind !== 'arc') return s;
    return emergeFrom(P.head, par, s, { t: s.parent.t, peel: b.angle, follow: a.len });
  });
}

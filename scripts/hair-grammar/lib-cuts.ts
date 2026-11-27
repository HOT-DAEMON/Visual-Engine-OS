import { resolveAppearance } from '../../src/appearance';
import type { HairLock } from '../../src/face/hair';
import { generate, type HairProfile } from '../../src/hair-grammar/grammar';
import { repairCycle } from '../../src/hair-grammar/repair';
import { DEFAULT_HEAD, landmarks, project } from '../../src/hair-grammar/head';
import { frameFromEyes, grammarToHairLocks } from '../../src/hair-grammar/interop';
import { MAIN_PRO, paintHairPro } from '../../src/hair-grammar/paint-pro';
import { norm, v3 } from '../../src/hair-grammar/vec';
import { lockMarkup, type LockStyle } from '../../src/render/face/hair-lock';
import { Appearance } from '../../src/schema';
import { ROI, headContent, viewAt } from './engine-kit';

/**
 * Outillage commun aux artefacts des NOUVELLES COUPES (passe 10) : une coupe (profil de grammaire) + graine + lacet → locks du rendu principal
 * (`paintHairPro` + `MAIN_PRO`, même chemin que la passe 9) → SVG de la tête entière (visage du moteur + cheveux en trois calques).
 */
export const H = DEFAULT_HEAD;
export const LIGHT = { dir: norm(v3(-0.45, -0.65, 0.6)) };
export type View = ReturnType<typeof viewAt>;

export const appearance = (hex: string, cel: boolean) => resolveAppearance(hex, Appearance.parse({ shading: { mode: cel ? 'cel' : 'smooth', bands: 3, highlightBand: 0.75, castShadow: 0.4 } }), { model: 'hair' });

/** Génère puis RÉPARE (`repairCycle` : le solveur de la passe 8, localisé par mèche) à la vue demandée — aucun second solveur. */
export const repaired = (P: HairProfile, seed: number, v: View, attempts = 24) => repairCycle(P, generate(P, seed), v, seed, attempts);

/** `fix` = false : mèches brutes du générateur (pour montrer ce que le solveur corrige). */
export function scene(P: HairProfile, yaw: number, seed: number, fix = true): { v: View; locks: HairLock[]; headW: number } {
  const v = viewAt(yaw); const lm = landmarks(H); const eR = project(v, lm.eyeR); const eL = project(v, lm.eyeL); const headW = 2 * H.rx * v.s;
  const painted = paintHairPro(H, fix ? repaired(P, seed, v).specs : generate(P, seed), v, MAIN_PRO, LIGHT);
  return { v, headW, locks: grammarToHairLocks(painted.locks as never, { frame: frameFromEyes(eR, eL, eR, eL), head: H, headW }) };
}

export function head(locks: readonly HairLock[], v: View, ra: ReturnType<typeof appearance>, id: string): string {
  const st: LockStyle = { id, ra, ld: { x: -0.6, y: -0.8 }, W: ROI.w, ring: 'replace' };
  const parts = locks.map((l, i) => lockMarkup(l, i, st, 0, true));
  const pick = (back: boolean): string[] => parts.flatMap((p, i) => ((locks[i] as HairLock).layer === 'back') === back ? p.markup : []);
  return headContent({ back: pick(true).join(''), front: `<defs>${parts.flatMap((p) => p.defs).join('')}</defs>${pick(false).join('')}`, over: '' }, v);
}

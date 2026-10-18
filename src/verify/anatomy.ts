import type { RandomFace } from '../generation/random-face';
import type { FaceLandmarks } from '../face';
import { halfWidthAt } from '../face/outline';
import type { HairGeometry } from '../face/hair';
import { boxCoverage, targetBox } from '../face/hair/occlusion';
import { coverageOf } from '../face/hair/sides';
import { check, type Check } from './types';

type Box = { minX: number; maxX: number; minY: number; maxY: number };

/**
 * COHÉRENCE ANATOMIQUE. Les enfants du visage (yeux, nez, bouche, oreilles) restent EXACTEMENT à leur place quoi que fassent
 * les cheveux ; les mèches ne recouvrent que ce qui a été DEMANDÉ (occlusion) et dans la mesure demandée ; chaque côté se
 * comporte comme annoncé (oreille cachée, dégagée, rangée).
 */
export function checkAnatomy(face: RandomFace, lm: FaceLandmarks, geo: HairGeometry | null): Check[] {
  const out: Check[] = [];
  const { W, H } = lm;
  for (const side of ['left', 'right'] as const) {
    const fit = face.fits[side];
    const want = side === 'left' ? lm.innerCanthus.left : lm.innerCanthus.right;
    // L'œil est ancré sur le canthus interne du visage : écart nul.
    out.push(check('anatomy', `eye-anchor-${side}`, '==', Math.hypot(fit.anchor.x - want.x, fit.anchor.y - want.y), 0, `canthus de l'œil ${side} ≠ repère du visage`, 'error', 1e-6));
    const f = fit.footprint;
    out.push(check('anatomy', `eye-side-${side}`, '==', side === 'left' ? Number(f.maxX > 0) : Number(f.minX < 0), 0, `l'œil ${side} franchit la ligne médiane`));
    const hw = halfWidthAt(lm.outline, Math.min(lm.chinY - 1e-3, Math.max(-H / 2, (f.minY + f.maxY) / 2)));
    out.push(check('anatomy', `eye-in-head-${side}`, '<=', Math.max(Math.abs(f.minX), Math.abs(f.maxX)), hw, `l'œil ${side} sort du contour du crâne`));
  }
  out.push(check('anatomy', 'mouth-below-nose', '>=', lm.mouthY, lm.noseBaseY + 0.06 * H - 1e-6, 'la bouche remonte sous le nez'));
  if (!geo) return out;

  const front = geo.locks.filter((l) => l.layer === 'front').map((l) => l.poly);
  const over = geo.locks.filter((l) => l.layer === 'over').map((l) => l.poly);
  const requested = (t: string): number => geo.occlusions.find((o) => o.target === t)?.requested ?? 0;
  // 1. Mèches AVANT : jamais sur un œil, le nez ou la bouche.
  for (const side of ['left', 'right'] as const) {
    const f = face.fits[side].footprint;
    const cov = boxCoverage(front, { minX: f.minX, maxX: f.maxX, minY: f.minY, maxY: f.maxY });
    out.push(check('anatomy', `front-clear-eye-${side}`, '<=', cov, 0.02, `des mèches avant recouvrent l'œil ${side}`));
  }
  for (const t of ['nose', 'mouth'] as const) {
    out.push(check('anatomy', `front-clear-${t}`, '<=', boxCoverage(front, targetBox(face.params, ctxOf(lm), t)), 0.02, `des mèches avant recouvrent ${t === 'nose' ? 'le nez' : 'la bouche'}`));
  }
  // 2. Occlusions : le recouvrement MESURÉ égale le recouvrement demandé (±0,12) ; une cible non demandée reste libre.
  for (const o of geo.occlusions) out.push(check('anatomy', `occlusion-${o.target}`, '<=', Math.abs(o.measured - o.requested), 0.12, `recouvrement ${o.target} mesuré ${o.measured.toFixed(2)} ≠ demandé ${o.requested.toFixed(2)}`));
  for (const t of ['eyeLeft', 'eyeRight', 'nose', 'mouth'] as const) {
    if (requested(t) > 0) continue;
    const b = targetBox(face.params, ctxOf(lm), t);
    out.push(check('anatomy', `occluder-spill-${t}`, '<=', boxCoverage(over, b), 0.03, `une mèche devant le visage déborde sur ${t} sans l'avoir demandé`));
  }
  // 3. Côtés : chaque côté fait ce qu'il annonce (zones d'oreille mesurées sur l'oreille réellement dessinée).
  for (const side of ['left', 'right'] as const) {
    const s = geo.sides[side];
    const cov = coverageOf(front, s.earZone);
    if (s.ear === 'covered') out.push(check('anatomy', `ear-covered-${side}`, '>=', cov, 0.45, `oreille ${side} annoncée cachée, couverte à ${cov.toFixed(2)}`));
    else if (s.ear === 'free') out.push(check('anatomy', `ear-free-${side}`, '<=', cov, 0.12, `oreille ${side} annoncée dégagée, couverte à ${cov.toFixed(2)}`));
    else out.push(check('anatomy', `ear-tucked-${side}`, '<=', cov, 0.5, `oreille ${side} rangée : seul le haut peut être couvert (${cov.toFixed(2)})`));
    // L'oreille est sur le contour, entre la ligne des yeux et la base du nez.
    const cy = s.earZone.reduce((a, q) => a + q.y, 0) / s.earZone.length;
    out.push(check('anatomy', `ear-height-${side}`, '==', Number(cy >= lm.eyeY - 1e-6 && cy <= lm.noseBaseY + 1e-6), 1, `oreille ${side} hors de la bande yeux → base du nez`));
  }
  // 4. Mèches qui passent devant : attachées à la chevelure (leur point le plus haut touche la zone d'implantation).
  for (const l of geo.locks.filter((q) => q.layer === 'over')) {
    const top = Math.min(...l.poly.map((q) => q.y));
    const hlTop = Math.min(...geo.hairline.map((q) => q.y));
    out.push(check('anatomy', 'occluder-attached', '<=', top, hlTop + 0.3 * H, 'mèche devant le visage non attachée à la chevelure', 'warn'));
  }
  // 5. Front visible pour les franges transparentes : peau visible entre les mèches.
  const forehead: Box = { minX: -W * 0.28, maxX: W * 0.28, minY: Math.max(...geo.hairline.map((q) => q.y)) - 0.01 * H, maxY: lm.browLimitY - 0.012 * H };
  if (forehead.maxY > forehead.minY && geo.fringeBottom) {
    const vis = 1 - boxCoverage(front.filter((_, i) => geo.locks.filter((l) => l.layer === 'front')[i]?.kind === 'fringe'), forehead);
    out.push(check('anatomy', 'forehead-visible-fringe', '>=', vis, 0.15, `front visible à travers la frange : ${vis.toFixed(2)}`, 'warn'));
  }
  return out;
}

/** Contexte minimal pour `targetBox` (il ne lit que `lm` et `guard.hw`). */
function ctxOf(lm: FaceLandmarks): Parameters<typeof targetBox>[1] {
  return { lm, guard: { hw: (y: number) => halfWidthAt(lm.outline, Math.min(lm.chinY - 1e-3, Math.max(-lm.H / 2, y))) } } as unknown as Parameters<typeof targetBox>[1];
}


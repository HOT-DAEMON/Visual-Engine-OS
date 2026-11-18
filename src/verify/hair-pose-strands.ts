import type { Vec } from '../geometry/eye/primitives';
import type { FaceLandmarks } from '../face';
import type { HairGeometry } from '../face/hair';
import type { Skull } from '../face/pose/skull';
import { faceCoverage, stackDepth } from './hair-pose-overlap';
import { check, type Check } from './types';

/**
 * RÈGLES DES MÈCHES SOUS POSE (passe 8, `docs/ROTATION-HAIR-PASS-8.md`). Chacune a son contrôle négatif (`tests/hair-pose-strands.test.ts`) ; chaque seuil est MESURÉ, jamais posé avant mesure.
 *  `pose.strand-conform`    (géométrie, erreur) : chaque point de la ligne médiane d'une mèche ordinaire EST la projection exacte du crâne (`Skull.projectX`) de son point de face (écart ≤ 1e-6 W). Avant la passe 8 l'écart allait
 *    jusqu'à 106 px (0,3 W) : la queue d'une mèche de balayage se détachait du crâne ;
 *  `pose.strand-face-cover` (anatomie, erreur)  : la part du VISAGE (sous les sourcils, 80 % de la demi-largeur) couverte par des mèches, posée − de face, ≤ 0,05. MESURÉ sur 7 coiffures × 3 graines × ±30 / ±45° : avant la passe
 *    8 max 0,239 (p90 0,028) ; après max 0,036 (p90 0,007). À 0° la zone est vide (0 %) pour toutes ;
 *  `pose.strand-stack`      (style, avertissement) : p95 du nombre de mèches empilées par cellule (0,01 W), posé / de face, ≤ 1,5. MESURÉ : médiane 1,00, p90 1,25, max 1,29 après (0,88 / 1,00 / 1,00 avant : l'ancienne carte empilait MOINS,
 *    parce que ses mèches s'écartaient du crâne). Ce n'était donc pas le défaut visible : c'est une garde contre le doublement de mèches, pas un détecteur de la joue traversée.
 */
export const STRAND_FACE_COVER_LIMIT = 0.05;
export const STRAND_STACK_LIMIT = 1.5;
const isTied = (l: { part?: string }): boolean => l.part === 'tail' || l.part === 'bun';
const visibleStrands = (g: HairGeometry): Vec[][] => g.locks.filter((l) => l.layer !== 'back').map((l) => l.poly as Vec[]);

/** Plus grand écart (px) entre la ligne médiane posée d'une mèche ordinaire et la projection exacte de sa ligne médiane de face. */
export function conformGap(g0: HairGeometry, g: HairGeometry, skull: Skull, yawDeg: number): number {
  let m = 0;
  g0.locks.forEach((l, i) => {
    const q = g.locks[i];
    if (!q || isTied(l) || !l.spine || !q.spine) return;
    l.spine.forEach((s, k) => { const p = q.spine?.[k]; if (p) m = Math.max(m, Math.abs(p.x - skull.projectX(s.x, s.y, yawDeg))); });
  });
  return m;
}

export function checkStrandRules(g0: HairGeometry, g: HairGeometry, lm: FaceLandmarks, skull: Skull, yawDeg: number): Check[] {
  const out: Check[] = [];
  out.push(check('geometry', 'pose.strand-conform', '<=', conformGap(g0, g, skull, yawDeg), 1e-6 * lm.W, 'mèche détachée de la surface du crâne (ligne médiane ≠ projection exacte)'));
  const yBot = lm.chinY - 0.02 * lm.H, clampY = (y: number): number => Math.min(lm.chinY - 1, Math.max(skull.topY, y));
  const c0 = faceCoverage(visibleStrands(g0), lm.W, lm.browLimitY, yBot, (y) => skull.halfAt(clampY(y), 0), 0.8);
  const c1 = faceCoverage(visibleStrands(g), lm.W, lm.browLimitY, yBot, (y) => skull.halfAt(clampY(y), yawDeg), 0.8);
  out.push(check('anatomy', 'pose.strand-face-cover', '<=', c1 - c0, STRAND_FACE_COVER_LIMIT, 'des mèches couvrent le visage sous pose alors qu\'elles ne le couvraient pas de face (mèche qui traverse la joue)'));
  const d0 = stackDepth(visibleStrands(g0), lm.W, lm.H), d1 = stackDepth(visibleStrands(g), lm.W, lm.H);
  out.push(check('style', 'pose.strand-stack', '<=', d1 / Math.max(1, d0), STRAND_STACK_LIMIT, 'mèches empilées sous pose bien au-delà de la vue de face (superpositions semi-transparentes)', 'warn'));
  return out;
}

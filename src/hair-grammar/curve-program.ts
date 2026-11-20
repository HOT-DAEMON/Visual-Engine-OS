import { smooth } from './vec';

/**
 * GRAMMAIRE DE COURBES — une mèche = un PROGRAMME de segments successifs, chacun avec son comportement propre.
 * Une ondulation sinusoïdale unique (`bend + wave + flick` de `lock.ts`) ne dit qu'une chose ; un programme compose :
 *   racine presque droite (`straight`) → courbure progressive (`arc`) → inflexion (`inflect`) → compression (`compress`)
 *   → ondulation (`wave`) → torsion du ruban (`twist`) → accélération (`accelerate`) → retournement de pointe (`tipFlip`).
 * Chaque segment décrit sa part de CAP (rad, tourné autour de la normale de coque) en fonction de sa position locale u ∈ [0,1],
 * avec θ_seg(0) = 0 : le cap est CONTINU d'un segment au suivant (pas de coude). `len` = poids de longueur (normalisé sur le programme).
 * La torsion ne déplace pas l'axe : elle fait tourner le ruban autour de lui (largeur apparente, face visible, normale de reflet).
 */
export type CurveSegment =
  | { readonly kind: 'straight'; readonly len: number }
  /** Courbure progressive : cap total `angle`, θ = angle·u^ease (ease = 1 : arc de cercle ; > 1 : part droit puis s'enroule). */
  | { readonly kind: 'arc'; readonly len: number; readonly angle: number; readonly ease?: number }
  /** Inflexion : le cap monte de 0 à `angle` puis revient à 0 (S) ; la courbure change de signe au milieu. */
  | { readonly kind: 'inflect'; readonly len: number; readonly angle: number }
  /** Compression : ondulation dont la fréquence passe de `f0` à `f1` (spires qui se resserrent) ; le cap net du segment est nul. */
  | { readonly kind: 'compress'; readonly len: number; readonly amp: number; readonly f0: number; readonly f1: number }
  /** Ondulation régulière (amplitude de cap `amp`, `freq` périodes, `phase` 0–1). */
  | { readonly kind: 'wave'; readonly len: number; readonly amp: number; readonly freq: number; readonly phase?: number }
  /** Torsion du ruban : `turns` tours complets autour de l'axe sur le segment (n'affecte pas le cap). */
  | { readonly kind: 'twist'; readonly len: number; readonly turns: number }
  /** Accélération : la courbure croît en loi de puissance (crochet tardif), θ = angle·u^power, power ≥ 2. */
  | { readonly kind: 'accelerate'; readonly len: number; readonly angle: number; readonly power?: number }
  /** Retournement de pointe : virage rapide `angle` (rad) sur un segment court, adouci aux deux bouts. */
  | { readonly kind: 'tipFlip'; readonly len: number; readonly angle: number };

export interface ProgramState { readonly theta: number; readonly twist: number; readonly seg: number; readonly u: number }

/** Cap local (rad) d'un segment à la position `u`. */
export function segTheta(s: CurveSegment, u: number): number {
  switch (s.kind) {
    case 'straight': case 'twist': return 0;
    case 'arc': return s.angle * u ** (s.ease ?? 1);
    case 'inflect': return s.angle * Math.sin(Math.PI * u) ** 2;
    case 'compress': {
      const ph = 2 * Math.PI * (s.f0 * u + ((s.f1 - s.f0) * u * u) / 2);
      return s.amp * Math.sin(ph) * Math.sin(Math.PI * u) ** 0.75;
    }
    case 'wave': { const p = s.phase ?? 0; return s.amp * (Math.sin(2 * Math.PI * (s.freq * u + p)) - Math.sin(2 * Math.PI * p)); }
    case 'accelerate': return s.angle * u ** (s.power ?? 2.4);
    case 'tipFlip': return s.angle * smooth(u);
  }
}

/** Torsion locale (rad, cumulée dans le segment). */
export const segTwist = (s: CurveSegment, u: number): number => (s.kind === 'twist' ? s.turns * 2 * Math.PI * smooth(u) : 0);

/** État du programme à la position t ∈ [0,1] de la mèche : cap cumulé (continu), torsion cumulée, segment courant. */
export function evalProgram(prog: readonly CurveSegment[], t: number): ProgramState {
  const total = prog.reduce((a, s) => a + s.len, 0) || 1;
  const x = Math.min(1, Math.max(0, t)) * total;
  let acc = 0; let theta = 0; let twist = 0;
  for (let i = 0; i < prog.length; i++) {
    const s = prog[i] as CurveSegment;
    if (x <= acc + s.len || i === prog.length - 1) {
      const u = s.len > 0 ? Math.min(1, Math.max(0, (x - acc) / s.len)) : 1;
      return { theta: theta + segTheta(s, u), twist: twist + segTwist(s, u), seg: i, u };
    }
    theta += segTheta(s, 1); twist += segTwist(s, 1); acc += s.len;
  }
  return { theta, twist, seg: 0, u: 0 };
}

/** Bornes de t [début, fin] de chaque segment (pour les tests et pour nommer le comportement dominant d'une portion). */
export function segmentSpans(prog: readonly CurveSegment[]): { kind: CurveSegment['kind']; t0: number; t1: number }[] {
  const total = prog.reduce((a, s) => a + s.len, 0) || 1; let acc = 0;
  return prog.map((s) => { const t0 = acc / total; acc += s.len; return { kind: s.kind, t0, t1: acc / total }; });
}

export const validProgram = (prog: readonly CurveSegment[]): boolean => prog.length > 0 && prog.every((s) => s.len > 0 && Number.isFinite(s.len)) && Array.from({ length: 21 }, (_, i) => evalProgram(prog, i / 20)).every((p) => Number.isFinite(p.theta) && Number.isFinite(p.twist));

/** Programme canonique à 8 comportements (ordre de la grammaire) : sert de démonstration et de test de combinaison. */
export const FULL_PROGRAM: readonly CurveSegment[] = [
  { kind: 'straight', len: 1 }, { kind: 'arc', len: 1.2, angle: 0.7, ease: 1.8 }, { kind: 'inflect', len: 1.2, angle: -0.8 },
  { kind: 'compress', len: 1.2, amp: 0.55, f0: 1, f1: 2.6 }, { kind: 'wave', len: 1, amp: 0.25, freq: 1.2 }, { kind: 'twist', len: 1, turns: 0.75 },
  { kind: 'accelerate', len: 1, angle: 0.9, power: 2.6 }, { kind: 'tipFlip', len: 0.5, angle: -1.2 },
];

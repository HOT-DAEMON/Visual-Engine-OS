import { el, urlRef } from '../../../core/svg';
import { gradientStop as stop } from '../../../materials';
import { lineD } from '../soft';
import type { NoseCtx } from './context';

/**
 * Racine, parois et arête du nez. Aucune ligne dure : chaque paroi est un dégradé qui part de l'arête et s'évanouit vers la joue
 * (transition anatomique douce), foncé du côté opposé à la lumière, clair du côté lumière. L'arête reçoit un reflet doux dont l'intensité
 * dépend du profil (un dorsum convexe accroche plus la lumière qu'un dorsum concave).
 */
export function renderWalls(c: NoseCtx): string[] {
  const { g, p, ra, dir, I, u } = c;
  const out: string[] = [];
  const relief = 0.35 + 0.65 * p.nose.bridge;
  const ax = g.dorsum.axis;
  const n = ax.length;
  const walls: string[] = [];
  for (const s of [-1, 1] as const) {
    // Paroi du côté s : de l'arête (bord intérieur) au contour de la pyramide (bord extérieur), du haut vers le bas puis retour.
    const inner = ax.map((q, i) => ({ x: q.x + s * (g.dorsum.half[i] as number), y: q.y }));
    const outer = ax.map((q, i) => ({ x: q.x + s * (g.dorsum.wallHalf[i] as number), y: q.y }));
    const d = `${lineD(inner)}L${[...outer].reverse().map((q) => `${q.x} ${q.y}`).join('L')}Z`;
    // Exposition : > 0 si la paroi regarde la lumière (s et dir.x de même signe).
    const expo = s * dir.x;
    const gid = `${c.id}-nose-wall${s}`;
    const x1 = (inner[Math.floor(n / 2)] as { x: number }).x;
    const x2 = (outer[Math.floor(n / 2)] as { x: number }).x;
    const lit = expo >= 0;
    const col = lit ? ra.light : ra.shadow;
    const a = (lit ? 0.5 : 0.9) * relief * (0.35 + 0.65 * Math.abs(expo)) * (lit ? I : 0.6 + 0.4 * I);
    c.defs.push(el('linearGradient', { id: gid, gradientUnits: 'userSpaceOnUse', x1, y1: 0, x2, y2: 0 }, [stop(0, col, a), stop(0.5, col, a * 0.45), stop(1, col, 0)]));
    walls.push(el('path', { d, fill: urlRef(gid) }));
  }
  // Les parois sont floutées en bloc : la coupe de la racine et le bord extérieur disparaissent (aucune arête de pyramide visible).
  out.push(el('g', { filter: c.kit.blur(2.2 * u) }, walls));
  // Reflet de l'arête : trait flou le long de l'axe, décalé vers la lumière ; plus étroit et plus fort pour un dorsum convexe.
  const shape = p.nose.dorsum.shape;
  const k = { straight: 1, concave: 0.6, convex: 1.25, asymmetric: 1 }[shape];
  const mid = g.dorsum.half[Math.floor(n / 2)] as number;
  const shift = dir.x * mid * 0.35;
  const line = ax.slice(Math.floor(n * 0.15)).map((q) => ({ x: q.x + shift, y: q.y }));
  out.push(c.kit.stroke(lineD(line), ra.light, Math.max(1.2 * u, mid * (shape === 'convex' ? 0.9 : 1.3)), Math.min(0.8, 0.65 * k * I * (0.5 + relief)), Math.max(1 * u, mid * 0.45)));
  return out;
}

/** Raccords haut du nez : glabelle (creux sous le front) et creux naso-jugaux (sous les canthi internes). */
export function renderUpperJunctions(c: NoseCtx): string[] {
  const { g, ra, u } = c;
  const gl = g.junctions.glabella;
  const out: string[] = [];
  const gid = `${c.id}-nose-glab`;
  c.defs.push(el('radialGradient', { id: gid, cx: 0.5, cy: 0.5, r: 0.5 }, [stop(0, ra.shadow, 0.4 * gl.depth), stop(0.6, ra.shadow, 0.18 * gl.depth), stop(1, ra.shadow, 0)]));
  out.push(el('ellipse', { cx: gl.c.x, cy: gl.c.y, rx: gl.rx, ry: gl.ry, fill: urlRef(gid) }));
  for (const side of ['left', 'right'] as const) {
    out.push(c.kit.stroke(lineD(g.junctions.orbital[side]), ra.shadow, 3.2 * u, 0.3 * g.junctions.orbital.depth * (0.5 + 0.5 * c.I), 2.4 * u));
  }
  return out;
}

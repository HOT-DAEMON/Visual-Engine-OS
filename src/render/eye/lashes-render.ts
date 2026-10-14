import { darken, lighten } from '../../core/color';
import type { Lash } from '../../geometry/eye';
import { el } from '../../core/svg';
import { cubicAt, cubicDeriv, norm, type Vec } from '../../geometry/eye/primitives';
import { P, smoothThrough } from './helpers';

/** Bords (gauche/droite) et normale d'un cil — partagés par le remplissage et le liseré de brillance. */
function lashEdges(l: Lash) {
  const dx = l.ctrl.x - l.base.x;
  const dy = l.ctrl.y - l.base.y;
  const n = Math.hypot(dx, dy) || 1;
  const nx = -dy / n;
  const ny = dx / n;
  const hw = l.baseWidth / 2;
  const ctrlFactor = 0.75 - 0.6 * l.tipSharpness;
  return {
    nx,
    ny,
    bl: { x: l.base.x + nx * hw, y: l.base.y + ny * hw },
    br: { x: l.base.x - nx * hw, y: l.base.y - ny * hw },
    c1: { x: l.ctrl.x + nx * hw * ctrlFactor, y: l.ctrl.y + ny * hw * ctrlFactor },
    c2: { x: l.ctrl.x - nx * hw * ctrlFactor, y: l.ctrl.y - ny * hw * ctrlFactor },
  };
}

/**
 * Cil CUBIQUE (cils longs externes) : ligne médiane en Bézier cubique, demi-largeur décroissante
 * jusqu'à la pointe (profil piloté par `tipSharpness`), contour lissé. Renvoie le contour fermé et
 * le bord éclairé le plus proche de la lumière (pour le liseré de brillance).
 */
function cubicLash(l: Lash, lightDir: { x: number; y: number }): { d: string; glint: string } {
  const c2 = l.ctrl2 as Vec;
  const N = 9;
  const left: Vec[] = [];
  const right: Vec[] = [];
  const p = 0.7 + 0.5 * l.tipSharpness;
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const c = cubicAt(l.base, l.ctrl, c2, l.tip, s);
    const t = norm(cubicDeriv(l.base, l.ctrl, c2, l.tip, s));
    const hw = (l.baseWidth / 2) * (1 - s) ** p;
    left.push({ x: c.x - t.y * hw, y: c.y + t.x * hw });
    right.push({ x: c.x + t.y * hw, y: c.y - t.x * hw });
  }
  const d = `M${P(left[0] as Vec)}${smoothThrough(left)}${smoothThrough(right.slice().reverse())}Z`;
  const t0 = norm(cubicDeriv(l.base, l.ctrl, c2, l.tip, 0.5));
  const litLeft = -t0.y * lightDir.x + t0.x * lightDir.y >= 0;
  const side = litLeft ? left : right;
  return { d, glint: `M${P(side[0] as Vec)}${smoothThrough(side)}` };
}

/**
 * Liseré de brillance (`gloss`) : un fibre fine montre un reflet directionnel sur le bord tourné
 * vers la lumière — on redessine simplement, en plus fin et plus clair, celui des deux bords du
 * cil (déjà calculés pour le remplissage) dont la normale est la plus alignée avec la lumière.
 * Approximation légère assumée, pas un calcul d'éclairage physique sur une fibre cylindrique.
 */
function glossPath(l: Lash, lightDir: { x: number; y: number }): string {
  if (l.ctrl2) return cubicLash(l, lightDir).glint;
  const e = lashEdges(l);
  const lit = e.nx * lightDir.x + e.ny * lightDir.y >= 0;
  const [a, c] = lit ? [e.bl, e.c1] : [e.br, e.c2];
  return `M${P(a)}Q${P(c)} ${P(l.tip)}`;
}

/**
 * Assemble un groupe de cils complet : remplissage (avec variation de luminosité par cil, voir
 * `colorJitter`) et, si `gloss > 0`, un liseré de brillance directionnel par-dessus.
 */
export function renderLashGroup(
  lashes: readonly Lash[],
  baseColor: string,
  opacity: number,
  gloss: number,
  lightDir: { x: number; y: number },
): string[] {
  const fills = lashes.map((l) => {
    const d = l.ctrl2
      ? cubicLash(l, lightDir).d
      : (() => {
          const e = lashEdges(l);
          return `M${P(e.bl)}Q${P(e.c1)} ${P(l.tip)}Q${P(e.c2)} ${P(e.br)}Z`;
        })();
    const color = l.colorJitter === 0 ? baseColor : l.colorJitter > 0 ? lighten(baseColor, l.colorJitter) : darken(baseColor, -l.colorJitter);
    return el('path', { d, fill: color, 'fill-opacity': opacity });
  });
  if (gloss <= 0) return fills;
  const glossColor = lighten(baseColor, 0.55);
  const glints = lashes.map((l) =>
    el('path', {
      d: glossPath(l, lightDir),
      fill: 'none',
      stroke: glossColor,
      'stroke-width': Math.max(0.3, l.baseWidth * 0.22),
      'stroke-opacity': gloss * opacity * 0.85,
      'stroke-linecap': 'round',
    }),
  );
  return [...fills, ...glints];
}

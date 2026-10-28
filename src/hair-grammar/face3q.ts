import { landmarks, project, sectionAt, type HeadSpec, type View } from './head';
import { smoothPath } from './blade';
import { rad, v3, type V2, type V3 } from './vec';

/**
 * TÊTE EN 3/4 (rendu d'encre) : silhouette, mâchoire, cou, yeux, nez, bouche, oreille — tous projetés depuis les repères 3D de
 * `head.ts` (donc cohérents avec les mèches ancrées sur la même tête). Les yeux ici sont des primitives 3/4 simplifiées : le
 * moteur d'yeux complet n'est pas encore branché sur la vue 3/4 (voir docs/HAIR-GRAMMAR-REMAINING.md).
 */
export interface FaceDrawing {
  /** Silhouette complète de la tête (crâne + mâchoire), polygone fermé. */
  readonly silhouette: V2[];
  readonly neckBack: string;
  readonly skin: string;
  readonly lines: string;
  readonly eyes: string;
  readonly ear: string;
  readonly pts: Record<string, V2>;
}

const f1 = (v: number): string => (Math.round(v * 10) / 10).toString();

/** Silhouette projetée : pour chaque section horizontale, les deux points où la tangente de vue touche l'ellipse. */
export function silhouetteOf(h: HeadSpec, view: View, n = 60): { left: V2[]; right: V2[] } {
  const a = rad(view.yaw);
  const left: V2[] = []; const right: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const y = -h.ry + 1e-3 + (i / n) * (h.chinY + h.ry - 2e-3);
    const s = sectionAt(h, y);
    const phi = Math.atan2(s.a * Math.cos(a), s.b * Math.sin(a) || 1e-9);
    const mk = (ph: number): V2 => { const p = project(view, v3(s.a * Math.sin(ph), y, s.zc + s.b * Math.cos(ph))); return { x: p.x, y: p.y }; };
    const p1 = mk(phi); const p2 = mk(phi + Math.PI);
    if (p1.x <= p2.x) { left.push(p1); right.push(p2); } else { left.push(p2); right.push(p1); }
  }
  return { left, right };
}

/** Œil 3/4 : coins projetés depuis la surface, paupière supérieure épaisse, iris elliptique selon le raccourcissement. */
function eye(h: HeadSpec, view: View, c: V3, side: 1 | -1, strength: number): string {
  const dx = 0.1;
  const surf = (x: number, y: number): V3 => { const s = sectionAt(h, y); const k = Math.sqrt(Math.max(0, 1 - (x / Math.max(1e-6, s.a)) ** 2)); return v3(x, y, s.zc + s.b * k - 0.015); };
  const pin = project(view, surf(c.x - side * dx * -1 * -1, c.y)); // coin interne (vers le nez)
  const inner = project(view, surf(c.x - side * dx, c.y + 0.004));
  const outer = project(view, surf(c.x + side * dx, c.y - 0.006));
  void pin;
  const m = { x: (inner.x + outer.x) / 2, y: (inner.y + outer.y) / 2 };
  const w = Math.hypot(outer.x - inner.x, outer.y - inner.y);
  const ang = Math.atan2(outer.y - inner.y, outer.x - inner.x);
  const lid = 0.34 * w; // hauteur de la paupière supérieure
  const up = (u: number, k: number): V2 => ({ x: m.x + Math.cos(ang) * u * w - Math.sin(ang) * k, y: m.y + Math.sin(ang) * u * w + Math.cos(ang) * k });
  const top = [up(-0.5, 0), up(-0.28, -lid * 0.92), up(0.05, -lid * 1.05), up(0.34, -lid * 0.7), up(0.5, -lid * 0.12)];
  const bot = [up(-0.5, 0), up(-0.2, lid * 0.55), up(0.2, lid * 0.5), up(0.5, -lid * 0.12)];
  const iris = { x: m.x + Math.cos(ang) * 0.02 * w, y: m.y - lid * 0.1 };
  const rx = 0.2 * w + 0.7; const ry = lid * 0.95;
  const sw = 0.6 + 1.9 * strength;
  const id = `${side}${f1(m.x)}`;
  return `<clipPath id="ec${id}"><path d="${smoothPath([...top, ...[...bot].reverse().slice(1)], true)}"/></clipPath>`
    + `<path d="${smoothPath([...top, ...[...bot].reverse().slice(1)], true)}" fill="#fff"/>`
    + `<g clip-path="url(#ec${id})"><ellipse cx="${f1(iris.x)}" cy="${f1(iris.y)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="#8a8a8c"/><ellipse cx="${f1(iris.x)}" cy="${f1(iris.y)}" rx="${f1(rx * 0.52)}" ry="${f1(ry * 0.62)}" fill="#1c1c1e"/><circle cx="${f1(iris.x - rx * 0.3)}" cy="${f1(iris.y - ry * 0.32)}" r="${f1(rx * 0.2)}" fill="#fff"/></g>`
    + `<path d="${smoothPath(top)}" fill="none" stroke="#111" stroke-width="${f1(sw)}" stroke-linecap="round"/>`
    + `<path d="${smoothPath(bot)}" fill="none" stroke="#111" stroke-width="0.7" stroke-linecap="round"/>`;
}

export function drawFace(h: HeadSpec, view: View): FaceDrawing {
  const lm = landmarks(h);
  const P = (v: V3): V2 => { const p = project(view, v); return { x: p.x, y: p.y }; };
  const sil = silhouetteOf(h, view);
  const silhouette = [...sil.left, ...[...sil.right].reverse()];
  const pts: Record<string, V2> = { eyeR: P(lm.eyeR), eyeL: P(lm.eyeL), noseTip: P(lm.noseTip), mouth: P(lm.mouth), chin: P(lm.chin), earR: P(lm.earR), jawAngleR: P(lm.jawAngleR) };
  // Contour du visage à encrer : bord gauche (avant) du front au menton, puis mâchoire côté droit jusqu'à l'angle.
  const yEye = (h.eyeY + h.ry) / (h.chinY + h.ry);
  const iL = Math.round(yEye * 60 * 0.9);
  const faceEdge = [...sil.left.slice(iL)];
  const iJaw = Math.round(((0.3 + h.ry) / (h.chinY + h.ry)) * 60);
  const jaw = [...sil.right.slice(iJaw)].reverse();
  const contour = [...faceEdge, ...jaw];
  const lines: string[] = [];
  lines.push(`<path d="${smoothPath(contour)}" fill="none" stroke="#111" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`);
  // Nez : arête, pointe, aile et narine (trait d'encre court, plus appuyé sous la pointe).
  const s0 = sectionAt(h, h.noseY);
  const bridge = P(v3(0, h.eyeY + 0.07, s0.zc + s0.b * 0.98 + 0.01));
  const tip = pts.noseTip as V2;
  const ala = P(v3(0.05, h.noseY + 0.012, s0.zc + s0.b * 0.9 + 0.035));
  const sub = P(v3(0, h.noseY + 0.02, s0.zc + s0.b * 0.98 + 0.04));
  lines.push(`<path d="${smoothPath([bridge, { x: (bridge.x + tip.x) / 2 + 0.6, y: (bridge.y + tip.y) / 2 }, tip])}" fill="none" stroke="#111" stroke-width="0.9" stroke-linecap="round"/>`);
  lines.push(`<path d="${smoothPath([tip, sub, ala])}" fill="none" stroke="#111" stroke-width="1.1" stroke-linecap="round"/>`);
  lines.push(`<circle cx="${f1(ala.x - 1.2)}" cy="${f1(ala.y + 1.2)}" r="0.9" fill="#111"/>`);
  // Bouche : trait légèrement concave entre les commissures projetées.
  const sm = sectionAt(h, h.mouthY);
  const mk = (x: number): V3 => v3(x, h.mouthY, sm.zc + sm.b * Math.sqrt(Math.max(0, 1 - (x / sm.a) ** 2)) + 0.01);
  const mL = P(mk(-0.085)); const mR = P(mk(0.085));
  lines.push(`<path d="${smoothPath([mL, { x: (mL.x + mR.x) / 2, y: (mL.y + mR.y) / 2 + 0.7 }, mR])}" fill="none" stroke="#111" stroke-width="1.1" stroke-linecap="round"/>`);
  // Cou : bande derrière la tête, du dessous de la mâchoire vers le bas de l'image.
  const nL = P(v3(-0.19, 0.3, -0.07)); const nR = P(v3(0.2, 0.3, -0.09));
  const nbL = P(v3(-0.2, 0.75, -0.09)); const nbR = P(v3(0.21, 0.75, -0.11));
  const neckBack = `<path d="M${f1(nL.x)} ${f1(nL.y)}L${f1(nR.x)} ${f1(nR.y)}L${f1(nbR.x)} ${f1(nbR.y)}L${f1(nbL.x)} ${f1(nbL.y)}Z" fill="#d6d3cf"/>`;
  const earP = P(lm.earR);
  const ear = `<ellipse cx="${f1(earP.x)}" cy="${f1(earP.y)}" rx="${f1(0.045 * view.s)}" ry="${f1(0.11 * view.s)}" fill="#f1eeea" stroke="#111" stroke-width="1"/>`;
  const eyes = eye(h, view, lm.eyeR, 1, 1) + eye(h, view, lm.eyeL, -1, 0.8);
  const skin = `<path d="${smoothPath(silhouette, true)}" fill="#fbf9f6"/>`;
  return { silhouette, neckBack, skin, lines: lines.join(''), eyes, ear, pts };
}

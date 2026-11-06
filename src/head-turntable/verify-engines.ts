import { earModel } from '../face/ear/geometry';
import { earPoint, earRig } from './engines/ear3d';
import { engineRows } from './engines/rows';
import { skinPoints } from './engines/profile';
import { fy } from './engines/units';
import { hex } from './color';
import { REF_ROWS } from './ref-fit';
import { sectionAt } from './sections';
import { REGION, type HeadTurnSpec, type TurnRender } from './types';
import type { RenderAt } from './verify-geo';
import { check, type Check } from './verify-types';

/**
 * CONTRÔLES DE L'USAGE DES MOTEURS EXISTANTS, répartis dans les trois couches (géométrique, anatomique, style).
 * Ils ne répètent pas les contrôles de forme des couches de base : ils vérifient que la tête vient bien des moteurs (`src/face`, `src/skull`) et que ce que ces
 * moteurs produisent est cohérent une fois posé dans le repère de la tête (attache de l'oreille, jonction cou/crâne, continuité de la mâchoire, plages anatomiques).
 */
const rms = (xs: readonly number[]): number => Math.sqrt(xs.reduce((s, v) => s + v * v, 0) / Math.max(1, xs.length));

/** Géométrie : cohérence entre les moteurs, la table de sections et les pièces posées. */
export function engineGeometry(s: HeadTurnSpec): Check[] {
  const G = 'geometry' as const, e = s.engine, c: Check[] = [check(G, 'eng.present', 'La tête est dérivée des moteurs existants (1 = oui)', e ? 1 : 0, 1, 1)];
  if (!e) return c;
  const R = engineRows(e, REF_ROWS.map((r) => r.y), (e.fit as { hairTh?: number }).hairTh);
  const sel = (k: 'a' | 'zf' | 'zb', y1: number): number[] => REF_ROWS.flatMap((m, i) => (m.y >= 0.05 && m.y <= y1 ? [R[i]![k] - m[k]] : []));
  c.push(check(G, 'eng.fit.a', 'Résidu du calage du contour de face sur la planche (rms, U)', rms(sel('a', 0.9)), 0, 0.015));
  c.push(check(G, 'eng.fit.zf', 'Résidu du calage du profil avant sur la planche (rms, U)', rms(sel('zf', 0.9)), 0, 0.025));
  c.push(check(G, 'eng.fit.zb', 'Résidu du calage de l\'arrière / dessous de la mâchoire (rms, U)', rms(sel('zb', 0.9)), 0, 0.045, 'hard', 'dessous de mâchoire dérivé de l\'angle gonial : limite connue'));
  c.push(check(G, 'eng.landmarks', 'Ligne des yeux de la spec = ligne des yeux du moteur de repères (écart, U)', Math.abs(s.eye.y - fy(e.lm.eyeY)), 0, 1e-6));
  const L = earRig(s, -1), Rg = earRig(s, 1), uvs: [number, number][] = e.p.ears ? earModel(e.p.ears, 1).outline.slice(0, 40).map((q) => [q.x, q.y]) : [];
  c.push(check(G, 'eng.ear.mirror', 'Oreilles gauche / droite symétriques, hors asymétrie naturelle du moteur (écart max, U)', Math.max(...uvs.map(([u, v]) => { const a = earPoint(Rg, u, v, 0.5), b = earPoint(L, u, v, 0.5); return Math.abs(a.x + b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z); })), 0, 0.012));
  const root = earPoint(Rg, 0, 0.5, 0), sr = sectionAt(s, root.y), xs = sr.a * Math.sqrt(Math.max(0, 1 - ((root.z - sr.zc) / sr.b) ** 2));
  c.push(check(G, 'eng.ear.root', 'L\'oreille est attachée au crâne : |x racine − x surface du crâne| (U)', Math.abs(root.x - xs), 0, 0.02));
  const buried = Math.max(...uvs.map(([u, v]) => { const p = earPoint(Rg, u, v, 0), q = sectionAt(s, p.y); return Math.max(0, q.a * Math.sqrt(Math.max(0, 1 - ((p.z - q.zc) / q.b) ** 2)) - p.x); }));
  c.push(check(G, 'eng.ear.buried', 'L\'oreille ne s\'enfonce pas dans le crâne : enfoncement max du contour (U)', buried, 0, 0.03));
  const n = s.neck, h0 = sectionAt(s, n.y0), top = e.sk.neck, zt = (x: number): number => e.fit.zPorion + x * 0.001;
  c.push(check(G, 'eng.neck.hidden', 'Haut du cou enfoui dans le crâne : marge de largeur (U, ≥ 0)', h0.a - s.neck.a, 0, 1, 'hard', 'le bord haut du cou ne doit jamais se voir'));
  c.push(check(G, 'eng.neck.zrange', 'Face antérieure du cou derrière la face du crâne (z cou − z avant du crâne à y0, U)', zt(top.xFront((n.y0 - 0.05) * 1000)) - (h0.zc + h0.b), -1, 0));
  const a = R.map((r) => r.a), dd = Math.max(...a.map((_, i) => (i > 0 && i < a.length - 1 && REF_ROWS[i]!.y >= 0.55 && REF_ROWS[i]!.y <= 1.0 ? Math.abs(a[i - 1]! - 2 * a[i]! + a[i + 1]!) : 0)));
  c.push(check(G, 'eng.jaw.smooth', 'Mâchoire sans angle vif : dérivée seconde max de la demi-largeur (U)', dd, 0, 0.035));
  const kn = s.nose.knots;
  c.push(check(G, 'eng.nose.knots', 'Profil du nez : ordonnées croissantes et largeurs positives (1 = oui)', kn.every((k, i) => (i === 0 || k[0] > kn[i - 1]![0]) && k[2] > 0) ? 1 : 0, 1, 1));
  return c;
}

/** Anatomie : plages du canon pour les grandeurs que seuls les moteurs fournissent. */
export function engineAnatomy(s: HeadTurnSpec): Check[] {
  const A = 'anatomy' as const, e = s.engine;
  if (!e) return [];
  const rg = earRig(s, 1), hT = s.rows[s.rows.length - 1]!.y, P = skinPoints(e), crusY = rg.pl.topY + rg.pl.hPx * (rg.pivot.y as number);
  const alpha = e.lm.jaw.gonialDeg - 90 - e.fit.ramusDeg;
  return [
    check(A, 'eng.gonial', 'Angle gonial (canon adulte 110° – 140° ; enfant et dessin plus ouverts)', e.lm.jaw.gonialDeg, 95, 145),
    check(A, 'eng.mandplane', 'Inclinaison du plan mandibulaire sur l\'horizontale, ° (canon 15° – 35°)', alpha, 12, 50, 'info', 'dérivé : angle gonial − 90° − ramus'),
    check(A, 'eng.ear.height', 'Hauteur de l\'oreille / hauteur de la tête (canon 0,22 – 0,27)', rg.pl.hPx / hT, 0.2, 0.3),
    check(A, 'eng.ear.crus', 'Racine de l\'hélix sur la ligne des yeux : écart (U)', Math.abs(crusY - s.eye.y), 0, 0.03),
    check(A, 'eng.ear.angle', 'Angle d\'ouverture de l\'oreille, ° (canon 21° – 38° ; dessin jusqu\'à 45°)', rg.pl.openingDeg, 18, 45),
    check(A, 'eng.ear.width', 'Largeur / hauteur de l\'oreille (canon 0,50 – 0,62 ; dessin plus large)', rg.model.widthRatio, 0.45, 0.8, 'info', 'canon 0,56'),
    check(A, 'eng.neck.tilt', 'Inclinaison du cou en avant, ° (canon 10° – 30°)', e.sk.neck.tiltDeg, 5, 32),
    check(A, 'eng.nose.proj', 'Projection du nez devant le plan du visage (U, canon 0,03 – 0,1)', P.get('pronasale')!.z - P.get('subnasale')!.z, 0.02, 0.12),
    check(A, 'eng.lips.order', 'Lèvres : sup. au-dessus de la inf. et toutes deux sous le nez (1 = oui)', P.get('labraleSup')!.y > P.get('subnasale')!.y && P.get('labraleInf')!.y > P.get('labraleSup')!.y ? 1 : 0, 1, 1),
  ];
}

const isInk = (r: TurnRender, k: number, ink: readonly number[]): boolean => Math.hypot(r.rgba[4 * k]! - ink[0]!, r.rgba[4 * k + 1]! - ink[1]!, r.rgba[4 * k + 2]! - ink[2]!) < 45;

/** Style : l'oreille de profil doit se lire comme un dessin (peu de plages d'encre, pas de bruit) et non comme un nuage de pixels sombres. */
export function engineStyle(s: HeadTurnSpec, at: RenderAt): Check[] {
  const S = 'style' as const, r = at(90), ink = hex(s.palette.ink);
  let x0 = r.w, x1 = 0, y0 = r.h, y1 = 0;
  for (let k = 0; k < r.w * r.h; k++) if (r.regions[k] === REGION.ear) { const x = k % r.w, y = (k - x) / r.w; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 <= x0) return [check(S, 'eng.ear.visible', 'Oreille visible de profil (1 = oui)', 0, 1, 1)];
  const seen = new Uint8Array(r.w * r.h); let ink_n = 0, comps = 0, tot = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const k = y * r.w + x; if (!r.ids[k]) continue; tot++;
    if (!isInk(r, k, ink)) continue; ink_n++;
    if (seen[k]) continue; comps++; const st = [k]; seen[k] = 1;
    while (st.length) { const q = st.pop()!, qx = q % r.w, qy = (q - qx) / r.w; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = qx + dx, ny = qy + dy; if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue; const j = ny * r.w + nx; if (!seen[j] && r.ids[j] && isInk(r, j, ink)) { seen[j] = 1; st.push(j); } } }
  }
  return [
    check(S, 'eng.ear.ink', 'Part d\'encre dans l\'oreille de profil (dessin lisible : 0,08 – 0,45)', ink_n / Math.max(1, tot), 0.08, 0.45),
    check(S, 'eng.ear.noise', 'Plages d\'encre séparées dans l\'oreille de profil (≤ 14 : pas de bruit)', comps, 1, 14),
    check(S, 'eng.ear.size', 'Oreille de profil : hauteur / hauteur de la tête (planche ≈ 0,25)', (y1 - y0 + 1) / r.ppu / s.rows[s.rows.length - 1]!.y, 0.18, 0.34),
  ];
}

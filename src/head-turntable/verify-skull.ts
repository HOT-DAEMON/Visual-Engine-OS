import { hasSkullModel } from './engines/skull-model';
import { sectionAt, sectionPoint } from './sections';
import type { HeadTurnSpec } from './types';
import { jawContourStats } from './verify-contour';
import { check, type Check } from './verify-types';
import type { TurnRender } from './types';

/**
 * Contrôles du MODÈLE DE CRÂNE (`engines/skull-model.ts`), sur les têtes qui l'ont (têtes issues d'un visage). Trois couches, mêmes verdicts que le reste de `verify-head.ts` :
 * géométrie (coupes convexes, exposants bornés, avant / arrière / largeur INCHANGÉS par la forme), anatomie (point le plus large en arrière de la mi-profondeur du crâne),
 * style (contour de la voûte lisible à 45° et 135°, sans creux ni dents).
 */
const YS = Array.from({ length: 27 }, (_, i) => 0.05 + i * 0.025);   // 0,05 → 0,70 : voûte et plan du visage

/** Nombre de sommets où la coupe n'est pas convexe (rotation de signe opposé au sens général), sur 128 points par coupe. */
function nonConvex(spec: HeadTurnSpec): number {
  let n = 0;
  for (const y of YS) {
    const s = sectionAt(spec, y), P = Array.from({ length: 128 }, (_, k) => sectionPoint(s, (k / 128) * 2 * Math.PI));
    const cr = P.map((p, k) => { const a = P[(k + 127) % 128]!, b = P[(k + 1) % 128]!; return (p.x - a.x) * (b.z - p.z) - (p.z - a.z) * (b.x - p.x); });
    const sign = Math.sign(cr.reduce((u, v) => u + v, 0));
    n += cr.filter((v) => v * sign < -1e-9).length;
  }
  return n;
}

export function skullGeometryChecks(spec: HeadTurnSpec, R: { at: (yaw: number, pitch0?: boolean) => TurnRender }): Check[] {
  if (!spec.engine || !hasSkullModel(spec.engine)) return [];
  const G = 'geometry' as const, c: Check[] = [];
  c.push(check(G, 'head.geo.skull.convex', 'Coupes du crâne (y 0,05 → 0,70) : sommets non convexes sur 128 points par coupe (un creux ou une dent de la vue de dessus)', nonConvex(spec), 0, 0));
  const exps = YS.flatMap((y) => { const s = sectionAt(spec, y); return [s.pf, s.qf, s.pb ?? 2, s.qb ?? 2]; });
  c.push(check(G, 'head.geo.skull.exp.min', 'Exposants de forme du crâne, minimum (1,5 = pointu ; 2 = ellipse ; tolérance 0,05 pour le dépassement de l\'interpolation de Hermite entre rangées)', Math.min(...exps), 1.45, 2));
  c.push(check(G, 'head.geo.skull.exp.max', 'Exposants de forme du crâne, maximum (2,8 = presque carré ; 2 = ellipse ; même tolérance)', Math.max(...exps), 2, 2.85));
  // La forme ne déplace ni le profil (x = 0 : zf, zb) ni la largeur (z = zw : x = a) : le profil du moteur de crâne et le contour du moteur de visage sont intacts.
  const err = Math.max(...YS.map((y) => { const s = sectionAt(spec, y); return Math.max(Math.abs(sectionPoint(s, 0).z - s.zf), Math.abs(sectionPoint(s, Math.PI).z - s.zb), Math.abs(sectionPoint(s, Math.PI / 2).x - s.a), Math.abs(sectionPoint(s, -Math.PI / 2).x + s.a)); }));
  c.push(check(G, 'head.geo.skull.anchors', 'Avant, arrière et largeur de chaque coupe inchangés par la forme (écart max, U)', err, 0, 1e-6));
  for (const yaw of [45, 135]) { const st = jawContourStats(R.at(yaw), { yMinU: 0.12, yMaxU: 0.6 }); c.push(check(G, `head.geo.skull.${yaw}.concavity`, `Voûte à ${yaw}° : creux maximal du contour (U)`, st.concavityU, 0, 0.02)); }
  return c;
}

export function skullAnatomyChecks(spec: HeadTurnSpec): Check[] {
  if (!spec.engine || !hasSkullModel(spec.engine)) return [];
  const A = 'anatomy' as const, wf = [0.15, 0.3, 0.45, 0.6].map((y) => { const s = sectionAt(spec, y); return (s.zw - s.zb) / (s.zf - s.zb); });
  // Indice céphalique 3D = largeur du contour de face au niveau du crâne / longueur 3D. Humain : 0,70 – 0,90 ; PLANCHE mesurée : 0,975 (personnage de dessin). Information : les têtes issues d'un visage sont plus larges que longues.
  const ys3 = [0.3, 0.4, 0.5], L3 = Math.max(...ys3.map((y) => sectionAt(spec, y).zf)) - Math.min(...[0.25, 0.3, 0.35, 0.4, 0.45].map((y) => sectionAt(spec, y).zb)), ci3 = (2 * Math.max(...ys3.map((y) => sectionAt(spec, y).a))) / Math.max(0.05, L3);
  const ci = check(A, 'head.anat.skull.cephalic3d', 'Indice céphalique 3D (largeur du contour / longueur 3D) [humain 0,70–0,90 ; planche mesurée 0,975 ; au-delà de 0,98 le crâne est plus large que long]', ci3, 0.7, 0.98, 'info');
  return [ci, check(A, 'head.anat.skull.widest', 'Point le plus large de la coupe, en fraction de la profondeur depuis l\'arrière [canon : pariétal / tempe, légèrement en arrière de la mi-profondeur : 0,40–0,60]', Math.min(...wf), 0.38, 0.62), check(A, 'head.anat.skull.widest.max', 'Id., maximum sur la voûte et le visage', Math.max(...wf), 0.38, 0.62)];
}

export function skullStyleChecks(spec: HeadTurnSpec, R: { at: (yaw: number, pitch0?: boolean) => TurnRender }): Check[] {
  if (!spec.engine || !hasSkullModel(spec.engine)) return [];
  const S = 'style' as const;
  return [45, 135, 180].map((yaw) => { const st = jawContourStats(R.at(yaw), { yMinU: 0.12, yMaxU: 0.6 }); return check(S, `head.style.skull.${yaw}.inflections`, `Voûte à ${yaw}° : inflexions du contour (une voûte lisse en a ≤ 2 : coupe de cheveux / oreille)`, st.inflections, 0, 4, 'info'); });
}

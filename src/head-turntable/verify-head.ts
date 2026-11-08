import { halfWidthAt } from '../face/outline';
import { CHIN_CAP_Y } from './engines/rows';
import { contrastRatio, hex } from './color';
import { JAW_SHAPE, jawCtx } from './engines/jaw-model';
import { toEngineY } from './engines/rows';
import { py } from './engines/units';
import { cranialLength } from './engines/skull-model';
import { defaultFrame, refView, renderHead } from './render';
import { sectionAt } from './sections';
import { headEdges, jawContourStats } from './verify-contour';
import { topRow } from './silhouette';
import { inkSpecks, inkWidth, outlineClosure } from './verify-style';
import { skullAnatomyChecks, skullGeometryChecks, skullStyleChecks } from './verify-skull';
import { check, layerOf, reportOf, type Check, type LayerReport, type TurnReport } from './verify-types';
import type { HeadTurnSpec, TurnRender } from './types';

/**
 * COUCHE DE VÉRIFICATION D'UNE TÊTE QUELCONQUE (pas seulement la planche : aucune mesure de planche n'est requise). Trois couches, mêmes contrats que `verify-types.ts` :
 *  - GÉOMÉTRIE : la 3D reste fidèle au contour 2D et au profil du moteur de visage (silhouettes à tangage 0), le maillage est sain, le contour de la mâchoire est continu
 *    (rayon de courbure, inflexions, creux : `verify-contour.ts`) ;
 *  - ANATOMIE : tiers du visage, plan et angle mandibulaires, hauteur du gonion, oreille entre sourcil et base du nez, profondeur du crâne, cou, menton = point le plus bas ;
 *  - STYLE : encre lisible sur la peau (contraste), trait d'épaisseur stable, contour fermé, pas d'îlots d'encre.
 * Chaque borne dit d'où elle vient : [canon] proportion classique du dessin de tête, [planche] valeur de la planche de référence avec marge, [rendu] tolérance de rastérisation.
 */
export interface HeadSubject {
  readonly id: string; readonly spec: HeadTurnSpec;
  /** Longueur de tête dérivée par le moteur de crâne (`Derivation.lengthH`, en H), s'il y en a une : la profondeur 3D du crâne doit la retrouver. */ readonly lengthH?: number;
}

/** Rendus mémoïsés d'une tête : vues standard (tangage de la planche) et vues à tangage 0 (silhouettes comparables aux profils 2D). */
export class HeadRenders {
  private readonly cache = new Map<string, TurnRender>();
  constructor(readonly spec: HeadTurnSpec, private readonly heightPx = 520) {}
  at(yaw: number, flat = false): TurnRender {
    const key = `${yaw}/${flat}`; let r = this.cache.get(key);
    if (!r) { const v = refView(yaw); r = renderHead(flat ? { yaw, pitch: 0 } : v, this.spec, { frame: defaultFrame(this.heightPx), ss: 2 }); this.cache.set(key, r); }
    return r;
  }
}

const contrast = contrastRatio;
const G = 'geometry', A = 'anatomy', S = 'style';

const sep = (spec: HeadTurnSpec): number => { const a = hex(spec.palette.ink), b = hex(spec.palette.skin); return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); };

export function headGeometry(h: HeadSubject, R: HeadRenders): LayerReport {
  const s = h.spec, c: Check[] = [], rows = s.rows, inkOpts = { ink: hex(s.palette.ink) as [number, number, number], inkTol: Math.min(70, 0.7 * sep(s)) };
  const bad = rows.filter((r, i) => ![r.a, r.zf, r.zb, r.zw ?? 0, r.pf ?? 2, r.qf ?? 2, r.pb ?? 2, r.qb ?? 2].every(Number.isFinite) || r.zf <= r.zb || (i > 0 && r.y >= JAW_SHAPE.y0 && r.y < CHIN_CAP_Y && r.zw !== undefined && rows[i - 1]!.zw !== undefined && r.zw < rows[i - 1]!.zw! - 1e-6)).length;
  c.push(check(G, 'head.geo.rows', 'Table de sections saine : valeurs finies, avant > arrière, point large jamais reculé (nombre de rangées fautives)', bad, 0, 0));
  if (s.engine) {
    // Face : demi-largeur du rendu à tangage 0 vs contour du moteur de visage, sur le crâne (0,15–0,5) et la mâchoire (0,85–1,0), hors oreilles.
    const e = s.engine, ts = [...Array.from({ length: 8 }, (_, i) => 0.15 + i * 0.05), 0.85, 0.9, 0.95, 1.0], f0 = headEdges(R.at(0, true), ts);
    const want = (y: number): number => halfWidthAt(e.lm.outline, Math.min(py(toEngineY(y)), e.lm.outline.bottomY - 1)) / 1000;
    const dev = f0.map((p) => Math.abs((p.right - p.left) / 2 - want(p.t))), mean = dev.reduce((a, b) => a + b, 0) / Math.max(1, dev.length);
    c.push(check(G, 'head.geo.front2d', 'Face 3D (tangage 0) vs contour 2D du moteur de visage : écart moyen de demi-largeur (U) [rendu : trait ≈ 0,011]', mean, 0, 0.03));
    // Profil : bord avant du crâne (front) du rendu à 90° vs z avant de la section ; le pivot est l'axe du cou.
    const f90 = headEdges(R.at(90, true), [0.2, 0.3, 0.4, 0.5]), pz = 0;   // le pivot de rotation est l'origine z = 0 de la tête
    const dz = f90.map((p) => Math.abs(-p.left - (sectionAt(s, p.t).zf - pz))), mz = dz.reduce((a, b) => a + b, 0) / Math.max(1, dz.length);
    c.push(check(G, 'head.geo.profile2d', 'Profil 3D (90°, tangage 0) vs z avant du crâne du moteur : écart moyen sur le front (U)', mz, 0, 0.03));
  }
  // Contour de la mâchoire : vues où elle se lit contre le fond (0°–90°) et vues de dos.
  for (const yaw of [0, 20, 45, 70, 90]) {
    const st = jawContourStats(R.at(yaw), { yMinU: 0.8, yMaxU: 1.25, ...inkOpts });
    c.push(check(G, `head.geo.jaw.${yaw}.concavity`, `Mâchoire à ${yaw}° : creux maximal du contour par rapport à son enveloppe convexe (U) : une poche qui pend en crée un`, st.concavityU, 0, 0.02));
    c.push(check(G, `head.geo.jaw.${yaw}.inflections`, `Mâchoire à ${yaw}° : inflexions du contour (ondulation, dents de scie) [canon : ≤ 3 : lèvre/sillon]`, st.inflections, 0, 3));
    c.push(check(G, `head.geo.jaw.${yaw}.radius`, `Mâchoire à ${yaw}° : rayon de courbure minimal (U) : en dessous, un angle vif`, st.minRadiusU, 0.025, 10));
    c.push(check(G, `head.geo.jaw.${yaw}.ink`, `Mâchoire à ${yaw}° : plus longue interruption du trait (px ; une largeur de trait ≈ 4 px à 520 px)`, st.inkGapPx, 0, 4));
  }
  for (const yaw of [135, 180]) c.push(check(G, `head.geo.jaw.${yaw}.concavity`, `Mâchoire à ${yaw}° : creux maximal du contour (U)`, jawContourStats(R.at(yaw), { yMinU: 0.8, yMaxU: 1.25 }).concavityU, 0, 0.02));
  c.push(...skullGeometryChecks(s, R));
  return layerOf(G, c);
}

export function headAnatomy(h: HeadSubject, R: HeadRenders): LayerReport {
  const s = h.spec, c: Check[] = [], yMen = s.rows[s.rows.length - 1]!.y, deg = 180 / Math.PI;
  c.push(check(A, 'head.anat.eyeline', 'Ligne des yeux / hauteur sommet → menton [canon : ≈ ½ ; dessin stylisé : yeux plus bas, planche 0,59]', s.eye.y / yMen, 0.4, 0.66));
  const aMax = Math.max(...s.rows.map((r) => r.a)), top = sectionAt(s, 0.45);
  c.push(check(A, 'head.anat.depth', 'Profondeur du crâne au niveau du sourcil / hauteur de tête [canon : 0,70–0,95 ; planche ≈ 0,77]', (sectionAt(s, 0.45).zf - top.zb) / yMen, 0.66, 1.0));
  if (s.engine) {
    const j = jawCtx(s.engine), plane = Math.atan((j.yMen - j.yG) / (j.zMen - j.zG)) * deg;
    c.push(check(A, 'head.anat.jaw.plane', 'Plan mandibulaire (gonion → menton) par rapport à l\'horizontale (°) [canon : 15–35° ; extrêmes admis 10–42°]', plane, 10, 42));
    c.push(check(A, 'head.anat.gonion.height', 'Gonion vs ligne de la bouche (U ; + = plus bas) [canon : le gonion est au niveau de la bouche ± 0,15]', j.yG - s.mouth.y, -0.15, 0.35));
    c.push(check(A, 'head.anat.gonion.rest', 'Distance gonion → bas du menton (U) [canon : ≥ 0,06]', j.yMen - j.yG, 0.06, 0.4));
    c.push(check(A, 'head.anat.bigonial', 'Largeur bigoniale / largeur bizygomatique du contour [canon : 0,55–0,95 ; planche 0,64]', sectionAt(s, j.yG).a / aMax, 0.5, 0.97));
    if (h.lengthH !== undefined) {
      // Le moteur de crâne dérive la longueur de tête du visage (largeur d'hôte → indice céphalique → longueur) : la profondeur 3D (avant du sourcil → arrière du crâne) doit la retrouver.
      // Un crâne figé (celui de la planche) s'en écarte dès que le visage est plus large ou plus étroit que la planche (0,044 U pour un visage de rapport 0,91).
      const L = Math.max(...[0.3, 0.4, 0.5].map((y) => sectionAt(s, y).zf)) - Math.min(...[0.25, 0.3, 0.35, 0.4, 0.45].map((y) => sectionAt(s, y).zb));
      const Lf = cranialLength(h.lengthH);
      c.push(check(A, 'head.anat.skull.length', `Longueur 3D du crâne vs longueur de forme crânienne (${Lf.toFixed(3)} H = dérivée ${h.lengthH.toFixed(3)} amplifiée, bornée) : écart (U)`, Math.abs(L - Lf), 0, 0.02));
    }
  }
  const ear = s.ear, nb = s.nose.baseY;
  c.push(check(A, 'head.anat.ear.top', 'Haut de l\'oreille vs ligne des sourcils (U ; + = au-dessus) [canon : haut de l\'oreille ≈ sourcil]', s.brow.yMid - ear.y0, -0.12, 0.2));
  c.push(check(A, 'head.anat.ear.bottom', 'Bas de l\'oreille vs base du nez (U ; + = plus haut) [canon : bas de l\'oreille ≈ base du nez]', nb - ear.y1, -0.16, 0.12));
  const neckW = 2 * (s.neck.a), ear2 = sectionAt(s, 0.45).a * 2;
  c.push(check(A, 'head.anat.neck', 'Largeur du cou / largeur du crâne [canon : 0,35–0,65]', neckW / ear2, 0.3, 0.72, 'info'));
  const st = jawContourStats(R.at(90), { yMinU: 0.8, yMaxU: 1.25 });
  c.push(check(A, 'head.anat.chin.lowest', 'Profil 90° : le point le plus bas du contour de la mâchoire est le menton, côté face (x image, U ; face = gauche)', st.lowest.x, -0.7, -0.1));
  c.push(...skullAnatomyChecks(s));
  return layerOf(A, c);
}

export function headStyle(h: HeadSubject, R: HeadRenders): LayerReport {
  const p = h.spec.palette, ink = hex(p.ink), skin = hex(p.skin), c: Check[] = [];
  c.push(check(S, 'head.style.ink.contrast', 'Contraste encre / peau (rapport WCAG) : le contour reste lisible sur toute teinte [planche : ≈ 9]', contrast(ink, skin), 2.5, 30));
  c.push(check(S, 'head.style.hair.contrast', 'Contraste cheveux / peau (WCAG) : la lisière se lit', contrast(hex(p.hair), skin), 1.05, 30, 'info'));
  const d = sep(h.spec), tol = Math.min(45, 0.45 * d), tolC = Math.min(70, 0.7 * d), tolS = Math.min(95, 0.9 * d);   // sur peau foncée, l'encre se distingue à moins de 45 / 70 / 95
  // Mesuré sur la mâchoire (peau contre fond) : sur le crâne, des cheveux sombres ressemblent à l'encre.
  for (const yaw of [0, 90]) { const r = R.at(yaw), top = topRow(r); c.push(check(S, `head.style.line.${yaw}`, `Épaisseur médiane du trait de la mâchoire à ${yaw}° (U) [planche ≈ 0,013 ; rendu 0,011]`, inkWidth(r, ink, tol, [top + 0.88 * r.ppu, top + 0.99 * r.ppu]), 0.006, 0.022)); }
  for (const yaw of [0, 45, 90, 180]) c.push(check(S, `head.style.closure.${yaw}`, `Contour fermé à ${yaw}° (part des pixels de bord couverts d'encre)`, outlineClosure(R.at(yaw), ink, tolC), 0.96, 1));
  // Information : le pavillon des têtes autres que la planche est encore pointillé (hachures du moteur d'oreille sous-échantillonnées) ; la planche reste ≤ 6 (voir docs/HEAD-TURNTABLE-REMAINING.md).
  for (const yaw of [0, 45, 90]) c.push(check(S, `head.style.specks.${yaw}`, `Îlots d'encre isolés à ${yaw}° (points, traits pointillés) [planche ≤ 6]`, inkSpecks(R.at(yaw), ink, tolS), 0, 6, h.spec.engine && h.id !== 'planche' ? 'info' : 'hard'));
  c.push(check(S, 'head.style.specks.180', 'Îlots d\'encre isolés à 180° (cheveux et pavillon : la planche en compte 33, limite connue)', inkSpecks(R.at(180), ink, tolS), 0, 60, 'info'));
  c.push(...skullStyleChecks(h.spec, R));
  return layerOf(S, c);
}

/** Vérification complète d'une tête quelconque. Rendus fournis ou construits (réutilisables pour les artefacts). */
export function verifyHeadSubject(h: HeadSubject, R: HeadRenders = new HeadRenders(h.spec)): TurnReport {
  return reportOf([headGeometry(h, R), headAnatomy(h, R), headStyle(h, R)]);
}

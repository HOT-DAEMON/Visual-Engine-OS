import { halfWidthAt } from '../face/outline';
import { isBare, toEngineY } from './engines/rows';
import { PARIETAL_MOVE, SKULL_RELIEF } from './engines/skull-relief';
import { vaultRise, vaultTop, warpY } from './engines/vault-model';
import { py } from './engines/units';
import { sectionAt } from './sections';
import { topRow } from './silhouette';
import { jawContourStats } from './verify-contour';
import { check, type Check } from './verify-types';
import type { HeadTurnSpec, TurnRender } from './types';

/**
 * VÉRIFICATION DU CRÂNE NU (`docs/SKULL-ENLARGEMENT.md`) : la tête 3D ne doit être ni plus haute ni plus large que le visage 2D du même hôte. Trois couches, mêmes contrats que `verify-types.ts`.
 *  - GÉOMÉTRIE : sommet de la tête rendue = vertex du moteur (plus d'étirement de la voûte) ; demi-largeur des coupes = contour 2D (plus d'épaisseur de coupe sous la coque) ; jamais d'épaisseur comptée deux fois.
 *  - ANATOMIE : indice céphalique du crâne nu (information : les proportions de dessin stylisé sont larges) ; éminence pariétale dans sa zone anatomique, même déplacée.
 *  - STYLE : la calotte se lit comme un dôme continu (pas d'angle, pas de creux) à 0° et à 90°.
 * Les mesures de largeur ne valent que pour un crâne à largeur nominale (`cranialBreadth`, `templeBreadth`, `parietalFlat` nuls : ces mesures changent volontairement la largeur).
 */
const G = 'geometry' as const, A = 'anatomy' as const, S = 'style' as const;
const widthNominal = (s: HeadTurnSpec): boolean => { const k = s.engine!.sk.params; return k.cranialBreadth === 0 && k.templeBreadth === 0 && k.parietalFlat === 0 && k.asymWidth === 0; };

export function enlargementGeometryChecks(s: HeadTurnSpec, r0: TurnRender): Check[] {
  const e = s.engine; if (!e || !isBare(e)) return [];   // tête coiffée : héritage de la planche (docs/SKULL-ENLARGEMENT.md §5), rien à prouver ici
  const rise = vaultRise(e), top = (topRow(r0) - r0.originY) / r0.ppu, want = vaultTop(e) - rise, c: Check[] = [];
  c.push(check(G, 'head.geo.enlarge.crown', 'Crâne nu : sommet de la tête rendue − vertex du moteur (U) : pas d\'étirement de la voûte [rendu : trait ≈ 0,011]', Math.abs(top - want), 0, 0.02));
  if (widthNominal(s)) {
    let worst = 0;   // y du maillage → hauteur source (sommet relevé / abaissé) → ordonnée du moteur
    for (let y = vaultTop(e) - rise + 0.1; y <= 0.6; y += 0.05) worst = Math.max(worst, Math.abs(sectionAt(s, y).a - halfWidthAt(e.lm.outline, Math.min(py(toEngineY(warpY(y, rise, vaultTop(e)), true)), e.lm.outline.bottomY - 1)) / 1000));
    c.push(check(G, 'head.geo.enlarge.width', 'Crâne nu à largeur nominale : écart maximal coupe − contour 2D (U) sur la voûte (0 = plus d\'épaisseur de coupe sous la coque ; ≤ 0,008 : interpolation de la table sur une calotte raide, voûte rehaussée)', worst, 0, 0.008));
  }
  c.push(check(G, 'head.geo.enlarge.double', 'Crâne nu : épaisseur de coupe `hairTh` portée par le crâne (U) : 0 = la coque de cheveux (ou rien, tête chauve) apporte seule l\'épaisseur, jamais comptée deux fois', (e.fit as { hairTh?: number }).hairTh ?? 0, 0, 0));
  return c;
}

export function enlargementAnatomyChecks(s: HeadTurnSpec): Check[] {
  const e = s.engine; if (!e) return [];
  const k = e.sk.params, c: Check[] = [];
  const W = 2 * Math.max(...[0.2, 0.3, 0.4, 0.5].map((y) => sectionAt(s, y).a)), L = Math.max(...[0.3, 0.4, 0.5].map((y) => sectionAt(s, y).zf)) - Math.min(...[0.25, 0.3, 0.35, 0.4, 0.45].map((y) => sectionAt(s, y).zb));
  c.push(check(A, 'head.anat.enlarge.cephalic', 'Indice céphalique 3D (largeur / longueur de la voûte) [canon : 0,70–0,90 ; dessin stylisé : jusqu\'à ≈ 1,10 (face large)]', W / L, 0.6, 1.15, 'info'));
  const y = SKULL_RELIEF.yP - PARIETAL_MOVE.dy * k.parietalHeight, az = SKULL_RELIEF.azP + PARIETAL_MOVE.daz * k.parietalAzimuth;
  c.push(check(A, 'head.anat.parietal.height', 'Éminence pariétale : hauteur du centre (U) [canon : tiers supérieur de la voûte, 0,12–0,36]', y, 0.12, 0.36));
  c.push(check(A, 'head.anat.parietal.azimuth', 'Éminence pariétale : azimut du centre (°, 0 = face, 180 = nuque) [canon : au-dessus et derrière l\'oreille, 96–128°]', az, 96, 128));
  return c;
}

export function enlargementStyleChecks(s: HeadTurnSpec, at: (yaw: number) => TurnRender): Check[] {
  if (!s.engine || !isBare(s.engine)) return [];
  const c: Check[] = [];
  for (const yaw of [0, 90]) {
    const r = at(yaw), t = (topRow(r) - r.originY) / r.ppu, st = jawContourStats(r, { yMinU: t + 0.02, yMaxU: t + 0.3 });
    c.push(check(S, `head.style.crown.${yaw}.concavity`, `Calotte à ${yaw}° : creux du contour par rapport à son enveloppe convexe (U) : un dôme n'a pas de creux`, st.concavityU, 0, 0.012));
    c.push(check(S, `head.style.crown.${yaw}.radius`, `Calotte à ${yaw}° : rayon de courbure minimal (U) : en dessous, un angle vif au sommet`, st.minRadiusU, 0.05, 10));
  }
  return c;
}

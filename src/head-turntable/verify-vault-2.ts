import { archAxisY, curveYAt, VAULT_SHAPE } from '../skull/vault-shapes';
import { VAULT_STRUCTURES } from '../skull/vault-registry';
import { headRelief } from './engines/head-relief';
import { skullOf } from './engines/skull-of';
import { skullRelief } from './engines/skull-relief';
import { vaultAnchors, vaultRelief } from './engines/vault-relief';
import { fy } from './engines/units';
import { silhouetteProfile } from './silhouette';
import { VAULT_VIEWS, vaultRender } from './vault-lab';
import { anchorOf, place } from './vault-visibility';
import type { HeadTurnSpec } from './types';
import { check, type Check } from './verify-types';

/**
 * VÉRIFICATION DE RENDU, PASSE 2 (`docs/SKULL-VAULT-2.md`) : cohérence GÉOMÉTRIQUE (symétrie des reliefs sans asymétrie demandée), ANATOMIQUE (arcade au-dessus de l'œil, bosses entre bregma et arcade,
 * chignon entre lambda et inion, crête temporale au-dessus du ptérion, éminence pariétale là où son ancre la déclare, structures tournées vers la caméra) et de STYLE ARTISTIQUE (contour postérieur lisse,
 * courbure du relief bornée : un modelé, pas une aiguille). Appelée par `verify-vault.ts` : mêmes couches, mêmes bornes écrites avant la mesure (docs/SKULL-VAULT-VALIDATION.md).
 */
/** Tolérance de suivi de l'ancre pariétale (U, °) : 1,5 × le pire écart mesuré (0,034 U ; 4,9°) sur 94 voûtes tirées (éminence nette) et les extrêmes de position. */
const PARIETAL_TOL = { dy: 0.05, daz: 7.5 } as const;
const G = 'geometry' as const, A = 'anatomy' as const, S = 'style' as const, D = Math.PI / 180;

export function vaultGeometryChecks2(spec: HeadTurnSpec): Check[] {
  const e = spec.engine!, k = skullOf(e);
  let m = 0;
  if (k.asymWidth === 0 && k.asymMastoid === 0) for (let y = 0.05; y < 0.9; y += 0.05) for (let az = 10; az <= 170; az += 10) m = Math.max(m, Math.abs(vaultRelief(e, y, az * D) - vaultRelief(e, y, -az * D)));
  return [check(G, 'vault.geo.symmetry', 'Reliefs de la voûte symétriques gauche / droite quand aucune asymétrie propre (largeur, mastoïde) n\'est demandée : écart maximal (U) [0 = rien à reprocher]', m, 0, 1e-9)];
}

export function vaultAnatomyChecks2(spec: HeadTurnSpec): Check[] {
  const e = spec.engine!, a = vaultAnchors(e), eyeY = fy(e.lm.eyeY), line = a.curves.find((c) => c.id === 'line.temporal')!, st = (id: string) => VAULT_STRUCTURES.find((q) => q.id === id)!;
  const yBoss = a.yG - VAULT_SHAPE.eminence.dyUp, yBun = a.yI - VAULT_SHAPE.bun.dyUp, k = skullOf(e);
  const face = (id: string, side: -1 | 0 | 1) => place(spec, st(id), side, VAULT_VIEWS.face).facing > 0.05, back = (id: string) => place(spec, st(id), 0, VAULT_VIEWS.dos).facing > 0.05;
  // L'éminence pariétale : l'ancre du registre doit se DÉPLACER comme le sommet du relief. On compare deux déplacements (celui du sommet du champ de relief et celui de l'ancre) par rapport à la même tête dont
  // les trois paramètres de position sont remis à 0 : la modulation du champ (poids de hauteur près du sommet, fondus d'azimut) décale le sommet du centre de la gaussienne, mais la même chose des deux côtés.
  const peak = (h: typeof e) => { let b = { v: -1, y: 0, az: 0 }; for (let y = 0.06; y <= 0.5; y += 0.005) for (let az = 70; az <= 160; az += 1) { const v = skullRelief(h, y, az * D); if (v > b.v) b = { v, y, az }; } return b; };
  const ref = { ...e, fit: { ...e.fit, skull: { ...e.fit.skull, parietalHeight: 0, parietalAzimuth: 0, asymParietalHeight: 0 } } } as typeof e;
  const pk = peak(e), p0 = peak(ref), pa = anchorOf(spec, st('parietal-bone'), 1), a0 = st('parietal-bone').anchor;
  const moved = k.parietalBulge >= 0.3 ? Math.max(Math.abs(pk.y - p0.y - (pa.yU! - a0.yU!)) / PARIETAL_TOL.dy, Math.abs(pk.az - p0.az - (pa.az - a0.az)) / PARIETAL_TOL.daz) : 0;   // éminence effacée : pas de sommet à suivre
  return [
    check(A, 'vault.anat.arch.orbit', 'Axe de l\'arcade sourcilière (à 30°) AU-DESSUS de la ligne des yeux (U ; y vers le bas) [canon : 0,03 – 0,2 U]', eyeY - archAxisY(30, a.yG), 0.03, 0.2),
    check(A, 'vault.anat.eminence.between', 'Éminence frontale entre le bregma et l\'arcade : marge (U) au-dessus de l\'arcade et sous le bregma, la plus petite des deux [≥ 0,05 U]', Math.min(yBoss - a.yB, a.yG - yBoss), 0.05, 1),
    check(A, 'vault.anat.bun.level', 'Chignon entre lambda et inion : marge (U) la plus petite des deux [≥ 0,1 U]', Math.min(yBun - a.yL, a.yI - yBun), 0.1, 1),
    check(A, 'vault.anat.line.above', 'Crête temporale (à 76°) au-dessus du ptérion (U ; y vers le bas) [canon : 0,05 – 0,4 U]', a.yT - curveYAt(line.pts, 76), 0.05, 0.4),
    check(A, 'vault.anat.parietal.anchor', 'L\'ancre pariétale du registre se déplace comme le sommet du relief : écart de déplacement, rapporté à la tolérance (0,05 U, 7,5°) [≤ 1 ; calibré sur 94 voûtes tirées + extrêmes : pire 0,034 U et 4,9°, borne = 1,5 × le pire ; ancre immobile : 0,06 U et 14°, détectée]', moved, 0, 1),
    check(A, 'vault.anat.visible.front', 'De face : éminence frontale, arcade (côté +x) et crête métopique tournées vers la caméra (nombre sur 3 ; l\'occlusion par le sourcil est une occlusion, pas un défaut)', +face('frontal-eminence', 1) + +face('supraorbital-arch', 1) + +face('metopic-ridge', 0), 3, 3),
    check(A, 'vault.anat.visible.back', 'De dos : chignon occipital tourné vers la caméra (1 = oui)', +back('occipital-bun'), 1, 1),
  ];
}

export function vaultStyleChecks2(spec: HeadTurnSpec): Check[] {
  const e = spec.engine!, rel = headRelief(e), r = vaultRender(spec, 'profil', 360, false);
  // Contour POSTÉRIEUR (profil : le visage est à gauche, l'occiput à droite) de t = 0,03 à 0,6 U : le chignon et la protubérance sont des bosses lisses, pas des crochets.
  const s = silhouetteProfile(r, Array.from({ length: 82 }, (_, i) => 0.03 + i * 0.007)).map((q) => q.right);
  let kink = 0; for (let i = 1; i + 1 < s.length; i++) kink = Math.max(kink, Math.abs(s[i - 1]! - 2 * s[i]! + s[i + 1]!));
  // Courbure du relief : plus grande dérivée seconde (en y, pas 0,0125 U ; en azimut, pas 3°) : un modelé arrondi, sans aiguille.
  let curv = 0;
  if (rel) for (let y = 0.04; y <= 0.95; y += 0.0125) for (let az = 3; az < 180; az += 3) {
    const v = rel(y, az * D);
    curv = Math.max(curv, Math.abs(rel(y - 0.0125, az * D) - 2 * v + rel(y + 0.0125, az * D)), Math.abs(rel(y, (az - 3) * D) - 2 * v + rel(y, (az + 3) * D)));
  }
  return [
    check(S, 'vault.style.silhouette.back', 'Contour postérieur de profil (t de 0,03 à 0,6 U) : plus grande cassure (dérivée seconde, U) : le chignon est une bosse lisse [calibré : 12 têtes nominales ≤ 0,0243 ; extrêmes ≤ 0,0243 ; borne = 1,5 × le pire]', kink, 0, BACK_KINK_MAX),
    check(S, 'vault.style.relief.curvature', 'Courbure du relief : plus grande dérivée seconde (U) : un modelé arrondi et non une aiguille [calibré : pire 0,0159 (extrême) ; borne = 1,5 × le pire]', curv, 0, CURVATURE_MAX),
  ];
}
/** Bornes de style de la passe 2 : voir `docs/SKULL-VAULT-VALIDATION.md` pour la mesure qui les justifie (borne = 1,5 × le pire cas mesuré, comme la passe 1 : cassure postérieure 0,0243 (12 têtes nominales, graine 2), courbure 0,0159 (extrême, graine 3)). */
export const BACK_KINK_MAX = 0.037, CURVATURE_MAX = 0.024;

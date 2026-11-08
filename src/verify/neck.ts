import { hueDelta, resolveAppearance, toHsl } from '../appearance';
import { neckBase } from '../render/neck/skin';
import { faceLandmarks } from '../face';
import type { RandomFace } from '../generation/random-face';
import { frontSilhouette, profileSilhouette } from '../neck/geometry';
import { neckModelFor } from '../neck';
import type { NeckModel } from '../neck/types';
import { SPECIES } from '../neck/species';
import { check, type Check } from './types';

/**
 * COUCHE DE VÉRIFICATION DU COU (TODO §9, trois familles chiffrées et reproductibles) :
 *   GÉOMÉTRIE  — nombres finis, axe monotone, ancrages tête/thorax intacts, plancher de section (pas d'inversion), contour non croisé,
 *                accord de la silhouette de face avec les sections (contrat commun 2D/3D) ;
 *   ANATOMIE   — le haut du cou reste sous la tête, structures conformes à l'espèce (désactivées avec leur raison), proportions humaines ;
 *   STYLE      — peau du cou de même teinte que celle de la tête (cohérence tête/corps/membres), mode cel = au plus 3 tons dans l'ombrage du cou.
 * `checkNeckModel` ne lit que le modèle (testable seul) ; `checkNeck` y ajoute le visage et le SVG réellement émis.
 */
const fin = (...v: number[]): boolean => v.every(Number.isFinite);

export function checkNeckModel(m: NeckModel, tint?: { readonly skin: string; readonly neckTone: string }): Check[] {
  const c: Check[] = [], S = m.stations, mo = m.composition.morphology, free = m.composition.species === 'fantasy';
  const f = frontSilhouette(m), pr = profileSilhouette(m);
  // --- GÉOMÉTRIE
  c.push(check('geometry', 'neck.finite', '==', S.every((s) => fin(s.x, s.y, s.z, s.aL, s.aR, s.bF, s.bB, s.n, s.twist) && s.aL > 0 && s.aR > 0 && s.bF > 0 && s.bB > 0) ? 1 : 0, 1, 'stations du cou : valeurs non finies ou section dégénérée'));
  const minDy = Math.min(...S.slice(1).map((s, i) => s.y - S[i]!.y));
  c.push(check('geometry', 'neck.axis-monotone', '>=', minDy, 1e-6, 'l\'axe du cou doit descendre strictement (pas d\'inversion de la longueur)'));
  c.push(check('geometry', 'neck.anchor-top', '==', S[0]!.y, mo.topY, 'le haut du cou reste sur le repère de la tête', 'error', 1e-6));
  c.push(check('geometry', 'neck.anchor-base', '==', S[S.length - 1]!.y, mo.bottomY, 'la base du cou reste sur l\'ancre du corps (lm.neck.bottomY)', 'error', 1e-6));
  const minSec = Math.min(...S.map((s) => Math.min(s.aL, s.aR) / mo.aTop), ...S.map((s) => Math.min(s.bF, s.bB) / mo.bTop));
  c.push(check('geometry', 'neck.section-floor', '>=', minSec, free ? 0.1 : 0.3, 'section trop étroite : surface proche de l\'inversion'));
  c.push(check('geometry', 'neck.contour-ordered', '>=', Math.min(...S.map((_, i) => f.right[i]!.x - f.left[i]!.x)), 1e-6, 'contour croisé : bord droit à gauche du bord gauche'));
  const exact = S.filter((s) => s.twist === 0 && s.n === 2 && s.x === S[0]!.x);
  const dev = exact.length ? Math.max(...exact.map((s) => { const i = S.indexOf(s); return Math.abs(f.right[i]!.x - f.left[i]!.x - (s.aL + s.aR)) / (s.aL + s.aR); })) : 0;
  c.push(check('geometry', 'neck.front-matches-sections', '<=', dev, 0.01, 'silhouette de face en désaccord avec les sections (contrat commun 2D/3D)'));
  c.push(check('geometry', 'neck.profile-shares-axis', '==', Math.max(...S.map((s, i) => Math.abs(pr.front[i]!.y - s.y))), 0, 'profil et face doivent lire le même axe', 'error', 1e-9));
  // --- ANATOMIE
  const rule = SPECIES[m.composition.species];
  const bad = m.composition.structures.filter((s) => (!rule.structures.includes(s.id) && (s.visibility !== 0 || !s.disabledBy)) || (rule.structures.includes(s.id) && s.disabledBy));
  c.push(check('anatomy', 'neck.species-structures', '==', bad.length, 0, `structures incompatibles avec « ${m.composition.species} » : ${bad.map((s) => s.id).join(', ')}`));
  c.push(check('anatomy', 'neck.under-head', '<=', Math.abs(S[0]!.x), 0.6 * m.ctx.chinHalf + 1e-6, 'le haut du cou doit rester sous la tête (≤ 0,6 du demi-menton)'));
  if (m.composition.species === 'human') {
    c.push(check('anatomy', 'neck.human-length', '>=', mo.lengthPx / m.ctx.H, 0.12, 'cou humain trop court (< 0,12 H)', 'warn'));
    c.push(check('anatomy', 'neck.human-length-max', '<=', mo.lengthPx / m.ctx.H, 1.0, 'cou humain trop long (> 1,0 H depuis le haut caché)', 'warn'));
    c.push(check('anatomy', 'neck.base-flare', '>=', mo.aBase / mo.aTop, 0.98, 'la base du cou doit être au moins aussi large que le haut (trapèzes)', 'warn'));
  }
  c.push(check('anatomy', 'neck.visibility-range', '==', m.composition.structures.every((s) => s.visibility >= 0 && s.visibility <= 1) ? 1 : 0, 1, 'visibilité de structure hors [0, 1]'));
  // --- STYLE : teinte de la peau du cou = teinte de la tête (le cou n'a pas sa propre couleur)
  if (tint) c.push(check('style', 'neck.skin-hue', '<=', Math.abs(hueDelta(toHsl(tint.skin).h, toHsl(tint.neckTone).h)), 12, 'la peau du cou dérive de la teinte de la tête', 'error'));
  return c;
}

/** Contrôles du cou d'un visage complet (visage + SVG réellement émis). Liste vide si le cou est masqué. */
export function checkNeck(face: RandomFace, svg: string): Check[] {
  const p = face.params;
  if (!p.neck.visible) return [];
  const lm = faceLandmarks(p, face.width, face.height), m = neckModelFor(p, lm);
  const skin = (face.objects[0] as { material: { color: string } }).material.color;
  const out = checkNeckModel(m, { skin, neckTone: neckBase(resolveAppearance(skin, p.skin), p.neck.shade, null) });
  out.push(check('geometry', 'neck.frame-source', '==', lm.neck.half, m.composition.morphology.aTop, 'lm.neck.half doit être la demi-largeur du haut du cou du moteur', 'error', 1e-9));
  // ÉCLAIRAGE : la peau du cou est émise par le moteur de peau PARTAGÉ (découpe `-skin-clip` de `skin/layers.ts`), pas par un ombrage propre au cou.
  out.push(check('style', 'neck.shared-skin-engine', '==', svg.includes(`${(face.objects[0] as { id: string }).id}-neck-skin-clip`) ? 1 : 0, 1, 'le cou doit passer par le moteur de peau partagé (couches de skin/layers.ts)'));
  // Mode cel : l'ombrage du cou n'utilise que trois aplats.
  if (p.renderMode === 'anime') {
    const tones = new Set([...svg.matchAll(/<linearGradient id="[^"]*-neck-band-\d+"[^>]*>(.*?)<\/linearGradient>/g)].flatMap((g) => [...g[1]!.matchAll(/stop-color="([^"]+)"/g)].map((s) => s[1]!.toLowerCase())));
    out.push(check('style', 'neck.cel-tones', '<=', tones.size, 3, 'mode cel : le cou doit utiliser au plus 3 tons'));
  }
  return out;
}
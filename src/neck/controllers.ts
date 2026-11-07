import { Resolver, type Correction } from '../core/resolve';
import { clamp, clamp01 } from '../core/math';
import type { NeckSystem } from '../schema/neck-system';
import { expressionDelta } from './expressions';
import { totalLimits } from './rig';
import type { HeadContext, NeckMorphology, NeckRig } from './types';
import type { Work } from './work';

/**
 * TROIS CONTRÔLEURS SÉPARÉS (TODO §5) — le même flux, trois responsabilités :
 *   BodyLanguageController     expression → décalages de pose + épaules (`expressions.ts`) ;
 *   HeadPoseController         orientation ET position de la tête (sources : articulation du visage, moteur de pose, expression) ;
 *   NeckDeformationController  adaptation GÉOMÉTRIQUE du cou à cette pose, par stratégie, dans les limites du rig.
 * Ainsi un profil « colère » ne fixe pas l'inclinaison : il décale la pose, que le contrôleur de déformation traduit selon la morphologie.
 */
export interface HeadPose {
  readonly pitchDeg: number; readonly yawDeg: number; readonly rollDeg: number;
  readonly translate: number; readonly compression: number; readonly stretch: number;
  readonly tension: number; readonly shoulderRaise: number;
  readonly corrections: readonly Correction[];
}

/** HeadPoseController : pose cible, bornée par les limites articulaires de l'espèce (consignées si ramenée). */
export function headPoseController(ctx: HeadContext, sys: NeckSystem, rig: NeckRig, m: NeckMorphology): HeadPose {
  const R = new Resolver(), d = expressionDelta(sys), lim = totalLimits(rig);
  const pitch = R.limit('rig-limit-pitch', 'deform.articulation.headPitchDeg', ctx.headPitchDeg + d.pitchDeg, -lim.pitch, lim.pitch, `amplitude de tangage du rig (${sys.species})`);
  const yaw = R.limit('rig-limit-yaw', 'headYawDeg', ctx.headYawDeg + d.yawDeg, -lim.yaw, lim.yaw, `amplitude de lacet du rig (${sys.species})`);
  const roll0 = R.limit('rig-limit-roll', 'neck.system.orientation.rollDeg', d.rollDeg, -lim.roll, lim.roll, `amplitude de roulis du rig (${sys.species})`);
  // Le haut du cou reste SOUS la tête : la part de roulis due à la pose s'ajoute au décalage statique (axe + inclinaison propre) et ne peut pas les dépasser.
  const staticLean = m.axisOffsetPx + m.lengthPx * Math.sin((m.rollDeg * Math.PI) / 180) * 0.35, room = 0.6 * ctx.chinHalf, k = 0.35 * m.lengthPx;
  const lo = (Math.asin(clamp((-room - staticLean) / k, -1, 1)) * 180) / Math.PI, hi = (Math.asin(clamp((room - staticLean) / k, -1, 1)) * 180) / Math.PI;
  const roll = R.limit('neck-top-under-head-pose', 'neck.system.pose.bodyLanguage', roll0, lo, hi, 'le haut du cou reste sous la tête (0,6 du demi-menton), roulis de pose compris');
  return { pitchDeg: pitch, yawDeg: yaw, rollDeg: roll, translate: sys.pose.headTranslate + d.translate, compression: clamp01(sys.pose.compression + d.compression), stretch: clamp01(sys.pose.stretch + d.stretch), tension: clamp(sys.musculature.tension + d.tension, 0, 1), shoulderRaise: d.shoulderRaise, corrections: R.applied };
}

const smooth = (t: number): number => { const x = clamp01(t); return x * x * (3 - 2 * x); };

/**
 * Cumul c(u) ∈ [0,1] du mouvement le long du cou (0 = haut, 1 = base) selon la stratégie. Le mouvement restant au-dessus de u est 1 − c(u).
 *   weighted = enveloppe pondérée lisse (le haut et la base travaillent plus) · centerline = courbure uniforme (arc) · chain = charnières par segment
 *   (coudes nets) · fields = aucune flexion de l'axe (le mouvement ne passe que par les champs locaux : compression, muscle).
 * Plusieurs stratégies COEXISTENT : moyenne des cumuls des stratégies d'axe ; `fields` seule ⇒ axe immobile.
 */
export function distribution(strategies: readonly string[], segments: number, u: number): number {
  const axis = strategies.filter((s) => s !== 'fields');
  if (axis.length === 0) return 1;
  const K = Math.max(3, segments);
  const c = (s: string): number => (s === 'chain' ? Math.min(1, Math.floor(u * K + 1e-9) / (K - 1)) : s === 'centerline' ? u : smooth(u));
  return axis.reduce((a, s) => a + c(s), 0) / axis.length;
}

/** NeckDeformationController : écrit la pose dans `Work` (axe, torsion, sections, champs). Aucun mouvement ne touche les ancrages (masque). */
export function neckDeformationController(w: Work, pose: HeadPose, m: NeckMorphology, rig: NeckRig, attachments: NeckSystem['attachments']): void {
  const rad = Math.PI / 180, lim = totalLimits(rig), L = m.lengthPx, f = w.fields;
  const strat = rig.strategies, K = m.segments;
  const pn = clamp(pose.pitchDeg / (lim.pitch || 1), -1, 1), rn = clamp(pose.rollDeg / (lim.roll || 1), -1, 1), yn = clamp(pose.yawDeg * rig.twistShare / ((lim.yaw * rig.twistShare) || 1), -1, 1);
  const axisOn = strat.some((s) => s !== 'fields');
  for (let i = 0; i <= w.N; i++) {
    const u = i / w.N, c = distribution(strat, K, u), g = 1 - c;
    const mid = Math.sin(Math.PI * u) ** 0.5;
    // M07 courbure distribuée + M01 (tangage) + M04 (translation) → z ; M02 (roulis) → x. Les extrémités restent ancrées (g = 0 à la base).
    if (axisOn) {
      w.z[i]! += L * Math.sin(pose.pitchDeg * rad) * 0.35 * g ** 1.5 + pose.translate * m.aTop * g ** 1.5;
      w.x[i]! += L * Math.sin(pose.rollDeg * rad) * 0.35 * g ** 1.5;
    }
    // M03/M08 : rotation de la tête suivie à raison de `twistShare`, répartie progressivement (torsion des sections le long de l'axe).
    if (axisOn) w.twist[i]! += pose.yawDeg * rad * rig.twistShare * g;
    // M01 : flexion (menton vers le bas) comprime la face antérieure en haut et tend la nuque ; extension : l'inverse, les tendons ressortent.
    if (pn > 0) { f.compression[i] = clamp01(f.compression[i]! + 0.6 * pn * (1 - u) ** 1.5); w.bF[i]! *= 1 + 0.07 * pn * (1 - u); w.bB[i]! *= 1 - 0.05 * pn * mid; }
    else if (pn < 0) { f.muscle[i]! += 0.5 * -pn * mid; w.bF[i]! *= 1 - 0.06 * -pn * mid; f.compression[i] = clamp01(f.compression[i]! * (1 + pn)); }
    // M02 : côté de l'inclinaison comprimé (gonfle, plis), côté opposé étiré (s'affine, SCM tendu).
    if (rn !== 0) { const s = Math.sign(rn); f.compressionSide[i]! += s * Math.abs(rn) * mid; f.muscleSide[i]! -= s * Math.abs(rn) * mid; (s > 0 ? w.aR : w.aL)[i]! *= 1 + 0.07 * Math.abs(rn) * mid; (s > 0 ? w.aL : w.aR)[i]! *= 1 - 0.05 * Math.abs(rn) * mid; }
    // M03 : le sterno-cléido-mastoïdien CONTROLATÉRAL à la rotation se tend ; la peau glisse un peu côté rotation.
    if (yn !== 0) { f.muscleSide[i]! -= Math.sign(yn) * Math.abs(yn) * mid; f.compressionSide[i]! += 0.3 * yn * mid; f.muscle[i]! += 0.35 * Math.abs(yn) * mid; }
    // M05/M06 : compression = sections qui gonflent + plis ; étirement = sections qui s'affinent + tendons visibles.
    w.aL[i]! *= 1 + 0.12 * pose.compression - 0.1 * pose.stretch; w.aR[i]! *= 1 + 0.12 * pose.compression - 0.1 * pose.stretch;
    w.bF[i]! *= 1 + 0.12 * pose.compression - 0.1 * pose.stretch; w.bB[i]! *= 1 + 0.12 * pose.compression - 0.1 * pose.stretch;
    f.compression[i] = clamp01(f.compression[i]! + pose.compression); f.fold[i]! *= 1 + 2 * pose.compression; f.muscle[i]! += 0.4 * pose.stretch + Math.max(0, pose.tension) * 0.6 * mid;
  }
  // M10 : contact. Un collier serre le cou à son ancrage (tissus qui débordent de part et d'autre) ; le menton écrase le tissu quand la tête s'abaisse.
  for (const a of attachments) {
    if (a.kind !== 'collar' && a.kind !== 'scarf') continue;
    for (let i = 0; i <= w.N; i++) { const u = i / w.N, k = Math.exp(-(((u - a.at) / 0.035) ** 2)), over = Math.exp(-(((Math.abs(u - a.at) - 0.06) / 0.03) ** 2)); const r = 1 - 0.07 * a.size * k + 0.04 * a.size * over; w.aL[i]! *= r; w.aR[i]! *= r; w.bF[i]! *= r; w.bB[i]! *= r; f.compression[i] = clamp01(f.compression[i]! + 0.4 * over); }
  }
  if (pose.pitchDeg > 15) for (let i = 0; i <= w.N; i++) { const u = i / w.N; if (u < 0.4) f.compression[i] = clamp01(f.compression[i]! + ((pose.pitchDeg - 15) / 30) * (1 - u / 0.4)); }
}

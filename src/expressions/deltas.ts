import type { Delta, ExpressionKind } from './types';
import { ZERO } from './types';

/**
 * Deltas à intensité 1, par émotion. Conventions du schéma reprises telles quelles :
 * `eyebrow.tiltDeg` positif = queue (externe) plus haute que la tête (interne) ; `gaze.pitchDeg`
 * positif = regard vers le bas ; `shape.tiltDeg` positif = fente relevée côté externe.
 */
export const DELTAS: Record<ExpressionKind, Delta> = {
  neutral: ZERO,
  // Sourcils froncés et abaissés (rapprochés de l'œil), fente plissée, pupille contractée.
  angry: {
    openness: -0.22,
    upperFraction: -0.05,
    tiltDeg: 0.06,
    creaseDepthAdd: 0.18,
    browGap: -0.24,
    browTiltDeg: 0.22,
    browArch: -0.32,
    browPinch: 0.85,
    pitchDeg: 0,
    pupilSize: -0.1,
  },
  // Coin interne du sourcil relevé (le « sourcil en V inversé » classique), paupière tombante.
  sad: {
    openness: -0.16,
    upperFraction: -0.04,
    tiltDeg: -0.07,
    creaseDepthAdd: 0.12,
    browGap: 0.1,
    browTiltDeg: -0.42,
    browArch: 0.1,
    browPinch: 0.2,
    pitchDeg: 0.2,
    pupilSize: 0,
  },
  // Yeux écarquillés, sourcils entièrement relevés et arrondis, regard droit.
  fearful: {
    openness: 0.18,
    upperFraction: 0.05,
    tiltDeg: 0,
    creaseDepthAdd: -0.1,
    browGap: 0.32,
    browTiltDeg: 0,
    browArch: 0.3,
    browPinch: -0.4,
    pitchDeg: 0,
    pupilSize: 0.18,
  },
  // Mélange tendu de peur et de tristesse : sourcils remontés ET rapprochés, regard fuyant.
  anguished: {
    openness: 0.06,
    upperFraction: 0.02,
    tiltDeg: -0.03,
    creaseDepthAdd: 0.05,
    browGap: 0.14,
    browTiltDeg: -0.12,
    browArch: 0.1,
    browPinch: 0.55,
    pitchDeg: 0.1,
    pupilSize: 0.1,
  },
  // Tristesse douce et durable : paupière lourde, regard bas, peu de tension au sourcil.
  melancholic: {
    openness: -0.2,
    upperFraction: -0.05,
    tiltDeg: -0.03,
    creaseDepthAdd: 0.2,
    browGap: -0.02,
    browTiltDeg: -0.08,
    browArch: -0.05,
    browPinch: 0.1,
    pitchDeg: 0.28,
    pupilSize: -0.04,
  },
  // Fatigue / lassitude : paupière très basse, sourcil neutre à peine affaissé.
  // « fatigué » (demandé séparément) n'a PAS sa propre entrée : il est couvert par celle-ci, le
  // mot désignant le même relâchement de la paupière — les dupliquer n'ajouterait rien de distinct.
  drowsy: {
    openness: -0.4,
    upperFraction: -0.08,
    tiltDeg: 0,
    creaseDepthAdd: 0.3,
    browGap: -0.06,
    browTiltDeg: 0,
    browArch: -0.1,
    browPinch: 0,
    pitchDeg: 0.12,
    pupilSize: -0.02,
  },
  // Étonnement : yeux écarquillés au maximum, sourcils relevés mais SANS la convergence tendue de
  // la peur (browPinch quasi nul) — la différence avec `fearful` est précisément là : l'étonnement
  // est une surprise neutre, pas une menace perçue.
  surprised: {
    openness: 0.3,
    upperFraction: 0.06,
    tiltDeg: 0,
    creaseDepthAdd: -0.15,
    browGap: 0.4,
    browTiltDeg: 0,
    browArch: 0.35,
    browPinch: -0.05,
    pitchDeg: 0,
    pupilSize: 0.08,
  },
  // Air maussade/boudeur : paupière mi-close, sourcil plat et légèrement abaissé (pas froncé comme
  // la colère — juste blasé), regard qui fuit légèrement vers le bas.
  sulky: {
    openness: -0.14,
    upperFraction: -0.02,
    tiltDeg: -0.1,
    creaseDepthAdd: 0.08,
    browGap: -0.1,
    browTiltDeg: -0.05,
    browArch: -0.3,
    browPinch: 0.1,
    pitchDeg: 0.15,
    pupilSize: -0.02,
  },
  // Colère poussée plus loin qu'`angry` : narration volontairement DISTINCTE (pas un simple
  // facteur d'échelle) — sourcil encore plus bas et plus incliné, plissement plus marqué,
  // pupille davantage contractée.
  furious: {
    openness: -0.32,
    upperFraction: -0.07,
    tiltDeg: 0.1,
    creaseDepthAdd: 0.26,
    browGap: -0.34,
    browTiltDeg: 0.32,
    browArch: -0.42,
    browPinch: 1,
    pitchDeg: 0,
    pupilSize: -0.16,
  },
  // Joie ouverte : yeux légèrement agrandis et lumineux, sourcils détendus et relevés en douceur,
  // fente relevée aux coins externes (tiltDeg positif) — à la différence de `smiling`, l'ouverture
  // reste GRANDE (pas de plissement).
  joyful: {
    openness: 0.14,
    upperFraction: 0.02,
    tiltDeg: 0.12,
    creaseDepthAdd: -0.08,
    browGap: 0.1,
    browTiltDeg: 0.05,
    browArch: 0.15,
    browPinch: -0.1,
    pitchDeg: -0.05,
    pupilSize: 0.05,
  },
  // Sourire plissé (« crescent eyes ») : à la différence de `joyful`, l'ouverture CHUTE nettement
  // (paupière basse qui remonte, comme poussée par la joue) plutôt que de s'agrandir — c'est ce qui
  // distingue visuellement les deux.
  smiling: {
    openness: -0.3,
    upperFraction: 0.12,
    tiltDeg: 0.14,
    creaseDepthAdd: -0.05,
    browGap: 0.04,
    browTiltDeg: 0.04,
    browArch: 0.08,
    browPinch: -0.05,
    pitchDeg: 0,
    pupilSize: 0,
  },
  // Regard féroce/perçant : fente étroite, pupille très contractée, sourcil bas et pressé SANS
  // l'inclinaison véhémente de la colère (pas de hausse du sourcil, juste un plissement froid).
  // Réserve assumée : faute de pouvoir confirmer le sens exact voulu pour « sanglant » dans la
  // liste d'émotions fournie, c'est l'interprétation retenue — susceptible d'être corrigée.
  fierce: {
    openness: -0.28,
    upperFraction: -0.04,
    tiltDeg: 0.08,
    creaseDepthAdd: 0.1,
    browGap: -0.2,
    browTiltDeg: 0.06,
    browArch: -0.5,
    browPinch: 0.65,
    pitchDeg: 0,
    pupilSize: -0.2,
  },
  // Tension/stress : plissement et léger rapprochement du sourcil SANS le ton descendant de la
  // tristesse (tiltDeg quasi neutre) ni la convergence extrême de la colère — un état d'alerte,
  // pas un conflit ouvert.
  stressed: {
    openness: -0.18,
    upperFraction: -0.02,
    tiltDeg: 0.02,
    creaseDepthAdd: 0.14,
    browGap: -0.16,
    browTiltDeg: 0.08,
    browArch: -0.15,
    browPinch: 0.4,
    pitchDeg: 0,
    pupilSize: -0.06,
  },
};

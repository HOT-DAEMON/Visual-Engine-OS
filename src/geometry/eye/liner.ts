import { clamp01, rad } from '../../core/math';
import type { EyeSpec } from '../../schema';
import type { OpeningGeometry } from './opening';
import { lowerFrame, upperFrame } from './opening';
import { cubicAt, cubicDeriv, norm, type Vec } from './primitives';

export type LinerSpec = NonNullable<EyeSpec['lids']['liner']>;

export interface LinerGeometry {
  /** Bord haut de la partie « sur la paupière », puis de l'aile, jusqu'à la pointe (incluse). */
  readonly top: readonly Vec[];
  /** Retour : de la pointe, le bord bas de l'aile puis celui de la paupière, jusqu'au départ. */
  readonly bottom: readonly Vec[];
  readonly start: Vec;
  readonly tip: Vec;
  /** Ligne de brillance (le long du bord haut, légèrement rentrée). */
  readonly gloss: readonly Vec[];
  /** Liner inférieur (vide si `lowerReach` = 0) : polygone fermé effilé. */
  readonly lower: readonly Vec[];
}

const smooth = (x: number): number => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

/** Montée en épaisseur du liner le long du bord supérieur (0 avant `start`, 1 au sommet `peak`). */
function profile(p: LinerSpec, t: number): number {
  const rise = smooth((t - p.start) / Math.max(p.peak - p.start, 0.05));
  const fall = 1 - 0.12 * smooth((t - p.peak) / Math.max(1 - p.peak, 0.05));
  return rise * fall;
}

/**
 * Distance (px) entre la courbe de la paupière et le BORD HAUT du liner en `t`. Sert aussi aux
 * cils supérieurs, qui prennent racine sur ce bord. Sans liner, les cils gardent leur décalage
 * historique (voir lashes.ts) : cette fonction n'est appelée que si `lids.liner` est défini.
 */
export function linerTopOffset(p: LinerSpec, th: number, t: number): number {
  const ramp = smooth((t - p.start) / 0.1);
  return th * (0.5 * ramp + p.thickness * profile(p, t));
}

/** Distance (px) du BORD BAS du liner sous la courbe (il recouvre le trait de paupière de même couleur). */
function linerBottomOffset(p: LinerSpec, th: number, t: number): number {
  return -0.45 * th * smooth((t - p.start) / 0.1);
}

const rot = (v: Vec, n: Vec, a: number): Vec => ({
  x: v.x * Math.cos(a) + n.x * Math.sin(a),
  y: v.y * Math.cos(a) + n.y * Math.sin(a),
});

/**
 * Géométrie pure du liner ailé : contour polygonal échantillonné (le rendu le lisse). L'aile est une
 * cubique qui prolonge le liner au-delà du canthus externe, d'épaisseur décroissante jusqu'à la
 * pointe ; son départ est tangent à la paupière puis relevé de `liftDeg`.
 */
export function linerGeometry(g: OpeningGeometry, p: LinerSpec, th: number): LinerGeometry {
  const NL = 30;
  const NW = 18;
  const top: Vec[] = [];
  const bottom: Vec[] = [];
  const gloss: Vec[] = [];
  const t0 = Math.min(p.start, 0.95);
  for (let i = 0; i <= NL; i++) {
    const t = t0 + ((1 - t0) * i) / NL;
    const f = upperFrame(g, t);
    const eTop = linerTopOffset(p, th, t);
    top.push({ x: f.pos.x + f.N.x * eTop, y: f.pos.y + f.N.y * eTop });
    const eBot = linerBottomOffset(p, th, t);
    bottom.push({ x: f.pos.x + f.N.x * eBot, y: f.pos.y + f.N.y * eBot });
    const eG = eBot + (eTop - eBot) * 0.72;
    if (t > p.start + 0.2) gloss.push({ x: f.pos.x + f.N.x * eG, y: f.pos.y + f.N.y * eG });
  }
  const f1 = upperFrame(g, 1);
  const eTop1 = linerTopOffset(p, th, 1);
  const eBot1 = linerBottomOffset(p, th, 1);
  const mid = (eTop1 + eBot1) / 2;
  const M0: Vec = { x: f1.pos.x + f1.N.x * mid, y: f1.pos.y + f1.N.y * mid };
  const hw0 = ((eTop1 - eBot1) / 2) * p.wing.thickness;
  const Lw = p.wing.length * g.w;
  // Direction de l'aile mesurée par rapport à l'HORIZONTALE de l'œil (vers l'extérieur, relevée de
  // `liftDeg`), et non par rapport à la tangente de la paupière : celle-ci plonge déjà à l'extérieur
  // pour un œil en amande, un relèvement relatif donnerait une aile qui retombe. Le départ reste
  // tangent à la paupière (continuité), puis la courbe s'oriente vers la direction voulue.
  const out: Vec = { x: g.s, y: 0 };
  const up: Vec = { x: 0, y: -1 };
  const dAbs = rot(out, up, rad(p.wing.liftDeg));
  const dEnd = rot(out, up, rad(p.wing.liftDeg + p.wing.curve * 28));
  // Départ : mi-chemin entre la tangente de la paupière et la direction de l'aile (évite le coude).
  const d1 = norm({ x: f1.T.x * 0.45 + dAbs.x * 0.55, y: f1.T.y * 0.45 + dAbs.y * 0.55 });
  const P1: Vec = { x: M0.x + d1.x * Lw * 0.28, y: M0.y + d1.y * Lw * 0.28 };
  const P3: Vec = { x: M0.x + dAbs.x * Lw, y: M0.y + dAbs.y * Lw };
  const P2: Vec = { x: P3.x - dEnd.x * Lw * 0.38, y: P3.y - dEnd.y * Lw * 0.38 };
  // Côté « haut » de l'aile : celui qui regarde la normale sortante de la paupière.
  const tan0 = norm(cubicDeriv(M0, P1, P2, P3, 0));
  const sgn = -tan0.y * f1.N.x + tan0.x * f1.N.y >= 0 ? 1 : -1;
  const wingTop: Vec[] = [];
  const wingBot: Vec[] = [];
  for (let i = 1; i <= NW; i++) {
    const u = i / NW;
    const c = cubicAt(M0, P1, P2, P3, u);
    const tn = norm(cubicDeriv(M0, P1, P2, P3, u));
    const n: Vec = { x: -tn.y * sgn, y: tn.x * sgn };
    // Profil : `sharpness` 0 = bout arrondi (demi-ellipse), 1 = aiguille (effilement quasi linéaire).
    const round = Math.sqrt(Math.max(0, 1 - u * u));
    const needle = (1 - u) ** 1.3;
    const hw = hw0 * (round * (1 - p.wing.sharpness) + needle * p.wing.sharpness);
    wingTop.push({ x: c.x + n.x * hw, y: c.y + n.y * hw });
    wingBot.push({ x: c.x - n.x * hw, y: c.y - n.y * hw });
  }
  const tip = P3;
  // La liaison paupière → aile : on garde les points de la paupière puis ceux de l'aile (sans la
  // pointe, ajoutée une seule fois), le lissage du rendu raccorde l'ensemble.
  const topAll = [...top, ...wingTop.slice(0, -1), tip];
  const botAll = [tip, ...wingBot.slice(0, -1).reverse(), ...bottom.slice().reverse()];

  // Liner inférieur : bande effilée qui part de po et remonte sur la paupière basse.
  const lower: Vec[] = [];
  if (p.lowerReach > 0.01) {
    const NLw = 14;
    const up: Vec[] = [];
    const dn: Vec[] = [];
    for (let i = 0; i <= NLw; i++) {
      const k = i / NLw;
      const t = 1 - p.lowerReach * k;
      const f = lowerFrame(g, t);
      const w = th * 0.55 * (1 - k) ** 0.8;
      up.push({ x: f.pos.x + f.N.x * w, y: f.pos.y + f.N.y * w });
      dn.push({ x: f.pos.x - f.N.x * w * 0.35, y: f.pos.y - f.N.y * w * 0.35 });
    }
    lower.push(...up, ...dn.slice().reverse());
  }
  return { top: topAll, bottom: botAll, start: top[0] as Vec, tip, gloss, lower };
}

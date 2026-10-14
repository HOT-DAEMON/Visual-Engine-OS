import { clamp, rad } from '../../core/math';
import { clumpLashes, flickLashes } from './lash-extras';
import { mulberry32 } from '../../core/prng';
import type { EyeSpec } from '../../schema';
import type { Frame, OpeningGeometry } from './opening';
import { lowerFrame, upperFrame } from './opening';
import type { Vec } from './primitives';

// ------------------------------------------------------------------ Cils

export interface Lash {
  readonly base: Vec;
  readonly ctrl: Vec;
  readonly tip: Vec;
  /** Second contrôle : présent pour les cils CUBIQUES (cils longs externes), absent pour les quadratiques. */
  readonly ctrl2?: Vec;
  readonly baseWidth: number;
  /** 0 = pointe arrondie (contrôle large), 1 = aiguille (contrôle resserré) — voir `tipSharpness`. */
  readonly tipSharpness: number;
  /** Écart de luminosité tiré pour CE cil (−1..1) — voir `colorVariation` ; 0 = couleur de base. */
  readonly colorJitter: number;
}

const smoothstep = (x: number): number => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};

type LashGroupParams = EyeSpec['lashes']['upper'] | EyeSpec['lashes']['lower'];

/**
 * Construit un groupe de cils à partir de sa MORPHOLOGIE (longueur/épaisseur de base, arche,
 * angle, pointe, courbure) et de la dispersion statistique entre FIBRES individuelles (seedée,
 * donc déterministe). Chaque cil tire un nombre d'appels FIXE au PRNG, qu'il soit ou non retenu
 * ensuite — c'est ce qui garantit qu'ajouter un paramètre plus tard ne décale pas les tirages
 * existants pour une seed donnée.
 */
function buildLashes(
  frameAt: (t: number) => Frame,
  p: LashGroupParams,
  lidPx: number,
  shiftPx: number,
  seed: number,
  rootShift?: (t: number) => number,
): Lash[] {
  const rnd = mulberry32(seed >>> 0);
  const out: Lash[] = [];
  // `p.length` est déjà converti en pixels par l'appelant (`lashes.length * g.h`) ; `lidPx` est
  // l'épaisseur du bord palpébral en pixels, base de l'épaisseur des cils (`p.thickness` est une
  // fraction de cette épaisseur, voir eye-lashes.ts).
  const lengthPx = p.length;
  const baseWidthPx = lidPx * p.thickness;
  for (let i = 0; i < p.count; i++) {
    // Ordre d'appel FIXE : 6 tirages par cil, même si le cil est ensuite écarté par la dispersion.
    const jPos = rnd();
    const jLen = rnd();
    const jThick = rnd();
    const jOrient = rnd();
    const jCurl = rnd();
    const jColor = rnd();

    const spread = p.positionDispersion * 0.9;
    const t = clamp(0.05 + 0.9 * ((i + 0.5) / p.count) + ((jPos - 0.5) * spread) / p.count, 0.02, 0.98);
    const { pos, T, N } = frameAt(t);

    // Éventail (sweep) + rotation globale (angleDeg) + dispersion d'orientation par cil.
    const phi = rad((p.sweep * (t - 0.3)) / 0.7 + p.angleDeg + (jOrient - 0.5) * 2 * p.orientationVariation);
    const dir0: Vec = { x: N.x * Math.cos(phi) + T.x * Math.sin(phi), y: N.y * Math.cos(phi) + T.y * Math.sin(phi) };
    // `outerLift` (opt-in) : mélange la direction vers le haut de l'œil, de plus en plus à l'extérieur.
    const lift = p.outerLift * smoothstep((t - 0.4) / 0.6);
    const lx = dir0.x * (1 - lift);
    const ly = dir0.y * (1 - lift) - lift;
    const ln = Math.hypot(lx, ly) || 1;
    const dir: Vec = lift === 0 ? dir0 : { x: lx / ln, y: ly / ln };

    // Arche : profil de longueur gaussien, pic et largeur réglables, amplitude réglable.
    const envelope = Math.exp(-(((t - p.arch.peak) / Math.max(p.arch.width, 0.02)) ** 2));
    const f = (1 - p.arch.strength) + p.arch.strength * envelope;
    // `outerLength` (opt-in) : allonge les cils de la moitié externe ; facteur exactement 1 à 0.
    const outer = 1 + p.outerLength * smoothstep((t - 0.5) / 0.5);
    const len = lengthPx * f * (1 + (jLen - 0.5) * 2 * p.lengthVariation) * outer;
    const curl = clamp(p.curl * (1 + (jCurl - 0.5) * 2 * p.curlVariation), 0, 1.5);
    const width = Math.max(0.3, baseWidthPx * (1 + (jThick - 0.5) * 2 * p.thicknessVariation));

    const shift = rootShift ? Math.max(shiftPx, rootShift(t)) : shiftPx;
    const base: Vec = { x: pos.x + N.x * shift, y: pos.y + N.y * shift };
    out.push({
      base,
      ctrl: { x: base.x + dir.x * len * 0.6, y: base.y + dir.y * len * 0.6 },
      tip: { x: base.x + dir.x * len + T.x * len * curl * 0.25, y: base.y + dir.y * len + T.y * len * curl * 0.25 },
      baseWidth: width,
      tipSharpness: p.tipSharpness,
      colorJitter: (jColor - 0.5) * 2 * p.colorVariation,
    });
  }
  return out;
}

/**
 * `rootShift` (optionnel) : décalage des racines selon la position `t` — fourni quand un liner est
 * actif pour que les cils sortent du BORD HAUT du liner (voir geometry/eye/liner.ts).
 */
export function upperLashes(
  g: OpeningGeometry,
  lashes: EyeSpec['lashes']['upper'],
  lidPx: number,
  seed: number,
  rootShift?: (t: number) => number,
): Lash[] {
  const base = buildLashes((t) => upperFrame(g, t), { ...lashes, length: lashes.length * g.h }, lidPx, lidPx * 0.3, seed, rootShift);
  const clumped = clumpLashes(base, lashes.clump, lashes.clumpSize, seed);
  return [...clumped, ...flickLashes(g, lashes.flick, lidPx, rootShift ?? (() => lidPx * 0.3), seed)];
}

export function lowerLashes(g: OpeningGeometry, lashes: EyeSpec['lashes']['lower'], lidPx: number, seed: number): Lash[] {
  const base = buildLashes((t) => lowerFrame(g, t), { ...lashes, length: lashes.length * g.h }, lidPx, lidPx * 0.1, seed);
  return clumpLashes(base, lashes.clump, lashes.clumpSize, seed);
}

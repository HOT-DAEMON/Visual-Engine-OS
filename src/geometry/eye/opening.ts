import { rad } from '../../core/math';
import type { EyeSpec } from '../../schema';
import type { BBox } from '../../materials';
import { extendedStyle } from './opening-styles';
import { cubicAt, cubicDeriv, norm, type Vec } from './primitives';


// ------------------------------------------------------------------ Fente palpébrale

/** Facteur de hauteur du style 'compressed' (paupières mi-closes) — la largeur n'est pas touchée. */
const COMPRESSED_CLOSURE = 0.55;
/** Rapport hauteur/largeur minimal du style 'circle'. */
const CIRCLE_MIN_ASPECT = 0.92;

export interface OpeningGeometry {
  /** Canthus interne, canthus externe, contrôles de la courbe supérieure (u) et inférieure (l). */
  readonly pi: Vec;
  readonly po: Vec;
  readonly u1: Vec;
  readonly u2: Vec;
  readonly l1: Vec;
  readonly l2: Vec;
  readonly s: 1 | -1;
  readonly w: number;
  readonly h: number;
  /** Hauteur effective (hauteur × openness). */
  readonly hEff: number;
  readonly bbox: BBox;
}

export function openingGeometry(shape: EyeSpec['shape'], canthi: EyeSpec['canthi']): OpeningGeometry {
  const { width: w, height: h, tiltDeg, upperFraction, openness, style } = shape;
  const s: 1 | -1 = shape.outerSide === 'left' ? -1 : 1;
  // 'compressed' : la hauteur est réduite par la FERMETURE des paupières (largeur inchangée), et la
  // paupière supérieure descend plus que l'inférieure ne monte (la part haute diminue).
  const closure = style === 'compressed' ? COMPRESSED_CLOSURE : 1;
  // 'triangle' : presque tout le volume est SOUS la ligne des canthi (dessus plat, sommet en bas) ;
  // 'diamond' : haut et bas symétriques ; 'circle' : symétrique aussi (cercle).
  const uf =
    style === 'compressed'
      ? upperFraction * 0.9
      : style === 'triangle'
        ? 0.12
        : style === 'diamond' || style === 'diamond_v2' || style === 'circle'
          ? 0.5
          : upperFraction;
  // 'circle' : une ouverture circulaire exige une hauteur voisine de la largeur → plancher à 0,92 × largeur.
  // 'triangle' : œil plus haut (×1,12, proportions du modèle) ; 'chibi' : beaucoup plus haut (×1,5) ; les deux
  // sont aussi prolongés côté externe (voir opening-styles.ts).
  const hBase = style === 'circle' ? Math.max(h, w * CIRCLE_MIN_ASPECT) : style === 'triangle' ? h * 1.12 : style === 'chibi' ? h * 1.5 : h;
  const hEff = hBase * openness * closure;
  const hUp = hEff * uf;
  const hLo = hEff * (1 - uf);
  const t = Math.tan(rad(tiltDeg)) * (w / 2);
  const k = 4 / 3; // contrôle à 4/3 de la hauteur => l'apex de la cubique atteint exactement la hauteur visée
  // Plus un canthus est arrondi, plus la courbe le quitte à la verticale.
  const rIn = canthi.inner.roundness;
  const rOut = canthi.outer.roundness;
  // Canthus interne (côté nez) : IDENTIQUE quel que soit le style — seul le canthus externe varie
  // d'une silhouette anime à l'autre (voir schema.ts, champ `shape.style`) — SAUF 'round', qui
  // arrondit aussi l'intérieur (un œil kawaii n'a pas de coin interne pointu).
  const innerRoundBoost = style === 'round' ? 0.45 : 0;
  const upIn = w * (0.24 - 0.16 * rIn) * (1 - innerRoundBoost);
  const loIn = w * (0.26 - 0.16 * rIn) * (1 - innerRoundBoost);
  let pi: Vec = { x: (-s * w) / 2, y: t };
  let po: Vec = { x: (s * w) / 2, y: -t };
  let u1: Vec = { x: pi.x + s * upIn, y: pi.y - k * hUp * (1 + innerRoundBoost * 0.5) };
  let l2: Vec = { x: pi.x + s * loIn, y: pi.y + k * hLo * (1 + innerRoundBoost * 0.5) };

  // Canthus externe : chaque style ne touche que u2 (contrôle haut-externe), l1 (contrôle bas-externe)
  // et éventuellement po lui-même (position du coin externe). `upOut`/`loOut` restent la base commune.
  const upOut = w * (0.24 - 0.16 * rOut);
  const loOut = w * (0.26 - 0.16 * rOut);
  let u2: Vec = { x: po.x - s * upOut, y: po.y - k * hUp };
  let l1: Vec = { x: po.x - s * loOut, y: po.y + k * hLo };

  if (style === 'round') {
    // Kawaii : silhouette proche d'un cercle — contrôles externes nettement ramenés vers le centre
    // (peu de taper horizontal) et apex vertical bien plus prononcé (bulbe haut/bas marqué).
    const bulge = k * 1.45;
    u2 = { x: po.x - s * upOut * 0.32, y: po.y - bulge * hUp };
    l1 = { x: po.x - s * loOut * 0.32, y: po.y + bulge * hLo };
  } else if (style === 'sharp') {
    // Tsurime : le coin externe se relève et se termine en pointe. Contrairement à 'almond', le
    // contrôle u2 reste PROCHE de po (petit upOut) avec une montée bornée par la LARGEUR (jamais
    // par hUp — sinon, sur un œil haut, le contrôle s'échappe loin du coin et gonfle toute la
    // paupière en une bulle au lieu d'un petit coup de pinceau localisé ; voir docs/ERRORS.md #8).
    const flick = Math.min(w * 0.16, hUp * 0.85);
    po = { x: po.x, y: po.y - w * 0.045 };
    u2 = { x: po.x - s * upOut * 0.22, y: po.y - flick };
    l1 = { x: po.x - s * loOut * 0.7, y: po.y + k * hLo * 0.75 };
  } else if (style === 'drooping') {
    // Tareme : le coin externe tombe, selon le même principe borné (fraction de la largeur, jamais
    // de hLo seul) pour rester un affaissement localisé et non une bulle qui gonfle avec la hauteur.
    const droop = Math.min(w * 0.16, hLo * 0.85);
    po = { x: po.x, y: po.y + w * 0.045 };
    u2 = { x: po.x - s * upOut * 1.05, y: po.y - k * hUp * 0.55 };
    l1 = { x: po.x - s * loOut * 0.55, y: po.y + droop };
  }

  // Styles ajoutés (chibi, angular, circle, triangle, diamond, diamond_v2, rounded_rect).
  const ext = extendedStyle(style, { pi, po, u1, u2, l1, l2 }, { s, w, k, hUp, hLo, hEff, t, rIn, rOut });
  if (ext) ({ pi, po, u1, u2, l1, l2 } = ext);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const N = 32;
  for (let i = 0; i <= N; i++) {
    for (const p of [cubicAt(pi, u1, u2, po, i / N), cubicAt(po, l1, l2, pi, i / N)]) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  return { pi, po, u1, u2, l1, l2, s, w, h, hEff, bbox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY } };
}

export interface Frame {
  readonly pos: Vec;
  /** Tangente unitaire, du canthus interne vers l'externe. */
  readonly T: Vec;
  /** Normale unitaire sortante (vers le haut pour le bord supérieur, vers le bas pour l'inférieur). */
  readonly N: Vec;
}

/** t = 0 : canthus interne ; t = 1 : canthus externe. */
export function upperFrame(g: OpeningGeometry, t: number): Frame {
  const pos = cubicAt(g.pi, g.u1, g.u2, g.po, t);
  const T = norm(cubicDeriv(g.pi, g.u1, g.u2, g.po, t));
  return { pos, T, N: { x: g.s * T.y, y: -g.s * T.x } };
}

export function lowerFrame(g: OpeningGeometry, t: number): Frame {
  const u = 1 - t;
  const pos = cubicAt(g.po, g.l1, g.l2, g.pi, u);
  const d = cubicDeriv(g.po, g.l1, g.l2, g.pi, u);
  const T = norm({ x: -d.x, y: -d.y });
  return { pos, T, N: { x: -g.s * T.y, y: g.s * T.x } };
}


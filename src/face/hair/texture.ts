import { clamp } from '../../core/math';
import type { Vec } from '../../geometry/eye/primitives';
import type { HairStyle, HairTexture, HairTextureChoice } from '../../schema';
import { smoothstep } from './noise';

/** Paramètres de forme d'une mèche selon la texture (px, repère de l'hôte). */
export interface TexSpec {
  /** Amplitude latérale. */
  readonly amp: number;
  /** Longueur d'onde le long de la mèche. */
  readonly lambda: number;
  /** 0 = ondulation ; 1 = boucle fermée (la mèche revient sur elle-même). */
  readonly loop: number;
  /** Désordre (phase et amplitude bruitées) : 0 = régulier. */
  readonly chaos: number;
  /** Rétrécissement de la portée (une boucle serrée raccourcit la mèche). */
  readonly shrink: number;
  /** Multiplicateur de largeur de mèche (les mèches crépues se regroupent en paquets épais). */
  readonly wide: number;
}

/** 'auto' : couplage historique (curly → bouclé, afro → crépu, le reste → raide). */
export function resolveTexture(style: HairStyle, choice: HairTextureChoice): HairTexture {
  if (choice !== 'auto') return choice;
  return style === 'curly' ? 'curly' : style === 'afro' ? 'coily' : 'straight';
}

export function textureSpec(t: HairTexture, curl: number, W: number, H: number): TexSpec {
  switch (t) {
    case 'wavy':
      return { amp: (0.01 + 0.022 * curl) * W, lambda: (0.22 - 0.08 * curl) * H, loop: 0, chaos: 0.15, shrink: 0.97 - 0.05 * curl, wide: 1 };
    case 'curly':
      return { amp: (0.016 + 0.026 * curl) * W, lambda: (0.085 - 0.035 * curl) * H, loop: 0.9, chaos: 0.35, shrink: 0.82 - 0.2 * curl, wide: 1.15 };
    case 'coily':
      return { amp: (0.008 + 0.014 * curl) * W, lambda: (0.04 - 0.015 * curl) * H, loop: 1, chaos: 1, shrink: 0.62, wide: 1.5 };
    default:
      return { amp: 0.0035 * W * (1 + curl), lambda: 0.5 * H, loop: 0, chaos: 0.1, shrink: 1, wide: 1 };
  }
}

/** Nombre d'échantillons d'une mèche : assez pour résoudre une onde (≥ 5,5 points par longueur d'onde). */
export const samplesFor = (lengthPx: number, sp: TexSpec): number => clamp(Math.ceil(lengthPx / (sp.lambda / 5.5)), 10, 46);

/** Rééchantillonne une polyligne à `n` points régulièrement espacés en abscisse curviligne. */
export function resample(c: Vec[], n: number): Vec[] {
  const cum = [0];
  for (let i = 1; i < c.length; i++) cum.push((cum[i - 1] as number) + Math.hypot((c[i] as Vec).x - (c[i - 1] as Vec).x, (c[i] as Vec).y - (c[i - 1] as Vec).y));
  const total = cum[cum.length - 1] as number;
  if (total < 1e-9) return Array.from({ length: n }, () => c[0] as Vec);
  const out: Vec[] = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const d = (total * k) / (n - 1);
    while (j < c.length - 2 && (cum[j + 1] as number) < d) j++;
    const a = c[j] as Vec;
    const b = c[j + 1] as Vec;
    const seg = (cum[j + 1] as number) - (cum[j] as number) || 1;
    const f = clamp((d - (cum[j] as number)) / seg, 0, 1);
    out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
  }
  return out;
}

/**
 * Applique la texture à une ligne médiane : décalage latéral sinusoïdal (ondulé), couplé à un décalage
 * tangentiel (boucle fermée dès que `amp·2π/λ·loop > 1`). La racine reste immobile (enveloppe lisse).
 */
export function displace(c: Vec[], sp: TexSpec, phase: number, nz: (x: number) => number): Vec[] {
  const n = c.length;
  const out: Vec[] = [];
  let len = 0;
  for (let i = 0; i < n; i++) {
    const a = c[Math.max(0, i - 1)] as Vec;
    const b = c[Math.min(n - 1, i + 1)] as Vec;
    const tl = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const t = { x: (b.x - a.x) / tl, y: (b.y - a.y) / tl };
    if (i > 0) len += Math.hypot((c[i] as Vec).x - (c[i - 1] as Vec).x, (c[i] as Vec).y - (c[i - 1] as Vec).y);
    const env = smoothstep(clamp(len / (sp.lambda * 0.8), 0, 1));
    const ph = (2 * Math.PI * len) / sp.lambda + phase + sp.chaos * 2 * nz((len / sp.lambda) * 0.7);
    const A = sp.amp * env * (1 + 0.35 * sp.chaos * nz(len * 0.05 + 7));
    const on = A * Math.sin(ph);
    const ot = sp.loop * A * 0.9 * (Math.cos(ph) - 1);
    const p = c[i] as Vec;
    out.push({ x: p.x - t.y * on + t.x * ot, y: p.y + t.x * on + t.y * ot });
  }
  return out;
}

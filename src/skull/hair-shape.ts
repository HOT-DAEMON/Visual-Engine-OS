import { mulberry32 } from '../core/prng';
import type { FaceHair } from '../schema';
import { resolveTexture } from '../face/hair/texture';
import { polyIndex, type SkullGeo } from './geometry';
import type { CPoint, V2 } from './types';

/**
 * CHEVEUX EN PROFIL, BRANCHÉS SUR LES PARAMÈTRES DE CHEVEUX DE LA FACE (`FaceHair`) — GÉOMÉTRIE PURE, lue par le rendu ET par la vérification.
 * Mêmes entrées que le moteur de cheveux de la face : style, texture (auto/raide/ondulée/bouclée/crépue/tressée), longueur, volume, frange,
 * implantation, queue/chignon/tresses, graine. Le profil n'a donc ni coiffure ni longueur propres : `hair.style = 'long'` donne une chevelure qui
 * descend dans le dos en profil comme en face. La ligne d'implantation du front est celle de la face (`f.hairline`, issue de `hair.hairline`).
 * Le moteur complet de la face (mèches simulées, tiers, occlusions) n'est PAS projeté : voir docs/SKULL-AXES-REMAINING.md.
 */
export interface HairShape {
  readonly style: FaceHair['style'];
  readonly texture: ReturnType<typeof resolveTexture>;
  /** Masse principale (polygone fermé) : dessus du crâne, front, nuque, rideau arrière. */
  readonly mass: CPoint[];
  /** Pièces rapportées : queue, tresses, mèche de frange (polygones fermés) ; chignon (cercle). */
  readonly extra: CPoint[][];
  readonly bun: { readonly cx: number; readonly cy: number; readonly r: number } | null;
  /** Ordonnée de l'implantation du front, de la nuque, ordonnée la plus basse et la plus haute de la chevelure (px). */
  readonly hairlineY: number; readonly napeY: number; readonly bottom: number; readonly top: number;
  /** Longueur de la chevelure sous le menton / l'implantation de la nuque (fraction de H) : valeur comparée à la face. */
  readonly dropH: number;
  /** Lignes de mèches (polylignes) qui suivent la masse. */
  readonly strands: V2[][];
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Épaisseur maximale (fraction de H) par coiffure avant le volume ; `bump` = ondulation du bord selon la texture (amplitude, fréquence). */
const BASE: Readonly<Record<FaceHair['style'], number>> = { bald: 0, buzz: 0.011, short: 0.034, spiky: 0.04, curly: 0.07, afro: 0.115, bob: 0.045, long: 0.045, ponytail: 0.036, bun: 0.036, braids: 0.04 };
const TEX: Readonly<Record<string, [number, number]>> = { straight: [0, 0], wavy: [0.008, 5], curly: [0.018, 9], coily: [0.024, 15], braided: [0.006, 7] };

/** Ordonnée la plus basse de la chevelure retombante (fraction de H depuis le sommet) : MÊMES formules que `hairGeometry` de la face (yHang). */
export function hairHangFrac(h: FaceHair, jawY: number): number {
  return h.style === 'long' ? 1 + 0.08 + 0.3 * h.length : jawY + 0.03 + 0.1 * h.length;
}

export function hairShape(g: SkullGeo, h: FaceHair, napeHairline: number): HairShape | null {
  if (h.style === 'bald') return null;
  const { H, poly, frame: fr } = g;
  const rnd = mulberry32(h.seed >>> 0);
  const tex = resolveTexture(h.style, h.texture);
  const [bAmp, bFreq] = TEX[tex] as [number, number];
  const iV = polyIndex(g, 'vertex');
  const hangs = h.style === 'bob' || h.style === 'long';
  const yNape = lerp(fr.f.inion * H + 0.2 * H, fr.f.inion * H + 0.02 * H, h.style === 'buzz' || h.style === 'short' || h.style === 'spiky' ? napeHairline : 0.3);
  const iN = poly.findIndex((p, i) => i < iV && p.y <= yNape);
  const yF = fr.f.hairline * H;
  let iF = poly.findIndex((p, i) => i > iV && p.y >= yF);
  if (iN < 0 || iV < 0) return null;
  if (iF < 0) iF = poly.length - 1;
  const seg = poly.slice(iN, iF + 1);
  const n = seg.length;
  const vol = 0.7 + 0.6 * h.volume;
  const tMax = BASE[h.style] * H * vol;
  const normal = (i: number): V2 => { const a = seg[Math.max(0, i - 1)] as V2, b = seg[Math.min(n - 1, i + 1)] as V2; const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; return { x: dy / l, y: -dx / l }; };
  const spikes = h.style === 'spiky' ? 7 : 0;
  const outer = seg.map((p, i) => {
    const s = i / (n - 1);
    // Épaisseur : s'annule au front ; à la nuque seulement pour les coiffures courtes (une chevelure tombante continue vers le bas, sans pincement).
    let t = tMax * Math.min(1, hangs ? 5 * (1 - s) : 4 * s * (1 - s)) ** 0.5;
    // Bord : ondulation (texture) ou pointes (spiky) ; amplitude proportionnelle à `curl` pour les textures bouclées.
    if (bAmp > 0) t += bAmp * H * (0.4 + 0.6 * h.curl) * Math.abs(Math.sin(s * bFreq * Math.PI + h.seed * 0.001)) * Math.min(1, 6 * s * (1 - s));
    if (spikes) t += 0.05 * H * vol * Math.max(0, 1 - Math.abs(((s * spikes) % 1) - 0.5) * 4) * Math.min(1, 6 * s * (1 - s));
    const nm = normal(i);
    return { x: p.x + nm.x * t, y: p.y + nm.y * t };
  });
  const por = fr.f.porion * H;
  const N = seg[0] as V2, F = seg[n - 1] as V2;
  const bottomSkull = hangs ? hairHangFrac(h, fr.f.jawY) * H + (rnd() - 0.5) * h.lengthVariance * 0.18 * H : N.y + 0.01 * H;
  const nk = g.neck;
  // Points d'angle (s = acuité) : la lisière du front (F) et les pointes du bas restent vives, tout le reste est lissé.
  const mass: CPoint[] = outer.map((p, i) => (i === n - 1 ? { ...p, s: 0.9 } : p));
  const extra: CPoint[][] = [];
  let bun: HairShape['bun'] = null;
  // Retour de la masse de F (implantation du front) vers l'oreille : devant l'oreille, sous elle (cachée), jusqu'au point E derrière le lobe.
  const E: V2 = { x: -0.085 * H, y: por + 0.075 * H };
  const inner: V2[] = [{ x: F.x - 0.14 * H, y: yF + 0.02 * H }, { x: 0.11 * H, y: por - 0.13 * H }, { x: 0.07 * H, y: por - 0.02 * H }, { x: -0.01 * H, y: por + 0.035 * H }, E];
  if (hangs && h.style === 'long') inner.splice(2, 3, { x: 0.05 * H, y: por + 0.05 * H }, { x: 0.02 * H, y: por + 0.1 * H });
  mass.push(...inner);
  if (hangs) {
    // Rideau (bob, long) : bord avant devant la nuque (`long` recouvre davantage le cou), bas irrégulier, bord arrière à distance de la nuque, remontée à N.
    const yE = Math.max(bottomSkull, E.y + 0.05 * H);
    const front = (y: number): number => nk.xBack(y) + nk.depth * (h.style === 'long' ? 0.6 : 0.25);
    const k = 6;
    const xb = nk.xBack(yE) - (0.03 + 0.05 * h.volume) * H;
    mass.push({ x: front(lerp(E.y, yE, 0.5)), y: lerp(E.y, yE, 0.5) }, { x: front(yE) + (rnd() - 0.5) * 0.01 * H, y: yE - 0.012 * H, s: 0.5 });
    for (let j = 1; j <= 3; j++) { const u = j / 4; mass.push({ x: lerp(front(yE), xb, u), y: yE + (rnd() * 0.03 + 0.005) * H * (h.lengthVariance + 0.3), s: 0.4 }); }
    // Bord arrière : part de la nuque (N) et rejoint, en douceur (smoothstep), l'arrière du cou décalé du volume ; ondulation du bord selon la texture.
    for (let i = k; i >= 0; i--) {
      const t = i / k, y = lerp(N.y, yE, t), sm = t * t * (3 - 2 * t);
      const target = nk.xBack(y) - (0.03 + 0.05 * h.volume) * H;
      mass.push({ x: lerp((outer[0] as V2).x, target, sm) + Math.sin(i * 1.7 + h.seed) * bAmp * H * sm, y });
    }
  } else mass.push({ x: N.x + 0.012 * H, y: N.y + 0.01 * H });
  // Queue / chignon / tresses.
  // Point d'attache : MÊME formule que `tieSpots` de la face (0 = niveau de la mâchoire − 0,1 H, 1 = au-dessus du sommet, exposant 0,8).
  const tieY = lerp((fr.f.jawY - 0.1) * H, -0.035 * H, h.tie.height ** 0.8);
  const tieX = (seg.reduce((a, p) => (Math.abs(p.y - tieY) < Math.abs(a.y - tieY) ? p : a), seg[0] as V2)).x;
  /** Ruban le long d'une ligne médiane : demi-largeur `w(t)` de chaque côté, selon la normale locale (pas un décalage vertical). */
  const ribbon = (c: V2[], w: (t: number) => number): CPoint[] => {
    const m = c.length;
    const nrm = (i: number): V2 => { const a = c[Math.max(0, i - 1)] as V2, b = c[Math.min(m - 1, i + 1)] as V2; const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; return { x: -dy / l, y: dx / l }; };
    const side = (k: number): CPoint[] => c.map((p, i) => ({ x: p.x + nrm(i).x * w(i / (m - 1)) * k, y: p.y + nrm(i).y * w(i / (m - 1)) * k, s: i === m - 1 ? 0.8 : 0 }));
    return [...side(1), ...side(-1).reverse()];
  };
  if (h.style === 'ponytail') {
    // Queue : attachée à la hauteur d'attache, part vers l'arrière puis retombe (courbe en S), s'effile en pointe ; épaisseur = `tie.thickness`.
    const len = (0.15 + 0.55 * h.tie.tail) * H, w0 = (0.022 + 0.05 * h.tie.thickness) * H;
    const c = Array.from({ length: 10 }, (_, i) => { const t = i / 9; return { x: tieX - 0.01 * H - (0.07 * Math.sin(t * Math.PI * 0.8) + 0.03 * t) * H * (0.6 + h.tie.tail), y: tieY + 0.02 * H + t * len }; });
    extra.push(ribbon(c, (t) => w0 * (1 - 0.82 * t ** 1.4) * (1 + 0.15 * Math.sin(t * 9))));
  } else if (h.style === 'bun') bun = { cx: tieX - (0.04 + 0.03 * h.tie.thickness) * H, cy: tieY - 0.02 * H, r: (0.05 + 0.05 * h.tie.thickness) * H };
  else if (h.style === 'braids') for (let b = 0; b < Math.min(2, h.braids.count); b++) {
    // Tresse : ruban dont la largeur alterne (maillons) et se resserre en bout ; accrochée à la nuque.
    const len = (0.2 + 0.55 * h.tie.tail) * H, w = (0.014 + 0.022 * h.braids.thickness) * H, x0 = tieX - (0.02 + 0.035 * b) * H, y0 = N.y + 0.01 * H;
    const c = Array.from({ length: 13 }, (_, i) => ({ x: x0 + 0.012 * H * Math.sin(i * 0.5 + b), y: y0 + (i / 12) * len }));
    extra.push(ribbon(c, (t) => w * (1 - 0.5 * t) * (1 + 0.28 * (Math.floor(t * 12) % 2 ? 1 : -1))));
  }
  // Frange : mèche qui retombe sur le front (jamais jusqu'au sourcil : la pointe reste au-dessus). Bord avant = front de la peau décalé d'une épaisseur de
  // cheveu ; bord arrière plus reculé pour `sweep` (balayage) et `curtain` (rideau, plus bas). Elle naît dans la masse (à 62 % de l'arc) : pas de coupure visible.
  if (h.fringe !== 'none' && h.style !== 'buzz') {
    const yTip = h.fringe === 'curtain' ? fr.f.eye * H - 0.09 * H : fr.f.supra * H + 0.01 * H;
    const i0 = Math.floor(n * 0.62);
    const k = seg.findIndex((p, i) => i > i0 && p.y >= yTip);
    const i1 = k < 0 ? n - 1 : k;
    const back = (h.fringe === 'sweep' ? 0.1 : h.fringe === 'curtain' ? 0.075 : 0.055) * H * vol;
    const fwd = seg.slice(i0, i1 + 1).map((p) => ({ x: p.x + 0.006 * H, y: p.y }));
    if (fwd.length > 2) {
      const L = fwd[fwd.length - 1] as V2;
      extra.push([...fwd, { x: L.x - back * 0.35, y: L.y + 0.012 * H }, { x: L.x - back * 0.8, y: L.y - 0.006 * H }, ...fwd.map((p, i) => ({ x: p.x - back * Math.min(1, 0.35 + (i / (fwd.length - 1)) * 0.65), y: p.y - 0.004 * H })).reverse()]);
    }
  }
  const strands: V2[][] = [];
  const ns = Math.round(3 + 8 * h.density);
  for (let k = 1; k <= ns; k++) { const r = k / (ns + 1); strands.push(seg.map((p, i) => ({ x: lerp(p.x, (outer[i] as V2).x, r), y: lerp(p.y, (outer[i] as V2).y, r) })).filter((_, i) => i % 3 === 0)); }
  const all = [...mass, ...extra.flat(), ...(bun ? [{ x: bun.cx, y: bun.cy - bun.r }, { x: bun.cx, y: bun.cy + bun.r }] : [])];
  const bottom = Math.max(...all.map((p) => p.y));
  return { style: h.style, texture: tex, mass, extra, bun, hairlineY: yF, napeY: N.y, bottom, top: Math.min(...all.map((p) => p.y)), dropH: (bottom - g.neck.throat.y) / H, strands };
}

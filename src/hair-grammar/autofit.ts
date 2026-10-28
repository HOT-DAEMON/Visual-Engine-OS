import { bladeOutline, makeBlade, type Blade } from './blade';
import { viewRayInHead, type HeadSpec, type View } from './head';
import { sampleLock, type HairProfile } from './grammar';
import { walk, type LockSpec } from './lock';
import { crescentPolygon, layerOfLock, strandLines } from './paint';
import { boxBlur, clearBuf, distance, fillPoly, inkPath, makeBuf, type Buf } from './raster';
import { clamp, prng, v3, type V2 } from './vec';

/**
 * AJUSTEMENT PAR SYNTHÈSE (analysis-by-synthesis) d'une coiffure sur une image de référence, sans dépendance ni gradient :
 * on rend la coiffure avec un rastériseur logiciel qui respecte l'ordre de peinture (couches back → visage → front → over),
 * on mesure l'écart à la référence, puis on perturbe UNE mèche à la fois (recherche locale à pas décroissants, avec mouvements
 * structurels : re-tirage, ajout, suppression). Le rendu SVG final reste celui de paint.ts : l'optimiseur ne change que les
 * paramètres de mèches (LockSpec), jamais la grammaire.
 *
 * PERTE = wR·rappel + wP·précision + wI·(1 − IoU de silhouette) + wT·écart de ton flou, avec
 *   rappel     : distance moyenne (plafonnée) de chaque pixel d'encre de la référence à l'encre du moteur ;
 *   précision  : distance moyenne (plafonnée) de chaque pixel d'encre du moteur à l'encre de la référence ;
 *   IoU        : recouvrement des silhouettes (cheveux + tête) au-dessus de `silRows` ;
 *   ton flou   : |gris moteur − gris référence| après flou de boîte (rend compte des gris doux et des masses noires).
 */
export interface FaceLayer { readonly alpha: Uint8Array; readonly gray: Uint8Array }
export interface FitTarget {
  /** Échelle de rastérisation (pixels par unité image), taille image (unités), gris de la référence à cette échelle. */
  readonly s: number; readonly w: number; readonly h: number; readonly refGray: Uint8Array;
  /** Lignes (unités image) comparées pour l'encre et le ton / pour la silhouette. */
  readonly inkRows: number; readonly silRows: number;
  /** Silhouette de la référence (1 = tête + cheveux), à l'échelle `s`. */
  readonly refInside: Uint8Array;
}
export interface Loss { readonly total: number; readonly recall: number; readonly precision: number; readonly iou: number; readonly tone: number; readonly low: number }
export interface FitOptions { readonly iters: number; readonly seed: number; readonly maxLocks: number; readonly minLocks: number; readonly onProgress?: (it: number, loss: Loss, n: number) => void }

const CAP = 5; // plafond de distance (pixels image)
const W = { recall: 1, precision: 1, iou: 2.2, tone: 2.5, low: 6 };
/** Ligne (unités image) sous laquelle les cheveux ne doivent pas descendre (cou/épaules : zone réservée aux vêtements). */
const LOW_ROW = 138;
const FACE_ID = 2000;
const grayOfTone = (t: number): number => (t <= -0.6 ? 38 : t < 0 ? 207 : 243);

interface Entry { spec: LockSpec; outline: V2[]; crescent: V2[]; strands: V2[][]; layer: 'back' | 'front' | 'over'; gray: number }

/** Paramètre mutable d'une mèche : borne, pas de base, accès fonctionnel (LockSpec est immuable). */
interface Param { readonly sigma: number; readonly lo: number; readonly hi: number; readonly get: (L: LockSpec) => number; readonly set: (L: LockSpec, v: number) => LockSpec }
const PARAMS: Param[] = [
  { sigma: 5, lo: 12, hi: 89, get: (L) => L.root.el, set: (L, v) => ({ ...L, root: { ...L.root, el: v } }) },
  { sigma: 9, lo: -180, hi: 180, get: (L) => L.root.az, set: (L, v) => ({ ...L, root: { ...L.root, az: v } }) },
  { sigma: 0.25, lo: -2, hi: 2, get: (L) => L.aim.x, set: (L, v) => ({ ...L, aim: v3(v, L.aim.y, L.aim.z) }) },
  { sigma: 0.25, lo: -2, hi: 2, get: (L) => L.aim.y, set: (L, v) => ({ ...L, aim: v3(L.aim.x, v, L.aim.z) }) },
  { sigma: 0.25, lo: -2, hi: 2, get: (L) => L.aim.z, set: (L, v) => ({ ...L, aim: v3(L.aim.x, L.aim.y, v) }) },
  { sigma: 0.1, lo: 0.12, hi: 1.25, get: (L) => L.length, set: (L, v) => ({ ...L, length: v }) },
  { sigma: 0.25, lo: -2.6, hi: 2.6, get: (L) => L.bend, set: (L, v) => ({ ...L, bend: v }) },
  { sigma: 0.12, lo: -1, hi: 1, get: (L) => L.wave.amp, set: (L, v) => ({ ...L, wave: { ...L.wave, amp: v } }) },
  { sigma: 0.3, lo: 0.3, hi: 3.2, get: (L) => L.wave.freq, set: (L, v) => ({ ...L, wave: { ...L.wave, freq: v } }) },
  { sigma: 0.2, lo: -2, hi: 3, get: (L) => L.wave.phase, set: (L, v) => ({ ...L, wave: { ...L.wave, phase: v } }) },
  { sigma: 0.35, lo: -2.2, hi: 2.2, get: (L) => L.flick.amt, set: (L, v) => ({ ...L, flick: { ...L.flick, amt: v } }) },
  { sigma: 0.06, lo: 0.06, hi: 0.5, get: (L) => L.flick.len, set: (L, v) => ({ ...L, flick: { ...L.flick, len: v } }) },
  { sigma: 0.02, lo: 0, hi: 0.2, get: (L) => L.lift0, set: (L, v) => ({ ...L, lift0: v }) },
  { sigma: 0.04, lo: 0, hi: 0.5, get: (L) => L.lift1, set: (L, v) => ({ ...L, lift1: v }) },
  { sigma: 0.12, lo: 0, hi: 1, get: (L) => L.gravity, set: (L, v) => ({ ...L, gravity: v }) },
  { sigma: 0.025, lo: 0.03, hi: 0.6, get: (L) => L.width, set: (L, v) => ({ ...L, width: v }) },
  { sigma: 0.08, lo: 0.15, hi: 0.75, get: (L) => L.peak, set: (L, v) => ({ ...L, peak: v }) },
  { sigma: 0.25, lo: 0.7, hi: 3.5, get: (L) => L.taper, set: (L, v) => ({ ...L, taper: v }) },
];
const TONES = [-0.5, 0.4, 1, 1];

export class Synth {
  readonly buf: Buf;
  private readonly entries: Entry[] = [];
  private readonly dist: Float32Array;
  private readonly refDist: Float32Array;
  private readonly refInkIdx: Int32Array;
  private readonly refBlur: Float32Array;
  private readonly engBlur: Float32Array;
  private readonly tmp: Float64Array;
  private readonly ray: { x: number; y: number; z: number };

  constructor(readonly head: HeadSpec, readonly view: View, readonly target: FitTarget, private readonly face: FaceLayer) {
    this.ray = viewRayInHead(view);
    const w = Math.round(target.w * target.s); const h = Math.round(target.h * target.s);
    this.buf = makeBuf(w, h);
    this.dist = new Float32Array(w * h); this.refDist = new Float32Array(w * h);
    this.refBlur = new Float32Array(w * h); this.engBlur = new Float32Array(w * h); this.tmp = new Float64Array((w + 1) * (h + 1));
    const rows = Math.min(h, Math.round(target.inkRows * target.s));
    const refInk = new Uint8Array(w * h); const idx: number[] = [];
    for (let i = 0; i < w * rows; i++) if ((target.refGray[i] as number) < 110) { refInk[i] = 1; idx.push(i); }
    this.refInkIdx = Int32Array.from(idx);
    distance(refInk, w, h, this.refDist);
    boxBlur(target.refGray, w, h, Math.round(3 * target.s), this.refBlur, this.tmp);
  }

  private build(spec: LockSpec): Entry {
    const blade: Blade = makeBlade(spec, walk(this.head, spec), this.view, this.ray);
    return { spec, outline: bladeOutline(blade), crescent: crescentPolygon(blade, spec.tone), strands: strandLines(blade, spec.strands), layer: layerOfLock(spec, blade), gray: grayOfTone(spec.tone) };
  }
  get specs(): LockSpec[] { return this.entries.map((e) => e.spec); }
  get count(): number { return this.entries.length; }
  load(specs: readonly LockSpec[]): void { this.entries.length = 0; for (const s of specs) this.entries.push(this.build(s)); }
  /** Remplace la mèche i (renvoie l'ancienne pour pouvoir annuler). */
  replace(i: number, spec: LockSpec): Entry { const old = this.entries[i] as Entry; this.entries[i] = this.build(spec); return old; }
  restore(i: number, e: Entry): void { this.entries[i] = e; }
  push(spec: LockSpec): void { this.entries.push(this.build(spec)); }
  pop(): void { this.entries.pop(); }
  removeAt(i: number): Entry { return this.entries.splice(i, 1)[0] as Entry; }
  insertAt(i: number, e: Entry): void { this.entries.splice(i, 0, e); }

  private paint(e: Entry, id: number): void {
    const s = this.target.s; const b = this.buf;
    fillPoly(b, e.outline, id, e.gray, s);
    fillPoly(b, e.crescent, id, 17, s, 1);
    inkPath(b, e.outline, s, true);
    for (const l of e.strands) inkPath(b, l, s);
  }

  /** Rend la scène complète dans `buf` : back → visage → front → over (ordre de génération à l'intérieur d'une couche). */
  render(): void {
    const b = this.buf; clearBuf(b);
    this.entries.forEach((e, i) => { if (e.layer === 'back') this.paint(e, i + 1); });
    for (let i = 0; i < b.id.length; i++) if ((this.face.alpha[i] as number) > 128) { const g = this.face.gray[i] as number; b.id[i] = FACE_ID; b.tone[i] = g; b.ink[i] = g < 110 ? 1 : 0; }
    this.entries.forEach((e, i) => { if (e.layer === 'front') this.paint(e, i + 1); });
    this.entries.forEach((e, i) => { if (e.layer === 'over') this.paint(e, i + 1); });
  }

  loss(): Loss {
    this.render();
    const { s } = this.target; const b = this.buf; const h = b.h;
    const rowsInk = Math.min(h, Math.round(this.target.inkRows * s)); const rowsSil = Math.min(h, Math.round(this.target.silRows * s));
    distance(b.ink, b.w, h, this.dist);
    const cap = CAP * s;
    let rec = 0;
    for (let k = 0; k < this.refInkIdx.length; k++) rec += Math.min(cap, this.dist[this.refInkIdx[k] as number] as number);
    rec /= Math.max(1, this.refInkIdx.length) * cap;
    let pre = 0; let nInk = 0;
    for (let i = 0; i < b.w * rowsInk; i++) if (b.ink[i]) { nInk++; pre += Math.min(cap, this.refDist[i] as number); }
    pre /= Math.max(1, nInk) * cap;
    let inter = 0; let uni = 0;
    for (let i = 0; i < b.w * rowsSil; i++) { const a = this.target.refInside[i] as number; const c = b.id[i] ? 1 : 0; inter += a & c; uni += a | c; }
    const iou = inter / Math.max(1, uni);
    boxBlur(b.tone, b.w, h, Math.round(3 * s), this.engBlur, this.tmp);
    let td = 0;
    for (let i = 0; i < b.w * rowsInk; i++) td += Math.abs((this.engBlur[i] as number) - (this.refBlur[i] as number));
    const tone = td / (b.w * rowsInk) / 255;
    // Garde anatomique intégrée à la perte : pixels de MÈCHES sous la ligne du cou (fraction de la largeur de l'image).
    let low = 0; const r0 = Math.min(h, Math.round(LOW_ROW * s));
    for (let i = r0 * b.w; i < b.w * h; i++) { const v = b.id[i] as number; if (v > 0 && v < FACE_ID) low++; }
    low /= b.w * 10 * s;
    return { total: W.recall * rec + W.precision * pre + W.iou * (1 - iou) + W.tone * tone + W.low * low, recall: rec, precision: pre, iou, tone, low };
  }
}

/** Perturbation gaussienne bornée de 1 à 3 paramètres d'une mèche (échelle `temp` ∈ ]0, 1]). */
function tweak(L: LockSpec, g: () => number, temp: number): LockSpec {
  let out = L; const k = 1 + Math.floor(g() * 3);
  for (let j = 0; j < k; j++) {
    const p = PARAMS[Math.floor(g() * PARAMS.length)] as Param;
    const gauss = (g() + g() + g() + g() - 2) * 1.7;
    out = p.set(out, clamp(p.get(out) + gauss * p.sigma * temp, p.lo, p.hi));
  }
  if (g() < 0.04) out = { ...out, tone: TONES[Math.floor(g() * TONES.length)] as number, strands: Math.floor(g() * 6) };
  return out;
}

/** Recherche locale : renvoie les meilleures mèches trouvées et la perte finale. */
export function fitLocks(P: HairProfile, synth: Synth, start: readonly LockSpec[], o: FitOptions): { specs: LockSpec[]; loss: Loss } {
  const g = prng(o.seed);
  synth.load(start);
  let cur = synth.loss();
  let uid = 0;
  for (let it = 1; it <= o.iters; it++) {
    const temp = 1 - 0.85 * (it / o.iters);
    const r = g();
    const n = synth.count;
    if (r < 0.84 || n < 3) {
      const i = Math.floor(g() * n);
      const old = synth.replace(i, tweak(synth.specs[i] as LockSpec, g, temp));
      const l = synth.loss();
      if (l.total < cur.total) cur = l; else synth.restore(i, old);
    } else if (r < 0.9) { // re-tirage complet d'une mèche (saut structurel)
      const i = Math.floor(g() * n); const F = P.families.find((f) => f.id === (synth.specs[i] as LockSpec).family) ?? (P.families[0] as typeof P.families[number]);
      const old = synth.replace(i, { ...sampleLock(P, F, i, g), id: `${F.id}-r${uid++}` });
      const l = synth.loss();
      if (l.total < cur.total) cur = l; else synth.restore(i, old);
    } else if (r < 0.95) { // ajout
      if (n >= o.maxLocks) continue;
      const F = P.families[Math.floor(g() * P.families.length)] as typeof P.families[number];
      synth.push({ ...sampleLock(P, F, n, g), id: `${F.id}-a${uid++}` });
      const l = synth.loss();
      if (l.total < cur.total - 1e-5) cur = l; else synth.pop();
    } else { // suppression (élagage : accepté si la perte n'augmente presque pas)
      if (n <= o.minLocks) continue;
      const i = Math.floor(g() * n);
      const old = synth.removeAt(i);
      const l = synth.loss();
      if (l.total <= cur.total + 2e-4) cur = l; else synth.insertAt(i, old);
    }
    if (o.onProgress && it % 2000 === 0) o.onProgress(it, cur, synth.count);
  }
  return { specs: synth.specs, loss: cur };
}

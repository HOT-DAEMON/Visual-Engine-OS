import { halfWidthAt, type FaceLandmarks, type NoseGeometry } from '../face';
import { REGION } from '../relief/field';
import type { HeadLit } from '../relief/overlay';
import type { LightPattern } from '../relief/patterns';
import { toLab } from '../relief/oklab';
import type { VCheck, VReport } from './volume';

/**
 * COUCHE DE VÉRIFICATION DE L'ÉCLAIRAGE (3 couches) : géométrie du relief et des ombres portées, cohérence anatomique des ombres, fidélité de style aux références.
 * Les bornes de style viennent des MESURES (`references/shadow/lighting-stats.json`) : écart de clarté OKLab cel 0,21–0,30 (planches 01, 06), peint 0,40–0,50
 * (02, 03, 04, 05, 10). Les bornes de géométrie sont des proportions de crâne (`W` = largeur de tête). Aucune borne n'a été ajustée sur le résultat d'un contrôle négatif.
 */
const chk = (id: string, layer: VCheck['layer'], ok: boolean, detail: string): VCheck => ({ id, layer, ok, detail });
const FACE = new Set<number>([REGION.skull, REGION.orbit, REGION.nose, REGION.cheek, REGION.mouth, REGION.chin]);
export type LitStats = Readonly<Record<'left' | 'right' | 'top' | 'bottom' | 'orbit' | 'neck' | 'face' | 'transition' | 'shadow' | 'neckCast' | 'neckTop', number>>;
const nan = Number.NaN;
/** Part éclairée moyenne par zone (`neckTop` : bande centrale de 0,05 H sous le menton) (0 = ombre, 1 = lumière), sur la grille du relief ; `transition` = part des pixels de visage ni éclairés ni à l'ombre (0,1 < lit < 0,9). */
export function litStats(h: HeadLit, lm: FaceLandmarks): LitStats {
  const f = h.field, acc: Record<string, [number, number]> = {}, add = (k: string, v: number): void => { const a = (acc[k] ??= [0, 0]); a[0] += v; a[1]++; };
  for (let j = 0; j < f.h; j++) {
    const y = f.y0 + (j + 0.5) / f.ppu;
    for (let i = 0; i < f.w; i++) {
      const k = j * f.w + i, r = f.region[k]!; if (f.depth[k] === -Infinity) continue;
      const x = f.x0 + (i + 0.5) / f.ppu, v = h.lit[k]!;
      if (r === REGION.neck && y > lm.chinY) { add('neck', v); if (y < lm.chinY + 0.05 * lm.H && Math.abs(x) < 0.5 * lm.neck.half) { add('neckCast', h.cast[k]!); add('neckTop', v); } }
      if (!FACE.has(r)) continue;
      add('face', v); add('shadow', v < 0.5 ? 1 : 0); add('transition', v > 0.1 && v < 0.9 ? 1 : 0);
      if (x < -0.04 * lm.W) add('left', v); else if (x > 0.04 * lm.W) add('right', v);
      if (y < lm.browLimitY) add('top', v); if (y > lm.mouthY) add('bottom', v);
      if (r === REGION.orbit && Math.abs(y - lm.eyeY) < 0.06 * lm.H) add('orbit', v);
    }
  }
  const m = (k: string): number => (acc[k] && acc[k]![1] > 30 ? acc[k]![0] / acc[k]![1] : nan);
  return { left: m('left'), right: m('right'), top: m('top'), bottom: m('bottom'), orbit: m('orbit'), neck: m('neck'), face: m('face'), transition: m('transition'), shadow: m('shadow'), neckCast: m('neckCast'), neckTop: m('neckTop') };
}
const inR = (v: number, r: readonly [number, number]): boolean => !Number.isNaN(v) && v >= r[0] && v <= r[1];
const at = (h: HeadLit, x: number, y: number): number => { const f = h.field, i = Math.floor((x - f.x0) * f.ppu), j = Math.floor((y - f.y0) * f.ppu); return i < 0 || j < 0 || i >= f.w || j >= f.h ? -Infinity : f.depth[j * f.w + i]!; };
export function verifyLit(h: HeadLit, lm: FaceLandmarks, nose: NoseGeometry, pattern?: LightPattern): VReport {
  const C: VCheck[] = [], W = lm.W, f = h.field, st = litStats(h, lm), m = h.model;
  // ── GÉOMÉTRIE ──
  let dev = 0, nzMin = 1, n = 0; for (let k = 0; k < f.depth.length; k += 97) if (f.depth[k] !== -Infinity) { dev = Math.max(dev, Math.abs(Math.hypot(f.nx[k]!, f.ny[k]!, f.nz[k]!) - 1)); nzMin = Math.min(nzMin, f.nz[k]!); n++; }
  C.push(chk('lit.geo.normals', 'geometry', n > 100 && dev < 1e-3 && nzMin > 0, `${n} normales échantillonnées : écart à 1 = ${dev.toExponential(1)}, nz min = ${nzMin.toFixed(2)} (> 0 : surface vue de face)`));
  // Les échantillons doivent être FINIS (un point hors du relief rendrait la comparaison vacuement vraie : défaut trouvé sur la première version de ce contrôle).
  const cy = (lm.eyeY + lm.mouthY) / 2, tip = at(h, nose.tip.c.x, nose.tip.c.y), cheek = at(h, 0.5 * halfWidthAt(lm.outline, cy), cy), brow = at(h, 0, lm.eyeY - 0.12 * lm.H);
  C.push(chk('lit.geo.nose-proud', 'geometry', [tip, cheek, brow].every(Number.isFinite) && tip - cheek >= 0.05 * W && tip > brow, `pointe − joue = ${((tip - cheek) / W).toFixed(3)} W (≥ 0,05, échantillons finis : ${[tip, cheek, brow].every(Number.isFinite)}) ; pointe devant le front : ${tip > brow}`));
  const chinZ = at(h, 0, lm.chinY - 0.03 * lm.H), neckZ = at(h, 0, lm.chinY + 0.1 * lm.H);
  C.push(chk('lit.geo.chin-overhang', 'geometry', Number.isFinite(chinZ) && Number.isFinite(neckZ) && chinZ - neckZ >= 0.1 * W, `menton − cou = ${((chinZ - neckZ) / W).toFixed(3)} W (≥ 0,10 : c'est ce surplomb qui projette l'ombre du menton)`));
  const hl = Math.hypot(m.dir.x, m.dir.y); let sx = 0, sy = 0, sn = 0;
  if (m.dir.z > 0.05 && hl > 0.05) for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) { const x = f.x0 + (i + 0.5) / f.ppu, y = f.y0 + (j + 0.5) / f.ppu, k = j * f.w + i; if (Math.abs(x) < 0.35 * W && y > nose.root.y && y < lm.noseBaseY + 0.08 * lm.H && h.cast[k]! > 0.5) { sx += x - nose.tip.c.x; sy += y - nose.tip.c.y; sn++; } }
  const along = sn > 20 ? (sx * m.dir.x + sy * m.dir.y) / (Math.hypot(sx, sy) * hl) : nan;
  C.push(chk('lit.geo.cast-direction', 'geometry', Number.isNaN(along) || along < -0.3, sn > 20 ? `ombre portée du nez : cosinus avec la direction de la lumière = ${along.toFixed(2)} (< −0,3 : elle tombe à l'opposé de la source)` : 'pas d\'ombre portée du nez pour cette lumière (frontale ou rasante) : sans objet'));
  // ── ANATOMIE ──
  if (m.dir.y < -0.55 && m.dir.z > 0.4) C.push(chk('lit.ana.chin-shadows-neck', 'anatomy', st.neckCast >= 0.4, `lumière venant d'en haut : ombre portée sur la bande centrale juste sous le menton (0,05 H) = ${(st.neckCast * 100).toFixed(0)} % (≥ 40 %)`));
  if (pattern) for (const [k, r] of Object.entries(pattern.expect) as [keyof LitStats, readonly [number, number]][]) C.push(chk(`lit.ana.pattern.${pattern.id}.${k}`, 'anatomy', inR(st[k], r), `motif « ${pattern.label} » (réf. ${pattern.ref}) : part éclairée ${k} = ${st[k].toFixed(2)}, attendu ${r[0]}–${r[1]}`));
  // ── STYLE ──
  const cel = m.style !== 'soft', dl = toLab(h.tones.lit).L - toLab(h.tones.shadow).L, ls = toLab(h.tones.lit), ss = toLab(h.tones.shadow);
  C.push(chk('lit.style.delta-L', 'style', cel ? dl >= 0.15 && dl <= 0.4 : dl >= 0.2 && dl <= 0.6, `écart de clarté OKLab lumière − ombre = ${dl.toFixed(2)} (réf. cel 0,21–0,30 ; peint 0,40–0,50) ; borne ${cel ? '0,15–0,40' : '0,20–0,60'}`));
  const cL = Math.hypot(ls.a, ls.b), cS = Math.hypot(ss.a, ss.b);
  C.push(chk('lit.style.shadow-hue', 'style', h.tones.imposed ? Math.abs(((Math.atan2(ss.b, ss.a) - Math.atan2(ls.b, ls.a)) * 180) / Math.PI) < 75 : m.shadowHue === 'cool' ? ss.b < ls.b - 0.015 : cS >= cL * 1.05, h.tones.imposed ? `teinte d'ombre IMPOSÉE par l'apparence : dans la famille de la lumière (écart de teinte < 75°, règle style/shadow-near-main)` : m.shadowHue === 'cool' ? `ombre froide : b OKLab ${ss.b.toFixed(3)} < ${ls.b.toFixed(3)} − 0,015` : `ombre chaude : chroma ${cS.toFixed(3)} ≥ 1,05 × ${cL.toFixed(3)} (diffusion sous-cutanée)`));
  C.push(chk('lit.style.edges', 'style', cel ? st.transition <= 0.1 : st.transition >= 0.04 || st.shadow < 0.05, `part de pixels en transition (0,1 < lit < 0,9) = ${(st.transition * 100).toFixed(1)} % ; ${cel ? 'cel : bords nets, ≤ 10 %' : 'peint : terminateur progressif, ≥ 4 % (ou aucune ombre)'}`));
  if (!pattern || pattern.id !== 'frontal') C.push(chk('lit.style.readable', 'style', st.shadow >= 0.08 && st.shadow <= 0.92, `part de visage à l'ombre = ${(st.shadow * 100).toFixed(0)} % (lumière ET ombre lisibles : 8–92 %)`));
  const lum = (c: { L: number }): number => c.L; C.push(chk('lit.style.never-black', 'style', lum(toLab(h.tones.core)) > 0.2, `ton de cœur d'ombre : clarté OKLab ${toLab(h.tones.core).L.toFixed(2)} (> 0,20 : jamais d'encre noire)`));
  return { ok: C.every((c) => c.ok), checks: C, failures: C.filter((c) => !c.ok) };
}

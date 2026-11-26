import { bladeOutline, makeBlade, smoothPath, type Blade } from './blade';
import { viewRayInHead, type HeadSpec, type View } from './head';
import { localGeometry, lightScreen, LIGHT, occlusionProfile, type Light, type LockGeom } from './local-geometry';
import { walk, type LockSpec } from './lock';
import { relationsOf } from './occlusion';
import { renderResolved, type ResolvedPainting } from './occlusion-paint';
import { peakShadeOpacity } from '../core/shade';
import { ringBands, type RingBands } from './spec-ring';
import { shoulderOpacityFor } from './ring-tone';
import { shadeMarkup } from './ring-shade';
import { ringIsSane } from './ring-check';
import { INK, fillOf, layerOfLock, strandLines, type PaintStyle, type PaintedLock } from './paint';
import type { V2 } from './vec';

/**
 * FINITION PICTURALE PILOTÉE PAR LA GÉOMÉTRIE LOCALE (grammaire de finition, étage 2). Là où `paint.ts` pose trois aplats, un croissant
 * fixe et une encre commune, ici chaque bande est calculée à partir de `LockGeom` (fournie par la géométrie, pas inventée) :
 *  - REFLET : ruban parallèle à l'axe, collé au bord éclairé (normale 2D · lumière), largeur ∝ exposition, étranglé quand le ruban est
 *    vu par la tranche (|cos φ|), éteint et déplacé quand on voit le dessous ; opacité réduite près d'un recouvrement (occlusion) ;
 *  - OMBRE PROPRE : bande côté opposé à la lumière, plus large quand l'exposition baisse et près des recouvrements ;
 *  - ENCRE : contour plein ; brins fins comme avant. Une mèche torsadée reçoit donc un reflet cassé, une mèche plate un reflet continu.
 */
/**
 * `ring` : reflet TRANSVERSAL de `spec-ring.ts` (référence 60). Absent ou `'off'` : rendu historique, au bit près. `'replace'` : l'anneau remplace le reflet longitudinal ; `'add'` : les deux (le longitudinal joue alors le liseré de bord).
 */
export interface ProStyle extends PaintStyle {
  readonly shadow: string; readonly highlight: string; readonly ring?: 'off' | 'replace' | 'add';
  /**
   * Ombre aval du reflet transversal. `profile` : `'smooth'` (défaut, passe 8) = dégradé au profil mesuré (`ring-shade.ts`), opacité de CRÊTE selon le ton (`core/shade.ts`) ou `opacity` s'il est donné ;
   * `'steps'` = trois paliers à bords durs des passes 6–7, `opacity` = opacité PAR palier (défaut : selon le ton, `ring-tone.ts`). `{ profile: 'steps', len: 0.2, opacity: 0.12 }` rend l'ombre de la passe 6.
   * `len` : longueur de l'ombre (fraction de la mèche), défaut `RING.shoulderLen`.
   */
  readonly shoulder?: { readonly len?: number; readonly opacity?: number; readonly profile?: 'smooth' | 'steps' };
  /**
   * Amplitude de la dentelure des bords du reflet transversal (passe 9). Absent ou 1 : les dents mesurées sur l'ENCRE de la référence 60 (rendu historique, au bit près). 0 : bords lisses.
   * Le rendu principal est lisse, pas à l'encre : une bande de 6 px à 1,5 px de dentelure s'y dessinait en « W » blanc (mesuré : 7 à 15 inversions de convexité sur 20 points ; une bande saine en a 0 à 2).
   */
  readonly ringJag?: number;
  /** Forme du reflet transversal (passe 9) : 0 ou absent = rectangle (historique) ; 1 = lentille aux bouts pointus (les références 06, 19, 21 : un reflet est une lentille qui s'effile, pas un rectangle). */
  readonly ringLens?: number;
}
export const INK_PRO: ProStyle = { ...INK, shadow: '#35353b', highlight: '#ffffff' };
/** Style de PASSAGE vers le rendu principal (`interop.ts`) : reflet transversal par mèche (`replace`), bords lisses. Les couleurs viennent du moteur d'apparence, pas de ce style. */
export const MAIN_PRO: ProStyle = { ...INK_PRO, ring: 'replace', ringJag: 0, ringLens: 0.85 };
/** `ring` : reflet transversal retenu par la garde de rendu (`ringIsSane`) ; absent si `st.ring` est `'off'`/absent ou si la garde l'a refusé — le rendu principal le dessine alors à son tour (`interop.ts` → `HairLockGeom.ring`). */
export interface ProLock extends PaintedLock { readonly geom: LockGeom; readonly ring?: RingBands }

/** Point de la lame à l'échantillon i, position latérale u ∈ [−1, 1] (+1 = bord gauche dans le sens racine → pointe). */
const at = (b: Blade, g: LockGeom, i: number, u: number): V2 => { const p = b.spine[i] as V2; const nrm = g.normal[i] as V2; const w = b.half[i] as number; return { x: p.x + nrm.x * u * w, y: p.y + nrm.y * u * w }; };

/** Bande latérale [uc − hw, uc + hw] le long de t, aux échantillons où `hw(i) > ε`, en polygone fermé. */
function band(b: Blade, g: LockGeom, uc: (i: number) => number, hw: (i: number) => number): V2[] | null {
  const A: V2[] = []; const B: V2[] = [];
  for (let i = 0; i < g.n; i++) { const h = hw(i); if (h < 0.02) continue; const c = uc(i); A.push(at(b, g, i, Math.max(-0.96, Math.min(0.96, c - h)))); B.push(at(b, g, i, Math.max(-0.96, Math.min(0.96, c + h)))); }
  return A.length >= 4 ? [...A, ...B.reverse()] : null;
}

export function paintLockPro(h: HeadSpec, L: LockSpec, view: View, st: ProStyle = INK_PRO, light: Light = LIGHT, occ?: number[]): ProLock {
  const ray = viewRayInHead(view); const samples = walk(h, L); const blade = makeBlade(L, samples, view, ray);
  const layer = layerOfLock(L, blade); const geom = localGeometry(h, L, blade, view, light, occ); const l2 = lightScreen(view, light);
  const n = geom.n; const env = (i: number): number => Math.sin((Math.PI * i) / (n - 1)) ** 0.7;
  const twisted = !!L.program && geom.twist.some((x) => Math.abs(x) > 0.2);
  const face = (i: number): number => (twisted ? Math.abs(Math.cos(geom.twist[i] as number)) ** 1.2 : 1);
  const side = (i: number): number => { const o = (geom.normal[i] as V2).x * l2.x + (geom.normal[i] as V2).y * l2.y; return geom.backface[i] ? -o : o; };
  const parts: string[] = [`<path d="${smoothPath(bladeOutline(blade), true)}" fill="${fillOf(L.tone, st)}" stroke="${st.ink}" stroke-width="${st.lineW}" stroke-linejoin="round"/>`];
  // Ombre propre : côté opposé à la lumière ; s'élargit quand l'exposition baisse et près des recouvrements.
  const sh = band(blade, geom, (i) => -side(i) * 0.55, (i) => env(i) * (0.1 + 0.2 * (1 - (geom.exposure[i] as number)) + 0.2 * (geom.occlusion[i] as number)) * (L.tone < -0.6 ? 0.5 : 1));
  if (sh) parts.push(`<path d="${smoothPath(sh, true)}" fill="${st.shadow}" opacity="0.3"/>`);
  // Reflet : collé au bord éclairé, largeur ∝ exposition × |cos φ|, éteint sur le dessous du ruban.
  const hi = band(blade, geom, (i) => side(i) * 0.5, (i) => env(i) * (0.07 + 0.2 * (geom.exposure[i] as number) ** 2) * face(i) * (L.tone < -0.6 ? 0.6 : 1));
  if (hi && st.ring !== 'replace') { const e = geom.exposure.reduce((a, b) => a + b, 0) / n; const back = geom.backface.filter(Boolean).length / n; parts.push(`<path d="${smoothPath(hi, true)}" fill="${st.highlight}" opacity="${Math.max(0.15, (0.35 + 0.6 * e) * (1 - 0.7 * back)).toFixed(2)}"/>`); }
  let kept: RingBands | undefined;
  if (st.ring === 'replace' || st.ring === 'add') {
    const r = ringBands(blade, geom, L, view, light, st.shoulder?.len, st.ringJag, st.ringLens);
    // Garde de rendu : un reflet qui sort de la lame, n'est pas transverse, est sur le dessous, trop peu exposé ou trop large (`ring-check.ts`) n'est pas dessiné ; la mèche n'a alors pas de reflet.
    if (r && ringIsSane({ spec: L, blade, geom }, r)) {
      kept = r;
      // Zone sombre aval d'abord, puis la bande par-dessus. Le creux relatif mesuré (−33 %) vaut pour toutes les teintes : l'opacité dépend du ton ; 0 sous un remplissage plus sombre que l'ombre (elle l'éclaircirait).
      if ((st.shoulder?.profile ?? 'smooth') === 'smooth') parts.push(shadeMarkup(r.shade, st.shoulder?.opacity ?? peakShadeOpacity(fillOf(L.tone, st), st.shadow), st.shadow)); // dégradé lisse (passe 8)
      else { const so = st.shoulder?.opacity ?? shoulderOpacityFor(fillOf(L.tone, st), st.shadow); if (so > 0) for (const q of r.shoulder) parts.push(`<path d="${smoothPath(q, true)}" fill="${st.shadow}" opacity="${so.toFixed(3)}"/>`); } // trois paliers (passes 6–7)
      parts.push(`<path d="${r.highlight.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join('')}Z" fill="${st.highlight}" opacity="${(0.55 + 0.4 * r.strength).toFixed(2)}"/>`);
    }
  }
  for (const line of strandLines(blade, L.strands)) parts.push(`<path d="${smoothPath(line)}" fill="none" stroke="#111" stroke-width="0.4" opacity="0.5"/>`);
  return { spec: L, blade, layer, svg: parts.join(''), geom, ...(kept ? { ring: kept } : {}) };
}

/** Coiffure complète en finition pilotée par la géométrie locale, occlusion locale incluse (mèches émergentes et groupes de tressage). */
export function paintHairPro(h: HeadSpec, specs: readonly LockSpec[], view: View, st: ProStyle = INK_PRO, light: Light = LIGHT, mode: 'weave' | 'all' = 'weave'): ResolvedPainting & { readonly geoms: LockGeom[] } {
  const pre = specs.map((L) => paintLockPro(h, L, view, st, light)); const rel = relationsOf(pre, mode === 'all');
  const fin = specs.map((L, i) => paintLockPro(h, L, view, st, light, occlusionProfile(i, pre[i]?.geom.n ?? 40, rel)));
  return { ...renderResolved(fin, st, mode, rel), geoms: fin.map((p) => p.geom) };
}

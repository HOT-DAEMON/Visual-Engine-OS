import type { BodyInput, NeckAnchor } from '../body';
import { reveal, tierOf } from '../body/muscle-tiers';
import { renderVolumes, type VolumeSet } from '../body/volume';
import type { VCheck, VReport } from './volume';

const chk = (id: string, layer: VCheck['layer'], ok: boolean, detail: string): VCheck => ({ id, layer, ok, detail });
const ext = (v: { stations: readonly { c: { x: number; y: number } }[] }, k: 'x' | 'y'): { lo: number; hi: number; mid: number } => { const a = v.stations.map((s) => s.c[k]); const lo = Math.min(...a), hi = Math.max(...a); return { lo, hi, mid: (lo + hi) / 2 }; };

/**
 * VÉRIFICATION DU DOS (itération 04) en 3 couches — omoplate, colonne/axe du tronc, rendu. Chaque contrôle est nommé, chiffré et reproductible.
 *  GÉOMÉTRIE : paire d'omoplates symétrique, centrée sur le côté du dos (ni à la ligne médiane, ni hors du tronc), sections finies.
 *  ANATOMIE  : hauteur de la lame en vertèbres (T2→T7/T8 ≈ 5,5), angle inférieur sous l'épine, épine oblique vers le haut et en dehors, axe C7→crête vertical, surface avant verticale (ref-04 : −1°).
 *  STYLE     : la lame (os) reste cachée par défaut sous les muscles ; le relief de surface (épine, infra-épineux, grand rond) est dessiné ; `showHidden` la révèle.
 */
export function verifyBack(set: VolumeSet, _raw: BodyInput, _a: NeckAnchor): VReport {
  void _raw; void _a;
  const C: VCheck[] = [], m = set.measures, H = m.h as number, acrX = Math.abs(set.landmarks.get('acromion.L')!.x), c7Y = m.c7Y as number, t12Y = m.t12Y as number;  // niveaux OSSEUX (axe vertébral) : les sphères d'articulation, décalées le long de la normale, ne sont pas des repères de niveau
  const sL = set.byId.get('scapula.L'), sR = set.byId.get('scapula.R'), spL = set.byId.get('scapular-spine.L');
  // ── Géométrie ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  C.push(chk('back.geo.scapula-pair', 'geometry', !!sL && !!sR && !!spL, sL && sR ? 'omoplates gauche et droite présentes' : 'omoplate manquante'));
  if (sL && sR && spL) {
    const xl = Math.abs(ext(sL, 'x').mid), xr = Math.abs(ext(sR, 'x').mid), ratio = xl / acrX;
    C.push(chk('back.geo.scapula-symmetry', 'geometry', Math.abs(xl - xr) <= 0.08 * H, `distance à la ligne médiane G ${(xl / H).toFixed(2)} h · D ${(xr / H).toFixed(2)} h (écart ≤ 0,08 h : le contrapposto décale légèrement)`));
    C.push(chk('back.geo.scapula-lateral', 'geometry', ratio > 0.3 && ratio < 0.8, `centre de la lame à ${ratio.toFixed(2)} × la demi-largeur des épaules (bande 0,30–0,80 : ni sur la colonne ni hors du tronc)`));
    const ok = sL.stations.every((s) => [s.c.x, s.c.y, s.c.z, s.a, s.b].every(Number.isFinite) && s.a > 0 && s.b > 0);
    C.push(chk('back.geo.scapula-finite', 'geometry', ok, `${sL.stations.length} sections finies et > 0`));
    // ── Anatomie ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
    const u = (t12Y - c7Y) / 12, yb = ext(sL, 'y'), hv = (yb.hi - yb.lo) / u, inf = (yb.hi - c7Y) / u;
    C.push(chk('back.ana.scapula-height', 'anatomy', hv > 4.2 && hv < 6.8, `hauteur de la lame ${hv.toFixed(1)} vertèbres thoraciques (T2→T7/T8 ≈ 5,5 ; bande 4,2–6,8)`));
    C.push(chk('back.ana.inferior-angle-level', 'anatomy', inf > 7 && inf < 10.5, `angle inférieur à ${inf.toFixed(1)} vertèbres sous C7 (T7–T9 ; bande 7–10,5)`));
    const a0 = spL.stations[0]!.c.y, a1 = spL.stations[spL.stations.length - 1]!.c.y;
    C.push(chk('back.ana.spine-oblique', 'anatomy', a0 > a1, `épine : racine y=${a0.toFixed(0)} plus basse que son extrémité latérale y=${a1.toFixed(0)} (oblique vers le haut et en dehors)`));
  }
  const lean = m.trunkLeanDeg as number, fl = m.frontLineDeg as number;
  C.push(chk('back.ana.trunk-axis-vertical', 'anatomy', Math.abs(lean) <= 4, `axe C7→crête incliné de ${lean.toFixed(1)}° (bande ±4°)`));
  C.push(chk('back.ana.front-line-vertical', 'anatomy', Math.abs(fl) <= 8, `ligne avant poitrine→crête à ${fl.toFixed(1)}° (ref-04 : −1° ; bande ±8°, le buste féminin et le ventre l'écartent)`));
  // ── Style ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const ids = new Set(renderVolumes(set, { skin: '#c99a76', uid: 'bk' }).ids), idsAll = new Set(renderVolumes(set, { skin: '#c99a76', uid: 'bk2', showHidden: true }).ids);
  C.push(chk('back.sty.blade-hidden', 'style', !ids.has('scapula.L') && !ids.has('scapula.R') && idsAll.has('scapula.L'), 'lame cachée par défaut, révélée par showHidden'));
  // Le relief suit la hiérarchie de paliers : un muscle de palier 3 n'est dessiné que si la musculature du corps l'atteint (enfant, silhouette fine : non) ; l'os de l'épine (palier 3, kind bone) l'est toujours.
  const tr = tierOf(m.vis as number), want = (id: string): boolean => { const v = set.byId.get(id); return !!v && (v.kind !== 'muscle' || v.tier === undefined || reveal(tr, v.tier) >= 0.04); };
  const rel = ['scapular-spine.L', 'infraspinatus.L', 'teres-major.L'], bad = rel.filter((id) => ids.has(id) !== want(id));
  C.push(chk('back.sty.relief-drawn', 'style', bad.length === 0 && ids.has('scapular-spine.L'), bad.length ? `incohérent avec le palier : ${bad.join(',')}` : `relief dessiné selon le palier ${tr.toFixed(1)} : ${rel.filter((i) => ids.has(i)).length}/3 volumes (épine toujours)`));
  const failures = C.filter((c) => !c.ok);
  return { ok: failures.length === 0, checks: C, failures };
}

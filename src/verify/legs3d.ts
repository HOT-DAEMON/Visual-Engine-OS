import type { Atom, BodyInput, NeckAnchor } from '../body';
import { legGeometry } from '../body/lower/geometry';
import type { LegInput } from '../body/lower/types';
import { renderVolumesPixel, type Volume, type VolumeSet } from '../body/volume';
import { ringPoint } from '../body/volume/loft';
import type { VCheck, VReport } from './volume';

const chk = (id: string, layer: VCheck['layer'], ok: boolean, detail: string): VCheck => ({ id, layer, ok, detail });
const fmt = (v: number, H: number): string => (v / H).toFixed(3);
/** Étendues (x, z) des sections d'un ensemble de volumes à la hauteur y : la section est INTERPOLÉE exactement là où l'axe du volume coupe y (pas d'échantillonnage de tranche). `tol` est conservé pour la compatibilité d'appel et ignoré. */
function slab(vs: readonly Volume[], y: number, _tol?: number): { x0: number; x1: number; z0: number; z1: number } | null {
  void _tol;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const v of vs) for (let i = 0; i < v.stations.length - 1; i++) {
    const A = v.stations[i]!, B = v.stations[i + 1]!, lo = Math.min(A.c.y, B.c.y), hi = Math.max(A.c.y, B.c.y);
    if (y < lo || y > hi || hi - lo < 1e-9) continue;
    const t = (y - A.c.y) / (B.c.y - A.c.y), L = (p: number, q: number): number => p + (q - p) * t;
    const S = { c: { x: L(A.c.x, B.c.x), y, z: L(A.c.z, B.c.z) }, a: L(A.a, B.a), b: L(A.b, B.b), t: A.t, u: { x: L(A.u.x, B.u.x), y: L(A.u.y, B.u.y), z: L(A.u.z, B.u.z) }, w: { x: L(A.w.x, B.w.x), y: L(A.w.y, B.w.y), z: L(A.w.z, B.w.z) } };
    for (let q = 0; q < 24; q++) { const p = ringPoint(S, (q / 24) * 2 * Math.PI).p; x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
  }
  return Number.isFinite(x0) ? { x0, x1, z0, z1 } : null;
}
const mid = (v: Volume): { c: Volume['stations'][number]['c'] } => ({ c: v.stations[(v.stations.length / 2) | 0]!.c });
const SIDES = ['L', 'R'] as const;
/** Atomes 2D du bas du corps qui DOIVENT avoir un volume 3D de même identifiant (une seule source). Les lignes de repère (plis, ligaments) restent 2D ; les tendons du pied sont portés. */
export const PORTED_2D = (a: Atom): boolean => !a.id.startsWith('pelvis.') && a.part !== 'pelvis' && (['muscle', 'bone', 'landmark', 'nail', 'fat'].includes(a.kind) || /^foot\.(toe\.\d|dorsum|tendon\.\d)/.test(a.id));
/**
 * VÉRIFICATION DES JAMBES 3D (itération 06), 3 couches. `legs` = les MÊMES paramètres que ceux passés à `bodyVolumes({ legs })`.
 *  GÉOMÉTRIE : parité d'identifiants avec le module 2D (source unique) · cotes 3D = cotes de `legGeometry` · muscles dans la coque de peau · symétrie · pied.
 *  ANATOMIE  : compartiments (quadriceps devant, ischio-jambiers derrière, mollet derrière) · rotule/tubérosité/tête du péroné · malléole latérale plus distale · orteils décroissants, gros orteil médial · origines/insertions.
 *  STYLE     : même pipeline que le haut du corps (kinds, couches, peau fusionnée) · rendu image : relief des cuisses du même ordre que celui du tronc (pas de tubes lisses sous un tronc sculpté) · aucun trou.
 */
export function verifyLegs3D(set: VolumeSet, raw: BodyInput, a: NeckAnchor, legs: LegInput = {}): VReport {
  const C: VCheck[] = [], vs = set.volumes, H = set.measures.h as number, lg = legGeometry(raw, legs, a), lf = lg.frame, by = set.byId, g = (id: string): Volume | undefined => by.get(id);
  const leg = vs.filter((v) => v.group === 'leg' || v.group === 'foot');
  // ── Géométrie ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  const need = lg.atoms.filter(PORTED_2D).map((q) => q.id), miss = need.filter((id) => !by.has(id));
  C.push(chk('legs3d.geo.parity-2d', 'geometry', miss.length === 0, miss.length ? `atomes 2D sans volume 3D : ${miss.slice(0, 8).join(', ')}${miss.length > 8 ? '…' : ''} (${miss.length}/${need.length})` : `${need.length} atomes 2D (muscles, os, repères, orteils, ongles, tendons du pied) ont un volume 3D de même identifiant`));
  const bad = SIDES.map((sd) => { const fe = g(`bone.femur.${sd}`)!, ti = g(`bone.tibia.${sd}`)!, d = (v: Volume): number => { const s0 = v.stations[0]!.c, s1 = v.stations[v.stations.length - 1]!.c; return Math.hypot(s1.x - s0.x, s1.y - s0.y, s1.z - s0.z); }; return { th: d(fe) / (lf.len.thigh + 0.22 * H) - 1, sh: d(ti) / lf.len.shin - 1 }; });
  const dev = Math.max(...bad.flatMap((q) => [Math.abs(q.th), Math.abs(q.sh)]));
  C.push(chk('legs3d.geo.dims-from-legGeometry', 'geometry', dev <= 0.03, `longueurs 3D (fémur, tibia) contre \`legGeometry\` : écart max ${(dev * 100).toFixed(2)} % (≤ 3 % : un os de la 3D n'a pas d'autre source que le cadre 2D)`));
  const rows = [0.15, 0.4, 0.65, 0.85].map((t) => lf.y.crotch + t * (lf.y.knee - lf.y.crotch)).concat([0.25, 0.5, 0.75].map((t) => lf.y.knee + t * (lf.y.ankle - lf.y.knee)));
  let worst = 0, worstAbs = 0, worstId = '';
  for (const sd of SIDES) { const skin = g(`leg.env.${sd}`)!, mus = vs.filter((v) => v.kind === 'muscle' && v.group === 'leg' && v.side === sd && !v.hidden); for (const y of rows) { const s = slab([skin], y, 0.008 * H), m = slab(mus, y, 0.008 * H); if (s && m) { const o = Math.max(m.x1 - s.x1, s.x0 - m.x0, m.z1 - s.z1, s.z0 - m.z0), r = o / Math.max(1e-6, Math.min(s.x1 - s.x0, s.z1 - s.z0) / 2); if (r > worst) { worst = r; worstAbs = o; worstId = `${sd}@${(y / H).toFixed(2)}`; } } } }
  C.push(chk('legs3d.geo.muscles-in-shell', 'geometry', worst <= 0.2, `dépassement maximal des muscles hors de la peau : ${(worst * 100).toFixed(1)} % de la demi-épaisseur locale = ${fmt(worstAbs, H)} h (${worstId || 'aucun'}) (≤ 20 % : la coque du modèle va jusqu'à 14 % ; un muscle modèle la surface)`));
  const nL = leg.filter((v) => v.side === 'L').length, nR = leg.filter((v) => v.side === 'R').length;
  const asym = Math.max(...vs.filter((v) => v.group === 'leg' && v.side === 'L').map((v) => { const r = g(v.id.replace(/\.L$/, '.R')); return r ? Math.abs(mid(v).c.x + mid(r).c.x) : Infinity; }));
  C.push(chk('legs3d.geo.symmetry', 'geometry', nL === nR && asym <= 0.08 * H, `${nL} volumes gauches, ${nR} droits ; décalage latéral gauche/droite maximal ${fmt(asym, H)} h (≤ 0,08 h : le contrapposto décale le bassin)`));
  const pl = lg.params.pose.left, ab = (pl.abduction * Math.PI) / 180, d0y = Math.cos(ab), d1y = Math.cos(ab * (1 - 0.4));
  const dor = g('foot.dorsum.L')!, ys = dor.stations.flatMap((q) => [ringPoint(q, Math.PI * 1.5).p.y, ringPoint(q, Math.PI / 2).p.y]), sole = Math.max(...ys), flat = pl.kneeFlex === 0;
  // Sol attendu : la chaîne hanche → cheville est celle du squelette 3D (cuisse inclinée de l'écartement, jambe ramenée de 40 %), pieds à `ankleH` sous la cheville. Les longueurs ne sont PAS compensées : un écartement relève les pieds (le bassin ne s'abaisse pas), limite documentée.
  const expected = lf.y.crotch - 0.22 * lf.body.h + (0.22 * lf.body.h + lf.len.thigh) * d0y + lf.len.shin * d1y + lf.len.ankleH;
  C.push(chk('legs3d.geo.foot-on-ground', 'geometry', !flat || Math.abs(sole - expected) <= 0.04 * H, flat ? `semelle à ${fmt(sole - expected, H)} h de la hauteur attendue pour la chaîne du squelette (abduction ${pl.abduction}°, jambes non compensées ; ≤ 0,04 h)` : 'genou fléchi : le pied reste attaché à la cheville (non posé au sol), contrôle sans objet'));
  // ── Anatomie ──────────────────────────────────────────────────────────────────────────────────────────────────────────
  const kn = SIDES.map((sd) => { const K = g(`joint.knee.${sd}`)!.stations[1]!.c, pa = mid(g(`knee.patella.${sd}`)!).c, tu = mid(g(`knee.tibial-tuberosity.${sd}`)!).c, fh = mid(g(`knee.fibula-head.${sd}`)!).c; return { ok: pa.y < tu.y && pa.z > K.z && tu.z > K.z && Math.abs(fh.x) > Math.abs(tu.x), pa: (pa.y - K.y) / H }; });
  C.push(chk('legs3d.ana.knee-landmarks', 'anatomy', kn.every((q) => q.ok), `rotule au-dessus de la tubérosité tibiale, toutes deux en avant du genou, tête du péroné plus latérale (${kn.map((q) => q.ok).join('/')} ; rotule à ${kn[0]!.pa.toFixed(3)} h du centre du genou)`));
  const ml = SIDES.map((sd) => { const K = g(`joint.knee.${sd}`)!.stations[1]!.c, An = g(`joint.ankle.${sd}`)!.stations[1]!.c, l = mid(g(`ankle.malleolus.lateral.${sd}`)!).c, m = mid(g(`ankle.malleolus.medial.${sd}`)!).c, n = Math.hypot(An.x - K.x, An.y - K.y, An.z - K.z), d = { x: (An.x - K.x) / n, y: (An.y - K.y) / n, z: (An.z - K.z) / n };
    // Dans le repère de la jambe : plus distale = plus loin le long de l'axe genou → cheville (le plus bas du monde dépend de l'inclinaison de la jambe).
    return (l.x - m.x) * d.x + (l.y - m.y) * d.y + (l.z - m.z) * d.z >= -1e-6 && Math.abs(l.x) > Math.abs(m.x); });
  C.push(chk('legs3d.ana.malleoli', 'anatomy', ml.every(Boolean), 'malléole latérale plus distale et plus latérale que la médiale (anatomie du cou-de-pied)'));
  const zc = (id: string): number => mid(g(id)!).c.z, comp = [zc('rectus-femoris.L') - zc('semitendinosus.L'), zc('tibialis-anterior.L') - zc('gastrocnemius.medial.L'), zc('quadriceps.L') - zc('hamstrings.L')];
  C.push(chk('legs3d.ana.compartments', 'anatomy', comp.every((d) => d > 0.04 * H), `écarts avant−arrière : droit fémoral/semi-tendineux ${fmt(comp[0]!, H)} h · tibial antérieur/gastrocnémien ${fmt(comp[1]!, H)} h · quadriceps/ischio-jambiers ${fmt(comp[2]!, H)} h (> 0,04 h : loges antérieure et postérieure distinctes)`));
  const toeLen = [1, 2, 3, 4, 5].map((k) => { const nm = ['hallux', 'toe2', 'toe3', 'toe4', 'toe5'][k - 1]!, ph = vs.filter((v) => v.id.startsWith(`toe.${nm}.`) && v.id.endsWith('.L') && v.kind === 'bone'); const ps = ph.flatMap((v) => [v.stations[0]!.c, v.stations[v.stations.length - 1]!.c]); return Math.hypot(...[0, 1, 2].map((i) => { const arr = ps.map((p) => [p.x, p.y, p.z][i]!); return Math.max(...arr) - Math.min(...arr); })); });
  const hx = Math.abs(mid(g('foot.toe.1.L')!).c.x), tx = Math.abs(mid(g('foot.toe.5.L')!).c.x), mono = toeLen.every((l, i) => i === 0 || l <= toeLen[i - 1]! * 1.02);
  C.push(chk('legs3d.ana.toes', 'anatomy', mono && hx < tx, `longueurs des orteils ${toeLen.map((l) => fmt(l, H)).join(' ≥ ')} h (décroissantes) ; gros orteil à ${fmt(hx, H)} h de l'axe du corps, 5ᵉ à ${fmt(tx, H)} h (gros orteil médial)`));
  const mus = vs.filter((v) => v.kind === 'muscle' && v.group === 'leg' && v.level >= 2), oi = mus.filter((v) => v.origin && v.insertion);
  C.push(chk('legs3d.ana.origin-insertion', 'anatomy', oi.length / mus.length >= 0.85, `${oi.length}/${mus.length} muscles de niveau ≥ 2 avec origine et insertion`));
  // ── Style ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const skinOk = ['leg.env.L', 'leg.env.R', 'foot.dorsum.L', 'foot.dorsum.R', 'foot.toe.1.L', 'foot.toe.5.R'].every((id) => g(id)?.kind === 'skin'), musOk = vs.filter((v) => v.kind === 'muscle' && v.group === 'leg').every((v) => v.layer >= 3 && v.level >= 1), boneOk = vs.filter((v) => v.kind === 'bone' && (v.group === 'leg' || v.group === 'foot') && v.id !== 'knee.patella.L' && v.id !== 'knee.patella.R').every((v) => v.hidden);
  C.push(chk('legs3d.sty.same-pipeline', 'style', skinOk && musOk && boneOk, `peau (jambe, pied, orteils) fusionnée dans le tampon de peau : ${skinOk} · muscles en couches ≥ 3 : ${musOk} · os cachés sauf la rotule : ${boneOk}`));
  const m = renderVolumesPixel(set, { skin: '#c99a76', heightPx: 520, camera: { yaw: 0, pitch: 0, pivot: { x: 0, y: 0, z: 0 } }, uid: 'l3' }), { w, h, rgba } = m.pixels, b = m.bounds, px = w / (b.x1 - b.x0), py = h / (b.y1 - b.y0);
  const lum = (x: number, y: number): number => { const k = (y * w + x) * 4; return 0.3 * rgba[k]! + 0.59 * rgba[k + 1]! + 0.11 * rgba[k + 2]!; }, al = (x: number, y: number): number => rgba[(y * w + x) * 4 + 3]! / 255;
  const rowsPx = (y0: number, y1: number, xin: number, xout: number): number[] => { const o: number[] = []; for (let y = Math.round((y0 - b.y0) * py); y < Math.round((y1 - b.y0) * py); y++) for (let x = Math.round((xin - b.x0) * px); x < Math.round((xout - b.x0) * px); x++) if (x >= 0 && x < w && y >= 0 && y < h && al(x, y) > 0.95) o.push(lum(x, y)); return o; };
  const sd = (v: number[]): number => { const mu = v.reduce((s, q) => s + q, 0) / Math.max(1, v.length); return Math.sqrt(v.reduce((s, q) => s + (q - mu) ** 2, 0) / Math.max(1, v.length)); };
  const th = rowsPx(lf.y.crotch + 0.1 * (lf.y.knee - lf.y.crotch), lf.y.knee - 0.1 * (lf.y.knee - lf.y.crotch), 0.02 * H, 0.9 * lf.axisX + 0.5 * lf.w.mid), tr = rowsPx(set.measures.h === 0 ? 0 : (g('trunk')!.stations[0]!.c.y + 0.3 * (lf.y.crotch - g('trunk')!.stations[0]!.c.y)), lf.y.crop, -0.5 * lf.axisX, 0.5 * lf.axisX);
  const ratio = sd(th) / Math.max(1e-6, sd(tr)), vis = set.measures.vis as number;
  let holes = 0, solid = 0; for (let y = Math.round((lf.y.crotch - b.y0) * py); y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const q = al(x, y); if (q >= 0.9) { solid++; continue; } if (q <= 0.04) continue; let e = false; for (let dy = -2; dy <= 2 && !e; dy++) for (let dx = -2; dx <= 2; dx++) if (al(x + dx, y + dy) <= 0.04) { e = true; break; } if (!e) holes++; }
  C.push(chk('legs3d.sty.relief-matches-trunk', 'style', vis < 0.25 || (ratio >= 0.4 && ratio <= 3), `écart-type de luminance cuisse / tronc (image de face) = ${ratio.toFixed(2)} (bande 0,4–3 si définition ≥ 0,25 ; ici ${vis.toFixed(2)}) : les jambes ne sont plus des tubes lisses sous un tronc sculpté`));
  C.push(chk('legs3d.sty.no-translucent-hole', 'style', holes <= 0.001 * Math.max(1, solid), `${holes} pixels translucides à l'intérieur des jambes sur ${solid} opaques (≤ 0,1 %)`));
  const failures = C.filter((c) => !c.ok);
  return { ok: failures.length === 0, checks: C, failures };
}

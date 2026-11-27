import type { BodyInput, NeckAnchor } from '../body';
import { bodyFrame } from '../body/frame';
import { reveal, tierOf } from '../body/muscle-tiers';
import { BodyParams } from '../body/types';
import { renderVolumesPixel, type Volume, type VolumeSet } from '../body/volume';
import { finishRelief } from '../body/volume/back-relief';
import type { VCheck } from './volume';

const chk = (id: string, layer: VCheck['layer'], ok: boolean, detail: string): VCheck => ({ id, layer, ok, detail });
type V3 = { x: number; y: number; z: number };
const cam = (yaw: number) => ({ yaw, pitch: 0, pivot: { x: 0, y: 0, z: 0 } });
const px = (set: VolumeSet, yaw: number, h: number, uid: string) => renderVolumesPixel(set, { skin: '#c99a76', heightPx: h, camera: cam(yaw), uid });
const without = (set: VolumeSet, re: RegExp): VolumeSet => { const vs = set.volumes.filter((v) => !re.test(v.id)); return { ...set, volumes: vs, byId: new Map(vs.map((v) => [v.id, v])) }; };
/** Pixels dont la couleur change de plus de 12/255 (somme R+G+B) entre deux rendus de même cadrage, et part du corps que cela représente (%). */
function diffOf(A: Uint8ClampedArray, B: Uint8ClampedArray): { n: number; pct: number } {
  let n = 0, body = 0;
  for (let i = 0; i < A.length; i += 4) { if (A[i + 3]! > 200) body++; if (Math.abs(A[i]! - B[i]!) + Math.abs(A[i + 1]! - B[i + 1]!) + Math.abs(A[i + 2]! - B[i + 2]!) > 12) n++; }
  return { n, pct: (100 * n) / Math.max(1, body) };
}
const mean = (v: Volume, k: 'x' | 'y' | 'z'): number => v.stations.reduce((s, q) => s + q.c[k], 0) / v.stations.length;
const ctr = (v: Volume): V3 => ({ x: mean(v, 'x'), y: mean(v, 'y'), z: mean(v, 'z') });
const distSeg = (p: V3, a: V3, b: V3): { d: number; t: number } => {
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }, l2 = ab.x * ab.x + ab.y * ab.y + ab.z * ab.z || 1e-9, t = Math.min(1, Math.max(0, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y + (p.z - a.z) * ab.z) / l2));
  return { d: Math.hypot(p.x - a.x - t * ab.x, p.y - a.y - t * ab.y, p.z - a.z - t * ab.z), t };
};

/**
 * GRAND DORSAL ET LOSANGE DU TRAPÈZE (itération 09), trois couches, seuils posés APRÈS mesure (valeurs observées citées).
 *  GÉOMÉTRIE : le bord latéral du grand dorsal va de la crête iliaque (≤ 0,06 h) au pli postérieur de l'aisselle (≤ 0,06 h).
 *  ANATOMIE  : le bord supérieur médial du muscle recouvre l'angle inférieur de l'omoplate (de 1,6 vertèbre au-dessus à 0,4 en dessous) ; la pointe du losange est à T12 (≤ 0,6 vertèbre) et ses
 *              sommets latéraux sont à la hauteur du bord médial de l'omoplate (0,20–0,34 × x.acr).
 *  STYLE     : retirer la nappe + le losange change l'image de dos ; le volume « sabre » `latissimus` n'est plus dessiné (il reste dans les données).
 */
export function latTrapChecks(set: VolumeSet, raw: BodyInput, a: NeckAnchor): VCheck[] {
  const r = set.relief, out: VCheck[] = [];
  if (!r) return out;
  const f = bodyFrame(BodyParams.parse(raw), a), H = r.H, m = set.measures, u = ((m.t12Y as number) - (m.c7Y as number)) / 12, XA = Math.abs(set.landmarks.get('acromion.L')!.x), vis = m.vis as number;
  const sh = (id: string) => r.shapes.find((s) => s.id === id), lat = sh('latissimus.L'), bd = sh('latissimus-border.L'), dia = sh('trapezius-diamond'), ia = sh('inferior-angle.L');
  if (!lat || !bd || !dia || !ia || lat.kind !== 'poly' || bd.kind !== 'line' || dia.kind !== 'poly' || ia.kind !== 'blob') return [chk('back.geo.lat-trap-present', 'geometry', false, 'nappe du grand dorsal, bord latéral, losange ou angle inférieur manquants')];
  const lo = bd.pts[0]!, hi = bd.pts[bd.pts.length - 1]!, eLo = Math.abs(lo[1] - f.y.crop) / H, eHi = Math.abs(hi[1] - (f.y.axilla + 0.03 * H)) / H;
  out.push(chk('back.geo.lat-border-span', 'geometry', eLo <= 0.06 && eHi <= 0.06, `bord latéral du grand dorsal : départ à ${eLo.toFixed(3)} h de la crête, arrivée à ${eHi.toFixed(3)} h du pli d'aisselle (≤ 0,06 h)`));
  const top = Math.min(...lat.pts.filter((p) => Math.abs(p[0]) <= 0.7 * XA).map((p) => p[1])), dTop = (top - ia.c[1]) / u;
  out.push(chk('back.ana.lat-over-angle', 'anatomy', dTop >= -1.6 && dTop <= 0.4, `le bord supérieur médial du grand dorsal est à ${dTop.toFixed(2)} vertèbre de l'angle inférieur de l'omoplate (−1,6 … +0,4 : il le recouvre)`));
  const apex = Math.max(...dia.pts.map((p) => p[1])), dApex = Math.abs(apex - (m.t12Y as number)) / u, wRoot = Math.abs(dia.pts[2]![0]) / XA;
  out.push(chk('back.ana.trap-diamond', 'anatomy', dApex <= 0.6 && wRoot >= 0.2 && wRoot <= 0.34, `pointe du losange à ${dApex.toFixed(2)} vertèbre de T12 (≤ 0,6) ; sommets latéraux à ${wRoot.toFixed(3)} × x.acr (0,20–0,34 = bord médial de l'omoplate)`));
  const noLT = { ...set, relief: finishRelief(r.shapes.filter((s) => !/^(latissimus|trapezius-)/.test(s.id)), H) }, on = px(set, 180, 460, 'lt1'), off = px(noLT, 180, 460, 'lt0'), d = diffOf(on.pixels.rgba, off.pixels.rgba), need = vis >= 0.25 ? 0.9 : 0.1;
  out.push(chk('back.sty.lat-trap-visible', 'style', d.pct >= need, `retirer la nappe du grand dorsal et le losange change ${d.n} pixels = ${d.pct.toFixed(2)} % du corps (≥ ${need} % pour vis = ${vis.toFixed(2)})`));
  const drawn = on.ids.filter((i) => i.startsWith('latissimus')), kept = set.volumes.filter((v) => v.id.startsWith('latissimus')).length;
  out.push(chk('back.sty.lat-no-sabres', 'style', kept >= 2 && drawn.length === 0, `${kept} volumes « sabre » dans les données, ${drawn.length} dessinés (0 attendu : la nappe de relief les remplace)`));
  return out;
}

/**
 * ENVELOPPE DU DELTOÏDE ET MAIN (itération 09), trois couches.
 *  GÉOMÉTRIE : chaque enveloppe (antérieure, postérieure) finit sur l'humérus (≤ 0,9 × rayon du bras de l'axe épaule→coude, à 20–60 % de sa longueur) ; chaque main a 4 palmures dont les extrémités sont sur
 *              les phalanges proximales voisines (≤ 0,35 × rayon du doigt).
 *  ANATOMIE  : le chef antérieur est du côté opposé au postérieur par rapport à la masse (z) ; médius le plus long, auriculaire le plus court, annulaire entre 0,9 et 1,15 × l'index.
 *  STYLE     : retirer les enveloppes change l'image de profil et de face ; retirer les palmures change l'image de face (mains au repos).
 */
export function armBodyChecks(set: VolumeSet, raw: BodyInput, a: NeckAnchor): VCheck[] {
  const out: VCheck[] = [], f = bodyFrame(BodyParams.parse(raw), a), rU = f.arm.armHalf, g = (id: string) => set.byId.get(id);
  const sh = g('joint.shoulder.L'), el = g('joint.elbow.L'), an = g('deltoid-wrap.ant.L'), po = g('deltoid-wrap.post.L'), dm = g('deltoid.L');
  if (!sh || !el || !an || !po || !dm) return [chk('junction.geo.deltoid-wrap-attached', 'geometry', false, 'volumes manquants (articulations, enveloppes ou deltoïde)')];
  const s0 = ctr(sh), e0 = ctr(el), ends = [an, po].map((v) => distSeg(v.stations[v.stations.length - 1]!.c, s0, e0));
  out.push(chk('junction.geo.deltoid-wrap-attached', 'geometry', ends.every((q) => q.d <= 0.9 * rU && q.t >= 0.2 && q.t <= 0.6), `fin des enveloppes à ${ends.map((q) => `${(q.d / rU).toFixed(2)} rayon (${(100 * q.t).toFixed(0)} % de l'humérus)`).join(' · ')} (≤ 0,9 rayon, 20–60 %)`));
  const hands = (['L', 'R'] as const).map((sd) => { const webs = [0, 1, 2, 3].map((k) => g(`web.${k}.${sd}`)), bad = webs.filter((w, k) => { if (!w) return true; return [[w.stations[0]!, k], [w.stations[w.stations.length - 1]!, k + 1]].some(([st, fk]) => { const fv = g(`finger.${fk as number}.1.${sd}`); if (!fv) return true; const q = distSeg((st as typeof w.stations[0]).c, fv.stations[0]!.c, fv.stations[fv.stations.length - 1]!.c); return q.d > 0.35 * fv.stations[0]!.a; }); }).length; return { sd, bad }; });
  out.push(chk('junction.geo.hand-webs-attached', 'geometry', hands.every((h) => h.bad === 0), `palmures (4 par main) : ${hands.map((h) => `${h.sd} ${4 - h.bad}/4 attachées`).join(' · ')}`));
  const zA = mean(an, 'z') - mean(dm, 'z'), zP = mean(po, 'z') - mean(dm, 'z');
  out.push(chk('junction.ana.deltoid-heads-opposed', 'anatomy', zA * zP < 0 && Math.min(Math.abs(zA), Math.abs(zP)) >= 0.1 * rU, `chef antérieur ${(zA / rU).toFixed(2)} · postérieur ${(zP / rU).toFixed(2)} rayon de part et d'autre de la masse (signes opposés, ≥ 0,1)`));
  const len = (sd: string, k: number): number => [1, 2, 3].reduce((t, j) => { const v = g(`finger.${k}.${j}.${sd}`); return t + (v ? Math.hypot(...(['x', 'y', 'z'] as const).map((c) => v.stations[v.stations.length - 1]!.c[c] - v.stations[0]!.c[c]) as [number, number, number]) : 0); }, 0), Lf = [1, 2, 3, 4].map((k) => len('L', k));
  const ok = Lf[1]! >= Math.max(...Lf) - 1e-9 && Lf[3]! <= Math.min(...Lf) + 1e-9 && Lf[2]! / Lf[0]! >= 0.9 && Lf[2]! / Lf[0]! <= 1.15;
  out.push(chk('junction.ana.finger-order', 'anatomy', ok, `longueurs index/médius/annulaire/auriculaire = ${Lf.map((q) => (q / rU).toFixed(2)).join(' / ')} rayons ; annulaire/index = ${(Lf[2]! / Lf[0]!).toFixed(2)} (0,9–1,15 ; médius max, auriculaire min)`));
  // Palier d'apparition (même règle que verifyBack : reveal(palier de la musculature, palier du volume) ≥ 0,04). Les chefs distincts du deltoïde sont du palier 2 : ni le nourrisson, ni l'obèse, ni le sujet très sec ne les montrent.
  const wantWrap = reveal(tierOf(set.measures.vis as number), an.tier ?? 0) >= 0.04, drawnWrap = px(set, 90, 460, 'w2').ids.filter((i) => i.startsWith('deltoid-wrap.')).length;
  if (!wantWrap) out.push(chk('junction.sty.deltoid-wrap-visible', 'style', drawnWrap === 0, drawnWrap === 0 ? `non applicable : palier ${an.tier} non atteint à vis = ${(set.measures.vis as number).toFixed(2)} (enveloppes non dessinées, comme voulu) ; géométrie et anatomie contrôlées, style NON prouvé visuellement` : `${drawnWrap} enveloppes dessinées alors que leur palier n’est pas atteint`));
  else { const noWrap = without(set, /^deltoid-wrap/), s90 = diffOf(px(set, 90, 460, 'w1').pixels.rgba, px(noWrap, 90, 460, 'w0').pixels.rgba), s0f = diffOf(px(set, 0, 460, 'v1').pixels.rgba, px(noWrap, 0, 460, 'v0').pixels.rgba);
    out.push(chk('junction.sty.deltoid-wrap-visible', 'style', s90.pct >= 0.5 && s0f.pct >= 0.4, `retirer les enveloppes change ${s90.pct.toFixed(2)} % du corps de profil et ${s0f.pct.toFixed(2)} % de face (≥ 0,5 % / 0,4 %)`)); }
  const noWeb = without(set, /^web\./), wd = diffOf(px(set, 0, 900, 'h1').pixels.rgba, px(noWeb, 0, 900, 'h0').pixels.rgba);
  out.push(chk('junction.sty.hand-webs-visible', 'style', wd.n >= 200, `retirer les palmures change ${wd.n} pixels de face à 900 px (≥ 200 ; invisibles de dos : les mains au repos regardent vers l'avant)`));
  return out;
}

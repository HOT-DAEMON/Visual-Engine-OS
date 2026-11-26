import type { BodyInput, NeckAnchor } from '../body';
import { bodyFrame } from '../body/frame';
import { ringPoint } from '../body/volume/loft';
import { renderVolumesPixel, type Volume, type VolumeSet } from '../body/volume';
import { BodyParams } from '../body/types';
import type { VCheck } from './volume';

const chk = (id: string, layer: VCheck['layer'], ok: boolean, detail: string): VCheck => ({ id, layer, ok, detail });
const CAM = { yaw: 0, pitch: 0, pivot: { x: 0, y: 0, z: 0 } };
const without = (set: VolumeSet, re: RegExp): VolumeSet => { const vs = set.volumes.filter((v) => !re.test(v.id)); return { ...set, volumes: vs, byId: new Map(vs.map((v) => [v.id, v])) }; };
const box = (v: Volume): { x0: number; x1: number; y0: number; y1: number } => {
  const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
  for (const s of v.stations) for (let q = 0; q < 24; q++) { const p = ringPoint(s, (q / 24) * 2 * Math.PI).p; b.x0 = Math.min(b.x0, p.x); b.x1 = Math.max(b.x1, p.x); b.y0 = Math.min(b.y0, p.y); b.y1 = Math.max(b.y1, p.y); }
  return b;
};
type Px = Uint8ClampedArray;
const shot = (set: VolumeSet, uid: string): Px => renderVolumesPixel(set, { skin: '#c99a76', heightPx: 460, camera: CAM, uid }).pixels.rgba;
/** Pixels dont la couleur change de plus de 12/255 (somme R+G+B) entre deux rendus de même cadrage ; `max` = plus fort écart moyen par canal. */
function diffOf(A: Px, B: Px): { n: number; max: number; body: number } {
  let n = 0, max = 0, body = 0;
  for (let i = 0; i < A.length; i += 4) {
    if (A[i + 3]! > 200) body++;
    const d = Math.abs(A[i]! - B[i]!) + Math.abs(A[i + 1]! - B[i + 1]!) + Math.abs(A[i + 2]! - B[i + 2]!);
    if (d > 12) n++; max = Math.max(max, d / 3);
  }
  return { n, max, body };
}

/**
 * CONTRÔLES DE L'INSERTION DU GRAND PECTORAL (itération 08), trois couches :
 *  GÉOMÉTRIE : l'insertion commence où finit le chef sterno-costal (continuité, ≤ 0,012 h) ET s'achève sur l'humérus (distance à l'axe épaule→coude ≤ 0,9 × rayon du bras, abscisse
 *              entre 5 et 30 % de l'humérus) : aucun muscle qui flotte entre le tronc et le bras.
 *  ANATOMIE  : couche supérieure à celle du deltoïde, recouvrement de leurs boîtes en projection de face ≥ 0,2 × rayon du bras dans les deux axes (c'est ce qui crée le sillon delto-pectoral),
 *              et extrémité effilée en tendon (dernière section ≤ 0,35 × la plus large).
 *  STYLE     : l'image change réellement quand on retire UNE insertion (chaque côté ≥ 40 pixels et écart max ≥ 30/255 à 460 px de haut ; seuils posés APRÈS observation par côté : 51–206 pixels, max 33–92 sur 11 archétypes).\n *              Premier essai écarté : retirer les deux côtés à la fois laissait le côté intact masquer une insertion invisible de l'autre côté (contrôle négatif en échec) — d'où la mesure par côté.
 *              Non applicable (et dit tel quel) quand le chef sterno-costal est lui-même invisible (graisse enfantine : baby, toddler — 0 pixel).
 */
export function pecInsertionChecks(set: VolumeSet, raw: BodyInput, a: NeckAnchor): VCheck[] {
  const H = set.measures.h as number, f = bodyFrame(BodyParams.parse(raw), a), rU = f.arm.armHalf, L = f.arm.upper, out: VCheck[] = [];
  const ins = set.byId.get('pectoralis.insertion.L'), ste = set.byId.get('pectoralis.sternal.L'), del = set.byId.get('deltoid.L'), sh = set.byId.get('joint.shoulder.L'), el = set.byId.get('joint.elbow.L');
  if (!ins || !ste || !del || !sh || !el) return [chk('junction.geo.pec-insertion-attached', 'geometry', false, 'volumes manquants (insertion, sterno-costal, deltoïde ou articulations)')];
  const e0 = ins.stations[0]!.c, s1 = ste.stations[ste.stations.length - 1]!.c, gap = Math.hypot(e0.x - s1.x, e0.y - s1.y, e0.z - s1.z);
  const P = sh.stations[1]!.c, Q = el.stations[1]!.c, ax = { x: Q.x - P.x, y: Q.y - P.y, z: Q.z - P.z }, al = Math.hypot(ax.x, ax.y, ax.z), u = { x: ax.x / al, y: ax.y / al, z: ax.z / al };
  const e1 = ins.stations[ins.stations.length - 1]!.c, d = { x: e1.x - P.x, y: e1.y - P.y, z: e1.z - P.z }, t = d.x * u.x + d.y * u.y + d.z * u.z;
  const perp = Math.hypot(d.x - t * u.x, d.y - t * u.y, d.z - t * u.z);
  out.push(chk('junction.geo.pec-insertion-attached', 'geometry', gap <= 0.012 * H && perp <= 0.9 * rU && t >= 0.05 * L && t <= 0.3 * L,
    `départ à ${(gap / H).toFixed(4)} h du bout du sterno-costal (≤ 0,012) ; arrivée à ${(perp / rU).toFixed(2)} × rayon du bras de l'axe huméral (≤ 0,9), à ${(t / L).toFixed(2)} de l'humérus (0,05–0,30)`));
  const bi = box(ins), bd = box(del), ox = Math.min(bi.x1, bd.x1) - Math.max(bi.x0, bd.x0), oy = Math.min(bi.y1, bd.y1) - Math.max(bi.y0, bd.y0);
  const wmax = Math.max(...ins.stations.map((s) => s.a)), taper = ins.stations[ins.stations.length - 1]!.a / wmax;
  out.push(chk('junction.ana.pec-over-deltoid', 'anatomy', ins.layer > del.layer && ox >= 0.2 * rU && oy >= 0.2 * rU && taper <= 0.35,
    `couche ${ins.layer} > deltoïde ${del.layer} ; recouvrement des boîtes ${(ox / rU).toFixed(2)} × ${(oy / rU).toFixed(2)} rayons (≥ 0,2) ; extrémité ${taper.toFixed(2)} × la section la plus large (≤ 0,35, tendon plat)`));
  // 3 rendus (complet, sans l'insertion gauche, sans la droite) ; un 4e (sans le sterno-costal) seulement si l'effet est faible, pour décider si le contrôle est applicable.
  const full = shot(set, 'pc0'), dL = diffOf(full, shot(without(set, /^pectoralis\.insertion\.L$/), 'pc1')), dR = diffOf(full, shot(without(set, /^pectoralis\.insertion\.R$/), 'pc2'));
  if (dL.n >= 40 && dR.n >= 40 && dL.max >= 30 && dR.max >= 30) out.push(chk('junction.sty.pec-insertion-visible', 'style', true, `retirer UNE insertion change ${dL.n} pixels à gauche (max ${dL.max.toFixed(0)}/255) et ${dR.n} à droite (max ${dR.max.toFixed(0)}/255), ${((100 * Math.min(dL.n, dR.n)) / dL.body).toFixed(2)} % du corps au minimum (chaque côté ≥ 40 pixels et ≥ 30/255)`));
  else {
    const bare = diffOf(full, shot(without(set, /^pectoralis\.sternal/), 'pc3'));
    if (bare.n < 80) out.push(chk('junction.sty.pec-insertion-visible', 'style', dL.n === 0 && dR.n === 0, `non applicable : le chef sterno-costal est lui-même invisible à ce palier (${bare.n} pixels) ; les insertions changent ${dL.n} et ${dR.n} pixels, comme lui`));
    else out.push(chk('junction.sty.pec-insertion-visible', 'style', false, `retirer UNE insertion change ${dL.n} pixels à gauche (max ${dL.max.toFixed(0)}/255) et ${dR.n} à droite (max ${dR.max.toFixed(0)}/255) : sous les seuils (chaque côté ≥ 40 pixels et ≥ 30/255) alors que le sterno-costal est visible`));
  }
  return out;
}

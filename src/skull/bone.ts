import { faceLandmarks } from '../face/landmarks';
import type { FaceParams } from '../schema';
import type { Frame } from './frame';
import type { NeckGeo } from './neck';
import type { CPoint, SkullParams, V2 } from './types';

/**
 * OSSATURE DU PROFIL (repères craniométriques) et PROFONDEURS DE TISSUS MOUS. Technique : approximation faciale médico-légale — on place des
 * repères OSSEUX sur la ligne médiane puis la peau en est l'offset d'une profondeur de tissu propre à chaque repère (Rhine & Moore, Helmer,
 * Manhein : méthode ; les profondeurs ci-dessous sont des ORDRES DE GRANDEUR en fraction de H — ≈ 0,0043 H par mm sur une tête de 230 mm — et NON
 * les tables publiées, qu'on ne recopie pas de mémoire : voir docs/SKULL-PROFILE-REMAINING.md, « calibrage »).
 * La mandibule est RÉSOLUE sur l'angle gonial du visage de face (`lm.jaw.gonialDeg`) : même mâchoire en face et en profil.
 */
/** `dir` : sens os → peau (`x-` : l'os est en arrière de la peau, `x+` : en avant — occiput —, `y+` : sous la peau — voûte —, `y-` : au-dessus de la peau — menton —). */
export type TissueDir = 'x-' | 'x+' | 'y+' | 'y-';
export interface TissueDepth { readonly id: string; readonly depth: number; readonly dir: TissueDir; readonly bone: V2; readonly skin: V2 }
export interface BoneGeo {
  readonly lm: Record<string, V2>;
  readonly tissue: TissueDepth[];
  readonly gonialDeg: number;
  readonly gonialRequestedDeg: number;
  readonly ramusLen: number;
  readonly vertebrae: { id: string; c: V2; r: number; spine: V2 }[];
}

/** Profondeurs (fraction de H) : valeurs d'ordre de grandeur, modulées par l'axe `scalp` pour la voûte. */
export const DEPTH: Readonly<Record<string, [number, TissueDir]>> = {
  supraglabella: [0.02, 'x-'], glabella: [0.024, 'x-'], nasion: [0.027, 'x-'], rhinion: [0.01, 'x-'], subnasale: [0.04, 'x-'], philtrum: [0.046, 'x-'],
  labraleSup: [0.04, 'x-'], labraleInf: [0.045, 'x-'], sublabiale: [0.047, 'x-'], pogonion: [0.05, 'x-'], menton: [0.03, 'y-'],
  vertex: [0.024, 'y+'], opisthocranion: [0.027, 'x+'], inion: [0.03, 'x+'], lambda: [0.022, 'y+'], bregma: [0.024, 'y+'],
};

const ang = (a: V2, b: V2): number => Math.atan2(b.y - a.y, b.x - a.x);
export function boneGeometry(face: FaceParams, sk: SkullParams, fr: Frame, skin: ReadonlyMap<string, CPoint>, neck: NeckGeo): BoneGeo {
  const { H, f } = fr;
  const lm = faceLandmarks(face, fr.hostH * 0.8, fr.hostH);
  const S = (id: string): CPoint => skin.get(id) as CPoint;
  const L: Record<string, V2> = {};
  const tissue: TissueDepth[] = [];
  const scalp = 0.75 + 0.5 * sk.scalp;
  for (const [id, [d0, dir]] of Object.entries(DEPTH)) {
    const s = skin.get(id);
    if (!s) continue;
    const d = (['vertex', 'opisthocranion', 'inion', 'lambda', 'bregma'].includes(id) ? d0 * scalp : d0) * H;
    const b = dir === 'x-' ? { x: s.x - d, y: s.y } : dir === 'x+' ? { x: s.x + d, y: s.y } : dir === 'y+' ? { x: s.x, y: s.y + d } : { x: s.x, y: s.y - d };
    L[id] = s; L[`${id}:bone`] = b;
    tissue.push({ id, depth: d, dir, bone: b, skin: { x: s.x, y: s.y } });
  }
  L.nasospinale = { x: S('subnasale').x - 0.04 * H, y: S('subnasale').y - 0.004 * H };
  L.prosthion = { x: S('labraleSup').x - 0.04 * H, y: S('subnasale').y + 0.55 * (S('stomion').y - S('subnasale').y) };
  L.infradentale = { x: S('labraleInf').x - 0.045 * H, y: S('stomion').y + 0.45 * (S('sublabiale').y - S('stomion').y) };
  L.gnathion = { x: S('menton').x, y: S('menton').y - 0.03 * H };
  // Mandibule : condyle fixé sous l'oreille ; gonion à l'ordonnée de la mâchoire de face ; abscisse résolue pour que l'angle ramus/corps = angle gonial de face.
  const yPor = f.porion * H;
  const condyle: V2 = { x: 0.015 * H, y: yPor + 0.02 * H };
  const yGo = f.jawY * H;
  const angleAt = (xg: number): number => {
    const up = ang({ x: xg, y: yGo }, condyle);
    const body = ang({ x: xg, y: yGo }, L.gnathion as V2);
    let d = Math.abs(body - up) * (180 / Math.PI);
    if (d > 180) d = 360 - d;
    return d;
  };
  const target = lm.jaw.gonialDeg;
  // L'angle croît avec x du gonion (le ramus se redresse puis s'incline vers l'arrière) : dichotomie sur [-0,2 H ; +0,12 H], 40 pas (précision < 1e-9 H).
  let lo = -0.2 * H, hi = 0.12 * H;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (angleAt(mid) > target) hi = mid; else lo = mid; }
  const xGo = (lo + hi) / 2;
  L.gonion = { x: xGo, y: yGo };
  L.condyle = condyle;
  L.coronoid = { x: condyle.x + 0.07 * H, y: condyle.y - 0.015 * H };
  L.porion = { x: 0, y: yPor };
  L.mastoid = { x: -0.075 * H, y: yPor + 0.1 * H };
  L.zygomaxillare = { x: fr.x.nasion - 0.03 * H + 0.012 * H * sk.zygoma, y: (f.eye + 0.07) * H };
  L.orbitale = { x: fr.x.nasion - 0.035 * H, y: (f.eye + 0.04) * H };
  L.pterion = { x: 0.1 * H, y: (f.eye - 0.06) * H };
  L.asterion = { x: -0.2 * H, y: yPor - 0.04 * H };
  // Vertèbres cervicales C1 → C7 : centre du corps (sur l'axe du cou), rayon, pointe de l'épineuse (saillie vers l'arrière, sous la peau de la nuque).
  const vertebrae = Array.from({ length: 7 }, (_, i) => {
    const y = neck.yTop - 0.015 * H + ((neck.yC7 - neck.yTop + 0.015 * H) * i) / 6;
    const cx = neck.xBack(y) + 0.4 * neck.depth;
    const r = (0.027 + 0.0015 * i) * H;
    const spine = { x: neck.xBack(y) + (i === 6 ? 0.026 : 0.045 + 0.003 * (3 - Math.abs(i - 3))) * H, y: y + 0.012 * H };
    return { id: `C${i + 1}`, c: { x: cx, y }, r, spine };
  });
  return { lm: L, tissue, gonialDeg: angleAt(xGo), gonialRequestedDeg: target, ramusLen: Math.hypot(condyle.x - xGo, condyle.y - yGo), vertebrae };
}

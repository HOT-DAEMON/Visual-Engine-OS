import type { EyeFit } from '../face/fit-eye';
import { browGeometry, openingGeometry } from '../geometry/eye';
import { EyeSpec, type ColorSource } from '../schema';

/**
 * DONNÉES D'ŒIL POUR LE PROFIL : tout ce que le profil lit du moteur d'yeux, mesuré sur l'œil RÉELLEMENT posé sur le visage de face (`EyeFit`) —
 * pas une copie : la taille est celle de la fente palpébrale de la face (même échelle d'ajustement `fit.scale`, ramenée à la hauteur de la tête),
 * les couleurs sont celles du matériau d'iris, les cils et le sourcil ont les paramètres de l'œil de face. Le profil ne retient aucune grandeur
 * propre : changer l'œil de face change l'œil de profil.
 */
export interface ProfileEyeData {
  /** Ouverture de la fente (hauteur) et largeur frontale de la fente, en fraction de la hauteur sommet → menton de la face. */
  readonly heightH: number;
  readonly widthH: number;
  /** Part de la fente au-dessus du centre de l'iris (0–1) et inclinaison du grand axe (°) de la face. */
  readonly upperFraction: number;
  readonly tiltDeg: number;
  readonly iris: { readonly radius: number; readonly center: string; readonly mid: string; readonly edge: string; readonly limbal: number };
  readonly sclera: string;
  readonly pupil: string;
  readonly lashUpper: { readonly count: number; readonly length: number; readonly curl: number; readonly outer: number; readonly color: string; readonly liner: boolean };
  readonly lashLowerCount: number;
  readonly creaseHeight: number;
  readonly brow: { readonly topH: number; readonly heightH: number; readonly lengthH: number; readonly gap: number; readonly thickness: number; readonly arch: number; readonly tiltDeg: number; readonly length: number; readonly taper: number; readonly color: string };
}

/** Couleurs (centre, milieu, bord) d'une source de couleur : un aplat les répète, un dégradé donne ses arrêts extrêmes et médian. */
export function stopColors(src: ColorSource): { center: string; mid: string; edge: string } {
  if (src.type === 'solid') return { center: src.color, mid: src.color, edge: src.color };
  const s = src.stops;
  return { center: (s[0] as { color: string }).color, mid: (s[Math.floor((s.length - 1) / 2) + (s.length > 2 ? 1 : 0)] as { color: string }).color, edge: (s[s.length - 1] as { color: string }).color };
}
const flat = (src: ColorSource): string => stopColors(src).mid;

export function profileEyeData(fit: EyeFit, hostH: number): ProfileEyeData {
  const spec = EyeSpec.parse({ ...fit.eye, place: undefined });
  const g = openingGeometry(spec.shape, spec.canthi);
  const k = fit.transform.scale / hostH;
  const ic = stopColors(spec.iris.material.base);
  const lu = spec.lashes.upper;
  const b = spec.eyebrow;
  // Position et taille du sourcil MESURÉES sur la face (géométrie exacte du sourcil, repère de l'œil → fraction de H) : le profil les relit.
  const bb = b ? browGeometry(g, b, spec.lids.crease.height).bbox : null;
  return {
    heightH: g.hEff * k,
    widthH: g.w * k,
    upperFraction: spec.shape.upperFraction,
    tiltDeg: spec.shape.tiltDeg,
    iris: { radius: spec.iris.radius, ...ic, limbal: spec.iris.limbalRing },
    sclera: flat(spec.sclera.base),
    pupil: flat(spec.pupil.fill),
    lashUpper: { count: lu.count, length: lu.length, curl: lu.curl, outer: lu.outerLength, color: lu.material ? flat(lu.material.base) : '#2a1c14', liner: Boolean(spec.lids.liner) },
    lashLowerCount: spec.lashes.lower.count,
    creaseHeight: spec.lids.crease.height,
    brow: b && bb ? { topH: (g.pi.y - bb.y) * k, heightH: bb.h * k, lengthH: bb.w * k, gap: b.gap, thickness: b.thickness, arch: b.arch, tiltDeg: b.tiltDeg, length: b.length, taper: b.taper, color: flat(b.material.base) } : { topH: 0.12, heightH: 0.02, lengthH: 0.2, gap: 0.35, thickness: 0.1, arch: 0.5, tiltDeg: 8, length: 1.1, taper: 0.7, color: '#3a2a22' },
  };
}

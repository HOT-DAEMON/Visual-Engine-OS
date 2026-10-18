import { rad } from '../core/math';
import type { LightSpec } from '../schema';
import { applyTemperature } from './rig';

/**
 * Repère : x vers la droite, y vers le BAS (convention SVG), z vers l'observateur.
 * Le vecteur pointe de la surface VERS la source lumineuse.
 */
export interface LightVector {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Couleur EFFECTIVE de la lumière : couleur de base multipliée par la température de couleur si elle est donnée. */
  readonly color: string;
  readonly intensity: number;
  /** Éléments du moteur d'éclairage (`rig.ts`). Optionnels : un vecteur construit à la main reste valide (valeurs neutres). */
  readonly size?: number;
  readonly hardness?: number;
  readonly distance?: number | null;
  readonly influence?: Readonly<Record<string, number>>;
}

/** Entrée de `lightVector` : les quatre champs historiques sont obligatoires, les ajouts du moteur d'éclairage optionnels. */
export type LightInput = Pick<LightSpec, 'azimuthDeg' | 'elevationDeg' | 'color' | 'intensity'> & Partial<LightSpec>;

/**
 * azimuthDeg : 0° = lumière venant du haut de l'écran, 90° = de la droite, 180° = du bas, 270° = de la gauche.
 * elevationDeg : angle au-dessus du plan de l'image (90° = face à l'observateur, 10° = rasante).
 */
export function lightVector(l: LightInput): LightVector {
  const az = rad(l.azimuthDeg);
  const el = rad(l.elevationDeg);
  return {
    x: Math.cos(el) * Math.sin(az),
    y: -Math.cos(el) * Math.cos(az),
    z: Math.sin(el),
    // Température de couleur : multiplie la couleur de base (6500 K = blanc neutre) ; sans température, la couleur est inchangée.
    color: l.temperatureK == null ? l.color : applyTemperature(l.color, l.temperatureK),
    intensity: l.intensity,
    // Ajouts du moteur d'éclairage : copiés tels quels quand ils sont fournis (absents = valeurs neutres de `rig.ts`).
    ...(l.sourceSize === undefined ? {} : { size: l.sourceSize }),
    ...(l.shadowHardness === undefined ? {} : { hardness: l.shadowHardness }),
    ...(l.distance === undefined ? {} : { distance: l.distance }),
    ...(l.influence === undefined ? {} : { influence: l.influence }),
  };
}

/**
 * Exprime la lumière (définie dans le monde) dans le repère local d'un objet tourné de
 * `rotationDeg` (rotation SVG, sens horaire). C'est ce qui garde reflets et ombres
 * cohérents quand un objet est pivoté : la lumière ne tourne PAS avec lui.
 */
export function toLocal(v: LightVector, rotationDeg: number): LightVector {
  const a = rad(rotationDeg);
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { ...v, x: v.x * c + v.y * s, y: -v.x * s + v.y * c };
}

/**
 * Composantes xy du vecteur médian normalisé H = normalize(L + V), avec V = (0,0,1).
 * Sur une sphère vue de face (projection orthographique), le point de réflexion spéculaire
 * se trouve à centre + H.xy × rayon : c'est la formule exacte, pas une approximation stylisée.
 */
export function halfVectorXY(v: LightVector): { x: number; y: number } {
  const hz = v.z + 1;
  const n = Math.hypot(v.x, v.y, hz);
  return { x: v.x / n, y: v.y / n };
}

/** Direction 2D unitaire de la lumière (vers la source). (0,-1) si la lumière est de face. */
export function direction2D(v: LightVector): { x: number; y: number } {
  const n = Math.hypot(v.x, v.y);
  return n < 1e-6 ? { x: 0, y: -1 } : { x: v.x / n, y: v.y / n };
}

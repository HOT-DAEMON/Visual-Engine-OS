import { memoPure } from '../perf';
import { FaceParams } from '../schema';
import { bezierChain, sampleChain, type Bez } from './spline';
import { boneGeometry, type BoneGeo } from './bone';
import { facePoints } from './face-profile';
import { skullFrame, type Frame } from './frame';
import { neckGeometry, type NeckGeo } from './neck';
import { SkullParams, type CPoint } from './types';
import { vaultPoints, type VaultPts } from './vault';

/** Géométrie complète de la tête en profil : contour de peau, os, tissus mous, cou. Fonction PURE, mémoïsée par contenu (`src/perf`). */
export interface SkullGeo {
  readonly H: number;
  readonly frame: Frame;
  readonly vault: VaultPts;
  readonly neck: NeckGeo;
  readonly bone: BoneGeo;
  /** Points du contour de peau, de la base du dos au bas devant (chaîne OUVERTE : le bas est une coupe). */
  readonly sil: readonly CPoint[];
  readonly chain: readonly Bez[];
  readonly skin: ReadonlyMap<string, CPoint>;
  /** Échantillons du contour (mesures de vérification). */
  readonly poly: readonly { x: number; y: number }[];
  readonly params: SkullParams;
}

function skullGeometryRaw(faceIn: unknown, skIn: unknown, H: number): SkullGeo {
  const face = FaceParams.parse(faceIn);
  const sk = SkullParams.parse(skIn);
  const frame = skullFrame(face, sk, H);
  const vault = vaultPoints(frame, sk);
  const faceP = facePoints(face, sk, frame);
  const neck = neckGeometry(face, sk, frame, vault);
  const sil: CPoint[] = [...neck.back, ...[...vault.back].reverse(), ...[...vault.front].reverse(), ...faceP, ...neck.front];
  const skin = new Map<string, CPoint>();
  for (const p of sil) if (p.id) skin.set(p.id, p);
  const bone = boneGeometry(face, sk, frame, skin, neck);
  const chain = bezierChain(sil, false);
  return { H, frame, vault, neck, bone, sil, chain, skin, poly: sampleChain(chain, 12), params: sk };
}

export const skullGeometry: (face: unknown, sk: unknown, H: number) => SkullGeo = memoPure('skullGeometry', 'geometry', skullGeometryRaw, 256);

/** Indice, dans `poly`, de l'échantillon qui coïncide avec le point nommé `id` du contour (12 échantillons par segment). */
export const polyIndex = (g: SkullGeo, id: string): number => g.sil.findIndex((p) => p.id === id) * 12;

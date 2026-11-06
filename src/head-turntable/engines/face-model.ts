import { memoPure } from '../../perf';
import { FaceParams } from '../../schema';
import { faceLandmarks, type FaceLandmarks } from '../../face/landmarks';
import { skullGeometry, type SkullGeo } from '../../skull/geometry';
import { noseGeometry } from '../../face/nose';
import { mouthGeometry } from '../../face/mouth/geometry';
import type { NoseGeometry } from '../../face/nose';
import type { MouthGeo } from '../../face/mouth/types';
import { ENGINE_FIT, type EngineFit } from './engine-fit';
import { H_PX } from './units';

/** Tête issue des moteurs existants : paramètres validés + repères + profil du crâne + nez + bouche (px de l'hôte, H = 1000). */
export interface EngineHead {
  readonly fit: EngineFit;
  readonly p: FaceParams;
  readonly lm: FaceLandmarks;
  readonly sk: SkullGeo;
  readonly nose: NoseGeometry;
  readonly mouth: MouthGeo;
}

const deepMerge = (a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> => {
  const o: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b)) o[k] = v && typeof v === 'object' && !Array.isArray(v) && typeof o[k] === 'object' ? deepMerge(o[k] as Record<string, unknown>, v as Record<string, unknown>) : v;
  return o;
};

function buildRaw(fit: EngineFit): EngineHead {
  const p = FaceParams.parse(fit.face);
  const lm = faceLandmarks(p, fit.W, H_PX);
  return { fit, p, lm, sk: skullGeometry(p, fit.skull, H_PX), nose: noseGeometry(p, lm), mouth: mouthGeometry(p, lm) };
}
const buildMemo = memoPure('headTurnEngine', 'geometry', (json: string): EngineHead => buildRaw(JSON.parse(json) as EngineFit), 32);

/** Tête des moteurs pour un jeu de paramètres (mémoïsée par contenu). `patch` surcharge `face` (fusion profonde) : sert à l'ajustement et aux tests. */
export function engineHead(fit: EngineFit = ENGINE_FIT, patch: Record<string, unknown> = {}): EngineHead {
  const f: EngineFit = Object.keys(patch).length ? { ...fit, face: deepMerge(fit.face as Record<string, unknown>, patch) } : fit;
  return buildMemo(JSON.stringify(f));
}

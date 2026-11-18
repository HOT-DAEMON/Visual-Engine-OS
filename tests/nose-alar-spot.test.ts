/**
 * Tache claire de l'aile proche à 45° (pyramide) — docs/NOSE-ALAR-SPOT.md.
 * Cause mesurée : la lumière de rebond est coupée par un seuil d'occlusion ; l'aile (occlusion 0,60) le franchit, la joue voisine (0,75) non → ovale clair à bord net.
 * Correctif : `bounceAo` donne à l'aile l'occlusion de la face qui l'entoure, POUR LE REBOND SEULEMENT.
 */
import { describe, expect, it } from 'vitest';
import { head3dSubject } from '../src/render/head-3d';
import { hostOf } from '../scripts/nose-refs/alar-overflow';
import { gbufOf, spotOf } from '../scripts/nose-refs/alar-spot-measure';
import { reliefLight } from '../src/head-turntable/paint';
import { alaWeigher } from '../src/head-turntable/nose-light';
import { PART } from '../src/head-turntable/mesh';
import { v3 } from '../src/head-turntable/math';
import { lightModelOfSpec, patternById } from '../src/relief';

const q = patternById('three-quarter-right'), model = lightModelOfSpec({} as never, { style: q.style, shadowHue: q.shadowHue, bias: q.bias, light: { azimuthDeg: q.azimuthDeg, elevationDeg: q.elevationDeg, shadowHardness: q.hardness, sourceSize: q.sourceSize } } as never);
const subject = (seed: number) => head3dSubject(hostOf(seed, 'pyramide'), {} as never).spec;

describe('occlusion du rebond sur les ailes du nez', () => {
  it('invariants : seuls les pixels d\'aile changent, jamais vers le bas, et `ao` (terme direct) reste intact', () => {
    const { spec, view, g, ppuHi } = gbufOf(subject(11), 45), rl = reliefLight(spec, g, { lineU: 0.022, ppuHi, light: model, shadowTint: null }, model, view), weigh = alaWeigher(spec);
    let changed = 0;
    for (let k = 0; k < g.w * g.h; k++) {
      const wing = g.id[k] === PART.bump && weigh(v3(g.P[3 * k]!, g.P[3 * k + 1]!, g.P[3 * k + 2]!)) > 0;
      if (!wing) expect(rl.aoBounce[k]).toBe(rl.ao[k]);
      else { expect(rl.aoBounce[k]!).toBeGreaterThanOrEqual(rl.ao[k]! - 1e-6); if (rl.aoBounce[k]! > rl.ao[k]! + 1e-3) changed++; }
    }
    expect(changed).toBeGreaterThan(50);   // le correctif agit bien sur l'aile (sinon le test ne prouverait rien)
  });
  it('rendu : à 45° la pyramide n\'a plus d\'aile plus claire que la joue de plus de 10 % (graine 11 : 1,165 avant correctif, 1,067 après)', () => {
    const s = spotOf(subject(11), 45); expect(s).not.toBeNull();
    expect(s!.ratio).toBeLessThanOrEqual(1.1);
  }, 60000);
});

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ARCHETYPES, type BodyInput } from '../src/body';
import { bodyVolumes } from '../src/body/volume';
import { lightModelOf, litFigure } from '../src/relief';
import { clearLayerCaches } from '../src/perf';
import { bodyHost } from '../scripts/lib/body-host';

/** Contrat d'immuabilité des entrées et des valeurs en cache : le rendu ne MODIFIE ni le jeu de volumes (le cache du G-buffer le désigne par identité), ni les tampons de la tête. */
const BH = bodyHost(), m = (az: number) => lightModelOf({ azimuthDeg: az, elevationDeg: 38, shadowHardness: 0.5, sourceSize: 0.4 }, { style: 'soft' });
const deepFreeze = <T,>(o: T): T => { if (o && typeof o === 'object' && !ArrayBuffer.isView(o) && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o as object)) deepFreeze(v); } return o; };
const sha = (a: Float32Array): string => createHash('sha1').update(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)).digest('hex');
describe('immuabilité', () => {
  it('un jeu de volumes gelé en profondeur est rendu sans erreur (le moteur ne le modifie pas)', () => {
    const set = deepFreeze(bodyVolumes(ARCHETYPES.thin as BodyInput, BH.a, {}));
    clearLayerCaches();
    expect(() => litFigure(BH.svg, BH.o, BH.skin, set, m(305), { heightPx: 300 })).not.toThrow(); // en mode strict (modules ES), écrire dans un objet gelé lèverait
    expect(() => litFigure(BH.svg, BH.o, BH.skin, set, m(60), { heightPx: 300 })).not.toThrow(); // couches chaudes
  });
  it('bodyVolumes est mémoïsé par contenu (mêmes entrées → même objet, donc même clé de cache) ; un autre corps donne un autre jeu et une autre image', () => {
    const a = bodyVolumes(ARCHETYPES.thin as BodyInput, BH.a, {}), b = bodyVolumes(ARCHETYPES.thin as BodyInput, BH.a, {}), c = bodyVolumes(ARCHETYPES.obese as BodyInput, BH.a, {});
    expect(a).toBe(b); expect(c).not.toBe(a); clearLayerCaches();
    const fa = litFigure(BH.svg, BH.o, BH.skin, a, m(305), { heightPx: 300 }).svg;
    expect(litFigure(BH.svg, BH.o, BH.skin, b, m(305), { heightPx: 300 }).svg).toBe(fa);
    expect(litFigure(BH.svg, BH.o, BH.skin, c, m(305), { heightPx: 300 }).svg).not.toBe(fa);
  });
  it('les tampons de la tête servis par le cache ne sont jamais modifiés par un rendu suivant', () => {
    const set = bodyVolumes(ARCHETYPES.thin as BodyInput, BH.a, {}); clearLayerCaches();
    const f1 = litFigure(BH.svg, BH.o, BH.skin, set, m(305), { heightPx: 300 }), before = [sha(f1.head.cast), sha(f1.head.field.depth)];
    litFigure(BH.svg, BH.o, BH.skin, set, m(305), { heightPx: 300, ao: 0.9, groove: 1 }); litFigure(BH.svg, BH.o, BH.skin, set, m(120), { heightPx: 300 });
    expect([sha(f1.head.cast), sha(f1.head.field.depth)]).toEqual(before);
  });
});

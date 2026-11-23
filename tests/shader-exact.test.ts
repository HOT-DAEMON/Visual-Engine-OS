import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/prng';
import { lightModelOf, shadeAt, shaderOf, type LitStyle, type ShadeOut } from '../src/relief/model';

/** `shaderOf` (sans allocation, invariants hoistés) ≡ `shadeAt` au bit près : 3 styles × 40 lumières × 2 000 normales aléatoires (non normalisées comprises). */
describe('shaderOf ≡ shadeAt (bit à bit)', () => {
  it('tous les styles, biais, duretés, intensités', () => {
    const rnd = mulberry32(424242), out: ShadeOut = { lit: 0, core: 0, rim: 0, spec: 0 };
    for (const style of ['soft', 'cel2', 'cel3'] as LitStyle[]) for (let i = 0; i < 40; i++) {
      const m = lightModelOf({ azimuthDeg: rnd() * 360, elevationDeg: 5 + rnd() * 85, shadowHardness: rnd(), sourceSize: rnd(), intensity: 0.2 + rnd() * 0.8 } as never, { style, bias: rnd() < 0.5 ? 0 : rnd() * 0.3 - 0.1, contrast: 0.6 + rnd() }), f = shaderOf(m);
      for (let k = 0; k < 2000; k++) {
        const z = k % 9 === 0 ? -rnd() : rnd(), n = { x: rnd() * 2 - 1, y: rnd() * 2 - 1, z }, cast = rnd(), ao = rnd(), gobo = k % 5 === 0 ? rnd() : 1, ref = shadeAt(m, n, cast, ao, gobo);
        f(n.x, n.y, n.z, cast, ao, gobo, out);
        expect(Object.is(out.lit, ref.lit) && Object.is(out.core, ref.core) && Object.is(out.rim, ref.rim) && Object.is(out.spec, ref.spec), `${style} #${i}/${k}`).toBe(true);
      }
    }
  });
});

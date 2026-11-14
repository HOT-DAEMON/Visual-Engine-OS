import { describe, expect, it } from 'vitest';
import { EXTENDED_IDENTITIES, extendedPair } from '../src/generation/eye-pool';
import { generateRandomFace } from '../src/generation/random-face';
import { verifyEye } from '../src/verify/eye';

describe('generateRandomFace : yeux de la galerie étendue (48 + 100)', () => {
  it('eyeSource "extended" : déterministe, identité dans [0, 147], toutes les identités atteignables', () => {
    const a = generateRandomFace(77, { eyeSource: 'extended' }); expect(JSON.stringify(a)).toBe(JSON.stringify(generateRandomFace(77, { eyeSource: 'extended' })));
    const ids = new Set<number>(); for (let s = 1; s <= 300; s++) ids.add(generateRandomFace(s, { eyeSource: 'extended' }).identity as number);
    for (const i of ids) { expect(i).toBeGreaterThanOrEqual(0); expect(i).toBeLessThan(EXTENDED_IDENTITIES); }
    expect([...ids].filter((i) => i >= 48).length).toBeGreaterThan(40);
  });
  it('l’identité imposée est consommée : une forme de la galerie des 100 se retrouve sur le visage', () => {
    const f = generateRandomFace(5, { eyeSource: 'extended', identity: 60 }); const want = extendedPair(60).left as any; const got = f.objects.find((o: any) => o.id.endsWith('eye-left')) as any;
    expect(f.identity).toBe(60); expect(got.shape.style).toBe(want.shape.style); expect(got.iris.aspect).toBeCloseTo(want.iris.aspect, 6);
  });
  it('le flux par défaut ("gallery") est inchangé : mêmes 48 identités qu’avant, sans identité ≥ 48', () => {
    for (let s = 1; s <= 60; s++) { const i = generateRandomFace(s).identity as number; expect(i).toBeLessThan(48); }
    expect(() => generateRandomFace(1, { eyeSource: 'extended', identity: 148 })).toThrow();
  });
  it('les yeux des identités étendues passent verifyEye', () => {
    for (let i = 48; i < EXTENDED_IDENTITIES; i += 7) { const r = verifyEye(extendedPair(i).right as never); expect(r.ok, `${i}: ${r.failures.map((x: any) => x.id)}`).toBe(true); }
  });
});

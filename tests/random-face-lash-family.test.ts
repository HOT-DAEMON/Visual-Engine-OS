import { describe, expect, it } from 'vitest';
import { generateRandomFace } from '../src/generation/random-face';
import { LASH_FAMILY_IDS, lashFamilyForSeed } from '../src/generation/eye-lash-families';

type EyeLike = { lashes: { upper: { count: number; bendDeg: number } } };
const eyes = (f: ReturnType<typeof generateRandomFace>) => f.objects.filter((o) => o.kind === 'eye') as unknown as EyeLike[];

describe('generateRandomFace : option lashFamily', () => {
  it('sans l’option, les visages sont inchangés (mêmes paramètres, mêmes yeux)', () => {
    const a = generateRandomFace(1234); const b = generateRandomFace(1234, { lashFamily: null });
    expect(JSON.stringify(b.objects)).toBe(JSON.stringify(a.objects));
  });
  it('avec "auto", seuls les cils des yeux changent : le visage (host, params) est identique', () => {
    const a = generateRandomFace(1234); const b = generateRandomFace(1234, { lashFamily: 'auto' });
    expect(JSON.stringify(b.params)).toBe(JSON.stringify(a.params)); expect(b.identity).toBe(a.identity);
    expect(JSON.stringify(eyes(b))).not.toBe(JSON.stringify(eyes(a)));
  });
  it('"auto" est déterministe, couvre les 10 familles sur 400 graines, et les deux yeux ont la même famille', () => {
    const seen = new Set<string>();
    for (let s = 1; s <= 400; s++) seen.add(lashFamilyForSeed(s));
    expect(seen.size).toBe(LASH_FAMILY_IDS.length);
    const f = generateRandomFace(77, { lashFamily: 'auto' }); const [l, r] = eyes(f);
    expect(JSON.stringify(l!.lashes)).toBe(JSON.stringify(r!.lashes));
    expect(JSON.stringify(generateRandomFace(77, { lashFamily: 'auto' }).objects)).toBe(JSON.stringify(f.objects));
  });
  it('une famille imposée est appliquée aux deux yeux (plume : bendDeg 38)', () => {
    const f = generateRandomFace(5, { lashFamily: 'plume', eyeSource: 'extended' });
    for (const e of eyes(f)) expect(e.lashes.upper.bendDeg).toBe(38);
  });
});

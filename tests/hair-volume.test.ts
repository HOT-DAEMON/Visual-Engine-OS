import { describe, expect, it } from 'vitest';
import { hairShellMesh, inHair, shellPoint, T_MIN } from '../src/head-turntable';
import { HeadRenders, headAnatomy, headGeometry, headStyle } from '../src/head-turntable/verify-head';
import { skullSurfacePoint } from '../src/head-turntable/mesh';
import { headRelief } from '../src/head-turntable/engines/head-relief';
import { subjectOf } from '../scripts/hair-volume/subject';
import type { CleanStyle } from '../scripts/lib/hair-faces';

const STYLES = ['buzz', 'short', 'spiky', 'curly', 'afro', 'bob', 'long', 'ponytail', 'bun', 'braids'] as CleanStyle[];

describe('volume de cheveux 3D : une coque par coiffure, même rotation que le crâne', () => {
  for (const st of STYLES) {
    it(`${st} : volume fini, coque au-dessus du crâne (≥ 0,9 T_MIN), pièces attendues`, () => {
      const s = subjectOf(st, 1, { seed: 9000 }).spec, v = s.hairVolume;
      expect(v, 'volume présent').toBeTruthy();
      const rel = headRelief(s.engine), D = Math.PI / 180;
      let n = 0;
      for (let y = 0.02; y < 0.98; y += 0.05) for (let th = -Math.PI; th < Math.PI; th += 15 * D) {
        if (!inHair(s, v!, th / D, y, -0.01)) continue;
        const p = shellPoint(s, v!, y, th, rel), q = skullSurfacePoint(s, rel, y, th);
        expect(Number.isFinite(p.x + p.y + p.z)).toBe(true);
        expect(Math.hypot(p.x - q.x, p.z - q.z)).toBeGreaterThanOrEqual(0.9 * T_MIN);
        n++;
      }
      expect(n).toBeGreaterThan(100);
      const parts = v!.parts.map((p) => p.kind);
      if (st === 'bun') expect(parts).toContain('bun');
      if (st === 'ponytail') expect(parts).toContain('tail');
      if (st === 'braids') expect(parts).toContain('braid');
      if (st === 'bob' || st === 'long') expect(v!.hang).not.toBeNull(); else expect(v!.hang).toBeNull();
      expect(hairShellMesh(s, v!).clip).toBeTypeOf('function');
    }, 120_000);
  }
  it('afro : gauche et droite moyennées (jamais penché)', () => {
    const v = subjectOf('afro' as CleanStyle, 1, { seed: 9000 }).spec.hairVolume!;
    expect(v.rL).toEqual(v.rR);
  }, 120_000);
});

describe('couche de vérification des cheveux 3D (head.hair3d.*)', () => {
  it('bun (graine 9000) : aucun contrôle dur n’échoue, sur les trois couches', () => {
    const s = subjectOf('bun' as CleanStyle, 1, { seed: 9000 }), R = new HeadRenders(s.spec), h = { id: 'f', spec: s.spec, lengthH: s.lengthH };
    const bad = [headGeometry(h, R), headAnatomy(h, R), headStyle(h, R)].flatMap((l) => l.checks).filter((c) => c.id.startsWith('head.hair3d') && c.kind === 'hard' && !c.ok);
    expect(bad.map((c) => `${c.id}=${c.value}`)).toEqual([]);
  }, 300_000);
});

import { describe, expect, it } from 'vitest';
import { generateRandomFace, SceneSpec } from '../src';
import { placedEyesByHost } from '../src/anatomy/placed';
import { visibilityOf } from '../src/neck/anatomy';
import { head3dSubject, hostEyesOf } from '../src/render/head-3d';
import { markColor, neckMark, neckReliefOf } from '../src/head-turntable/engines/neck-relief';
import { neckSection } from '../src/head-turntable/engines/neck3d';
import { HeadRenders } from '../src/head-turntable/verify-head';
import { neckReliefChecks } from '../src/head-turntable/verify-neck-relief';
import type { HeadTurnSpec } from '../src/head-turntable';
import type { HostSpec } from '../src/schema';

function subject(seed: number): HeadTurnSpec {
  const f = generateRandomFace(seed, { id: 'f0', transform: { x: 150, y: 220, scale: 0.8 } } as never);
  const sc = SceneSpec.parse({ width: 700, height: 460, objects: [...f.objects, { kind: 'head_3d', id: 't0', host: 'f0', resolution: 1 }] });
  const host = sc.objects.find((o) => o.kind === 'host') as HostSpec;
  return head3dSubject(host, { skull: {}, variation: { ci: 0, axes: {} }, hair: undefined, hairline: 'host' }, undefined, hostEyesOf(host, placedEyesByHost(sc).get('f0') ?? [])).spec;
}

describe('reliefs du cou 3D : SCM, platysma, clavicule (lus du moteur de cou)', () => {
  it('les visibilités sont celles du moteur de cou, pas une copie', () => {
    const spec = subject(11), R = neckReliefOf(spec.engine!), st = R.model.composition.structures;
    expect(R.scm).toBe(visibilityOf(st, 'scm')); expect(R.platysma).toBe(visibilityOf(st, 'platysma-infrahyoid')); expect(R.clavicle).toBe(visibilityOf(st, 'clavicle'));
  });
  for (const seed of [3, 11, 77]) {
    it(`graine ${seed} : insertion basse près du creux sus-sternal, attache haute latérale, couverture mesurée, pixels de creux dans l'image`, () => {
      const spec = subject(seed), cs = neckReliefChecks(spec, new HeadRenders(spec).at(0, true));
      expect(cs.map((c) => c.id)).toEqual(['head.neck.scm.insertion', 'head.neck.scm.mastoid', 'head.neck.scm.below-ear', 'head.neck.relief.coverage', 'head.neck.relief.pixels']);
      expect(cs.filter((c) => !c.ok)).toEqual([]);
    });
  }
  it('un point du cou est marqué sur le tracé du SCM et pas au milieu de la nuque ni du côté sans relief', () => {
    const spec = subject(11), e = spec.engine!, n = spec.neck, y = n.y1 - 0.1, s = neckSection(e, y, n.y1);
    let front = 0, back = 0;
    for (let i = 1; i < 150; i++) {
      const psi = (i / 150) * Math.PI;
      if (neckMark(spec, { x: s.a * Math.sin(psi), y, z: s.zc + s.b * Math.cos(psi) })) { if (psi < 0.5 * Math.PI) front++; else back++; }
    }
    expect(front).toBeGreaterThan(0);   // le SCM passe par la face antérieure près de sa base
    expect(back).toBe(0);               // la nuque n'a pas de SCM à cette hauteur
  });
  it('un cou invisible ne porte aucune marque ni contrôle', () => {
    const spec = subject(11), hidden = { ...spec, engine: { ...spec.engine!, p: { ...spec.engine!.p, neck: { ...spec.engine!.p.neck, visible: false } } } } as HeadTurnSpec;
    expect(neckMark(hidden, { x: 0.1, y: hidden.neck.y1 - 0.1, z: 0.3 })).toBe(false);
    expect(neckReliefChecks(hidden, new HeadRenders(hidden, 200).at(0, true))).toEqual([]);
  });
  it('la teinte d\'un creux est dérivée de la palette (ombre durcie vers l\'encre), sans nouveau ton libre', () => {
    const c = markColor({ shade: [100, 100, 100], ink: [0, 0, 0] });
    expect(c[0]).toBeCloseTo(70, 5);
  });
});

import { describe, expect, it } from 'vitest';
import { compileScene, expandScene, SceneSpec } from '../src';

function svgOf(input: unknown): string {
  const r = compileScene(input);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return r.svg;
}
function issuesOf(input: unknown): readonly string[] {
  const r = compileScene(input);
  if (r.ok) throw new Error('scène attendue invalide, mais validée');
  return r.issues;
}

const headHost = (over: Record<string, unknown> = {}) => ({
  kind: 'host',
  id: 'head',
  material: { preset: 'matte', color: '#eec9ad' },
  anchors: [{ id: 'l', x: -0.4 }, { id: 'r', x: 0.4 }],
  ...over,
});
const placedEye = (over: Record<string, unknown> = {}) => ({
  kind: 'eye',
  id: 'eyes',
  place: { host: 'head', anchors: ['l', 'r'] },
  ...over,
});

describe('validation de scène avec hôtes', () => {
  it('rejette un `place.host` introuvable, avec le bon chemin', () => {
    const issues = issuesOf({ objects: [placedEye({ place: { host: 'ghost', anchors: ['l'] } })] });
    expect(issues.some((m) => m.startsWith('objects.0.place.host'))).toBe(true);
  });

  it('rejette une ancre nommée introuvable dans l\'hôte', () => {
    const issues = issuesOf({ objects: [headHost(), placedEye({ place: { host: 'head', anchors: ['zzz'] } })] });
    expect(issues.some((m) => m.includes('zzz') && m.includes('introuvable'))).toBe(true);
  });

  it('rejette `place` sans ancre ni motif', () => {
    const issues = issuesOf({ objects: [headHost(), placedEye({ place: { host: 'head' } })] });
    expect(issues.some((m) => m.includes('au moins une ancre ou un motif'))).toBe(true);
  });

  it('rejette des ancres dupliquées au sein d\'un même hôte', () => {
    const issues = issuesOf({ objects: [headHost({ anchors: [{ id: 'l' }, { id: 'l' }] })] });
    expect(issues.some((m) => m.includes('ancre dupliquée'))).toBe(true);
  });

  it('accepte une scène hôte + placement valides, et produit un id par exemplaire', () => {
    const s = SceneSpec.parse({ objects: [headHost(), placedEye()] });
    const eyes = expandScene(s).filter((o) => o.kind === 'eye');
    expect(eyes.map((o) => o.id)).toEqual(['eyes-l', 'eyes-r']);
  });

  it('détecte un conflit d\'id entre deux placements différents', () => {
    const issues = issuesOf({
      objects: [
        headHost({ anchors: [{ id: 'l' }] }),
        { kind: 'eye', id: 'e', place: { host: 'head', anchors: ['l'] } },
        { kind: 'robot_eye', id: 'e', place: { host: 'head', anchors: ['l'] } },
      ],
    });
    expect(issues.some((m) => m.includes('dupliqué') && m.includes('e-l'))).toBe(true);
  });
});

describe('expansion : transformation monde et héritage', () => {
  it('une ancre décalée + tournée + mise à l\'échelle compose correctement avec la transform de l\'hôte', () => {
    const s = SceneSpec.parse({
      objects: [
        headHost({
          transform: { x: 100, y: 50, rotationDeg: 90, scale: 2 },
          anchors: [{ id: 'a', x: 0.5, y: 0, rotationDeg: 0, scale: 1 }],
          width: 200,
          height: 200,
        }),
        { kind: 'eye', id: 'e', place: { host: 'head', anchors: ['a'] } },
      ],
    });
    const [eye] = expandScene(s).filter((o) => o.kind === 'eye');
    // rx=ry=100 ; ancre locale = (0.5*100, 0) = (50, 0) ; hôte : rotation 90° horaire, échelle 2, translation (100,50)
    // (50,0) tourné 90° => (0,50) ; ×2 => (0,100) ; + (100,50) => (100,150)
    expect(eye?.transform.x).toBeCloseTo(100, 6);
    expect(eye?.transform.y).toBeCloseTo(150, 6);
    expect(eye?.transform.rotationDeg).toBeCloseTo(90, 6);
    expect(eye?.transform.scale).toBeCloseTo(2, 6);
  });

  it('outerSide "auto" devient "left" à gauche du centre de l\'hôte et "right" à droite', () => {
    const s = SceneSpec.parse({
      objects: [headHost(), placedEye({ shape: { outerSide: 'auto' } })],
    });
    const eyes = expandScene(s).filter((o) => o.kind === 'eye');
    const l = eyes.find((o) => o.id === 'eyes-l');
    const r = eyes.find((o) => o.id === 'eyes-r');
    if (l?.kind !== 'eye' || r?.kind !== 'eye') throw new Error('yeux attendus');
    expect(l.shape.outerSide).toBe('left');
    expect(r.shape.outerSide).toBe('right');
  });

  it('outerSide "auto" hors hôte retombe sur "right"', () => {
    const s = SceneSpec.parse({ objects: [{ kind: 'eye', id: 'e', shape: { outerSide: 'auto' } }] });
    const [eye] = expandScene(s);
    if (eye?.kind !== 'eye') throw new Error('œil attendu');
    expect(eye.shape.outerSide).toBe('right');
  });

  it('skin hérite du matériau de l\'hôte quand non spécifié, mais pas quand spécifié', () => {
    const withInherit = SceneSpec.parse({ objects: [headHost(), placedEye()] });
    const [e1] = expandScene(withInherit).filter((o) => o.kind === 'eye');
    if (e1?.kind !== 'eye') throw new Error('œil attendu');
    expect(e1.skin?.base).toEqual({ type: 'solid', color: '#eec9ad' });

    const explicit = SceneSpec.parse({
      objects: [headHost(), placedEye({ skin: { preset: 'matte', color: '#000000' } })],
    });
    const [e2] = expandScene(explicit).filter((o) => o.kind === 'eye');
    if (e2?.kind !== 'eye') throw new Error('œil attendu');
    expect(e2.skin?.base).toEqual({ type: 'solid', color: '#000000' });
  });

  it('variation "vary" décale la seed par exemplaire ; "same" la garde identique', () => {
    const s = SceneSpec.parse({ objects: [headHost(), placedEye({ seed: 5, place: { host: 'head', anchors: ['l', 'r'], variation: 'vary' } })] });
    const eyes = expandScene(s).filter((o) => o.kind === 'eye');
    const seeds = eyes.map((o) => (o.kind === 'eye' ? o.seed : -1));
    expect(new Set(seeds).size).toBe(2);

    const s2 = SceneSpec.parse({ objects: [headHost(), placedEye({ seed: 5 })] });
    const eyes2 = expandScene(s2).filter((o) => o.kind === 'eye');
    const seeds2 = eyes2.map((o) => (o.kind === 'eye' ? o.seed : -1));
    expect(new Set(seeds2).size).toBe(1);
  });
});

describe('rendu de scènes avec hôtes', () => {
  it('est déterministe et sans NaN/Infinity, sur un motif ring + line', () => {
    const scene = {
      objects: [
        {
          kind: 'host', id: 'h', material: { preset: 'satin', color: '#6aa84f' },
          patterns: [
            { type: 'ring', id: 'ring', count: 5, follow: 'surface' },
            { type: 'line', id: 'line', count: 3, from: { x: -1, y: 1 }, to: { x: 1, y: 1 } },
          ],
        },
        { kind: 'eye', id: 'e1', place: { host: 'h', patterns: ['ring'] } },
        { kind: 'robot_eye', id: 'e2', place: { host: 'h', patterns: ['line'] } },
      ],
    };
    const a = svgOf(scene);
    const b = svgOf(JSON.parse(JSON.stringify(scene)));
    expect(a).toBe(b);
    expect(a).not.toMatch(/NaN|Infinity/);
  });

  it('un hôte seul (sans objet placé dessus) se rend normalement', () => {
    expect(svgOf({ objects: [headHost()] })).not.toMatch(/NaN|Infinity/);
  });

  it('showAnchors ajoute des marqueurs visibles', () => {
    const svg = svgOf({ objects: [headHost({ showAnchors: true })] });
    expect(svg).toContain('#ff2d95');
  });
});

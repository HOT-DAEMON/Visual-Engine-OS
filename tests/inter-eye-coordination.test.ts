import { describe, expect, it } from 'vitest';
import { compileScene, HostSpec, resolveAnchors } from '../src';

/**
 * Position MONDE de la tête du sourcil (canthus interne) d'un œil placé sur un hôte.
 *
 * Le chemin du sourcil est exposé dans un groupe `<g id="${eyeId}-brow">` (voir eye.ts) dont le
 * premier chemin est le contour rempli ; son point de départ (M) est la tête du sourcil, exactement
 * le point que `pinch` déplace (voir browGeometry). Ce point est en repère LOCAL de l'œil : on lui
 * ajoute la position monde de l'ancre sur laquelle l'œil est posé (host.transform + ancre, tous deux
 * triviaux ici — pas de rotation/échelle) pour obtenir une position comparable entre les deux yeux.
 */
function browHeadWorldX(svg: string, eyeId: string, anchorWorldX: number): number {
  const groupRe = new RegExp(`<g id="${eyeId}-brow">([\\s\\S]*?)</g>`);
  const group = groupRe.exec(svg)?.[1];
  if (!group) throw new Error(`groupe sourcil introuvable : ${eyeId}-brow`);
  const d = /<path d="M([-\d.]+) ([-\d.]+)/.exec(group);
  if (!d) throw new Error(`chemin de sourcil introuvable dans ${eyeId}-brow`);
  return anchorWorldX + Number(d[1]);
}

// Hôte volontairement large par rapport aux yeux (valeurs par défaut) : à neutre, les deux têtes de
// sourcil sont clairement séparées du centre du visage (ni au centre, ni l'une sur l'autre), ce qui
// permet d'observer sans ambiguïté un rapprochement (colère) ou un écartement (peur) monotone.
const HOST = { kind: 'host', id: 'head', width: 600, height: 600, material: { preset: 'matte', color: '#eec9ad' }, anchors: [{ id: 'l', x: -0.4 }, { id: 'r', x: 0.4 }] };
const anchorX = resolveAnchors(HostSpec.parse(HOST));
const ANCHOR_L = anchorX.find((a) => a.id === 'l')?.x as number;
const ANCHOR_R = anchorX.find((a) => a.id === 'r')?.x as number;

function facePair(expressionKind: 'neutral' | 'angry' | 'fearful') {
  return {
    objects: [
      HOST,
      { kind: 'eye', id: 'eyes', place: { host: 'head', anchors: ['l', 'r'] }, shape: { outerSide: 'auto' }, expression: { kind: expressionKind, intensity: 1 } },
    ],
  };
}

function renderedSvg(expressionKind: 'neutral' | 'angry' | 'fearful'): string {
  const r = compileScene(facePair(expressionKind));
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return r.svg;
}

describe('coordination inter-yeux : convergence/écartement des sourcils sur un visage complet', () => {
  it('à neutre, les deux têtes de sourcil sont symétriques par rapport au centre du visage, et séparées (ni au centre, ni superposées)', () => {
    const svg = renderedSvg('neutral');
    const lx = browHeadWorldX(svg, 'eyes-l', ANCHOR_L);
    const rx = browHeadWorldX(svg, 'eyes-r', ANCHOR_R);
    expect(lx).toBeCloseTo(-rx, 6);
    expect(Math.abs(lx)).toBeGreaterThan(5); // marge franche : le test suivant a de la place pour être monotone
  });

  it("la colère RAPPROCHE les deux têtes de sourcil du centre du visage (convergence), sur les DEUX yeux", () => {
    const neutral = renderedSvg('neutral');
    const angry = renderedSvg('angry');
    const distNeutralL = Math.abs(browHeadWorldX(neutral, 'eyes-l', ANCHOR_L));
    const distNeutralR = Math.abs(browHeadWorldX(neutral, 'eyes-r', ANCHOR_R));
    const distAngryL = Math.abs(browHeadWorldX(angry, 'eyes-l', ANCHOR_L));
    const distAngryR = Math.abs(browHeadWorldX(angry, 'eyes-r', ANCHOR_R));
    expect(distAngryL).toBeLessThan(distNeutralL);
    expect(distAngryR).toBeLessThan(distNeutralR);
  });

  it("la peur ÉCARTE les deux têtes de sourcil du centre du visage (elles s'éloignent l'une de l'autre), sur les DEUX yeux", () => {
    const neutral = renderedSvg('neutral');
    const fearful = renderedSvg('fearful');
    const distNeutralL = Math.abs(browHeadWorldX(neutral, 'eyes-l', ANCHOR_L));
    const distNeutralR = Math.abs(browHeadWorldX(neutral, 'eyes-r', ANCHOR_R));
    const distFearfulL = Math.abs(browHeadWorldX(fearful, 'eyes-l', ANCHOR_L));
    const distFearfulR = Math.abs(browHeadWorldX(fearful, 'eyes-r', ANCHOR_R));
    expect(distFearfulL).toBeGreaterThan(distNeutralL);
    expect(distFearfulR).toBeGreaterThan(distNeutralR);
  });

  it("l'effet reste rigoureusement symétrique entre l'œil gauche et l'œil droit, à chaque émotion", () => {
    for (const kind of ['neutral', 'angry', 'fearful'] as const) {
      const svg = renderedSvg(kind);
      const l = browHeadWorldX(svg, 'eyes-l', ANCHOR_L);
      const r = browHeadWorldX(svg, 'eyes-r', ANCHOR_R);
      expect(l).toBeCloseTo(-r, 6);
    }
  });

  it('la convergence est monotone en intensité (0.25 < 0.75 < 1, toutes plus proches du centre que le neutre)', () => {
    const distances = [0, 0.25, 0.75, 1].map((intensity) => {
      const r = compileScene({
        objects: [
          HOST,
          { kind: 'eye', id: 'e', place: { host: 'head', anchors: ['l', 'r'] }, shape: { outerSide: 'auto' }, expression: { kind: 'angry', intensity } },
        ],
      });
      if (!r.ok) throw new Error(r.issues.join('\n'));
      return Math.abs(browHeadWorldX(r.svg, 'e-l', ANCHOR_L));
    });
    for (let i = 1; i < distances.length; i++) expect(distances[i]).toBeLessThan(distances[i - 1] as number);
  });

  it('ne casse rien à aucune combinaison émotion × intensité, sur les deux yeux', () => {
    for (const kind of [
      'angry',
      'sad',
      'fearful',
      'anguished',
      'melancholic',
      'drowsy',
      'surprised',
      'sulky',
      'furious',
      'joyful',
      'smiling',
      'fierce',
      'stressed',
    ] as const) {
      for (const intensity of [0.25, 0.75, 1]) {
        const r = compileScene({
          objects: [
            HOST,
            { kind: 'eye', id: 'e', place: { host: 'head', anchors: ['l', 'r'] }, shape: { outerSide: 'auto' }, expression: { kind, intensity } },
          ],
        });
        if (!r.ok) throw new Error(r.issues.join('\n'));
        expect(r.svg).not.toMatch(/NaN|Infinity/);
      }
    }
  });
});

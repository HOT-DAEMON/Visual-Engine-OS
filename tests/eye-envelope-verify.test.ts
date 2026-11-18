import { describe, expect, it } from 'vitest';
import { openingGeometry, openingProfile } from '../src/geometry/eye';
import { Canthi } from '../src/schema/eye-canthi-fold';
import { Shape } from '../src/schema/eye-shape';
import { NATURAL_STYLES, checkEyeEnvelope, peaks } from '../src/verify/eye-envelope';
import { verifyEye } from '../src/verify/eye';

const STYLES = ['almond', 'round', 'sharp', 'drooping', 'chibi', 'angular', 'compressed', 'rounded_rect', 'triangle', 'circle', 'diamond', 'diamond_v2'] as const;
describe('vérification de l’enveloppe (couches géométrie / anatomie / style)', () => {
  it('peaks() distingue une bosse, deux bosses et un plateau', () => {
    expect(peaks([0, 1, 2, 3, 2, 1, 0])).toBe(1);
    expect(peaks([0, 2, 1, 2, 0])).toBe(2);
    expect(peaks([0, 0, 0, 0])).toBe(0);
  });
  it('les 12 enveloppes par défaut passent les contrôles géométriques (error)', () => {
    for (const s of STYLES) { const g = openingGeometry(Shape.parse({ style: s }), Canthi.parse({})); const bad = checkEyeEnvelope(g, s, 40).filter((c) => !c.ok && c.severity === 'error'); expect(bad, s).toEqual([]); }
  });
  it('l’almond par défaut ne déclenche aucun avertissement anatomie/style sur l’enveloppe', () => {
    const g = openingGeometry(Shape.parse({ style: 'almond' }), Canthi.parse({}));
    const p = openingProfile(g);
    expect(checkEyeEnvelope(g, 'almond', (p.aspect * g.w) / 2).filter((c) => !c.ok)).toEqual([]);
  });
  it('les styles stylisés sont exclus des bornes humaines', () => { expect(NATURAL_STYLES).not.toContain('round'); expect(NATURAL_STYLES).not.toContain('chibi'); });
  it('un sommet décentré hors plage mesurée est signalé (warn) sur un style naturel', () => {
    const g = openingGeometry(Shape.parse({ style: 'drooping' }), Canthi.parse({}));
    const w = checkEyeEnvelope({ ...g, u1: { x: g.pi.x + g.w * 0.02, y: g.u1.y }, u2: { x: g.po.x - g.w * 0.6, y: g.u2.y } }, 'drooping', 50);
    expect(w.some((c) => !c.ok && c.severity === 'warn' && c.id.startsWith('upper-peak'))).toBe(true);
  });
  it('verifyEye accepte un œil amande par défaut (les contrôles d’enveloppe y sont branchés)', () => {
    expect(verifyEye({ kind: 'eye', id: 'e', shape: { style: 'almond' } } as never).ok).toBe(true);
  });
});

describe('PASSE 7 : contrat de hauteur et angles d’ouverture de l’almond', () => {
  const OLD_ALMOND = { u1dx: 1.077, u1dy: 0.966, u2dx: 1.028, u2dy: 0.985, l1dx: 0.814, l1dy: 1.049, l2dx: 2.171, l2dy: 0.824 };   // facteurs de la PASSE 3 (hauteur −3,1 %)
  const sweep = (): string[] => {
    const bad: string[] = [];
    for (const asp of [0.35, 0.45, 0.55, 0.65]) for (const upF of [0.5, 0.62, 0.72]) for (const tilt of [-4, 2, 8, 14]) {
      const g = openingGeometry(Shape.parse({ style: 'almond', width: 240, height: 240 * asp, upperFraction: upF, tiltDeg: tilt }), Canthi.parse({}));
      for (const c of checkEyeEnvelope(g, 'almond', 0)) if (!c.ok && /height-contract|canthus-opening/.test(c.id)) bad.push(`${asp}/${upF}/${tilt} ${c.id}`);
    }
    return bad;
  };
  it('almond réajusté : 0 écart sur 48 combinaisons (aspect × fraction haute × inclinaison)', () => { expect(sweep()).toEqual([]); });
  it('la règle DÉTECTE le défaut d’avant : avec les facteurs de la PASSE 3, la hauteur obtenue est en dessous de la hauteur demandée', async () => {
    const { ALMOND_REF } = await import('../src/geometry/eye');
    const keep = { ...ALMOND_REF };
    Object.assign(ALMOND_REF, OLD_ALMOND);
    try { expect(sweep().some((s) => s.includes('envelope-height-contract'))).toBe(true); } finally { Object.assign(ALMOND_REF, keep); }
  });
  it('les angles de canthus mesurés (04, 07, 11) sont dans les plages du contrôle, calculés par la MÊME définition que le moteur', async () => {
    const { readFileSync } = await import('node:fs');
    const { canthusChordAngles, REF_RANGES } = await import('../src/geometry/eye');
    const M = JSON.parse(readFileSync('references/eyes/measures.json', 'utf8')).eyes as Record<string, { upperProfile: number[]; lowerProfile: number[] }>;
    for (const k of ['04', '07', '11']) {
      const a = canthusChordAngles(M[k]!.upperProfile, M[k]!.lowerProfile);
      expect(a.inner, k).toBeGreaterThanOrEqual(REF_RANGES.canthusChordInner[0]); expect(a.inner, k).toBeLessThanOrEqual(REF_RANGES.canthusChordInner[1]);
      expect(a.outer, k).toBeGreaterThanOrEqual(REF_RANGES.canthusChordOuter[0]); expect(a.outer, k).toBeLessThanOrEqual(REF_RANGES.canthusChordOuter[1]);
    }
  });
  it('sharp et drooping : écart de hauteur CONNU et borné (−19 % à −35 %), documenté, pas masqué', () => {
    for (const style of ['sharp', 'drooping'] as const) {
      const g = openingGeometry(Shape.parse({ style, width: 240, height: 240 * 0.55 }), Canthi.parse({}));
      const rel = (openingProfile(g).aspect - g.hEff / g.w) / (g.hEff / g.w);
      expect(rel, style).toBeLessThan(-0.1); expect(rel, style).toBeGreaterThan(-0.45);
    }
  });
});

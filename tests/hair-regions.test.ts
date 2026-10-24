import { describe, expect, it } from 'vitest';
import { generateRandomFace } from '../src';
import { faceLandmarks, hairGeometry } from '../src/face';
import { PROFILES } from '../src/face/hair/sim/profiles';
import { sideSpan, depthLimit, TEMPLE_MAX, EYE_BAND_MAX, CHEEK_MAX } from '../src/face/hair/sim/regions';
import { HAIR_ARCHETYPES } from '../src/schema';
import { verifyFace } from '../src/verify';

const CEL = { shading: { mode: 'cel', bands: 3, highlightBand: 0.6, castShadow: 0.8 } };
const mk = (archetype: string, extra: Record<string, unknown> = {}) =>
  generateRandomFace(321, { identity: 3, hairEngine: 'classic', facialHair: { mustache: 'none', beard: 'none' }, hair: { style: 'short', texture: 'straight', fringe: 'none', color: '#23232b', seed: 5, volume: 0.5, density: 0.85, part: 0.2, appearance: CEL, sim: { enabled: true, archetype, ...extra } } } as never);
const geoOf = (f: ReturnType<typeof mk>) => hairGeometry(f.params, faceLandmarks(f.params, f.width, f.height))!;
const ARCH = HAIR_ARCHETYPES.filter((a) => a !== 'none');

describe('masses de région (tempes, pattes, nuque, joues)', () => {
  it('désactivées par défaut : aucune masse de zone, rendu historique inchangé', () => {
    const g = geoOf(mk('side_sweep'));
    expect(g.locks.some((l) => l.zone !== undefined)).toBe(false);
    expect(g.shaved ?? []).toHaveLength(0);
  });

  it('chaque archétype a un profil', () => {
    for (const a of ARCH) expect(PROFILES[a], a).toBeDefined();
  });

  it('les longueurs sont propres à chaque coiffure : hime > messy_bangs > swept_back', () => {
    const end = (a: string): number => {
      const f = mk(a, { regions: true });
      const lm = faceLandmarks(f.params, f.width, f.height);
      return sideSpan(lm, PROFILES[a]!.region).yEnd;
    };
    expect(end('hime')).toBeGreaterThan(end('messy_bangs'));
    expect(end('messy_bangs')).toBeGreaterThan(end('swept_back'));
  });

  it('zones rasées : produites pour les undercuts, absentes ailleurs', () => {
    expect(geoOf(mk('quiff_undercut', { regions: true })).shaved?.length).toBe(2);
    expect(geoOf(mk('bun_undercut', { regions: true })).shaved?.length).toBe(2);
    expect(geoOf(mk('messy_bangs', { regions: true })).shaved?.length ?? 0).toBe(0);
  });

  it('la limite de profondeur suit les 3 zones : tempe > joue > bande des yeux', () => {
    const f = mk('tousled', { regions: true });
    const lm = faceLandmarks(f.params, f.width, f.height);
    expect(depthLimit(lm, lm.eyeY - 0.3 * lm.H)).toBeCloseTo(TEMPLE_MAX, 3);
    expect(depthLimit(lm, lm.eyeY)).toBeCloseTo(EYE_BAND_MAX, 3);
    expect(depthLimit(lm, lm.eyeY + 0.2 * lm.H)).toBeCloseTo(CHEEK_MAX, 3);
  });

  it('nuque courte : jamais devant la tête ; tous les sommets finis', () => {
    for (const a of ARCH) {
      const g = geoOf(mk(a, { regions: true }));
      expect(g.locks.filter((l) => l.zone === 'nape').every((l) => l.layer === 'back'), a).toBe(true);
      expect(g.locks.every((l) => l.poly.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y))), a).toBe(true);
    }
  });
});

describe('vérification : yeux, sourcils, nez, bouche protégés ; reste autorisé par zone', () => {
  it.each(ARCH)('%s (régions + encre) : aucun échec', (a) => {
    const r = verifyFace(mk(a, { regions: true, ink: true }));
    expect(r.failures.map((c) => `${c.id}=${c.value}`)).toEqual([]);
  }, 60000);
});

describe('rendu encre', () => {
  it('noir franc, bandes blanches, contours noirs, zéro dégradé de mèche', () => {
    const r = verifyFace(mk('side_sweep', { regions: true, ink: true }));
    for (const id of ['ink-flat-fill', 'ink-white-bands', 'ink-outline']) expect(r.checks.find((c) => c.id === id)?.ok, id).toBe(true);
  }, 60000);
});

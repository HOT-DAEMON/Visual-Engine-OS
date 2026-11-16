import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Mesures d'iris colorés (réfs 14 et 15 rangées 3–5) : une mesure `fiable` doit avoir passé le critère automatique ET la relecture visuelle consignée ; rien n'est écarté en silence. */
interface Eye { id: string; confidence: string; autoConfidence?: string; humanReview?: string; rx?: number; ry?: number; aspect?: number }
const doc = JSON.parse(readFileSync('references/eyes/measures-iris-colour.json', 'utf8')) as { eyes: Eye[]; notMeasured: string[] };

describe('mesures d’iris colorés', () => {
  it('12 yeux consignés (14-00..14-05, 15-04..15-09), aucun écarté en silence', () => {
    expect(doc.eyes.map((e) => e.id).sort()).toEqual(['14-00', '14-01', '14-02', '14-03', '14-04', '14-05', '15-04', '15-05', '15-06', '15-07', '15-08', '15-09']);
  });
  it('« fiable » = critère automatique ET relecture visuelle « ok »', () => {
    for (const e of doc.eyes.filter((x) => x.confidence === 'fiable')) { expect(e.autoConfidence, e.id).toBe('fiable'); expect(e.humanReview, e.id).toBe('ok'); }
  });
  it('au moins 7 mesures fiables, plausibles (demi-largeur 0,1–0,35 L ; hauteur/largeur 0,9–1,6)', () => {
    const ok = doc.eyes.filter((e) => e.confidence === 'fiable');
    expect(ok.length).toBeGreaterThanOrEqual(7);
    for (const e of ok) { expect(e.rx as number, e.id).toBeGreaterThan(0.1); expect(e.rx as number, e.id).toBeLessThan(0.35); expect(e.aspect as number, e.id).toBeGreaterThan(0.9); expect(e.aspect as number, e.id).toBeLessThan(1.6); }
  });
  it('la silhouette de la réf. 14 est consignée « non mesurable », pas inventée', () => {
    expect(doc.notMeasured.join(' ')).toMatch(/silhouette.*14/);
  });
});

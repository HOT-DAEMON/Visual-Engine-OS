import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { faceLandmarks, noseGeometry, noseArchetype } from '../src/face';
import { noseView } from '../src/face/nose/underview';
import { rotateProject3 } from '../src/face/nose/underview';
import { inPoly } from '../src/face/poly';
import { lightModelOf, underviewRelief, litUnderview } from '../src/relief';
import { FaceParams } from '../src/schema';

const nose = (patch: object = {}) => { const p = FaceParams.parse({ anatomyEngine: 'structured', ...patch }); return noseGeometry(p, faceLandmarks(p, 300, 380)); };
const SKIN = '#d8a47c', LIGHT = (az: number) => lightModelOf({ azimuthDeg: az, elevationDeg: 45, color: '#ffffff', intensity: 1, sourceSize: 0.3 }, { style: 'soft' });

describe('vue de dessous éclairée par le moteur unique (src/relief) — preuves de rendu', () => {
  it('la carte de profondeur est sans trou à l\'intérieur de la silhouette projetée (lobule, ailes, columelle)', () => {
    for (const pitch of [20, 40, 60]) {
      const g = nose(), r = underviewRelief(g, { pitchDeg: pitch }), v = noseView(g, pitch); let inside = 0, holes = 0;
      for (let j = 0; j < r.grid.h; j += 2) for (let i = 0; i < r.grid.w; i += 2) {
        const x = r.grid.x0 + (i + 0.5) / r.grid.ppu, y = r.grid.y0 + (j + 0.5) / r.grid.ppu;
        if (!inPoly(v.lobule, x, y)) continue; inside++; if (r.field.depth[j * r.grid.w + i] === -Infinity) holes++;
      }
      expect(inside).toBeGreaterThan(200); expect(holes, `tangage ${pitch}`).toBe(0);
    }
  });
  it('les cavités de narine sont plus profondes que la peau qui les entoure (et présentes à 40°)', () => {
    const r = underviewRelief(nose(), { pitchDeg: 40 }); let cs = 0, cn = 0, ns = 0, nn = 0;
    for (let k = 0; k < r.grid.w * r.grid.h; k++) { const d = r.field.depth[k]!; if (d === -Infinity) continue; if (r.cavity[k]) { cs += d; cn++; } else if (r.field.region[k] === 3) { ns += d; nn++; } }
    expect(cn).toBeGreaterThan(100); expect(cs / cn).toBeLessThan(ns / nn);
  });
  it('la columelle est une MASSE : sa hauteur décroît du lobule vers le sous-nez, avec un volume mesurable au-dessus du plan de peau', () => {
    const g = nose(), r = underviewRelief(g, { pitchDeg: 0 }), c = g.regions.columella, at = (y: number): number => {
      const q = rotateProject3({ x: 0, y, z: 0 }, g.baseY, 0, 0, 0), i = Math.floor((q.x - r.grid.x0) * r.grid.ppu), j = Math.floor((q.y - r.grid.y0) * r.grid.ppu); return r.field.depth[j * r.grid.w + i]!; };
    const top = at(c.topY + 0.15 * (c.bottomY - c.topY)), mid = at(c.topY + 0.55 * (c.bottomY - c.topY)), low = at(c.topY + 0.92 * (c.bottomY - c.topY));
    expect(top).toBeGreaterThan(mid); expect(mid).toBeGreaterThan(low); expect(top).toBeGreaterThan(0.2 * g.tip.projectionPx);
  });
  it('le rendu éclairé n\'est pas un aplat : le contraste de luminance dans le nez est net et une ombre portée tombe sur la peau', () => {
    const l = litUnderview(nose(), { pitchDeg: 40 }, SKIN, LIGHT(300)); let n = 0, mu = 0, mu2 = 0, sh = 0;
    for (let k = 0; k < l.grid.w * l.grid.h; k++) { if (l.field.depth[k] === -Infinity || l.field.region[k] !== 3) continue; const L = 0.2126 * l.rgba[k * 4]! + 0.7152 * l.rgba[k * 4 + 1]! + 0.0722 * l.rgba[k * 4 + 2]!; n++; mu += L; mu2 += L * L; }
    for (let k = 0; k < l.grid.w * l.grid.h; k++) if (l.field.region[k] === 4 && l.cast[k]! > 0.5) sh++;
    expect(Math.sqrt(mu2 / n - (mu / n) ** 2)).toBeGreaterThan(15); expect(sh).toBeGreaterThan(300);
  });
  it('le rendu LIT le LightModel : l\'ombre change de côté quand la source passe de 300° à 120°', () => {
    const g = nose(), a = litUnderview(g, { pitchDeg: 40 }, SKIN, LIGHT(300)), b = litUnderview(g, { pitchDeg: 40 }, SKIN, LIGHT(120));
    const cx = (l: typeof a): number => { let s = 0, c = 0; for (let k = 0; k < l.grid.w * l.grid.h; k++) if (l.field.region[k] === 4 && l.cast[k]! > 0.5) { s += k % l.grid.w; c++; } return c ? s / c / l.grid.w : 0.5; };
    expect(Math.abs(cx(a) - cx(b))).toBeGreaterThan(0.1);
  });
  it('déterministe : deux appels identiques donnent exactement les mêmes pixels', () => {
    const g = nose(), a = litUnderview(g, { pitchDeg: 30, yawDeg: 10, rollDeg: -5 }, SKIN, LIGHT(300)), b = litUnderview(g, { pitchDeg: 30, yawDeg: 10, rollDeg: -5 }, SKIN, LIGHT(300));
    expect(Buffer.from(a.rgba).equals(Buffer.from(b.rgba))).toBe(true);
  });
  it('la forme du nez change le rendu (preuve que les paramètres produisent des différences visibles) : pyramide ≠ cloche-ailes', () => {
    const a = litUnderview(nose(noseArchetype('pyramide')), { pitchDeg: 40 }, SKIN, LIGHT(300)), b = litUnderview(nose(noseArchetype('cloche-ailes')), { pitchDeg: 40 }, SKIN, LIGHT(300));
    const w = Math.min(a.grid.w, b.grid.w), h = Math.min(a.grid.h, b.grid.h); let diff = 0, n = 0;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const ka = (j * a.grid.w + i) * 4, kb = (j * b.grid.w + i) * 4; diff += Math.abs(a.rgba[ka + 1]! - b.rgba[kb + 1]!); n++; }
    expect(diff / n).toBeGreaterThan(2);
  });
});

describe('narines du moteur contre la mesure de la réf. 03 (écart verrouillé, pas masqué)', () => {
  const m03 = JSON.parse(readFileSync('references/nez/measures-03.json', 'utf8')) as { summary: { separationOverNoseW: { min: number; median: number }; meanCyRel: { min: number; max: number } } };
  const stats = (patch: object, pitch: number) => {
    const v = noseView(nose(patch), pitch), xs = v.envelope.map((q) => q.x), ys = v.envelope.map((q) => q.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const c = (poly: { x: number; y: number }[]) => ({ x: poly.reduce((s, q) => s + q.x, 0) / poly.length, y: poly.reduce((s, q) => s + q.y, 0) / poly.length });
    const L = c(v.nostrils.left), R = c(v.nostrils.right); return { sep: (R.x - L.x) / (x1 - x0), cy: ((L.y + R.y) / 2 - y0) / (y1 - y0) };
  };
  it('hauteur relative des narines : DANS la plage mesurée (0,61–0,80) pour le nez par défaut et deux archétypes, à 20°, 40° et 60°', () => {
    for (const patch of [{}, noseArchetype('pyramide'), noseArchetype('cloche-ailes')]) for (const pitch of [20, 40, 60]) { const s = stats(patch, pitch); expect(s.cy).toBeGreaterThan(m03.summary.meanCyRel.min); expect(s.cy).toBeLessThan(m03.summary.meanCyRel.max); }
  });
  it('ÉCART VERROUILLÉ : la séparation des narines du nez par défaut est SOUS la plage mesurée (0,38–0,50) ; si elle y entre, mettre à jour docs/NOSE-REFS-03-05.md', () => {
    expect(stats({}, 40).sep).toBeLessThan(m03.summary.separationOverNoseW.min);
  });
});

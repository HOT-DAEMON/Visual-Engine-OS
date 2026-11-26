import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generate } from '../src/hair-grammar/grammar';
import { DEFAULT_HEAD as H } from '../src/hair-grammar/head';
import { fillOf } from '../src/hair-grammar/paint';
import { INK_PRO, paintLockPro, type ProLock } from '../src/hair-grammar/paint-pro';
import { TOUSLED } from '../src/hair-grammar/profiles/tousled';
import { MEASURED, MEASURED_RANGE } from '../src/hair-grammar/ring-measures';
import { ringDefects, ringIsSane } from '../src/hair-grammar/ring-check';
import { SHOULDER_BASE, SHOULDER_MAX, shoulderDip, shoulderOpacityFor } from '../src/hair-grammar/ring-tone';
import { RING, ringBands } from '../src/hair-grammar/spec-ring';
import { norm, v3 } from '../src/hair-grammar/vec';
import { viewAt } from '../scripts/hair-grammar/engine-kit';

const V = viewAt(0); const L = { dir: norm(v3(0.6, -0.6, 0.5)) };
const scene = (st = INK_PRO, seed = 1): ProLock[] => generate(TOUSLED, seed).map((s) => paintLockPro(H, s, V, st, L));
const json = JSON.parse(readFileSync(new URL('../artefacts/hair-engine-pass7/measures-ref60.json', import.meta.url), 'utf8'));
const within = (a: number, b: number, tol = 0.03): boolean => Math.abs(a - b) <= tol * Math.max(Math.abs(b), 1e-9) + 0.003;

describe('ring-measures.ts suit les mesures du script (references/hair/60.jpg)', () => {
  it('rubans A et B', () => {
    for (const k of ['A', 'B'] as const) {
      expect(within(MEASURED.extent[k], json.ribbons[k].extent), `extent ${k}`).toBe(true);
      expect(within(MEASURED.dip[k], json.ribbons[k].dip), `dip ${k}`).toBe(true);
      expect(within(MEASURED.halfRecovery[k], json.ribbons[k].shadowHalfLen), `halfRecovery ${k}`).toBe(true);
    }
  });
  it('éventail C et tête illustrée', () => {
    expect(within(MEASURED.extent.C, json.fan.thickness)).toBe(true);
    expect(within(MEASURED.dip.C, json.fan.dip)).toBe(true);
    expect(within(MEASURED.halfRecovery.C, json.fan.shadowHalfLen)).toBe(true);
    expect(within(MEASURED.fullRecovery.C, json.fan.shadowFullLen)).toBe(true);
    expect(within(MEASURED.headHighlightShare, json.head.hlShare)).toBe(true);
  });
  it('plage des parts d\'aire des panneaux : bornes réellement observées (seuil strict)', () => {
    const shares = ['A', 'B', 'C', 'D'].map((k) => json.panels[k].hlShare as number);
    expect(Math.min(...shares)).toBeGreaterThanOrEqual(MEASURED.panelHighlightShare.min - 0.002);
    expect(Math.max(...shares)).toBeLessThanOrEqual(MEASURED.panelHighlightShare.max + 0.002);
  });
});

describe('RING reste dans les plages mesurées', () => {
  it('étendue du reflet', () => { expect(RING.extent).toBeGreaterThanOrEqual(MEASURED_RANGE.extent.min); expect(RING.extent).toBeLessThanOrEqual(MEASURED_RANGE.extent.max); });
  it('mi-retour de l\'ombre : palier médian × longueur = 0,27–0,30 L', () => {
    const mid = RING.shoulderSteps[1]! * RING.shoulderLen;
    expect(mid).toBeGreaterThanOrEqual(MEASURED_RANGE.halfRecovery.min - 0.01); expect(mid).toBeLessThanOrEqual(MEASURED_RANGE.halfRecovery.max + 0.01);
  });
  it('fin de l\'ombre = retour complet mesuré sur l\'éventail', () => { expect(Math.abs(RING.shoulderLen - MEASURED.fullRecovery.C)).toBeLessThan(0.02); });
  it('l\'ombre émise s\'étend bien sur ~0,42 L quand la mèche a la place (pas de retour aux 0,2 de la passe 6)', () => {
    const lens: number[] = [];
    for (const l of scene()) {
      const r = ringBands(l.blade, l.geom, l.spec, V, L); if (!r) continue;
      const sp = l.blade.spine; let total = 0; for (let i = 1; i < sp.length; i++) total += Math.hypot(sp[i]!.x - sp[i - 1]!.x, sp[i]!.y - sp[i - 1]!.y);
      const poly = r.shoulder[0]!; const m = (poly.length / 2) | 0; const far = poly.slice(m); const near = poly.slice(0, m);
      const c = (p: typeof far) => ({ x: p.reduce((a, q) => a + q.x, 0) / p.length, y: p.reduce((a, q) => a + q.y, 0) / p.length });
      const a = c(near); const b = c(far); lens.push(Math.hypot(b.x - a.x, b.y - a.y) / total);
    }
    expect(lens.length).toBeGreaterThan(5); expect(Math.max(...lens)).toBeGreaterThan(0.3);
  });
});

describe('opacité de l\'ombre aval selon le ton', () => {
  it('ton clair (0,6) et moyen (−0,3) : creux relatif = mesure (−33,5 %), contre −25 % avant', () => {
    for (const tone of [0.6, -0.3]) {
      const f = fillOf(tone, INK_PRO); const a = shoulderOpacityFor(f, INK_PRO.shadow);
      expect(a, `ton ${tone}`).toBeGreaterThan(SHOULDER_BASE); expect(a).toBeLessThanOrEqual(SHOULDER_MAX);
      expect(shoulderDip(f, INK_PRO.shadow, a)).toBeCloseTo(MEASURED.dip.C, 2);
      expect(shoulderDip(f, INK_PRO.shadow, SHOULDER_BASE)).toBeGreaterThan(-0.27);
    }
    expect(fillOf(0.6, INK_PRO)).not.toBe(fillOf(-0.3, INK_PRO));
  });
  it('ton sombre : l\'ombre éclaircirait le remplissage → opacité 0, aucun palier dessiné', () => {
    const dark = fillOf(-0.9, INK_PRO);
    expect(shoulderDip(dark, INK_PRO.shadow, SHOULDER_BASE)).toBeGreaterThan(0);
    expect(shoulderOpacityFor(dark, INK_PRO.shadow)).toBe(0);
  });
  it('couleur non #rrggbb : retombe sur l\'opacité historique, sans lever d\'exception', () => { expect(shoulderOpacityFor('#fff', '#333')).toBe(SHOULDER_BASE); });
  it('SVG (profil « steps », passes 6–7) : la même mèche repeinte en trois tons — paliers à l\'opacité calculée en clair et en moyen, aucun en sombre', () => {
    const base = scene().find((x) => ringBands(x.blade, x.geom, x.spec, V, L))!; const r = ringBands(base.blade, base.geom, base.spec, V, L)!;
    const count = (tone: number): number => { const l = paintLockPro(H, { ...base.spec, tone }, V, { ...INK_PRO, ring: 'add', shoulder: { profile: 'steps' } }, L); return (l.svg.match(new RegExp(`fill="${INK_PRO.shadow}" opacity="0\\.(1[7-9]|20)\\d"`, 'g')) ?? []).length; };
    expect(r.shoulder.length).toBe(3);
    expect(count(0.6)).toBe(3); expect(count(-0.3)).toBe(3); expect(count(-0.9)).toBe(0);
  });
});

describe('retour arrière vers l\'ombre de la passe 6 (ProStyle.shoulder)', () => {
  it('{ len: 0.2, opacity: 0.12 } : ombre plus courte et opacité fixe ; le reflet lui-même est inchangé', () => {
    const base = scene().find((x) => ringBands(x.blade, x.geom, x.spec, V, L))!;
    const p7 = paintLockPro(H, { ...base.spec, tone: 0.6 }, V, { ...INK_PRO, ring: 'add', shoulder: { profile: 'steps' } }, L); const p6 = paintLockPro(H, { ...base.spec, tone: 0.6 }, V, { ...INK_PRO, ring: 'add', shoulder: { profile: 'steps', len: 0.2, opacity: 0.12 } }, L);
    expect(p6.svg).toContain(`fill="${INK_PRO.shadow}" opacity="0.120"`); expect(p6.svg).not.toContain(`opacity="0.171"`); expect(p7.svg).toContain(`opacity="0.171"`);
    const r6 = ringBands(base.blade, base.geom, base.spec, V, L, 0.2)!; const r7 = ringBands(base.blade, base.geom, base.spec, V, L)!;
    expect(r6.highlight).toEqual(r7.highlight); expect(r6.side).toBe(r7.side);
    const reach = (r: typeof r7): number => { const q = r.shoulder[0]!; const m = (q.length / 2) | 0; const far = q.slice(m); const near = q.slice(0, m); const c = (a: typeof far) => ({ x: a.reduce((t, z) => t + z.x, 0) / a.length, y: a.reduce((t, z) => t + z.y, 0) / a.length }); return Math.hypot(c(far).x - c(near).x, c(far).y - c(near).y); };
    expect(reach(r7)).toBeGreaterThan(reach(r6));
  });
  it('sans option : ring off reste le rendu historique (aucun palier, aucun reflet transversal)', () => {
    const base = scene().find((x) => ringBands(x.blade, x.geom, x.spec, V, L))!;
    expect(paintLockPro(H, base.spec, V, INK_PRO, L).svg).toBe(paintLockPro(H, base.spec, V, { ...INK_PRO, ring: 'off' }, L).svg);
  });
});

describe('garde de rendu et défauts localisés', () => {
  it('une coiffure générée : aucun défaut, et la garde ne retire aucun reflet légitime', () => {
    for (const seed of [1, 2, 3]) {
      const on = scene({ ...INK_PRO, ring: 'add' }, seed);
      let expected = 0; let drawn = 0;
      for (const l of on) {
        const r = ringBands(l.blade, l.geom, l.spec, V, L); if (!r) continue;
        expected++; expect(ringDefects(l, r), `${seed} ${l.spec.id}`).toEqual([]); expect(ringIsSane(l, r)).toBe(true);
        if (l.svg.includes(`fill="${INK_PRO.highlight}" opacity="${(0.55 + 0.4 * r.strength).toFixed(2)}"`)) drawn++;
      }
      expect(drawn).toBe(expected);
    }
  });
  it('reflet hors de la lame → ring.outside (géométrie), localisé sur la mèche', () => {
    const l = scene().find((x) => ringBands(x.blade, x.geom, x.spec, V, L))!; const r = ringBands(l.blade, l.geom, l.spec, V, L)!;
    const bad = { ...r, highlight: r.highlight.map((p) => ({ x: p.x + 500, y: p.y })) };
    const d = ringDefects(l, bad);
    expect(d.map((x) => x.code)).toContain('ring.outside');
    expect(d[0]).toMatchObject({ layer: 'geometry', lock: l.spec.id, family: l.spec.family }); expect(ringIsSane(l, bad)).toBe(false);
  });
  it('sommet non fini → ring.finite seul, sévérité 3', () => {
    const l = scene().find((x) => ringBands(x.blade, x.geom, x.spec, V, L))!; const r = ringBands(l.blade, l.geom, l.spec, V, L)!;
    const d = ringDefects(l, { ...r, highlight: [{ x: NaN, y: 0 }, ...r.highlight.slice(1)] });
    expect(d).toHaveLength(1); expect(d[0]).toMatchObject({ code: 'ring.finite', severity: 3 });
  });
  it('reflet sur le dessous du ruban → ring.backface (anatomie)', () => {
    const l = scene().find((x) => ringBands(x.blade, x.geom, x.spec, V, L))!; const r = ringBands(l.blade, l.geom, l.spec, V, L)!;
    const geom = { ...l.geom, backface: l.geom.backface.map(() => true) };
    expect(ringDefects({ spec: l.spec, blade: l.blade, geom }, r).map((x) => x.code)).toContain('ring.backface');
  });
  it('reflet qui occupe presque toute la lame → ring.area (style)', () => {
    const l = scene().find((x) => ringBands(x.blade, x.geom, x.spec, V, L))!; const r = ringBands(l.blade, l.geom, l.spec, V, L)!;
    const poly = [...l.blade.left, ...[...l.blade.right].reverse()];
    expect(ringDefects(l, { ...r, highlight: poly }).map((x) => x.code)).toContain('ring.area');
  });
});

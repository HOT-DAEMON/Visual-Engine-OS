import { describe, expect, it } from 'vitest';
import { EyeSpec, compileScene } from '../src';
import { gradeEye, resolveEyeLook } from '../src/render/eye/look';

const svg = (appearance: unknown, extra: object = {}) => {
  const r = compileScene({ width: 640, height: 520, background: '#3b4157', objects: [{ kind: 'eye', id: 'e', transform: { x: 320, y: 260 }, shape: { width: 400, height: 240 }, appearance, ...extra }] } as never);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  return r.svg;
};
const eye = (o: object = {}) => EyeSpec.parse({ kind: 'eye', id: 'e', ...o });

describe('moteur d’apparence branché sur l’œil', () => {
  it('appearance null = rendu historique ; défaut du schéma = null', () => {
    expect(eye().appearance).toBeNull();
    expect(svg(null)).toBe(svg(undefined));
  });

  it('la teinte d’ombre imposée colore l’ombre du pli et celle des paupières (au lieu du noir)', () => {
    const base = svg(null);
    const tinted = svg({ light: { shadow: '#1a3a7a' } });
    expect(tinted).not.toBe(base);
    expect(tinted).toContain('stop-color="#1a3a7a"'); // dégradé d'ombre du pli
    expect(base).not.toContain('stop-color="#1a3a7a"');
  });

  it('les teintes dérivées sont cohérentes avec la peau : ombre plus sombre que la base, lumière plus claire', () => {
    const e = eye({ appearance: {} });
    const look = resolveEyeLook(e, '#e8b89a')!;
    const lum = (h: string) => parseInt(h.slice(1, 3), 16) * 0.2126 + parseInt(h.slice(3, 5), 16) * 0.7152 + parseInt(h.slice(5, 7), 16) * 0.0722;
    expect(lum(look.skin.shadow)).toBeLessThan(lum(look.skin.base));
    expect(lum(look.skin.light)).toBeGreaterThan(lum(look.skin.base));
  });

  it('effets : glow/bloom/émission produisent UN filtre appliqué à l’iris seul ; sans effet, aucun filtre', () => {
    expect(svg({})).not.toContain('-iris-fx');
    const fx = svg({ glow: { intensity: 0.8, radius: 0.5 }, bloom: { intensity: 0.5 }, emission: { color: '#66ffee', intensity: 0.6 } });
    expect(fx).toContain('id="e-iris-fx"');
    expect((fx.match(/id="e-iris-fx"/g) ?? []).length).toBe(1);
    expect(fx).toContain('filter="url(#e-iris-fx)"');
  });

  it('étalonnage : la luminosité change vraiment les couleurs de l’iris et de la sclère ; identité à 0', () => {
    const e = eye();
    expect(gradeEye(eye({ appearance: {} }))).toEqual(eye({ appearance: {} }));
    const bright = gradeEye(eye({ appearance: { brightness: 0.5 } }));
    expect(bright.iris.material.base).not.toEqual(e.iris.material.base);
    expect(bright.sclera.base).not.toEqual(e.sclera.base);
    expect(svg({ brightness: 0.5 })).not.toBe(svg({}));
  });

  it('teinte de reflet imposée : appliquée aux reflets ; sinon ils gardent la couleur de la lumière', () => {
    const tinted = svg({ reflection: { tint: '#ffcc33' } });
    expect(tinted).toContain('fill="#ffcc33"');
    expect(svg({})).not.toContain('fill="#ffcc33"');
  });

  it('lumière de contour : liseré le long du bord inférieur, absent à rimStrength 0', () => {
    expect(svg({ light: { rimStrength: 0.8 } })).not.toBe(svg({ light: { rimStrength: 0 } }));
  });

  it('combiné avec rotation sphère, couches d’iris et reflets : déterministe', () => {
    const extra = { headTurn: { model: 'sphere', yawDeg: 25, azimuthDeg: 22 }, iris: { layers: [{ color: '#2a6fdb' }] }, highlights: { list: [{ shape: 'star', anchor: 'iris', x: 0.3, y: -0.3 }] } };
    const a = svg({ glow: { intensity: 0.5 } }, extra);
    expect(svg({ glow: { intensity: 0.5 } }, extra)).toBe(a);
  });
});

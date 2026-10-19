import { describe, expect, it } from 'vitest';
import { Resvg } from '@resvg/resvg-js';
import { compileScene, generateRandomFace } from '../src';
import { resolveAppearance } from '../src/appearance';
import { faceLandmarks, noseGeometry, skinRegions } from '../src/face';
import { direction2D, lightVector } from '../src/lighting/light';
import { applyTemperature, falloff, intensityFor, kelvinRgb, softness } from '../src/lighting/rig';
import { Appearance, FaceParams, LightSpec, SkinMaterial } from '../src/schema';
import { skinShading } from '../src/skin';
import { parseHex } from '../src/core/color';

const L0 = lightVector({ azimuthDeg: 330, elevationDeg: 55, color: '#ffffff', intensity: 1 });
const skin = '#c99a7e';
const shade = (mat: object, geom: object = {}, L = L0) => {
  const p = FaceParams.parse(geom);
  const lm = faceLandmarks(p, 320, 420);
  const regions = skinRegions(lm, noseGeometry(p, lm));
  return { s: skinShading(SkinMaterial.parse(mat), L, regions, resolveAppearance(skin, Appearance.parse({})), skin), regions };
};

describe('moteur d\'éclairage : le rig', () => {
  it('température de couleur : 6500 K neutre, plus bas = plus chaud, plus haut = plus froid', () => {
    expect(applyTemperature('#ffffff', 6500)).toBe('#ffffff');
    const warm = parseHex(applyTemperature('#ffffff', 3000));
    const cool = parseHex(applyTemperature('#ffffff', 10000));
    expect(warm[0]).toBeGreaterThan(warm[2]);
    expect(cool[2]).toBeGreaterThanOrEqual(cool[0]);
    expect(kelvinRgb(2000)[2]).toBeLessThan(kelvinRgb(6500)[2]);
    expect(lightVector({ azimuthDeg: 0, elevationDeg: 50, color: '#ffffff', intensity: 1, temperatureK: 3000 }).color).toBe(applyTemperature('#ffffff', 3000));
  });

  it('douceur des ombres : croît avec la taille de la source, décroît avec la dureté, croît quand la source se rapproche', () => {
    const l = (o: object) => softness(lightVector({ azimuthDeg: 0, elevationDeg: 50, color: '#ffffff', intensity: 1, ...o }));
    expect(l({ sourceSize: 0.9 })).toBeGreaterThan(l({ sourceSize: 0.1 }));
    expect(l({ shadowHardness: 0.9 })).toBeLessThan(l({ shadowHardness: 0.1 }));
    expect(l({ distance: 1 })).toBeGreaterThan(l({ distance: 10 }));
    for (const v of [l({ sourceSize: 0, shadowHardness: 1 }), l({ sourceSize: 1, shadowHardness: 0 })]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
  });

  it('influence par matériau et atténuation selon la distance', () => {
    const L = lightVector({ azimuthDeg: 0, elevationDeg: 50, color: '#ffffff', intensity: 0.8, influence: { skin: 1, hair: 0.25, eyes: 1, lips: 1, metal: 1 } });
    expect(intensityFor(L, 'hair')).toBeCloseTo(0.2, 9);
    expect(intensityFor(L, 'skin')).toBeCloseTo(0.8, 9);
    expect(falloff(L0)).toEqual({ near: 1, far: 1 });
    const f = falloff(lightVector({ azimuthDeg: 0, elevationDeg: 50, color: '#ffffff', intensity: 1, distance: 1 }));
    expect(f.near).toBeGreaterThan(1);
    expect(f.far).toBeLessThan(1);
    expect(f.far).toBeGreaterThan(0.5);
  });

  it('une scène sans réglages de rig reste valide (valeurs neutres)', () => {
    const l = LightSpec.parse({});
    expect(l.temperatureK).toBeNull();
    expect(l.distance).toBeNull();
    expect(l.influence.skin).toBe(1);
  });
});

describe('matériau de peau : indépendant de la géométrie', () => {
  it('le contrat n\'a ni coordonnée ni champ métallique', () => {
    expect(() => SkinMaterial.parse({ metallic: 1 })).toThrow();
    expect(() => SkinMaterial.parse({ roughness: { cheeks: 0.5, x: 3 } })).toThrow();
    expect(Object.keys(SkinMaterial.parse({}))).not.toContain('metallic');
  });

  it('la rugosité d\'une région pilote la taille, l\'intensité et la douceur de SON reflet', () => {
    const spot = (rough: number) => shade({ roughness: { cheeks: rough } }).s.spots.find((p) => p.region === 'cheeks') as { e: { rx: number }; alpha: number; soft: number };
    const smooth = spot(0.1);
    const rough = spot(0.9);
    expect(rough.e.rx).toBeGreaterThan(smooth.e.rx);
    expect(rough.alpha).toBeLessThan(smooth.alpha);
    expect(rough.soft).toBeGreaterThan(smooth.soft);
    // Les autres régions ne bougent pas.
    const other = (rv: number) => shade({ roughness: { cheeks: rv } }).s.spots.find((p) => p.region === 'forehead')?.alpha;
    expect(other(0.1)).toBe(other(0.9));
  });

  it('le même matériau donne les mêmes intensités sur deux géométries différentes (seules les positions changent)', () => {
    const mat = { roughness: { forehead: 0.3, nose: 0.2, cheeks: 0.7 } };
    const a = shade(mat, { jawWidth: 0.6, nose: { length: 0.1 } }).s;
    const b = shade(mat, { jawWidth: 0.95, nose: { length: 0.2 }, chinWidth: 0.4 }).s;
    expect(a.spots.map((p) => [p.region, p.alpha, p.soft])).toEqual(b.spots.map((p) => [p.region, p.alpha, p.soft]));
    expect(a.spots.map((p) => p.e.cy)).not.toEqual(b.spots.map((p) => p.e.cy));
  });

  it('reflet DIÉLECTRIQUE : la couleur du reflet reste proche de celle de la lumière', () => {
    const { s } = shade({ specular: { tint: 0 } });
    expect(s.specColor).toBe('#ffffff');
    const warm = shade({ specular: { tint: 0 } }, {}, lightVector({ azimuthDeg: 330, elevationDeg: 55, color: '#ffffff', intensity: 1, temperatureK: 3000 })).s;
    expect(warm.specColor).not.toBe('#ffffff');
    expect(parseHex(warm.specColor)[0]).toBeGreaterThan(parseHex(warm.specColor)[2]);
  });

  it('les reflets suivent la lumière pour 12 azimuts', () => {
    for (let az = 0; az < 360; az += 30) {
      const L = lightVector({ azimuthDeg: az, elevationDeg: 45, color: '#ffffff', intensity: 1 });
      const { s, regions } = shade({}, {}, L);
      const d = direction2D(L);
      for (const sp of s.spots) {
        const r = regions[sp.region].reduce((b, e) => (Math.hypot(e.cx - sp.e.cx, e.cy - sp.e.cy) < Math.hypot(b.cx - sp.e.cx, b.cy - sp.e.cy) ? e : b));
        expect((sp.e.cx - r.cx) * d.x + (sp.e.cy - r.cy) * d.y).toBeGreaterThanOrEqual(-1e-9);
      }
    }
  });

  it('transition lumière → ombre : plus douce avec `softness` ; nette en mode cel', () => {
    expect(shade({ softness: 1 }).s.terminatorWidth).toBeGreaterThan(shade({ softness: 0 }).s.terminatorWidth);
    const cel = skinShading(SkinMaterial.parse({}), L0, shade({}).regions, resolveAppearance(skin, Appearance.parse({ shading: { mode: 'cel' } })), skin);
    expect(cel.cel).toBe(true);
    expect(cel.terminatorWidth).toBeLessThanOrEqual(0.02);
    expect(cel.spots.every((p) => p.soft < 0.1)).toBe(true);
  });

  it('une lumière plus intense éclaire et ombre davantage ; l\'influence « skin » nulle éteint les reflets', () => {
    const lo = shade({}, {}, lightVector({ azimuthDeg: 330, elevationDeg: 55, color: '#ffffff', intensity: 0.3 })).s;
    const hi = shade({}, {}, lightVector({ azimuthDeg: 330, elevationDeg: 55, color: '#ffffff', intensity: 1 })).s;
    expect(hi.spots[0]!.alpha).toBeGreaterThan(lo.spots[0]!.alpha);
    const off = shade({}, {}, lightVector({ azimuthDeg: 330, elevationDeg: 55, color: '#ffffff', intensity: 1, influence: { skin: 0, hair: 1, eyes: 1, lips: 1, metal: 1 } })).s;
    expect(off.spots.every((p) => p.alpha === 0)).toBe(true);
  });
});

describe('rendu : la peau reste cohérente sous différents éclairages (mesuré sur pixels)', () => {
  /** Luminance moyenne d'un rectangle de l'image RGBA. */
  const lum = (px: Uint8Array, w: number, x0: number, y0: number, x1: number, y1: number): number => {
    let s = 0;
    let n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * w + x) * 4; s += 0.2126 * px[i]! + 0.7152 * px[i + 1]! + 0.0722 * px[i + 2]!; n++; }
    return s / n;
  };
  const side = (az: number): number => {
    const f = generateRandomFace(77, { eyeSource: 'random', identity: 1, hairEngine: 'classic', hair: { style: 'bald' } as never, neck: { visible: false } as never, anatomy: { skin: { gradient: [], light: {} } } });
    const W = 240;
    const H = Math.round(240 * (f.height / f.width));
    const host = { ...f.objects[0], transform: { x: W / 2, y: H / 2, scale: W / f.width / 1.05, rotationDeg: 0 } } as never;
    const r = compileScene({ width: W, height: H, background: '#808080', light: { azimuthDeg: az, elevationDeg: 50, color: '#ffffff', intensity: 1 }, objects: [host] } as never);
    if (!r.ok) throw new Error('scène');
    const img = new Resvg(r.svg).render();
    const px = img.pixels as Uint8Array;
    const y0 = Math.round(H * 0.5);
    const y1 = Math.round(H * 0.62);
    // Joue gauche et joue droite de l'image (sous les yeux, hors du nez).
    return lum(px, img.width, Math.round(W * 0.2), y0, Math.round(W * 0.34), y1) - lum(px, img.width, Math.round(W * 0.66), y0, Math.round(W * 0.8), y1);
  };

  it('le côté tourné vers la lumière est plus clair ; inverser la lumière inverse la différence', () => {
    // Direction 2D vers la lumière : le signe de x décide du côté éclairé de l'image.
    const dxA = direction2D(lightVector({ azimuthDeg: 300, elevationDeg: 50, color: '#ffffff', intensity: 1 })).x;
    const dxB = direction2D(lightVector({ azimuthDeg: 60, elevationDeg: 50, color: '#ffffff', intensity: 1 })).x;
    expect(Math.sign(dxA)).toBe(-Math.sign(dxB));
    const a = side(300);
    const b = side(60);
    expect(Math.sign(a)).toBe(-Math.sign(b));
    expect(Math.abs(a - b)).toBeGreaterThan(2);
    // Gauche - droite > 0 quand la lumière vient de la gauche de l'image (dx < 0).
    expect(Math.sign(a)).toBe(-Math.sign(dxA));
  }, 60000);
});

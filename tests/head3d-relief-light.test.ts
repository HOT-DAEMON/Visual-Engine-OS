import { describe, expect, it } from 'vitest';
import { compileScene, generateRandomFace, SceneSpec } from '../src';
import { rasterPixels } from '../scripts/lib/raster';
import { diffStats } from '../src/regression/diff';
import { lightModelOf, lightModelOfSpec } from '../src/relief';
import { buildParts } from '../src/head-turntable/parts';
import { cullFarEar } from '../src/head-turntable/engines/ear-cull';
import { rasterize } from '../src/head-turntable/raster';
import { defaultFrame } from '../src/head-turntable/render';
import { reliefLight } from '../src/head-turntable/paint';
import { REF_SPEC } from '../src/head-turntable/spec';

/** Tête 3D (rotation) éclairée par le moteur unique `src/relief` : même `LightModel` que la tête de face et le corps (docs/LIGHT-HEAD3D-07.md). */
type Lit = Record<string, unknown>;
const SIDE = (az: number): Lit => ({ style: 'soft', light: { azimuthDeg: az, elevationDeg: 25, shadowHardness: 1, sourceSize: 0.2 } });
function scene(yaw: number, lit: Lit | null, faceTweak?: (f: Record<string, any>) => void) {
  const objs: any[] = generateRandomFace(11, { id: 'f0', transform: { x: 60, y: 400, scale: 0.2 } } as never).objects.map((o) => JSON.parse(JSON.stringify(o)));
  if (faceTweak) faceTweak(objs[0]);
  return { width: 420, height: 460, background: '#ece6dc', objects: [...objs, { kind: 'head_3d', id: 't0', host: 'f0', resolution: 1, yaw, transform: { x: 190, y: 30, scale: 0.9 }, ...(lit ? { lit } : {}) }] };
}
/** Pixels de la zone de la TÊTE TOURNÉE seule (l'hôte-visage, requis par `head_3d`, est posé en bas à gauche, hors de cette zone). */
const ras = (sc: unknown) => {
  const r = compileScene(sc); if (!r.ok) throw new Error(r.issues.join(' ; '));
  const p = rasterPixels(r.svg), x0 = 140, y1 = 340, w = p.width - x0, data = new Uint8Array(w * y1 * 4);
  for (let y = 0; y < y1; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++) data[4 * (y * w + x) + c] = p.pixels[4 * (y * p.width + x0 + x) + c]!;
  return { width: w, height: y1, data };
};
const lum = (r: { width: number; data: Uint8Array | Uint8ClampedArray | Buffer }, x0: number, x1: number, y0: number, y1: number): number => {
  let s = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = 4 * (y * r.width + x); if (r.data[i + 3]! > 0) { s += 0.2126 * r.data[i]! + 0.7152 * r.data[i + 1]! + 0.0722 * r.data[i + 2]!; n++; } }
  return n ? s / n : 0;
};
/** Rapport de luminance moitié gauche / moitié droite de la tête, fenêtres calées sur la boîte englobante des pixels qui ne sont pas le fond. */
const leftRight = (r: ReturnType<typeof ras>): number => {
  let x0 = r.width, x1 = 0, y0 = r.height, y1 = 0;
  for (let y = 0; y < r.height; y++) for (let x = 0; x < r.width; x++) { const i = 4 * (y * r.width + x); if (Math.abs(r.data[i]! - 236) + Math.abs(r.data[i + 1]! - 230) + Math.abs(r.data[i + 2]! - 220) > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  const cx = (x0 + x1) / 2, hw = (x1 - x0) * 0.2, ya = Math.floor(y0 + 0.12 * (y1 - y0)), yb = Math.floor(y0 + 0.55 * (y1 - y0));
  return lum(r, Math.floor(cx - hw), Math.floor(cx), ya, yb) / lum(r, Math.floor(cx), Math.floor(cx + hw), ya, yb);
};

describe('tête en rotation : éclairage du moteur relief', () => {
  it('un seul modèle : la traduction réglages → LightModel est celle de `lightModelOf` (aucun second calcul de lumière)', () => {
    const spec = { style: 'cel2' as const, contrast: 1, bias: 0.1, rim: 0.35, light: { azimuthDeg: 270, elevationDeg: 18 } };
    expect(lightModelOfSpec({}, spec)).toEqual(lightModelOf({ azimuthDeg: 270, elevationDeg: 18 }, { style: 'cel2', contrast: 1, bias: 0.1, rim: 0.35 }));
  });

  it('contrat strict : une clé inconnue dans `lit` est refusée', () => {
    expect(SceneSpec.safeParse(scene(45, { style: 'soft', brillance: 1 })).success).toBe(false);
    expect(SceneSpec.safeParse(scene(45, SIDE(270))).success).toBe(true);
  });

  it('ombres portées sur la PROFONDEUR de la tête tournée : nombreuses sous une lumière latérale basse, quasi nulles sous une lumière frontale haute (3 lacets)', () => {
    const fr = defaultFrame(420), hi = { w: fr.w * 2, h: fr.h * 2, ppu: fr.ppu * 2, ox: fr.ox * 2, oy: fr.oy * 2 };
    for (const yaw of [0, 45, 90]) {
      const g = rasterize(cullFarEar(buildParts(REF_SPEC), { yaw, pitch: 0 }), { yaw, pitch: 0 }, hi);
      const share = (az: number, el: number): number => {
        const m = lightModelOf({ azimuthDeg: az, elevationDeg: el, shadowHardness: 0.9, sourceSize: 0.15 }, { style: 'cel2' });
        const { cast } = reliefLight(REF_SPEC, g, { lineU: 0.022, ppuHi: hi.ppu, light: m }, m);
        let n = 0, s = 0; for (let k = 0; k < cast.length; k++) if (g.id[k]) { n++; if (cast[k]! > 0.5) s++; } return s / n;
      };
      expect(share(270, 18), `yaw ${yaw} latérale`).toBeGreaterThan(0.1);
      expect(share(330, 85), `yaw ${yaw} frontale`).toBeLessThan(0.01);
    }
  }, 120_000);

  it('dans la scène : `lit` change l\'image, et la moitié éclairée suit la lumière (270° ≠ 90°) à 3 lacets', () => {
    for (const yaw of [0, 45, 90]) {
      const plate = ras(scene(yaw, null)), a = ras(scene(yaw, SIDE(270))), b = ras(scene(yaw, SIDE(90)));
      expect(diffStats(plate, a).rms, `yaw ${yaw} planche→moteur`).toBeGreaterThan(5);
      expect(diffStats(a, b).rms, `yaw ${yaw} 270° vs 90°`).toBeGreaterThan(8);
      expect(leftRight(a) / leftRight(b), `yaw ${yaw} bascule gauche/droite`).toBeGreaterThan(1.25);
    }
  }, 240_000);

  it('même apparence que la tête de face : la teinte d\'ombre IMPOSÉE de l\'hôte change le rendu éclairé, pas celui de la planche', () => {
    const tint = (hex: string) => (o: Record<string, any>) => { o.face = { ...(o.face ?? {}), skin: { ...(o.face?.skin ?? {}), light: { ...(o.face?.skin?.light ?? {}), shadow: hex } } }; };
    const lit = (hex: string) => ras(scene(45, SIDE(270), tint(hex))), plate = (hex: string) => ras(scene(45, null, tint(hex)));
    expect(diffStats(lit('#a08974'), lit('#5a4a8a')).rms).toBeGreaterThan(2);
    expect(diffStats(plate('#a08974'), plate('#5a4a8a')).rms).toBeLessThan(0.5);
  }, 120_000);
});

import { describe, expect, it } from 'vitest';
import { ARCHETYPES, type BodyInput } from '../src/body';
import { bodyVolumes } from '../src/body/volume';
import { lightModelOf, litFigure, type LitStyle } from '../src/relief';
import { bodyHost } from '../scripts/lib/body-host';

/**
 * PARAMÈTRES CONSOMMÉS ET PROUVABLES : chaque paramètre exposé par la figure (lumière, style, peau, ombrage, cadrage, grilles) est modifié seul ; le test prouve OÙ
 * l'image change (couche d'éclairage de la tête, pixels du corps) et où elle ne doit PAS changer. Un paramètre accepté mais ignoré, ou qui déborde sur une zone
 * étrangère, fait échouer. Zones : `head` = champ d'éclairage de la tête (lit), `body` = pixels du corps.
 */
const BH = bodyHost(), set = bodyVolumes(ARCHETYPES.veryMuscular as BodyInput, BH.a, {}), BASE_L = { azimuthDeg: 305, elevationDeg: 38, shadowHardness: 0.5, sourceSize: 0.4 };
type Fig = ReturnType<typeof litFigure>;
const render = (light: Record<string, number> = {}, style: LitStyle = 'soft', o: Record<string, unknown> = {}, skin = BH.skin): Fig => litFigure(BH.svg, BH.o, skin, set, lightModelOf({ ...BASE_L, ...light }, { style }), { heightPx: 360, ...o } as never);
const frac = (a: ArrayLike<number>, b: ArrayLike<number>): number => { if (a.length !== b.length) return 1; let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n / a.length; };
// Tête : ses IMAGES d'éclairage (`head.svg`, qui portent teinte, intensité, spéculaire) ET son champ de lumière ; 1 si l'un des deux change.
const diff = (a: Fig, b: Fig): { head: number; body: number } => ({ head: a.head.svg !== b.head.svg || frac(a.head.lit, b.head.lit) > 0 ? 1 : 0, body: frac(a.body.pixels.rgba, b.body.pixels.rgba) });
const base = render();

/** `minor` : le corps ne change que sur le bord de l'ombre portée par la tête (couplage légitime, la tête est l'occulteur), < 1 % des pixels. */
type Row = [name: string, make: () => Fig, head: 'change' | 'same', body: 'change' | 'same' | 'minor'];
const ROWS: Row[] = [
  ['lumière : azimut', () => render({ azimuthDeg: 60 }), 'change', 'change'], ['lumière : élévation', () => render({ elevationDeg: 70 }), 'change', 'change'],
  ['lumière : dureté d’ombre', () => render({ shadowHardness: 0.95 }), 'change', 'change'], ['lumière : taille de source', () => render({ sourceSize: 0.05 }), 'change', 'change'],
  ['lumière : intensité', () => render({ intensity: 0.4 }), 'change', 'change'], ['style cel2', () => render({}, 'cel2'), 'change', 'change'], ['style cel3', () => render({}, 'cel3'), 'change', 'change'],
  ['couleur de peau', () => render({}, 'soft', {}, '#6b4226'), 'change', 'change'],
  ['ao (corps)', () => render({}, 'soft', { ao: 0.9 }), 'same', 'change'], ['groove (rainures)', () => render({}, 'soft', { groove: 1 }), 'same', 'change'],
  ['shadowReach (portée d’ombre du corps)', () => render({}, 'soft', { shadowReach: 0.05 }), 'same', 'change'], ['quality fast', () => render({}, 'soft', { quality: 'fast' }), 'same', 'change'],
  ['camera yaw 25°', () => render({}, 'soft', { camera: { yaw: 25, pitch: 0, pivot: { x: 0, y: 0, z: 0 } } }), 'same', 'change'],
  ['ss 1 (sur-échantillonnage)', () => render({}, 'soft', { ss: 1 }), 'same', 'change'], ['heightPx 300', () => render({}, 'soft', { heightPx: 300 }), 'same', 'change'],
  ['headPpu 1.6 (grille de la tête)', () => render({}, 'soft', { headPpu: 1.6 }), 'change', 'minor'], ['headCastScale 2 (ombre de la tête)', () => render({}, 'soft', { headCastScale: 2 }), 'change', 'same'],
];
describe('chaque paramètre de la figure est consommé, et seulement là où il doit l’être', () => {
  for (const [name, make, head, body] of ROWS) it(name, () => {
    const d = diff(base, make());
    if (head === 'change') expect(d.head, `${name} : la tête devrait changer`).toBeGreaterThan(0.001); else expect(d.head, `${name} : la tête ne devrait PAS changer`).toBe(0);
    if (body === 'change') expect(d.body, `${name} : le corps devrait changer`).toBeGreaterThan(0.001);
    else if (body === 'minor') { expect(d.body, `${name} : bord d'ombre du corps`).toBeGreaterThan(0); expect(d.body, `${name} : seulement le bord`).toBeLessThan(0.01); }
    else expect(d.body, `${name} : le corps ne devrait PAS changer`).toBe(0);
  }, 60000);
  it('contrôle négatif : deux rendus identiques ne diffèrent en rien', () => expect(diff(base, render())).toEqual({ head: 0, body: 0 }));
});

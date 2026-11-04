import { Resvg } from '@resvg/resvg-js';
import { describe, expect, it } from 'vitest';
import { compileScene, generateRandomFace } from '../src';
import { ARCHETYPES, type BodyInput } from '../src/body';
import { bodyVolumes, renderVolumesPixel } from '../src/body/volume';
import { castShadow, goboAt, headLit, hostFace, lightModelOf, LIGHT_PATTERNS, litFigure, litHead, tonesOf, toLab, type HeadLit } from '../src/relief';
import { verifyLit, litStats } from '../src/verify';
import { bodyHost } from '../scripts/lib/body-host';

const H = bodyHost(), FC0 = hostFace(H.o), FC = { ...FC0, p: { ...FC0.p, skin: { ...FC0.p.skin, light: { ...FC0.p.skin.light, shadow: null } } } } as typeof FC0; // visage sans teinte d'ombre imposée : exerce la dérivation (chaude / froide)
const modelOf = (p: (typeof LIGHT_PATTERNS)[number]) => lightModelOf({ azimuthDeg: p.azimuthDeg, elevationDeg: p.elevationDeg, shadowHardness: p.hardness, sourceSize: p.sourceSize }, { style: p.style, shadowHue: p.shadowHue, bias: p.bias });
const lit = (m = modelOf(LIGHT_PATTERNS[0]!)): HeadLit => headLit(FC.p, FC.lm, FC.nose, H.skin, m, { ppu: 1.6 });
const luma = (r: number, g: number, b: number): number => 0.2126 * r + 0.7152 * g + 0.0722 * b;

describe('ombre et lumière visibles (itération 06 de l\'éclairage)', () => {
  it('régression du défaut : une lumière rasante à 270° change la luminance gauche/droite du visage de plus de 25 % (elle ne la changeait que de 4,6 %)', () => {
    const f = generateRandomFace(11, { id: 'f', transform: { x: 190, y: 200, scale: 0.9 } }), o = f.objects[0] as { material: { color: string }; face: unknown; width: number; height: number };
    const sc = compileScene({ width: 380, height: 420, background: '#3b4157', objects: f.objects, light: { azimuthDeg: 270, elevationDeg: 25, shadowHardness: 1, color: '#ffffff', intensity: 1, sourceSize: 0.3 } } as never);
    if (!sc.ok) throw new Error(sc.issues.join());
    const ratio = (svg: string): number => {
      const png = new Resvg(svg, { fitTo: { mode: 'width', value: 380 } }).render(), px = png.pixels, W = png.width, Hh = png.height; let l = 0, ln = 0, r = 0, rn = 0;
      for (let y = Math.floor(Hh * 0.3); y < Hh * 0.6; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (Math.abs(px[i]! - 0x3b) + Math.abs(px[i + 1]! - 0x41) + Math.abs(px[i + 2]! - 0x57) < 30) continue; const Y = luma(px[i]!, px[i + 1]!, px[i + 2]!); if (x > W * 0.28 && x < W * 0.5) { l += Y; ln++; } else if (x >= W * 0.5 && x < W * 0.72) { r += Y; rn++; } }
      return l / ln / (r / rn);
    };
    const before = ratio(sc.svg), after = ratio(litHead(sc.svg, o, o.material.color, lightModelOf({ azimuthDeg: 270, elevationDeg: 25, shadowHardness: 1, sourceSize: 0.3 }, { style: 'soft' }), { ppu: 1.6 }).svg);
    expect(before).toBeLessThan(1.1);
    expect(after).toBeGreaterThan(1.25);
  });
  it('mix-blend-mode multiply est rendu par resvg (la couche d\'éclairage multiplie la couleur dessinée dessous)', () => {
    const out = new Resvg('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="#c8a080"/><rect width="4" height="4" fill="#8aa0e0" style="mix-blend-mode:multiply"/></svg>').render().pixels;
    expect([out[0], out[1], out[2]]).toEqual([108, 100, 112]);
  });
});

describe('modèle de lumière', () => {
  it('l\'azimut place la source : 270° → vers la gauche de l\'image, 90° → droite, 0° → haut (y < 0)', () => {
    expect(lightModelOf({ azimuthDeg: 270 }).dir.x).toBeLessThan(-0.5);
    expect(lightModelOf({ azimuthDeg: 90 }).dir.x).toBeGreaterThan(0.5);
    expect(lightModelOf({ azimuthDeg: 0, elevationDeg: 40 }).dir.y).toBeLessThan(-0.5);
  });
  it('l\'écart de clarté ombre-lumière croît avec l\'intensité et la dureté, jamais sous 0,12, et l\'ombre est plus sombre que la lumière', () => {
    const d = (spec: object) => lightModelOf(spec as never, { style: 'soft' }).dL;
    expect(d({ intensity: 1 })).toBeGreaterThan(d({ intensity: 0.2 }));
    expect(d({ shadowHardness: 1 })).toBeGreaterThan(d({ shadowHardness: 0 }));
    expect(d({ intensity: 0 })).toBeGreaterThanOrEqual(0.12);
    const t = tonesOf('#c99a76', lightModelOf({}, { style: 'soft' }));
    expect(toLab(t.lit).L - toLab(t.shadow).L).toBeGreaterThan(0.2);
    expect(toLab(t.core).L).toBeLessThan(toLab(t.shadow).L);
  });
  it('ombre froide : plus bleue que la lumière ; ombre chaude : plus saturée (diffusion sous-cutanée)', () => {
    const cool = tonesOf('#c99a76', lightModelOf({}, { style: 'cel2', shadowHue: 'cool' })), warm = tonesOf('#c99a76', lightModelOf({}, { style: 'soft', shadowHue: 'warm' }));
    expect(toLab(cool.shadow).b).toBeLessThan(toLab(cool.lit).b - 0.02);
    const C = (h: string): number => Math.hypot(toLab(h).a, toLab(h).b);
    expect(C(warm.shadow)).toBeGreaterThan(C(warm.lit) * 1.05);
  });
  it('une teinte d\'ombre imposée par l\'apparence (`light.shadow`) est lue telle quelle si elle est assez sombre, et assombrie à base − ΔL sinon (garde sa teinte)', () => {
    expect(tonesOf('#c99a76', lightModelOf({}, {}), { shadow: '#552244' }).shadow).toBe('#552244');
    expect(tonesOf('#c99a76', lightModelOf({}, {}), { shadow: null }).shadow).not.toBe('#552244');
    const m = lightModelOf({}, { style: 'soft' }), close = tonesOf('#c99a76', m, { shadow: '#b89070' });
    expect(toLab('#c99a76').L - toLab(close.shadow).L).toBeGreaterThanOrEqual(m.dL - 0.01);
    expect(Math.abs(Math.atan2(toLab(close.shadow).b, toLab(close.shadow).a) - Math.atan2(toLab('#b89070').b, toLab('#b89070').a))).toBeLessThan(0.05);
  });
  it('la couleur et la température de la lumière teintent les tons éclairés (bougie : plus rouge que bleu)', () => {
    const t = tonesOf('#c8c8c8', lightModelOf({ temperatureK: 2000 }, {}));
    const [r, , b] = [parseInt(t.lit.slice(1, 3), 16), 0, parseInt(t.lit.slice(5, 7), 16)];
    expect(r).toBeGreaterThan(b + 40);
  });
  it('motifs de projection : déterministes, dans [0,1], et les stores alternent lumière / ombre', () => {
    const g = { kind: 'blinds', scale: 30, angleDeg: 0, duty: 0.5 } as const;
    const v = Array.from({ length: 60 }, (_, i) => goboAt(g, i, 0));
    expect(v.every((x) => x >= 0 && x <= 1)).toBe(true);
    expect(Math.max(...v)).toBeGreaterThan(0.95); expect(Math.min(...v)).toBeLessThan(0.05);
    expect(goboAt({ kind: 'dapple', scale: 20, angleDeg: 0, duty: 0.5 }, 12.3, 4.5)).toBe(goboAt({ kind: 'dapple', scale: 20, angleDeg: 0, duty: 0.5 }, 12.3, 4.5));
  });
});

describe('ombres portées (marche de rayon)', () => {
  const g = { x0: 0, y0: 0, ppu: 1, w: 80, h: 40 }, field = (): Float32Array => { const d = new Float32Array(80 * 40); for (let y = 0; y < 40; y++) for (let x = 0; x < 80; x++) d[y * 80 + x] = x >= 36 && x < 44 && y >= 16 && y < 24 ? 10 : 0; return d; };
  it('un bloc de 10 unités éclairé par la droite (élévation 45°) projette son ombre à sa GAUCHE, pas à sa droite, sur ≈ 10 unités', () => {
    const s = castShadow(g, field(), { x: 0.707, y: 0, z: 0.707 }, { reach: 30, penumbra: 0.1, blur: 0 });
    const row = 20; expect(s[row * 80 + 30]).toBeGreaterThan(0.8); expect(s[row * 80 + 22]).toBeLessThan(0.3); expect(s[row * 80 + 50]).toBe(0);
  });
  it('la pénombre croît avec la distance à l\'occulteur', () => {
    const s = castShadow(g, field(), { x: 0.707, y: 0, z: 0.707 }, { reach: 30, penumbra: 0.5, blur: 0 }), row = 20;
    const near = s[row * 80 + 34]!, far = s[row * 80 + 28]!; expect(near).toBeGreaterThan(far);
  });
  it('lumière de dos ou verticale : aucune ombre portée', () => {
    expect(castShadow(g, field(), { x: 0.5, y: 0, z: -0.8 }, { reach: 30 }).every((v) => v === 0)).toBe(true);
    expect(castShadow(g, field(), { x: 0, y: 0, z: 1 }, { reach: 30 }).every((v) => v === 0)).toBe(true);
  });
});

describe('vérification de l\'éclairage de la tête (3 couches)', () => {
  for (const p of LIGHT_PATTERNS) it(`motif « ${p.label} » (réf. ${p.ref}) : aucun échec`, () => {
    const h = lit(modelOf(p)), r = verifyLit(h, FC.lm, FC.nose, p);
    expect(r.failures.map((c) => `${c.id} — ${c.detail}`)).toEqual([]);
    expect(new Set(r.checks.map((c) => c.layer))).toEqual(new Set(['geometry', 'anatomy', 'style']));
  });
  it('CONTRÔLE NÉGATIF — un motif attendu à gauche échoue quand la lumière vient de la droite', () => {
    const left = LIGHT_PATTERNS.find((q) => q.id === 'side-left')!, right = LIGHT_PATTERNS.find((q) => q.id === 'side-right')!;
    const r = verifyLit(lit(modelOf(right)), FC.lm, FC.nose, left);
    expect(r.failures.some((c) => c.id.includes('pattern.side-left.left'))).toBe(true);
  });
  it('CONTRÔLE NÉGATIF — un relief aplati (sans nez ni menton) échoue les contrôles de géométrie', () => {
    const h = lit(), flat = { ...h, field: { ...h.field, depth: h.field.depth.map((z) => (z === -Infinity ? z : 50)) } } as HeadLit;
    const r = verifyLit(flat, FC.lm, FC.nose);
    expect(r.failures.map((c) => c.id)).toEqual(expect.arrayContaining(['lit.geo.nose-proud', 'lit.geo.chin-overhang']));
  });
  it('CONTRÔLE NÉGATIF — un contraste trop faible (ancien éclairage) échoue le contrôle de style', () => {
    const h = lit(), weak = tonesOf(H.skin, lightModelOf({ intensity: 0 }, { contrast: 0.01 }));
    const r = verifyLit({ ...h, tones: { ...weak, shadow: weak.lit } }, FC.lm, FC.nose);
    expect(r.failures.map((c) => c.id)).toContain('lit.style.delta-L');
  });
  it('symétrie : lumière frontale → lumière gauche ≈ droite (écart ≤ 0,12)', () => {
    const s = litStats(lit(lightModelOf({ azimuthDeg: 0, elevationDeg: 90 }, { style: 'soft' })), FC.lm);
    expect(Math.abs(s.left - s.right)).toBeLessThanOrEqual(0.12);
  });
  it('cel2 : bords nets (≤ 10 % de pixels en transition) ; peint : terminateur progressif', () => {
    const cel = litStats(lit(modelOf(LIGHT_PATTERNS[2]!)), FC.lm), soft = litStats(lit(lightModelOf({ azimuthDeg: 305, elevationDeg: 38 }, { style: 'soft' })), FC.lm);
    expect(cel.transition).toBeLessThanOrEqual(0.1); expect(soft.transition).toBeGreaterThan(cel.transition);
  });
  it('visage AVEC teinte d\'ombre imposée : l\'ombre garde sa teinte, le contraste minimal est respecté, les contrôles passent', () => {
    const imposed = { ...FC0.p, skin: { ...FC0.p.skin, light: { ...FC0.p.skin.light, shadow: '#9a7a6a' } } }, p = LIGHT_PATTERNS[2]!;
    const h = headLit(imposed, FC0.lm, FC0.nose, H.skin, modelOf(p), { ppu: 1.6 }), r = verifyLit(h, FC0.lm, FC0.nose, p);
    expect(h.tones.imposed).toBe(true); expect(r.failures.map((c) => c.id)).toEqual([]);
  });
  it('déterministe : deux calculs identiques', () => {
    const a = lit(), b = lit(); expect(a.svg === b.svg).toBe(true);
  });
});

describe('corps éclairé par le même modèle', () => {
  const set = bodyVolumes(ARCHETYPES.veryMuscular as BodyInput, H.a, {});
  const render = (spec: object, extra: object = {}) => renderVolumesPixel(set, { skin: H.skin, heightPx: 420, ss: 1, uid: 'rl', lightModel: lightModelOf(spec as never, { style: 'soft' }), ...extra });
  const stats = (r: ReturnType<typeof render>): { p5: number; p95: number; cx: number } => {
    const { w, h, rgba } = r.pixels, ys: number[] = []; let sx = 0, sw = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; if (rgba[i + 3]! < 200) continue; const L = luma(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!); ys.push(L); sx += x * L * L; sw += L * L; }
    ys.sort((a, b) => a - b); return { p5: ys[Math.floor(0.05 * ys.length)]!, p95: ys[Math.floor(0.95 * ys.length)]!, cx: sx / sw / w };
  };
  it('plage de luminance du corps plus large que l\'ancien éclairage (ombres portées et relief lisibles)', () => {
    const legacy = stats(renderVolumesPixel(set, { skin: H.skin, heightPx: 420, ss: 1, uid: 'rl', lightModel: null })), now = stats(render({ azimuthDeg: 305, elevationDeg: 38 }));
    expect(now.p95 - now.p5).toBeGreaterThan(1.3 * (legacy.p95 - legacy.p5));
  });
  it('la lumière suit son azimut : la luminance se déplace du côté de la source', () => {
    const l = stats(render({ azimuthDeg: 270, elevationDeg: 30 })), r = stats(render({ azimuthDeg: 90, elevationDeg: 30 }));
    expect(l.cx).toBeLessThan(r.cx);
  });
  it('la tête projette son ombre sur le corps : sous le menton, avec une lumière venant d\'en haut, le cou 3D est plus sombre qu\'avec le seul corps (l\'ombre n\'atteint pas la poitrine : voir REMAINING)', () => {
    const spec = { azimuthDeg: 0, elevationDeg: 45 }, m = lightModelOf(spec, { style: 'soft' });
    const fig = litFigure(H.svg, H.o, H.skin, set, m, { heightPx: 420, ss: 1, uid: 'rl2' }), alone = render(spec);
    const band = (r: { pixels: { w: number; h: number; rgba: Uint8ClampedArray }; bounds: { x0: number; y0: number; x1: number; y1: number } }): number => {
      const { w, rgba } = r.pixels, k = w / (r.bounds.x1 - r.bounds.x0); let s = 0, n = 0;
      for (let y = Math.floor((FC.lm.chinY + 0.01 * FC.lm.H - r.bounds.y0) * k); y < Math.floor((FC.lm.chinY + 0.12 * FC.lm.H - r.bounds.y0) * k); y++) for (let x = Math.floor((-0.5 * FC.lm.neck.half - r.bounds.x0) * k); x < Math.floor((0.5 * FC.lm.neck.half - r.bounds.x0) * k); x++) { const i = (y * w + x) * 4; if (rgba[i + 3]! < 200) continue; s += luma(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!); n++; }
      return s / n;
    };
    expect(band(fig.body)).toBeLessThan(band(alone) - 3);
  });
  it('déterministe octet à octet', () => {
    expect(render({ azimuthDeg: 305 }).svg === render({ azimuthDeg: 305 }).svg).toBe(true);
  });
});

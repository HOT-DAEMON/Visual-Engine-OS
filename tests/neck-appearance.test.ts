import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileScene, generateRandomFace, SceneSpec } from '../src';
import { hueDelta, toHsl } from '../src/appearance';
import { hostFace } from '../src/render/face';
import { decodePng } from '../src/regression/png';
import type { HostSpec } from '../src/schema';
import { cellSvg } from '../scripts/lib/board';
import { rasterPng } from '../scripts/lib/raster';
import { neckPatch } from '../scripts/lib/neck-cases';

/**
 * APPARENCE DU COU = apparence du reste du corps. Trois garanties, chacune sur le code OU sur un rendu réel :
 *  1. aucun second modèle d'éclairage dans `src/render/neck` (le cou assemble les couches de `skin/layers.ts`) ;
 *  2. même peau : la teinte du cou, de la joue et du torse (rendu final, corps branché) ne diverge pas ;
 *  3. les effets de l'apparence (opacité, grain, glow…) atteignent le cou comme la tête.
 */
describe('cou — un seul moteur d\'apparence', () => {
  it('aucun ombrage propre au cou : pas de Lambert maison, pas de shade.ts, import du moteur de peau partagé', () => {
    expect(existsSync(join('src', 'render', 'neck', 'shade.ts'))).toBe(false);
    const files = readdirSync(join('src', 'render', 'neck')).filter((f) => f.endsWith('.ts'));
    for (const f of files) {
      const code = readFileSync(join('src', 'render', 'neck', f), 'utf8');
      expect(code, `${f} : produit scalaire normale·lumière maison`).not.toMatch(/n\.z\s*\*\s*L\.z|\*\s*L\.x\s*\+\s*n\.y\s*\*\s*L\.y/);
      expect(code, `${f} : bandes de couleur par ra.tone(…lit…)`).not.toMatch(/ra\.tone\([^)]*lit/);
    }
    expect(readFileSync(join('src', 'render', 'neck', 'skin.ts'), 'utf8')).toMatch(/from '\.\.\/\.\.\/skin'/);
  });

  it('même peau sur le rendu final : cou ≈ joue (≤ 8°) et torse ≈ cou (≤ 14°) en teinte, sur 3 identités', () => {
    for (const seed of [3, 11, 42]) {
      const f = generateRandomFace(seed, { id: 'f0', transform: { x: 320, y: 330, scale: 1 }, neck: { visible: true } } as never);
      const parsed = SceneSpec.parse({ width: 640, height: 900, background: '#f4f1ec', objects: [...f.objects, { kind: 'body', id: 'b0', host: 'f0', body: { age: 28, sex: 1, muscularity: 0.6 } }] });
      const host = parsed.objects.find((o) => o.kind === 'host') as HostSpec, { lm } = hostFace(host);
      const r = compileScene(parsed as never);
      if (!r.ok) throw new Error(r.issues.join('\n'));
      const img = decodePng(rasterPng(r.svg, { fitWidth: 640 }));
      const hue = (x: number, y: number): number => {
        let R = 0, G = 0, B = 0, n = 0;
        for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) { const k = ((Math.round(330 + y) + j) * img.width + Math.round(320 + x) + i) * 4; R += img.data[k]!; G += img.data[k + 1]!; B += img.data[k + 2]!; n++; }
        const h2 = (v: number): string => Math.round(v / n).toString(16).padStart(2, '0');
        return toHsl(`#${h2(R)}${h2(G)}${h2(B)}`).h;
      };
      const h = lm.neck.half, cheek = hue(-lm.W * 0.22, lm.eyeY + 0.2 * lm.H), neck = hue(-h * 0.45, lm.chinY + 0.55 * (lm.neck.bottomY - lm.chinY)), torso = hue(-h * 0.8, lm.neck.bottomY + 0.22 * lm.H);
      expect(Math.abs(hueDelta(neck, cheek)), `graine ${seed} : cou ${neck.toFixed(0)}° / joue ${cheek.toFixed(0)}°`).toBeLessThanOrEqual(8);
      expect(Math.abs(hueDelta(torso, neck)), `graine ${seed} : torse ${torso.toFixed(0)}° / cou ${neck.toFixed(0)}°`).toBeLessThanOrEqual(14);
    }
  });

  it('les effets de l\'apparence atteignent le cou : une opacité de peau de 0,5 modifie le cou comme la tête', () => {
    const run = (skin: Record<string, unknown>) => { const c = cellSvg({ seed: 321, patch: { ...neckPatch({}), skin }, focus: 'face' } as never, 300, 440); return { img: decodePng(rasterPng(c.svg)), c }; };
    const a = run({}), b = run({ opacity: 0.5 }), lm = a.c.meta.lm, [x0, y0] = a.c.meta.px(-lm.neck.half * 0.8, lm.chinY + 0.4 * (lm.neck.bottomY - lm.chinY)), [x1, y1] = a.c.meta.px(lm.neck.half * 0.8, lm.neck.bottomY - 6);
    let n = 0, t = 0;
    for (let y = Math.floor(y0); y < y1; y++) for (let x = Math.floor(x0); x < x1; x++) { const i = (y * a.img.width + x) * 4; t++; if (Math.abs(a.img.data[i]! - b.img.data[i]!) + Math.abs(a.img.data[i + 1]! - b.img.data[i + 1]!) + Math.abs(a.img.data[i + 2]! - b.img.data[i + 2]!) > 24) n++; }
    expect(n / t).toBeGreaterThan(0.5);
  });
});

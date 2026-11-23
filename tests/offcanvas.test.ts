import { Resvg } from '@resvg/resvg-js';
import { describe, expect, it } from 'vitest';
import { compileScene, generateRandomFace } from '../src';
import { cullOffCanvas } from '../src/core/offcanvas';
import { crashesNatively } from './helpers/native-crash';

const svg = (inner: string, defs = '', size = 200): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><defs>${defs}</defs>${inner}</svg>`;
const CLIP = '<clipPath id="c"><rect x="0" y="0" width="40" height="40"/></clipPath>';
const FLT = '<filter id="f" filterUnits="userSpaceOnUse" x="0" y="0" width="40" height="40"><feGaussianBlur stdDeviation="2"/></filter>';
const R = '<rect x="0" y="0" width="40" height="40" fill="#c33"/>';
const at = (tf: string, layer: string): string => `<g transform="${tf}"><g ${layer}>${R}</g></g>`;
const px = (s: string): Buffer => Buffer.from(new Resvg(s, { font: { loadSystemFonts: false } }).render().pixels);

describe('cullOffCanvas : décisions géométriques', () => {
  it('supprime un calque entièrement hors cadre, garde ce qui est visible ou partiellement visible', () => {
    expect(cullOffCanvas(svg(at('translate(9000 50)', 'clip-path="url(#c)"'), CLIP)).culled).toBe(1);
    expect(cullOffCanvas(svg(at('translate(-9000 50)', 'filter="url(#f)"'), FLT)).culled).toBe(1);
    expect(cullOffCanvas(svg(at('translate(50 9000)', 'opacity="0.5"'))).culled).toBe(1);
    expect(cullOffCanvas(svg(at('translate(50 50)', 'clip-path="url(#c)"'), CLIP)).culled).toBe(0); // dans le cadre
    expect(cullOffCanvas(svg(at('translate(190 50)', 'clip-path="url(#c)"'), CLIP)).culled).toBe(0); // à cheval sur le bord
    expect(cullOffCanvas(svg(at('translate(-30 50)', 'clip-path="url(#c)"'), CLIP)).culled).toBe(0);
  });
  it('un calque hors cadre sans clip ni filtre n’est pas un calque : rien à faire', () => {
    expect(cullOffCanvas(svg(`<g transform="translate(9000 50)">${R}</g>`)).culled).toBe(0);
  });
  it('conserve les DÉFINITIONS d’un sous-arbre supprimé (un élément resté en vue peut les référencer)', () => {
    const inner = `<g transform="translate(9000 50)" opacity="0.5"><defs><linearGradient id="keep"><stop offset="0" stop-color="#000"/></linearGradient></defs>${R}</g><rect width="30" height="30" fill="url(#keep)"/>`;
    const r = cullOffCanvas(svg(inner));
    expect(r.culled).toBe(1); expect(r.svg).toContain('id="keep"'); expect(r.svg).not.toContain('translate(9000');
    // Référence SANS le calque lointain (le rastériser brut avorterait ce processus) : mêmes pixels, le dégradé gardé colore toujours le carré.
    const ref = svg('<defs><linearGradient id="keep"><stop offset="0" stop-color="#000"/></linearGradient></defs><rect width="30" height="30" fill="url(#keep)"/>');
    expect(px(r.svg).equals(px(ref))).toBe(true);
  });
  it('clip lointain sur un contenu en vue : intersection vide ⇒ invisible ⇒ supprimé ; clip en vue : conservé', () => {
    const far = '<clipPath id="c"><rect x="5000" y="0" width="40" height="40"/></clipPath>';
    expect(cullOffCanvas(svg(`<g clip-path="url(#c)">${R}</g>`, far)).culled).toBe(1);
    expect(cullOffCanvas(svg(`<g clip-path="url(#c)">${R}</g>`, CLIP)).culled).toBe(0);
  });
  it('la région d’un filtre qui atteint le cadre garde le calque (le flou déborde sa géométrie)', () => {
    const reach = '<filter id="f" filterUnits="userSpaceOnUse" x="-9100" y="0" width="9200" height="60"><feGaussianBlur stdDeviation="2"/></filter>';
    expect(cullOffCanvas(svg(at('translate(9000 50)', 'filter="url(#f)"'), reach)).culled).toBe(0);
  });
  it('le trait élargit l’emprise ; une transformation inconnue ou un <use> ne sont jamais supprimés', () => {
    const stroked = `<g transform="translate(-60 50)" opacity="0.5"><path d="M0 0H40" stroke="#000" stroke-width="40" fill="none"/></g>`;
    expect(cullOffCanvas(svg(stroked)).culled).toBe(0); // trait de 40 : le bord droit atteint x = 0
    expect(cullOffCanvas(svg(`<g transform="translate(9000 50) bizarre(3)" opacity="0.5">${R}</g>`)).culled).toBe(0);
    expect(cullOffCanvas(svg(`<g transform="translate(9000 50)" opacity="0.5">${R}</g><use href="#x"/>`)).culled).toBe(0);
  });
  it('SVG non analysable : rendu tel quel, sans exception', () => {
    for (const bad of ['', '<svg', '<g/>', '<svg viewBox="0 0 0 0"></svg>']) expect(cullOffCanvas(bad).svg).toBe(bad);
  });
  it('svg imbriqué : son cadre de vue borne son contenu', () => {
    const nested = `<svg x="9000" y="0" width="100" height="100" viewBox="0 0 10 10" opacity="0.5">${R}</svg>`;
    expect(cullOffCanvas(svg(nested)).culled).toBe(1);
    expect(cullOffCanvas(svg(`<svg x="10" y="10" width="100" height="100" viewBox="0 0 10 10" opacity="0.5"><g opacity="0.5" transform="translate(9000 0)">${R}</g></svg>`)).culled).toBe(1);
  });
});

describe('plantage natif de resvg : contrôle négatif + garde', () => {
  const cases: [string, string, string][] = [
    ['clip lointain (droite)', at('translate(9000 50)', 'clip-path="url(#c)"'), CLIP], ['filtre lointain (gauche)', at('translate(-9000 50)', 'filter="url(#f)"'), FLT],
    ['opacité lointaine (bas)', at('translate(50 9000)', 'opacity="0.5"'), ''], ['clip + filtre lointains', `<g transform="translate(9000 9000)"><g clip-path="url(#c)"><g filter="url(#f)">${R}</g></g></g>`, CLIP + FLT],
  ];
  for (const [name, inner, defs] of cases) {
    it(`${name} : le SVG brut avorte le processus, le SVG gardé non`, () => {
      expect(crashesNatively(svg(inner, defs)), 'contrôle négatif : le brut doit planter (sinon ce test ne prouve rien)').toBe(true);
      expect(crashesNatively(cullOffCanvas(svg(inner, defs)).svg)).toBe(false);
    });
  }
});

describe('scènes à plusieurs personnages : garde sans effet sur les pixels', () => {
  const scene = (xs: number[]): unknown => ({ width: 800, height: 900, background: '#f4f1ec', objects: xs.flatMap((x, i) => {
    const f = generateRandomFace(3 + 8 * i, { id: `f${i}`, transform: { x, y: 200, scale: 0.5 } });
    return [...f.objects, { kind: 'body', id: `b${i}`, host: `f${i}`, body: { age: 28, sex: i % 2, muscularity: 0.5 }, legs: {} }];
  }) });
  for (const xs of [[200, 600], [200, -900], [700, 200], [-5000, 600], [400]]) {
    it(`personnages en x = ${xs.join(', ')} : pixels identiques, plantage impossible`, () => {
      const r = compileScene(scene(xs) as never); expect(r.ok).toBe(true); if (!r.ok) return;
      const g = cullOffCanvas(r.svg);
      expect(crashesNatively(g.svg)).toBe(false);
      if (!crashesNatively(r.svg)) expect(px(g.svg).equals(px(r.svg)), 'la garde a changé des pixels').toBe(true);
    }, 120000);
  }
  it('scène extrême (x = 9000) : le brut plante, le gardé non', () => {
    const r = compileScene(scene([200, 9000]) as never); expect(r.ok).toBe(true); if (!r.ok) return;
    expect(crashesNatively(r.svg)).toBe(true); expect(crashesNatively(cullOffCanvas(r.svg).svg)).toBe(false);
  }, 120000);
});

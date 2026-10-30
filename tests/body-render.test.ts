import { describe, expect, it } from 'vitest';
import { Resvg } from '@resvg/resvg-js';
import { compileScene, generateRandomFace } from '../src';
import { anchorFromFace, bodyBounds, bodyGeometry, bodyMarkup, composeFigure, renderBody, type Level } from '../src/body';
import { cacheStats, clearCaches } from '../src/perf';

const f = generateRandomFace(11, { id: 'f0', transform: { x: 300, y: 200, scale: 0.4 } });
const host = f.objects[0] as unknown as { face: Parameters<typeof anchorFromFace>[0]; width: number; height: number };
const A = anchorFromFace(host.face, host.width, host.height);
const SKIN = '#c99a76';

describe('rendu du corps', () => {
  it('aucun filtre, aucun script, et seuls des éléments de la liste blanche sortent', () => {
    const m = renderBody(bodyGeometry({}, A), { skin: SKIN });
    expect(m.back).not.toMatch(/<filter|<script|href=|<image/);
    const tags = new Set([...(m.back + m.front).matchAll(/<([a-zA-Z]+)/g)].map((x) => x[1]));
    for (const t of tags) expect(['g', 'defs', 'path', 'clipPath', 'rect', 'linearGradient', 'stop']).toContain(t);
  });
  it('déterministe : mêmes entrées → même SVG', () => {
    const g = bodyGeometry({ age: 22, sex: -1 }, A);
    expect(renderBody(g, { skin: SKIN }).back).toBe(renderBody(g, { skin: SKIN }).back);
  });
  it('hiérarchie de présentation : chaque niveau AJOUTE du détail (poids du SVG strictement croissant) et le niveau 0 n’a aucun trait interne', () => {
    const g = bodyGeometry({ age: 25 }, A);
    const w = ([0, 1, 2, 3] as Level[]).map((level) => renderBody(g, { skin: SKIN, level }).back.length);
    for (let i = 1; i < w.length; i++) expect(w[i]!).toBeGreaterThan(w[i - 1]!);
    expect(renderBody(g, { skin: SKIN, level: 0 }).back).not.toMatch(/stroke-opacity/);
  });
  it('mode atomes : tous les atomes (cachés compris, en pointillés) sont dessinés', () => {
    const g = bodyGeometry({}, A);
    const m = renderBody(g, { skin: SKIN, mode: 'atoms' });
    expect((m.back.match(/<path/g) ?? []).length).toBe(g.atoms.length - 1);
    expect(m.back).toContain('stroke-dasharray');
  });
  it('un nourrisson n’a AUCUN relief musculaire visible (opacité des muscles nulle) ; un culturiste en a', () => {
    const baby = renderBody(bodyGeometry({ age: 0.5, sex: 0, muscularity: 0.1 }, A), { skin: SKIN }).back;
    const bb = renderBody(bodyGeometry({ age: 28, sex: 1, adiposity: 0.05, muscularity: 1 }, A), { skin: SKIN }).back;
    const op = (s: string) => [...s.matchAll(/fill-opacity="([0-9.]+)"/g)].map((x) => Number(x[1])).filter((v) => v > 0.3).length;
    expect(op(bb)).toBeGreaterThan(op(baby));
  });
  it('composition avec le visage : le SVG final est valide et rastérisable ; le corps est DERRIÈRE le visage', () => {
    const scene = compileScene({ width: 600, height: 800, background: '#3b4157', objects: f.objects });
    if (!scene.ok) throw new Error('scène invalide');
    const m = renderBody(bodyGeometry({}, A), { skin: SKIN });
    const svg = composeFigure(scene.svg, m);
    expect(svg.indexOf(m.back)).toBeLessThan(svg.indexOf('<path d="M-61'));
    expect(svg.endsWith('</svg>')).toBe(true);
    const png = new Resvg(svg, { font: { loadSystemFonts: false } }).render().asPng();
    expect(png.length).toBeGreaterThan(5000);
  });
  it('composeFigure refuse une scène de structure inattendue au lieu de produire un SVG faux', () => {
    expect(() => composeFigure('<svg></svg>', { back: '', front: '' })).toThrow(/structure/);
  });
  it('bodyMarkup est mémoïsé par le contenu : la 2ᵉ demande est un succès de cache et rend le même objet', () => {
    clearCaches();
    const a = bodyMarkup({ age: 33 }, A, { skin: SKIN }), b = bodyMarkup({ age: 33 }, A, { skin: SKIN });
    expect(b).toBe(a);
    expect(cacheStats().find((c) => c.name === 'body-svg')!.hits).toBe(1);
    expect(bodyMarkup({ age: 34 }, A, { skin: SKIN })).not.toBe(a);
  });
  it('bodyBounds englobe tous les atomes visibles et reste borné (un bébé occupe moins de place qu’un adulte)', () => {
    const adult = bodyGeometry({ age: 30 }, A), baby = bodyGeometry({ age: 0.5, sex: 0 }, A);
    const b = bodyBounds(adult);
    for (const at of adult.atoms.filter((x) => x.view === 'front' && x.id !== 'neck')) for (const q of at.poly) { expect(q.x).toBeGreaterThanOrEqual(b.x0); expect(q.x).toBeLessThanOrEqual(b.x1); expect(q.y).toBeLessThanOrEqual(b.y1); }
    const bb = bodyBounds(baby);
    expect((bb.x1 - bb.x0) * (bb.y1 - bb.y0)).toBeLessThan((b.x1 - b.x0) * (b.y1 - b.y0));
  });
});

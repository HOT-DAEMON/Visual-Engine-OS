import { describe, expect, it } from 'vitest';
import { compileScene, generateRandomFace, renderScene } from '../src';
import { faceIsCel } from '../src/face/head-style';
import { FaceParams } from '../src/schema';
import { checkEyePair } from '../src/verify/eye-pair';

/** PASSE 19 — cohérence de style tête ↔ yeux : `eyeFinish`, `faceIsCel`, règle `eyes-finish-matches-head`. */
const SEEDS = [11, 23, 5, 42];
const finishes = (f: ReturnType<typeof generateRandomFace>): (string | undefined)[] => (f.objects as { kind: string; finish?: string }[]).filter((o) => o.kind === 'eye').map((o) => o.finish);
const rule = (f: ReturnType<typeof generateRandomFace>) => checkEyePair(f).find((c) => c.id === 'eyes-finish-matches-head');
const svgOf = (f: ReturnType<typeof generateRandomFace>): string => { const r = compileScene({ width: 520, height: 640, objects: f.objects } as never) as { ok: boolean; scene: never; issues?: string[] }; if (!r.ok) throw new Error((r.issues ?? []).join('\n')); return renderScene(r.scene); };
const count = (s: string, re: RegExp): number => (s.match(re) ?? []).length;

describe('faceIsCel — une seule définition du style cel d’une tête', () => {
  it('lisse par défaut ; cel par le mode d’ombrage de la peau ; cel forcé par renderMode anime', () => {
    expect(faceIsCel(FaceParams.parse({}))).toBe(false);
    expect(faceIsCel(FaceParams.parse({ skin: { shading: { mode: 'cel', bands: 3 } } }))).toBe(true);
    expect(faceIsCel(FaceParams.parse({ renderMode: 'anime' }))).toBe(true);
  });
  it('le tirage d’un visage cel donne un faceIsCel vrai, un visage ordinaire faux', () => {
    for (const s of SEEDS) {
      expect(faceIsCel(generateRandomFace(s, { anatomy: { style: 'cel' } }).params)).toBe(true);
      expect(faceIsCel(generateRandomFace(s).params)).toBe(false);
    }
  });
});

describe('eyeFinish — le fini des yeux suit le style de la tête', () => {
  it('absent : visages inchangés ; auto sur tête lisse : identique à absent (octet pour octet)', () => {
    for (const s of SEEDS) expect(JSON.stringify(generateRandomFace(s, { eyeFinish: 'auto' }).objects)).toBe(JSON.stringify(generateRandomFace(s).objects));
  });
  it('auto sur tête cel : les DEUX yeux en fini cel ; shaded impose l’ombré ; flat impose les aplats sur tête lisse', () => {
    for (const s of SEEDS) {
      expect(finishes(generateRandomFace(s, { anatomy: { style: 'cel' }, eyeFinish: 'auto' }))).toEqual(['cel', 'cel']);   // identités de galerie non encre : aplats + ombre portée dure
      expect(finishes(generateRandomFace(s, { anatomy: { style: 'cel' }, eyeFinish: 'shaded' }))).toEqual(['shaded', 'shaded']);
      expect(finishes(generateRandomFace(s, { eyeFinish: 'flat' }))).toEqual(['flat', 'flat']);
    }
  });
  it('le paramètre est CONSOMMÉ à l’image : un œil en aplats dessine moins de dégradés et de filtres que le même œil ombré', () => {
    for (const s of SEEDS.slice(0, 3)) {
      const flat = svgOf(generateRandomFace(s, { anatomy: { style: 'cel' }, eyeFinish: 'flat' })), shaded = svgOf(generateRandomFace(s, { anatomy: { style: 'cel' }, eyeFinish: 'shaded' }));
      const eyeOnly = (v: string): string => v.slice(v.indexOf('eye-left') > 0 ? v.indexOf('eye-left') : 0);
      const g = (v: string): number => count(eyeOnly(v), /<(radialGradient|linearGradient|filter)\b/g);
      expect(g(flat)).toBeLessThan(g(shaded));
    }
  });
});

describe('mesure sur les galeries : l’incohérence existe sans `auto`, disparaît avec', () => {
  it('sources étendues : des yeux d’encre sur tête lisse apparaissent sans `eyeFinish` (≥ 1 visage) ; 0 sur 6 sources × 30 visages avec `auto`', () => {
    let without = 0;
    for (const src of ['gallery', 'extended', 'extended2', 'extended3', 'extended4', 'random'] as const) for (let s = 1; s <= 30; s++) {
      if (rule(generateRandomFace(s, { eyeSource: src }))?.ok === false) without++;
      expect(rule(generateRandomFace(s, { eyeSource: src, eyeFinish: 'auto' }))?.ok, `${src} ${s}`).toBe(true);
    }
    expect(without).toBeGreaterThan(0);
  }, 240_000);
  it('yeux d’encre + auto : la TÊTE devient cel (pas l’inverse) ; un style imposé par l’utilisateur n’est jamais écrasé', () => {
    const ink = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter((s) => finishes(generateRandomFace(s, { eyeSource: 'extended' }))[0] === 'flat');
    expect(ink.length).toBeGreaterThan(0);
    for (const s of ink) {
      expect(faceIsCel(generateRandomFace(s, { eyeSource: 'extended', eyeFinish: 'auto' }).params)).toBe(true);
      const kept = generateRandomFace(s, { eyeSource: 'extended', eyeFinish: 'auto', anatomy: { style: 'smooth' } });
      expect(faceIsCel(kept.params)).toBe(false); expect(finishes(kept)).toEqual(['flat', 'flat']);
    }
  });
});

describe('eyes-finish-matches-head (couche style de la paire d’yeux)', () => {
  it('tête lisse + yeux ombrés (cas ordinaire) : passe ; tête cel + yeux ombrés : avertit ; tête cel + auto : passe', () => {
    for (const s of SEEDS) {
      expect(rule(generateRandomFace(s))?.ok).toBe(true);
      const bad = rule(generateRandomFace(s, { anatomy: { style: 'cel' } }));
      expect(bad?.ok).toBe(false); expect(bad?.severity).toBe('warn');
      expect(rule(generateRandomFace(s, { anatomy: { style: 'cel' }, eyeFinish: 'auto' }))?.ok).toBe(true);
    }
  });
  it('tête lisse + yeux en aplats : avertit (l’inverse du cas précédent)', () => {
    expect(rule(generateRandomFace(11, { eyeFinish: 'flat' }))?.ok).toBe(false);
  });
  it('eyes-same-finish ne confond plus « finish absent » et « shaded » (même fini, défaut du schéma)', () => {
    const f = generateRandomFace(11); const objs = (f.objects as { kind: string; id: string; finish?: string }[]).map((o) => (o.id.endsWith('eye-left') ? { ...o, finish: 'shaded' } : o));
    expect(checkEyePair({ ...f, objects: objs as never }).find((c) => c.id === 'eyes-same-finish')?.ok).toBe(true);
  });
});

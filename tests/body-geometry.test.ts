import { describe, expect, it } from 'vitest';
import { ARCHETYPES, ARCHETYPE_NAMES, BodyParams, bodyGeometry, generateBody } from '../src/body';
import { canonAt, puberty, senior, stageOf } from '../src/body/canon';
import { clearCaches, cacheStats } from '../src/perf';
import { referenceAnchor } from './body-helpers';

const A = referenceAnchor();
const G = (o: object) => bodyGeometry(o as never, A);

describe('corps — schéma et déterminisme', () => {
  it('le schéma est strict : une clé inconnue est refusée', () => {
    expect(BodyParams.safeParse({ age: 30, taille: 1 }).success).toBe(false);
    expect(BodyParams.safeParse({ pose: { left: { curl: [0, 0] } } }).success).toBe(false);
    expect(BodyParams.safeParse({ age: 120 }).success).toBe(false);
  });
  it('même entrée → même géométrie, octet pour octet ; et la mémoïsation par le contenu sert la deuxième demande', () => {
    clearCaches();
    const a = G({ age: 40, sex: -1 }), b = G({ age: 40, sex: -1 });
    expect(b).toBe(a);
    const st = cacheStats().find((c) => c.name === 'body-geometry')!;
    expect(st.hits).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(G(generateBody(3, 'adultMale')).atoms)).toBe(JSON.stringify(G(generateBody(3, 'adultMale')).atoms));
  });
  it('le générateur est déterministe par graine et varie entre graines', () => {
    expect(generateBody(5, 'thin')).toEqual(generateBody(5, 'thin'));
    expect(generateBody(5, 'thin')).not.toEqual(generateBody(6, 'thin'));
  });
  it('granularité atomique : ≥ 250 atomes, 4 niveaux de présentation, ids uniques', () => {
    const g = G({});
    expect(g.atoms.length).toBeGreaterThanOrEqual(250);
    expect(new Set(g.atoms.map((a) => a.level)).size).toBe(4);
    expect(new Set(g.atoms.map((a) => a.id)).size).toBe(g.atoms.length);
  });
  it('la main compte 5 doigts × 3 segments, 15 articulations, des ongles (dos) ET des pulpes (paume), de chaque côté', () => {
    const g = G({});
    for (const s of ['L', 'R']) {
      expect(g.atoms.filter((a) => /^finger\.\w+\.(prox|mid|dist|meta)\./.test(a.id) && a.side === s).length).toBe(15);
      expect(g.atoms.filter((a) => /^finger\.\w+\.joint\./.test(a.id) && a.side === s).length).toBe(15);
      expect(g.atoms.filter((a) => /\.nail\./.test(a.id) && a.side === s).length).toBe(5);
      expect(g.atoms.filter((a) => /\.pad\./.test(a.id) && a.side === s).length).toBe(5);
    }
  });
});

describe('corps — axes INDÉPENDANTS et distinctions demandées', () => {
  it('canon : le corps grandit avec l’âge (têtes, épaules, bras, main) et la porte de puberté s’ouvre entre 10 et 17 ans', () => {
    const ages = [0, 2, 6, 10, 15, 20];
    for (const k of ['heads', 'shoulder', 'upperArm', 'forearm', 'hand', 'torso'] as const) for (let i = 1; i < ages.length; i++) expect(canonAt(ages[i]!)[k]).toBeGreaterThan(canonAt(ages[i - 1]!)[k]);
    expect(puberty(9)).toBe(0); expect(puberty(18)).toBe(1); expect(senior(40)).toBe(0); expect(senior(90)).toBe(1);
    expect(['baby', 'child', 'teen', 'adult', 'elder']).toEqual([0.5, 6, 15, 30, 80].map(stageOf));
  });
  it('BÉBÉ / ENFANT / ADO / ADULTE : l’épaule et le bras grandissent strictement (en hauteurs de tête)', () => {
    const m = [0.5, 6, 15, 30].map((age) => G({ age, sex: 0 }).measures);
    for (const k of ['shoulderWidth', 'armStraight', 'upperArm', 'hand', 'torsoLength'] as const) for (let i = 1; i < m.length; i++) expect(m[i]![k]!, k).toBeGreaterThan(m[i - 1]![k]!);
  });
  it('FÉMININ ≠ MASCULIN : adulte → épaules plus larges et hanches relatives plus étroites chez l’homme ; seins seulement chez la femme', () => {
    const f = G({ age: 28, sex: -1, adiposity: 0.3, muscularity: 0.3 }), mm = G({ age: 28, sex: 1, adiposity: 0.3, muscularity: 0.3 });
    expect(mm.measures.shoulderWidth!).toBeGreaterThan(f.measures.shoulderWidth! * 1.08);
    expect(mm.measures.hipToShoulder!).toBeLessThan(f.measures.hipToShoulder! - 0.08);
    expect(f.atoms.some((a) => a.id === 'breast.L')).toBe(true);
    expect(mm.atoms.some((a) => a.id.startsWith('breast'))).toBe(false);
  });
  it('AVANT LA PUBERTÉ le sexe ne change RIEN à la silhouette (enfant fille = enfant garçon, atome pour atome)', () => {
    const a = G({ age: 7, sex: -1 }), b = G({ age: 7, sex: 1 });
    expect(JSON.stringify(a.atoms)).toBe(JSON.stringify(b.atoms));
    const c = G({ age: 2, sex: -1 }), d = G({ age: 2, sex: 1 });
    expect(JSON.stringify(c.atoms)).toBe(JSON.stringify(d.atoms));
  });
  it('GARDE-FOU MINEURS : aucun atome de sein avant 18 ans, même à sexe = −1 et adiposité maximale ; il apparaît à 18 ans', () => {
    for (const age of [0.5, 5, 12, 15, 17.9]) expect(G({ age, sex: -1, adiposity: 1, breast: { volume: 1, ptosis: 0, spacing: 0, projection: 1 } }).atoms.filter((a) => a.id.startsWith('breast.')).length, `âge ${age}`).toBe(0);
    expect(G({ age: 18, sex: -1, breast: { volume: 1 } }).atoms.some((a) => a.id === 'breast.L')).toBe(true);
  });
  it('MINCE < NORMAL < OBÈSE : la taille s’élargit strictement avec l’adiposité, sans toucher les épaules d’os (±4 %)', () => {
    const w = [0.02, 0.4, 0.95].map((adiposity) => G({ age: 30, sex: 1, adiposity, muscularity: 0.2 }).measures);
    expect(w[1]!.waistWidth!).toBeGreaterThan(w[0]!.waistWidth!); expect(w[2]!.waistWidth!).toBeGreaterThan(w[1]!.waistWidth! * 1.2);
    expect(w[2]!.shoulderWidth! / w[0]!.shoulderWidth!).toBeLessThan(1.05);
  });
  it('MUSCLÉ < TRÈS MUSCLÉ : épaules et bras s’épaississent, la taille reste (rapport taille/épaules baisse)', () => {
    const w = [0.1, 0.5, 1].map((muscularity) => G({ age: 28, sex: 1, adiposity: 0.1, muscularity }).measures);
    for (let i = 1; i < w.length; i++) { expect(w[i]!.shoulderWidth!).toBeGreaterThan(w[i - 1]!.shoulderWidth!); expect(w[i]!.armWidth!).toBeGreaterThan(w[i - 1]!.armWidth!); expect(w[i]!.waistToShoulder!).toBeLessThan(w[i - 1]!.waistToShoulder!); }
  });
  it('VIEUX : épaules plus tombantes et bras plus fins que le même adulte jeune, à axes égaux', () => {
    const y = G({ age: 30, sex: 1, adiposity: 0.3, muscularity: 0.5 }), o = G({ age: 85, sex: 1, adiposity: 0.3, muscularity: 0.5 });
    expect(o.frame.y.acr - o.frame.y.base).toBeGreaterThan(y.frame.y.acr - y.frame.y.base);
    expect(o.measures.armWidth!).toBeLessThan(y.measures.armWidth!);
  });
  it('les 13 archétypes sont deux à deux distincts (aucun doublon de silhouette)', () => {
    const sigs = ARCHETYPE_NAMES.map((n) => JSON.stringify(G(ARCHETYPES[n]).atoms.find((a) => a.id === 'torso.shell')!.poly));
    expect(new Set(sigs).size).toBe(ARCHETYPE_NAMES.length);
  });
  it('indépendance des axes : changer l’âge ne modifie ni le sexe, ni l’adiposité lus (le cadre les relit tels quels)', () => {
    const a = G({ age: 20, sex: 0.3, adiposity: 0.6, muscularity: 0.2 }).frame, b = G({ age: 60, sex: 0.3, adiposity: 0.6, muscularity: 0.2 }).frame;
    expect(a.fat).toBeCloseTo(b.fat, 12);
  });
});

describe('corps — pose et cinématique', () => {
  it('abduction : le coude s’éloigne du tronc quand l’abduction augmente ; une pose asymétrique ne touche que son bras', () => {
    const a = G({ pose: { left: { abduction: 10 }, right: { abduction: 10 } } }), b = G({ pose: { left: { abduction: 60 }, right: { abduction: 10 } } });
    const ex = (g: ReturnType<typeof G>, s: 'L' | 'R') => g.byId.get(`elbow.epicondyle.lateral.${s}`)!.poly[0]!.x;
    expect(ex(b, 'L')).toBeGreaterThan(ex(a, 'L') + 20);
    expect(ex(b, 'R')).toBe(ex(a, 'R'));
  });
  it('flexion du coude : l’avant-bras se raccourcit (perspective), le poignet remonte', () => {
    const a = G({ pose: { left: { elbowFlex: 0 } } }), b = G({ pose: { left: { elbowFlex: 70 } } });
    const wy = (g: ReturnType<typeof G>) => g.byId.get('wrist.crease.L')!.poly[1]!.y;
    expect(wy(b)).toBeLessThan(wy(a) - 10);
  });
  it('doigts fléchis : le poing est plus court que la main ouverte (bout du majeur)', () => {
    const open = G({ pose: { left: { curl: [0, 0, 0, 0, 0], pronation: -1 } } }), fist = G({ pose: { left: { curl: [0.9, 1, 1, 1, 1], pronation: -1 } } });
    const tip = (g: ReturnType<typeof G>) => Math.max(...g.byId.get('finger.middle.dist.L')!.poly.map((q) => q.y));
    expect(tip(fist)).toBeLessThan(tip(open) - 20);
  });
  it('pronation : la paume (plis, éminences) n’est visible que paume en avant ; le dos (tendons, ongles) que dos en avant', () => {
    const palm = G({ pose: { left: { pronation: -1 } } }), back = G({ pose: { left: { pronation: 1 } } });
    const vis = (g: ReturnType<typeof G>, id: string) => g.byId.get(id)!.view;
    expect(vis(palm, 'hand.crease.heart.L')).toBe('front'); expect(vis(back, 'hand.crease.heart.L')).toBe('occluded');
    expect(vis(back, 'hand.tendon.1.L')).toBe('front'); expect(vis(palm, 'hand.tendon.1.L')).toBe('occluded');
    expect(vis(back, 'finger.index.nail.L')).toBe('front'); expect(vis(palm, 'finger.index.nail.L')).toBe('occluded');
    expect(vis(palm, 'finger.index.pad.L')).toBe('front');
  });
});

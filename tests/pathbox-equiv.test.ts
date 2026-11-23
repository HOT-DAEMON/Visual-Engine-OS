import { describe, expect, it } from 'vitest';
import { compileScene, generateRandomFace } from '../src';
import { mulberry32 } from '../src/core/prng';
import { pathBox } from '../src/core/pathbox';
import { pathBoxRef } from './helpers/pathbox-ref';

/** La `pathBox` sans regex est STRICTEMENT égale à l'ancienne (même boîte au bit près, même `null`) : sur les tracés de vraies scènes et sur des chaînes piégeuses. */
describe('pathBox rapide ≡ ancienne pathBox', () => {
  it('égale sur tous les tracés de 8 visages complets (corps compris)', () => {
    let n = 0;
    for (const seed of [3, 7, 11, 19, 42, 58, 77, 90]) {
      const f = generateRandomFace(seed, { id: 'f0', transform: { x: 190, y: 200, scale: 0.5 } });
      const r = compileScene({ width: 380, height: 480, background: '#f4f1ec', objects: [...f.objects, { kind: 'body', id: 'b0', host: 'f0', body: { age: 30, sex: 1, muscularity: 0.5 }, legs: {} }] } as never);
      expect(r.ok).toBe(true); if (!r.ok) continue;
      for (const m of r.svg.matchAll(/ d="([^"]*)"/g)) { expect(pathBox(m[1]!)).toEqual(pathBoxRef(m[1]!)); n++; }
    }
    expect(n).toBeGreaterThan(5000);
  });

  it('égale sur 30 000 chaînes aléatoires aux jetons pièges', () => {
    const rnd = mulberry32(20261122);
    const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]!;
    const digits = (k: number): string => Array.from({ length: k }, () => Math.floor(rnd() * 10)).join('');
    const NUMS = [() => digits(1 + Math.floor(rnd() * 3)), () => `-${digits(2)}.${digits(3)}`, () => `.${digits(2)}`, () => `-.${digits(1)}`, () => `${digits(2)}.`, () => `+${digits(2)}`,
      () => `${digits(1)}e`, () => `${digits(1)}e+`, () => `1.2.3`, () => `--${digits(1)}`, () => `${digits(16)}`, () => `${digits(3)}.${digits(25)}`,
      () => `0.${'0'.repeat(30)}${digits(2)}`, () => '-', () => '.', () => `${digits(15)}.${digits(1)}`, () => `00${digits(2)}.0${digits(2)}`, () => '-0', () => '0.0'] as const;
    const CMDS = 'MmLlHhVvCcSsQqTtAaZzxXeE'.split(''), SEP = [' ', ',', '  ', ' , ', '\n', ''] as const;
    for (let i = 0; i < 30000; i++) {
      let d = ''; const len = 1 + Math.floor(rnd() * 14);
      for (let k = 0; k < len; k++) {
        const piece = rnd() < 0.25 ? pick(CMDS) : pick(NUMS)();
        // Jamais de jonction pouvant former un EXPOSANT (« 2 » + « e » + « 12 ») : cette forme est le seul écart voulu, testé à part.
        const glue = /[eE+-]$/.test(d) || /^[eE]/.test(piece) ? ' ' : pick(SEP);
        d += (k === 0 ? '' : glue) + piece;
      }
      expect(pathBox(d), JSON.stringify(d)).toEqual(pathBoxRef(d));
    }
  });

  it('exposants : la nouvelle version les lit comme des nombres (l’ancienne les prenait pour des commandes)', () => {
    // Écart VOULU, sans effet sur le moteur (num() n'écrit jamais d'exposant) : l'ancienne pathBox testait /[a-zA-Z]/ sur chaque jeton, donc `6e+12` devenait une « commande ».
    expect(pathBoxRef('M1e1 2e1L3e1 4e1')).toBeNull();
    expect(pathBox('M1e1 2e1L3e1 4e1')).toEqual(pathBoxRef('M10 20L30 40'));
    expect(pathBox('M5E-1 7e0L-2.5e1 1e2')).toEqual(pathBoxRef('M0.5 7L-25 100'));
    expect(pathBox('M1 2 L1e999 5')).toEqual({ x: 1, y: 2, w: 0, h: 0 }); // non fini : arrêt, comme pour tout nombre non fini
  });

  it('cas limites : vide, sans nombre, nombres orphelins, Z seul', () => {
    for (const d of ['', 'M', 'Z', 'zz', '5 6 7', 'M 1 2 3', 'M1 2L', 'M1,2 3,4 5,6', 'C1 2 3 4 5', 'a1 1 0 0 1 5 5', 'M0 0h10v10H0z']) expect(pathBox(d), d).toEqual(pathBoxRef(d));
  });
});

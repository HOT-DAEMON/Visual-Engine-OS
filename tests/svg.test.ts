import { describe, expect, it } from 'vitest';
import { el, escapeXml, num, urlRef } from '../src/core/svg';

describe('num', () => {
  it('formate de façon déterministe (3 décimales max, pas de -0)', () => {
    expect(num(2)).toBe('2');
    expect(num(1.23456)).toBe('1.235');
    expect(num(-0)).toBe('0');
    expect(num(-0.0001)).toBe('0');
  });
  it('refuse NaN et Infinity', () => {
    expect(() => num(NaN)).toThrow(RangeError);
    expect(() => num(Infinity)).toThrow(RangeError);
  });
});

describe('el (liste blanche)', () => {
  it('refuse un élément non autorisé', () => {
    expect(() => el('script')).toThrow(/non autorisé/);
    expect(() => el('foreignObject')).toThrow(/non autorisé/);
  });
  it('refuse un attribut non autorisé (gestionnaires d\'événements inclus)', () => {
    expect(() => el('g', { onload: 'x()' })).toThrow(/non autorisé/);
    expect(() => el('path', { href: 'javascript:alert(1)' })).toThrow(/non autorisé/);
  });
  it('échappe les valeurs', () => {
    expect(el('g', { 'aria-label': '"><script>' })).toBe('<g aria-label="&quot;&gt;&lt;script&gt;"/>');
    expect(escapeXml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&apos;');
  });
  it('refuse un id ou une référence mal formés', () => {
    expect(() => el('g', { id: 'a" onload="x' })).toThrow(/invalide/);
    expect(() => urlRef('a)b')).toThrow(/invalide/);
    expect(urlRef('ok-1')).toBe('url(#ok-1)');
  });
  it('ignore les attributs undefined', () => {
    expect(el('g', { opacity: undefined })).toBe('<g/>');
  });
});

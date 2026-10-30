import { tierRule } from './muscle-tiers';
import { mirror } from './shape';
import type { Atom, AtomKind, Level, Side, V } from './types';

const tierField = (id: string): { tier?: number } => { const r = tierRule(id); return r ? { tier: r.min } : {}; };
export interface AtomOpts { readonly side?: Side; readonly open?: boolean; readonly view?: 'front' | 'occluded'; readonly z?: number; readonly tone?: number }
/** Fabrique d'atome : un seul endroit où la forme d'un `Atom` est décidée. */
export function mk(id: string, kind: AtomKind, part: string, parent: string | null, level: Level, poly: readonly V[], o: AtomOpts = {}): Atom {
  return { id, kind, part, parent, level, side: o.side ?? 'C', poly, view: o.view ?? 'front', z: o.z ?? level * 10, ...(o.open ? { open: true } : {}), ...(o.tone !== undefined ? { tone: o.tone } : {}), ...tierField(id) };
}
/**
 * Paire gauche/droite : `build` dessine le côté GAUCHE du corps (x > 0) ; le droit est son miroir exact (`mirror`). Un atome impair (ligne
 * médiane) se construit avec `mk` directement. Identifiants : `<id>.L` / `<id>.R`, parents `<parent>.L` / `<parent>.R` si `parent` est latéral.
 */
export function pair(id: string, kind: AtomKind, part: string, parent: string | null, level: Level, build: () => readonly V[], o: AtomOpts & { sidedParent?: boolean } = {}): Atom[] {
  const L = build();
  const unsided = parent === 'torso.shell' || parent === 'neck';
  const pr = (s: 'L' | 'R'): string | null => (parent === null ? null : o.sidedParent === false || unsided ? parent : `${parent}.${s}`);
  const flip = o.open ? [...L].map((q) => ({ x: -q.x, y: q.y })) : mirror(L);
  return [mk(`${id}.L`, kind, part.replace('{s}', 'L'), pr('L'), level, L, { ...o, side: 'L' }), mk(`${id}.R`, kind, part.replace('{s}', 'R'), pr('R'), level, flip, { ...o, side: 'R' })];
}

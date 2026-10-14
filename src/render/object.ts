import type { Transform } from '../schema';
import { num } from '../core/svg';

export interface CompiledObject {
  readonly defs: string[];
  readonly markup: string;
}

export function objectTransform(t: Transform): string {
  return `translate(${num(t.x)} ${num(t.y)}) rotate(${num(t.rotationDeg)}) scale(${num(t.scale)})`;
}

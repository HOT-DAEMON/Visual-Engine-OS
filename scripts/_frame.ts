import { ARCHETYPES, BodyParams } from '../src/body';
import { bodyFrame } from '../src/body/frame';
import { bodyHost } from './lib/body-host';
const H = bodyHost(); const f = bodyFrame(BodyParams.parse((ARCHETYPES as any).veryMuscular), H.a);
const r = (o: any): any => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? +(v as number).toFixed(2) : v]));
console.log('h', f.h.toFixed(1), 'a', JSON.stringify(r(H.a as any)));
console.log('y', JSON.stringify(r(f.y)), '\nx', JSON.stringify(r(f.x)), '\narm', JSON.stringify(r(f.arm)), '\njoint', JSON.stringify(r(f.joint)));
console.log('pose', JSON.stringify(BodyParams.parse((ARCHETYPES as any).veryMuscular).pose));

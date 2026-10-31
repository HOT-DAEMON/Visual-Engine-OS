import { ARCHETYPES } from '../src/body';
import { bodyVolumes, renderVolumesPixel } from '../src/body/volume';
import { bodyHost } from './lib/body-host';
const H = bodyHost(), set = bodyVolumes(ARCHETYPES.veryMuscular as never, H.a, {});
for (const v of set.volumes) for (const s of v.stations) for (const q of [s.c.x, s.c.y, s.c.z, s.a, s.b, s.t.x, s.u.x, s.w.x]) if (!Number.isFinite(q)) { console.log('non fini', v.id); break; }
const m = renderVolumesPixel(set, { skin: H.skin, heightPx: 420 });
console.log(/NaN|Infinity/.test(m.svg), m.bounds);
const i = m.svg.search(/NaN|Infinity/); console.log(m.svg.slice(Math.max(0, i - 200), i + 100));

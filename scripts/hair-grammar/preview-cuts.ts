import { generate, type HairProfile } from '../../src/hair-grammar/grammar';
import { DOUBLE_BUNS, TOP_BUN } from '../../src/hair-grammar/profiles/buns';
import { PONYTAIL } from '../../src/hair-grammar/profiles/ponytail';
import { TWIN_BRAIDS } from '../../src/hair-grammar/profiles/braids';
import { appearance, head, scene } from './lib-cuts';
import { png, save, sheetSvg, type Panel } from './engine-kit';

/** Aperçu de développement : `npx tsx scripts/hair-grammar/preview-cuts.ts <sortie.png> <coupe> [lacets…]` — tête entière, rendu principal, mèches réparées. */
const REG: Record<string, HairProfile> = { double_buns: DOUBLE_BUNS, top_bun: TOP_BUN, ponytail: PONYTAIL, twin_braids: TWIN_BRAIDS };
const [out = 'preview.png', name = 'double_buns', ...yaws] = process.argv.slice(2);
const P0 = REG[name]; if (!P0) throw new Error(`coupe inconnue ${name}`);
// DROP=crown,sweepL : retire ces familles (diagnostic : isoler ce qui produit un défaut visible).
const drop = process.env.DROP?.split(',').filter(Boolean) ?? [];
const P: HairProfile = drop.length ? { ...P0, families: P0.families.filter((f) => !drop.includes(f.id)) } : P0;
const ys = (yaws.length ? yaws : ['0']).map(Number);
const panels: Panel[] = ys.flatMap((yaw) => [1, 2].map((seed): Panel => { const s = scene(P, yaw, seed, true); return { content: head(s.locks, s.v, appearance('#1c1a24', true), `${name}${yaw}${seed}`), label: `${name} · lacet ${yaw}° · graine ${seed} · ${generate(P, seed).length} mèches` }; }));
save(out, png(sheetSvg(panels, 2, name, 3)));

import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { landmarks, project } from '../../src/hair-grammar/head';
import type { HairProfile } from '../../src/hair-grammar/grammar';
import { BOB } from '../../src/hair-grammar/profiles/bob';
import { SHAG } from '../../src/hair-grammar/profiles/shag';
import { TOUSLED } from '../../src/hair-grammar/profiles/tousled';
import { H, appearance, head, scene } from './lib-cuts';
import { ROI, headContent } from './engine-kit';

/**
 * Rend, pour chaque (coupe, graine, lacet), DEUX images de la tête entière du moteur — visage seul et visage + cheveux — plus les ancres en pixels
 * (ligne des yeux, menton, axe). `measure-cuts.py` en déduit le masque des cheveux VISIBLES (différence des deux images) et lui applique
 * la MÊME fonction de mesure qu'aux références : l'écart référence / moteur est donc calculé par un seul estimateur.
 * Usage : `npx tsx scripts/hair-grammar/render-masks.ts <dossier> [coupe[:graine[:lacet]] ...]` (défaut : bob, shag, tousled, graine 1, lacet 0).
 */
const SCALE = 4;
const CANVAS_H = 235; // plus haut que la ROI du moteur (150, arrêtée au menton) : les mèches longues (hime) descendent sous le menton
const BLUE = '#2f6fb5'; // loin de la peau, des traits noirs et du blanc : la différence des deux rendus isole les cheveux
const PROFILES: Record<string, HairProfile> = { bob: BOB, shag: SHAG, tousled: TOUSLED };

/** Registre des coupes ajoutées par les passes suivantes (chargé à la demande, pour ne pas figer la liste ici). */
async function register(): Promise<void> {
  for (const [name, mod, key] of [['hime', '../../src/hair-grammar/profiles/hime', 'HIME'], ['pixie', '../../src/hair-grammar/profiles/pixie', 'PIXIE']] as const) {
    try { const m = (await import(mod)) as Record<string, HairProfile>; if (m[key]) PROFILES[name] = m[key]; } catch { /* coupe pas encore écrite */ }
  }
}

const svgOf = (inner: string): string => `<svg xmlns="http://www.w3.org/2000/svg" width="${ROI.w * SCALE}" height="${CANVAS_H * SCALE}" viewBox="0 0 ${ROI.w} ${CANVAS_H}"><rect width="${ROI.w}" height="${CANVAS_H}" fill="#fff"/>${inner}</svg>`;
const raster = (svg: string): Buffer => Buffer.from(new Resvg(svg).render().asPng());

export function renderPair(P: HairProfile, seed: number, yaw: number, dir: string, tag: string, hex = BLUE): Record<string, number | string> {
  const s = scene(P, yaw, seed, true);
  const face = headContent({ back: '', front: '', over: '' }, s.v);
  const full = head(s.locks, s.v, appearance(hex, true), `${tag}m`);
  writeFileSync(`${dir}/${tag}-face.png`, raster(svgOf(face)));
  writeFileSync(`${dir}/${tag}-full.png`, raster(svgOf(full)));
  const lm = landmarks(H);
  const eye = (project(s.v, lm.eyeR).y + project(s.v, lm.eyeL).y) / 2; const chin = project(s.v, lm.chin).y;
  return { tag, cut: P.name, seed, yaw, eyeY: eye * SCALE, chinY: chin * SCALE, cx: s.v.tx * SCALE, scale: SCALE };
}

async function main(): Promise<void> {
  await register();
  const [dir = 'masks', ...specs] = process.argv.slice(2);
  mkdirSync(dir, { recursive: true });
  const todo = (specs.length ? specs : ['bob', 'shag', 'tousled']).map((q) => { const [n = '', sd = '1', yw = '0'] = q.split(':'); return { n, seed: Number(sd), yaw: Number(yw) }; });
  // FAM=crownL,massR : ne garde que ces familles (diagnostic : isoler ce qui produit un défaut visible).
  const only = process.env.FAM?.split(',').filter(Boolean);
  const anchors = todo.map(({ n, seed, yaw }) => { const P0 = PROFILES[n]; if (!P0) throw new Error(`coupe inconnue : ${n}`); const P = only ? { ...P0, families: P0.families.filter((f) => only.includes(f.id)) } : P0; return renderPair(P, seed, yaw, dir, `${n}${only ? '-' + only.join('_') : ''}-s${seed}-y${yaw}`); });
  writeFileSync(`${dir}/anchors.json`, JSON.stringify(anchors, null, 1));
  console.log(`${anchors.length} paires rendues dans ${dir}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

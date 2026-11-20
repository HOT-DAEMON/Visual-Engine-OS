import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { faceLandmarks } from '../../src/face';
import { earViewSvg } from '../../src/render/face/ear/sheet';
import type { ViewName } from '../../src/face/ear/project';
import { FaceParams } from '../../src/schema';
import { setPath } from './lib';
import { PARAMS } from './params';

/**
 * Audit de visibilité DANS LES VUES de l'oreille (face, trois-quarts, profil, gros plan éclairé) : un paramètre à la fois, bas → haut, sur le même modèle.
 * Complète `visibility.ts` (tête entière) : un axe physiquement invisible de face (tangage) ou trop petit pour la tête entière (antitragus) doit se lire ici.
 *   npx tsx scripts/ear-audit/views.ts [all] [a-b]  → artefacts/oreille-audit-visibilite/views(-a-b).json
 * Mesure : pixels (cadre 300 × 420, l'oreille occupe ≈ 78 % de la hauteur) dont la somme RGB change de plus de 24 ; moyenne de 3 graines d'oreille.
 */
const VIEWS: ViewName[] = ['face', 'three-quarter', 'profile', 'close-up'];
const SEEDS = [11, 77, 1203];
const range = process.argv[3]?.split('-').map(Number) as [number, number] | undefined;
const W = 300, H = 420;
const ensure = (o: Record<string, unknown>, path: string): void => { const k = path.split('.'); let c = o; for (let i = 0; i < k.length - 1; i++) c = (c[k[i]!] ??= {}) as Record<string, unknown>; };
const rows: Record<string, unknown>[] = [];
for (const [i, [path, lo, hi, extra]] of PARAMS.entries()) {
  if (range && !(i >= range[0] && i < range[1])) continue;
  const mk = (v: unknown): Record<string, unknown> => { const e: Record<string, unknown> = {}; for (const [k, x] of Object.entries({ ...(extra ?? {}), [path]: v })) { const root: Record<string, unknown> = e; ensure(root, k); setPath(root, k, x); } return e; };
  const per: Record<string, number> = {};
  for (const view of VIEWS) {
    let tot = 0;
    for (const sd of SEEDS) {
      // `ensure` crée les sous-objets dans `ears` ; le résultat d'édition est ensuite fusionné dans `ears`.
      const a = shot2(sd, view, mk(lo)), b = shot2(sd, view, mk(hi));
      let n = 0;
      for (let q = 0; q < a.length; q += 4) if (Math.abs(a[q]! - b[q]!) + Math.abs(a[q + 1]! - b[q + 1]!) + Math.abs(a[q + 2]! - b[q + 2]!) > 24) n++;
      tot += n;
    }
    per[view] = Math.round(tot / SEEDS.length);
  }
  const label = ['family', 'material.kind', 'style.look'].includes(path) ? `${path}(${String(lo)}→${String(hi)})` : path;
  rows.push({ param: label, ...per });
  console.log(label.padEnd(40), VIEWS.map((v) => String(per[v]).padStart(6)).join(' '));
}
function shot2(seed: number, view: ViewName, edit: Record<string, unknown>): Uint8Array {
  const p = FaceParams.parse({ anatomyEngine: 'structured', ears: { engine: 'morphology', seed, ...edit } });
  const svg = earViewSvg(p, faceLandmarks(p, 300, 400), { view, width: W, height: H, skin: '#b98a62' });
  return new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().pixels;
}
mkdirSync('artefacts/oreille-audit-visibilite', { recursive: true });
writeFileSync(`artefacts/oreille-audit-visibilite/views${range ? `-${range[0]}-${range[1]}` : ''}.json`, JSON.stringify({ seeds: SEEDS, views: VIEWS, rows }, null, 1));

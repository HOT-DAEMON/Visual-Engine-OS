import { readFileSync, writeFileSync } from 'node:fs';
import { faceLandmarks, noseGeometry, widthProfile25 } from '../src/face';
import { FaceParams } from '../src/schema';

/**
 * Silhouettes de face des archétypes v2 (`fit-06-v2.json`) et v3 (`fit-06.json`) normalisées dans la boîte de chaque forme de `references/nez/06.png`.
 * Sortie : artefacts/nez-planche06-v3/silhouettes.json, puis `python3 scripts/nose-refs/compose-06-overlay.py artefacts/nez-planche06-v3 v2 v3 artefacts/nez-planche06-v3/01-superposition-v2-v3.png`
 *   npx tsx scripts/artefacts-nose-plate06.ts
 */
const v2 = JSON.parse(readFileSync('references/nez/fit-06-v2.json', 'utf8')), v3 = JSON.parse(readFileSync('references/nez/fit-06.json', 'utf8'));
const shapes = JSON.parse(readFileSync('references/nez/measures-06.json', 'utf8')).shapes as { index: number; bboxPx: number[] }[];
const NAMES = ['pyramide', 'ellipse-large', 'cloche-ailes', 'plat-trapeze', 'losange-petit'];
const sil = (flat: Record<string, number>) => {
  const patch: Record<string, any> = { anatomyEngine: 'structured' };
  for (const [path, v] of Object.entries(flat)) { const ks = path.split('.'); let c = patch; for (const k of ks.slice(0, -1)) c = (c[k] ??= {}); c[ks[ks.length - 1]!] = v; }
  const p = FaceParams.parse(patch), g = noseGeometry(p, faceLandmarks(p, 300, 380)), m = widthProfile25(g.silhouette);
  const xs = g.silhouette.map((q) => q.x), ys = g.silhouette.map((q) => q.y), x0 = Math.min(...xs), y0 = Math.min(...ys);
  return { aspect: m.aspect, pts: g.silhouette.map((q) => [(q.x - x0) / m.width, (q.y - y0) / m.height]) };
};
const out = shapes.map((s) => { const n = NAMES[s.index]!; return { name: n, bbox: s.bboxPx, v2: sil(v2[n].params), v3: sil(v3[n].params), v2Residual: v2[n].residual, v3Residual: v3[n].residual }; });
writeFileSync('artefacts/nez-planche06-v3/silhouettes.json', JSON.stringify(out));
console.log(out.map((o) => `${o.name} v2 ${o.v2Residual} → v3 ${o.v3Residual}`).join('\n'));

/**
 * Planches comparatives de la régression visuelle → artefacts/regression/ :
 *  01 cas difficiles (références permanentes) ; 02 tirages standard ; 03 contrôle négatif : référence | rendu perturbé | carte de chaleur
 *  (prouve que la comparaison VOIT une dérive de 0,04 de la largeur de mâchoire, qu'un test d'invariants seul ne signalerait pas).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { HARD_CASES, STANDARD_CASES, type VisualCase } from '../src/regression/cases';
import { decodePng } from '../src/regression/png';
import { diffStats, heatmap } from '../src/regression/diff';
import { board } from './lib/board';
import { REF_DIR, REF_H, REF_W, renderCase } from './lib/regress';
import { rasterPng, rasterPixels } from './lib/raster';

const OUT = 'artefacts/regression';
mkdirSync(OUT, { recursive: true });
const ref = (c: VisualCase): Buffer => readFileSync(`${REF_DIR}/${c.id}.png`);
const sheet = (name: string, title: string, cs: readonly VisualCase[], cols: number): void => {
  writeFileSync(`${OUT}/${name}.png`, board(title, cs.map((c) => ({ png: ref(c), label: c.id.replace(/^hard-/, '').slice(0, 22) })), cols, REF_W, REF_H));
};
sheet('01-cas-difficiles', 'Cas difficiles : références permanentes (18)', HARD_CASES, 4);
sheet('02-tirages-standard', 'Tirages standard à graine fixe (16)', STANDARD_CASES, 4);

// Contrôle négatif : mêmes graine et cadrage, jawWidth ±0,04 (dérive subtile, vers l'intérieur si la borne est atteinte). Référence | perturbé | chaleur.
const cases = [HARD_CASES[0]!, STANDARD_CASES[0]!, STANDARD_CASES[4]!];
const cells: { png: Buffer; label: string }[] = [];
const report: Record<string, unknown>[] = [];
for (const c of cases) {
  const refR = decodePng(ref(c));
  const base = (c.patch?.jawWidth as number | undefined) ?? 0.8;
  const pert = { ...c, patch: { ...(c.patch ?? { anatomyEngine: 'structured' }), jawWidth: base + 0.04 > 0.98 ? base - 0.04 : base + 0.04 } };
  const { svg } = renderCase(pert);
  const px = rasterPixels(svg);
  const cur = { width: px.width, height: px.height, data: px.pixels };
  const st = diffStats(refR, cur);
  const hm = heatmap(refR, cur);
  // Les rasters bruts → PNG : on repasse par un SVG <image> n'est pas nécessaire, resvg a déjà le PNG du rendu perturbé.
  cells.push({ png: ref(c), label: `${c.id} · référence` }, { png: rasterPng(svg), label: `perturbé (jawWidth ±0,04) rms=${st.rms.toFixed(2)}` });
  const heatPng = rasterPng(`<svg xmlns="http://www.w3.org/2000/svg" width="${hm.width}" height="${hm.height}">${[...Array(0)].join('')}<image href="data:image/png;base64,${rasterPng(svg).toString('base64')}" width="1" height="1" opacity="0"/>${hmRects(hm)}</svg>`);
  cells.push({ png: heatPng, label: `chaleur · >8/255 : ${(st.fracOver8 * 100).toFixed(1)} %` });
  report.push({ id: c.id, ...st, detected: st.rms > 1.5 || st.fracOver8 > 0.002 });
}
writeFileSync(`${OUT}/03-controle-negatif.png`, board('Contrôle négatif : la comparaison détecte une dérive de 0,04 de la largeur de mâchoire', cells, 3, REF_W, REF_H));
writeFileSync(`${OUT}/controle-negatif.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1));

/** Carte de chaleur → rectangles SVG par ligne (agrège les pixels consécutifs identiques : fichier léger). */
function hmRects(h: { width: number; height: number; data: Uint8Array }): string {
  const out: string[] = [];
  for (let y = 0; y < h.height; y++) {
    let x = 0;
    while (x < h.width) {
      const i = (y * h.width + x) * 4; const c = `rgb(${h.data[i]},${h.data[i + 1]},${h.data[i + 2]})`;
      let x2 = x + 1;
      while (x2 < h.width && `rgb(${h.data[(y * h.width + x2) * 4]},${h.data[(y * h.width + x2) * 4 + 1]},${h.data[(y * h.width + x2) * 4 + 2]})` === c) x2++;
      out.push(`<rect x="${x}" y="${y}" width="${x2 - x}" height="1" fill="${c}"/>`);
      x = x2;
    }
  }
  return out.join('');
}

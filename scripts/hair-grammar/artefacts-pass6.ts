import { Resvg } from '@resvg/resvg-js';
import { compileScene, generateRandomFace } from '../../src';
import { generate } from '../../src/hair-grammar/grammar';
import { DEFAULT_HEAD } from '../../src/hair-grammar/head';
import { generateIntended } from '../../src/hair-grammar/intent-run';
import type { LockSpec } from '../../src/hair-grammar/lock';
import { paintLock } from '../../src/hair-grammar/paint';
import { INK_PRO, paintHairPro, paintLockPro, type ProLock, type ProStyle } from '../../src/hair-grammar/paint-pro';
import { TOUSLED } from '../../src/hair-grammar/profiles/tousled';
import { headEllipse, referenceFromPainted } from '../../src/hair-grammar/reference-fit';
import { fitFromReferencePart } from '../../src/hair-grammar/reference-fit-part';
import { paintHairResolved } from '../../src/hair-grammar/occlusion-paint';
import { ringBands } from '../../src/hair-grammar/spec-ring';
import { norm, v3 } from '../../src/hair-grammar/vec';
import { verifyRing } from '../../src/hair-grammar/verify-ring';
import { ROI, headContent, png, save, sheetSvg, viewAt, type Panel } from './engine-kit';

/**
 * Artefacts de la PASSE 6 du moteur de cheveux (docs/HAIR-PASS6.md) : preuves visuelles, TÊTE ENTIÈRE puis détails.
 * `npx tsx scripts/hair-grammar/artefacts-pass6.ts` régénère tout dans artefacts/hair-engine-pass6/ (déterministe) : planches + metrics.json.
 *  01 reflet transversal : désactivé | remplace | s'ajoute, sous trois lumières, tête entière, avec les rapports de vérification ;
 *  02 reflet transversal : détails (crâne, ×2,6) désactivé | remplace ;
 *  03 intensité de la lumière dans le rendu principal : ombre portée sur la peau et brillance des cheveux à 1 / 0,5 / 0,15 ;
 *  04 raie lue sur une référence : référence | ajustement avec lecture de la raie | ajustement historique (sans lecture).
 */
const OUT = 'artefacts/hair-engine-pass6'; const H = DEFAULT_HEAD; const f2 = (x: number): string => x.toFixed(2);
const board = (name: string, panels: Panel[], cols: number, title: string): void => save(`${OUT}/${name}.png`, png(sheetSvg(panels, cols, title, 3)));
const metrics: Record<string, unknown> = {};
const LIGHTS: readonly { name: string; dir: ReturnType<typeof norm> }[] = [
  { name: 'haut-gauche (référence)', dir: norm(v3(-0.45, -0.65, 0.6)) }, { name: 'haut-droite', dir: norm(v3(0.6, -0.6, 0.5)) }, { name: 'zénith', dir: norm(v3(0, -0.9, 0.4)) },
];
const styleOf = (ring: ProStyle['ring']): ProStyle => ({ ...INK_PRO, ...(ring ? { ring } : {}) });
/** Fait ressortir la tête : la peinture « pro » est passée par `paintHairPro` (occlusion locale comprise). */
const hair = (specs: readonly LockSpec[], v: ReturnType<typeof viewAt>, ring: ProStyle['ring'], light: { dir: ReturnType<typeof norm> }): string => headContent(paintHairPro(H, specs, v, styleOf(ring), light), v, { head: H });
const zoom = (content: string, x: number, y: number, w: number): string => `<svg x="0" y="0" width="${ROI.w}" height="${ROI.h}" viewBox="${x} ${y} ${w} ${(w * ROI.h) / ROI.w}" overflow="hidden">${content}</svg>`;

// 01 · TOUTE LA TÊTE — trois lumières × (sans reflet transversal | remplace | s'ajoute), lacet 0 ; rapports de vérification dans la légende.
{
  const v = viewAt(0); const specs = generate(TOUSLED, 2); const panels: Panel[] = []; const rows: Record<string, unknown>[] = [];
  for (const light of LIGHTS) {
    for (const ring of ['off', 'replace', 'add'] as const) {
      const painted = specs.map((s) => paintLockPro(H, s, v, styleOf(ring), light)); const rep = ring === 'off' ? null : verifyRing(H, v, painted, light);
      const rings = painted.filter((p) => ringBands(p.blade, p.geom, p.spec, v, light)).length; const fails = rep ? rep.flatMap((r) => r.checks.filter((c) => !c.ok).map((c) => c.name)) : [];
      rows.push({ light: light.name, ring, rings, locks: specs.length, verified: rep ? rep.every((r) => r.ok) : null, failing: fails });
      panels.push({ content: hair(specs, v, ring, light), label: `${light.name} · ${ring}${rep ? ` · ${rings}/${specs.length} reflets · ${rep.every((r) => r.ok) ? 'vérifié G·A·S' : `ÉCHEC ${fails.length}`}` : ''}` });
    }
  }
  metrics.fullHeadRing = rows; board('01-toute-la-tete-reflet-transversal', panels, 3, 'Reflet transversal : sans | remplace | s\'ajoute — trois lumières (le reflet suit N·H, l\'ombre aval est côté opposé à la lumière)');
}

// 02 · DÉTAILS — crâne ×2,6, mêmes lumières, sans | remplace.
{
  const v = viewAt(0); const specs = generate(TOUSLED, 2); const panels: Panel[] = [];
  for (const light of LIGHTS) for (const ring of ['off', 'replace'] as const) panels.push({ content: zoom(hair(specs, v, ring, light), 62, 20, 56), label: `${light.name} · ${ring} (×2,8)` });
  board('02-details-reflet-transversal', panels, 2, 'Détail (×2,8) : bande transverse dentelée + ombre aval, contre le reflet longitudinal');
}

// 03 · LUMIÈRE DANS LE RENDU PRINCIPAL — intensité 1 / 0,5 / 0,15 : ombre portée sur la peau et brillance suivent l'intensité. Rangée du haut : TÊTE ENTIÈRE ; rangée du bas : détail du front (ombre des mèches, brillance).
{
  const panels: Panel[] = []; const rows: Record<string, unknown>[] = []; const whole: Panel[] = []; const detail: Panel[] = [];
  for (const intensity of [1, 0.5, 0.15]) {
    const F = generateRandomFace(321, { id: 'f', hairEngine: 'classic', hair: { style: 'short', texture: 'straight', color: '#23232b', seed: 5, volume: 0.5, density: 0.85, part: 0.2, sim: { enabled: true, archetype: 'side_sweep', skinShadow: 0.9 } }, transform: { x: 200, y: 215, scale: 1.05 } } as never);
    const r = compileScene({ width: 400, height: 420, background: '#f4efe9', light: { azimuthDeg: 330, elevationDeg: 55, intensity }, objects: F.objects } as never); if (!r.ok) throw new Error(r.issues.join(';'));
    const img = new Resvg(r.svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng(); rows.push({ intensity });
    const href = `data:image/png;base64,${Buffer.from(img).toString('base64')}`; const lab = `intensité ${intensity}${intensity === 1 ? ' (référence)' : ''}`;
    whole.push({ content: `<rect width="${ROI.w}" height="${ROI.h}" fill="#f4efe9"/><svg x="0" y="0" width="${ROI.w}" height="${ROI.h}" viewBox="0 0 1200 1260" overflow="hidden"><image href="${href}" width="1200" height="1260"/></svg>`, label: `${lab} · tête entière` });
    detail.push({ content: `<svg x="0" y="0" width="${ROI.w}" height="${ROI.h}" viewBox="250 160 700 673" overflow="hidden"><image href="${href}" width="1200" height="1260"/></svg>`, label: `${lab} · détail front` });
  }
  panels.push(...whole, ...detail);
  metrics.lightIntensity = rows; board('03-intensite-lumiere-ombre-et-brillance', panels, 3, 'Intensité de la lumière : ombre des mèches sur la peau et brillance des cheveux faiblissent ensemble (avant : inchangées)');
}

// 04 · RAIE LUE SUR UNE RÉFÉRENCE — référence (raie +0,3) | ajustement avec lecture | ajustement historique (sans lecture de la raie).
{
  const v = viewAt(0); const W = ROI.w; const Hh = ROI.h; const panels: Panel[] = []; const rows: Record<string, unknown>[] = [];
  const draw = (specs: readonly LockSpec[]): string => headContent(paintHairResolved(H, specs, v), v, { head: H });
  for (const [part, seed] of [[0.3, 2], [-0.3, 3]] as const) {
    const ref = generateIntended(TOUSLED, { part }, v, seed, false); const R = referenceFromPainted(ref.specs.map((L) => paintLock(H, L, v)), W, Hh, headEllipse(TOUSLED, v));
    const a = fitFromReferencePart(TOUSLED, R, v, { seed, iters: 2 }); const b = fitFromReferencePart(TOUSLED, R, v, { seed, iters: 2, part: false });
    rows.push({ referencePart: part, readPart: a.intent.part ?? null, grooveObserved: a.partRead.observed.groove, clarityObserved: a.partRead.observed.clarity, clarityFinalWithRead: a.partRead.final.clarity, grooveFinalWithRead: a.partRead.final.groove });
    panels.push({ content: draw(ref.specs), label: `référence · raie ${part}` }, { content: draw(a.specs), label: `ajusté AVEC lecture · raie ${f2(a.intent.part ?? 0)} · sillon ${a.partRead.final.groove ? 'net' : 'absent'}` }, { content: draw(b.specs), label: 'ajusté SANS lecture (historique)' });
  }
  metrics.partFromReference = rows; board('04-raie-lue-sur-reference', panels, 3, 'Raie lue sur la référence : le sillon observé devient une intention, appliquée à chaque tour d\'ajustement');
}

// 05 · Rapport de vérification du reflet (JSON) : 3 lumières × 3 graines × 2 lacets.
{
  const rows: Record<string, unknown>[] = [];
  for (const light of LIGHTS) for (const seed of [1, 2, 3]) for (const yaw of [0, 30]) {
    const v = viewAt(yaw); const painted: ProLock[] = generate(TOUSLED, seed).map((s) => paintLockPro(H, s, v, styleOf('replace'), light)); const rep = verifyRing(H, v, painted, light);
    rows.push({ light: light.name, seed, yaw, ok: rep.every((r) => r.ok), reports: rep.map((r) => ({ layer: r.layer, ok: r.ok, checks: r.checks.map((c) => ({ name: c.name, value: Number(c.value.toFixed(3)), min: c.min, max: c.max, ok: c.ok })) })) });
  }
  metrics.ringVerification = { cases: rows.length, passing: rows.filter((r) => r.ok).length, rows };
}
save(`${OUT}/metrics.json`, JSON.stringify(metrics, null, 2));
console.log('artefacts écrits dans', OUT);

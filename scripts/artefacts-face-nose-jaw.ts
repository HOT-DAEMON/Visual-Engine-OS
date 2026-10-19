import { mkdirSync, writeFileSync } from 'node:fs';
import { board, cell, type CellMeta, type CellSpec } from './lib/board';

/**
 * Preuves visuelles du moteur de nez et du moteur de menton / mâchoire : `artefacts/face-anatomy/`.
 * Même visage de base (seed 321, yeux d'identité 3, chauve, expression neutre) : seule la propriété testée change.
 * Les images 04 et 05 portent une surcouche calculée sur la VRAIE géométrie (pas un dessin à la main).
 * Usage : `npx tsx scripts/artefacts-face-nose-jaw.ts [groupe…]` (groupes : nose tip alae anat jaw angle open).
 */
const DIR = 'artefacts/face-anatomy';
mkdirSync(DIR, { recursive: true });
const want = new Set(process.argv.slice(2));
const on = (g: string): boolean => want.size === 0 || want.has(g);
const W = 320;
const H = 320;

function make(group: string, file: string, title: string, specs: CellSpec[], cols: number, w = W, h = H): void {
  if (!on(group)) return;
  const cells = specs.map((s) => ({ ...cell(s, w, h), label: s.label }));
  writeFileSync(`${DIR}/${file}`, board(title, cells, cols, w, h));
  console.log(`${DIR}/${file}`);
}
/** Profil de côté du nez (courbe exacte de la géométrie) dans un encart en bas à droite de la cellule : le dorsum se lit ici, pas de face. */
const profileInset = (m: CellMeta): string => {
  const pts = m.nose.profile;
  const ys = pts.map((q) => q.y);
  const xs = pts.map((q) => q.x);
  const y0 = Math.min(...ys);
  const k = 80 / (Math.max(...ys) - y0);
  const ox = m.w - 40 - Math.max(...xs) * k;
  const d = `M${pts.map((q) => `${(ox + q.x * k).toFixed(1)} ${(m.h - 92 + (q.y - y0) * k).toFixed(1)}`).join('L')}`;
  return `<rect x="${m.w - 92}" y="${m.h - 108}" width="88" height="102" rx="6" fill="#1b1f2e" fill-opacity="0.82"/><path d="${d}" fill="none" stroke="#ffe14a" stroke-width="2.2"/><text x="${m.w - 86}" y="${m.h - 94}" fill="#fff" font-size="11" font-family="DejaVu Sans">profil</text>`;
};
const nose = (label: string, n: Record<string, unknown>, extra: Partial<CellSpec> = {}): CellSpec => ({ label, focus: 'nose', patch: { nose: n }, overlay: profileInset, ...extra });

make('nose', '01-nez-dorsum-droit-concave-convexe-asymetrique.png', 'Dorsum : droit, concave, convexe, asymétrique (profil + déviation vue de face)', [
  nose('droit', { dorsum: { shape: 'straight' } }),
  nose('concave (courbure 0,9)', { dorsum: { shape: 'concave', curvature: 0.9 } }),
  nose('convexe (courbure 0,9)', { dorsum: { shape: 'convex', curvature: 0.9 } }),
  nose('asymétrique (déviation 0,9)', { dorsum: { shape: 'asymmetric', deviation: 0.9 } }),
], 4, 300, 300);

make('tip', '02-nez-pointe-largeur-rondeur-orientation-projection.png', 'Pointe : largeur, rondeur, orientation, projection (reflet doux)', [
  nose('étroite (0,1)', { tip: { width: 0.1 } }), nose('large (0,95)', { tip: { width: 0.95 } }),
  nose('pointue (rondeur 0)', { tip: { roundness: 0 } }), nose('bulbeuse (rondeur 1)', { tip: { roundness: 1 } }),
  nose('abaissée (rotation -1)', { tip: { rotation: -1 } }), nose('relevée (rotation +1)', { tip: { rotation: 1 } }),
  nose('projection faible', { tip: { projection: 0.05 } }), nose('projection forte', { tip: { projection: 0.95 } }),
], 4, 300, 300);

make('alae', '03-nez-ailes-et-narines.png', 'Ailes (épaisseur, écartement, raccord) et narines (forme, orientation, asymétrie)', [
  nose('ailes fines', { alae: { thickness: 0, volume: 0.3 } }), nose('ailes charnues', { alae: { thickness: 1, volume: 0.9 } }),
  nose('raccord joue net', { alae: { attachment: 0 }, junction: { cheek: 0 } }), nose('raccord joue fondu', { alae: { attachment: 1 }, junction: { cheek: 1 } }),
  nose('narines rondes, droites', { nostrils: { shape: 0, tiltDeg: 0 }, tip: { rotation: 0.6 } }), nose('narines en fente, inclinées 40°', { nostrils: { shape: 1, tiltDeg: 40 }, tip: { rotation: 0.6 } }),
  nose('narines asymétriques', { nostrils: { asymmetry: 0.9 }, tip: { rotation: 0.6 } }), nose('pointe abaissée : narines cachées', { tip: { rotation: -1 } }),
], 4, 300, 300);

/** Surcouche : tous les sous-composants du nez, tracés depuis la géométrie. */
const decompose = (m: CellMeta): string => {
  const P = (pts: readonly { x: number; y: number }[]): string => `M${pts.map((q) => m.px(q.x, q.y).map((v) => v.toFixed(1)).join(' ')).join('L')}`;
  const g = m.nose;
  const line = (d: string, c: string, dash = ''): string => `<path d="${d}" fill="none" stroke="${c}" stroke-width="1.6" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
  const [rx, ry] = m.px(0, g.root.y);
  return [
    line(`${P(g.silhouette)}Z`, '#ffffff', '4 3'),
    line(P(g.dorsum.axis), '#ffe14a'),
    line(`M${rx - g.root.half * m.s} ${ry}L${rx + g.root.half * m.s} ${ry}`, '#ff7ad9'),
    line(`${P(g.tip.poly)}Z`, '#5cf2ff'),
    line(`${P(g.alae.left.poly)}Z`, '#7dff9a'), line(`${P(g.alae.right.poly)}Z`, '#7dff9a'),
    line(`${P(g.nostrils.left.poly)}Z`, '#ff8a4a'), line(`${P(g.nostrils.right.poly)}Z`, '#ff8a4a'),
    line(P(g.junctions.nasolabial.left), '#b78cff', '3 3'), line(P(g.junctions.nasolabial.right), '#b78cff', '3 3'),
    line(P(g.junctions.orbital.left), '#ff6a6a', '3 3'), line(P(g.junctions.orbital.right), '#ff6a6a', '3 3'),
    `<text x="10" y="22" fill="#fff" font-size="13" font-family="DejaVu Sans">blanc: pyramide · jaune: dorsum · rose: racine · cyan: pointe</text>`,
    `<text x="10" y="40" fill="#fff" font-size="13" font-family="DejaVu Sans">vert: ailes · orange: narines · violet: nasolabial · rouge: orbite</text>`,
  ].join('');
};
/** Profil de côté : la courbe exacte produite par la géométrie, pour les quatre dorsums (diagnostic). */
make('anat', '04-nez-decomposition-anatomique.png', 'Décomposition anatomique du nez : tous les sous-composants (géométrie réelle)', [
  { label: 'racine · dorsum · pointe · ailes · narines · raccords', focus: 'nose', overlay: decompose, patch: { nose: { tip: { rotation: 0.5 } } } },
  { label: 'même nez, dorsum convexe + pointe projetée', focus: 'nose', overlay: decompose, patch: { nose: { dorsum: { shape: 'convex' }, tip: { projection: 0.9, rotation: 0.5 } } } },
], 2, 520, 520);

const chinMetrics = (): ((m: CellMeta) => string) => (m) => `<rect x="0" y="0" width="${m.w}" height="26" fill="#1b1f2e" fill-opacity="0.8"/><text x="6" y="17" fill="#ffe14a" font-size="12" font-family="DejaVu Sans">H menton ${m.lm.chin.heightPx.toFixed(1)} · bas ${m.lm.chinY.toFixed(1)} · ½L ${m.lm.outline.chinHalf.toFixed(1)} · proj ${m.lm.chin.projectionPx.toFixed(1)}</text>`;
/** Base commune des gros plans du bas du visage : bouche remontée (mouth.y 0,72) pour laisser la place à toute la plage de hauteurs du menton. */
const lower = (label: string, p: Record<string, unknown>): CellSpec => ({ label, focus: 'lower', patch: { ...p, mouth: { y: 0.72, ...((p.mouth as object) ?? {}) } }, overlay: chinMetrics() });
make('jaw', '05-menton-hauteur-projection-largeur-independantes.png', 'Menton : hauteur, projection, largeur — contrôlées INDÉPENDAMMENT (mesures sur chaque cellule)', [
  lower('hauteur 0,085', { chin: { height: 0.085 } }), lower('hauteur 0,115', { chin: { height: 0.115 } }), lower('hauteur 0,14', { chin: { height: 0.14 } }),
  lower('projection 0,05', { chin: { projection: 0.05 } }), lower('projection 0,5', { chin: { projection: 0.5 } }), lower('projection 0,95', { chin: { projection: 0.95 } }),
  lower('largeur 0,12', { chinWidth: 0.12 }), lower('largeur 0,26', { chinWidth: 0.26 }), lower('largeur 0,4', { chinWidth: 0.4 }),
], 3, 380, 330);

make('angle', '06-machoire-angle-et-symphyse.png', 'Angle mandibulaire (anguleux → obtus) et forme de la symphyse (ronde, carrée, pointue, fendue)', [
  lower('angle 0 (95°)', { jaw: { angle: 0 } }), lower('angle 0,5 (117°)', { jaw: { angle: 0.5 } }), lower('angle 1 (140°)', { jaw: { angle: 1 } }),
  lower('symphyse ronde', { chin: { symphysis: 'round' } }), lower('symphyse carrée', { chin: { symphysis: 'square' } }),
  lower('symphyse pointue', { chin: { symphysis: 'pointed' } }), lower('symphyse fendue (fossette)', { chin: { symphysis: 'cleft', cleft: 0.9 } }),
  lower('transition cou douce (1) + double menton', { jaw: { neckTransition: 1, submental: 0.8 } }),
], 4, 340, 330);

const open = (label: string, o: number, mob: number, tis: number): CellSpec => ({ label, focus: 'lower', patch: { mouth: { y: 0.72, open: o }, jaw: { mobility: mob, tissue: tis } }, overlay: (m) => `<rect x="0" y="0" width="${m.w}" height="26" fill="#1b1f2e" fill-opacity="0.8"/><text x="6" y="17" fill="#ffe14a" font-size="12" font-family="DejaVu Sans">chute ${m.lm.jaw.drop.toFixed(1)} · sillon ${m.lm.chin.sulcusY.toFixed(1)} · lèvre ${m.lm.lips.lowerH.toFixed(1)} · joue +${m.lm.jaw.tissue.cheekLift.toFixed(1)}</text>` });
make('open', '07-machoire-mobilite-et-deformation-des-tissus.png', 'Mobilité de la mâchoire et déformation des tissus à l\'ouverture de la bouche', [
  open('fermée', 0, 1, 1), open('ouverture 0,35', 0.35, 1, 1), open('ouverture 0,7', 0.7, 1, 1), open('ouverture 1', 1, 1, 1),
  open('ouverture 1, mobilité 0 (rigide)', 1, 0, 1), open('ouverture 1, tissus 0 (sans déformation)', 1, 1, 0),
], 3, 380, 330);

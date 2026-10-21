import { mkdirSync, writeFileSync } from 'node:fs';
import { board, cell, cellSvg, rasterize, type CellMeta, type CellSpec } from './lib/board';
import { blob, dot, inkWrapScene, line, note, poly, tag } from './lib/overlays-structure';
import { structureGeometry } from '../src/face/structure';
import { mouthGeometry } from '../src/face/mouth';

/**
 * Artefacts de preuve du moteur de structure (T15) : `npx tsx scripts/artefacts-face-structure.ts [planche …]`.
 * Chaque planche est une image PNG dans `artefacts/face-structure/`, produite par un rendu réel (jamais retouchée). Les surcouches colorées dessinent
 * les régions EXPOSÉES par la géométrie. Sans argument, toutes les planches sont rendues.
 */
const OUT = 'artefacts/face-structure';
mkdirSync(OUT, { recursive: true });
const S = { anatomyEngine: 'structured' } as const;
const SEED = 321;
type Cell = CellSpec & { label: string };
const save = (name: string, title: string, specs: Cell[], cols: number, w: number, h: number): void => {
  const t = Date.now();
  const cells = specs.map((s) => ({ ...cell({ seed: SEED, ...s, patch: { ...S, ...(s.patch ?? {}) } }, w, h), label: s.label }));
  writeFileSync(`${OUT}/${name}.png`, board(title, cells, cols, w, h));
  console.log(`${name}.png  ${((Date.now() - t) / 1000).toFixed(0)} s`);
};
const g = (m: CellMeta) => ({ st: structureGeometry(m.params, m.lm, m.nose), mo: mouthGeometry(m.params, m.lm) });

const BOARDS: Record<string, () => void> = {
  '01-nez-regions': () => {
    const regions = (m: CellMeta): string => {
      const R = m.nose.regions;
      const sw = [R.sidewalls.left, R.sidewalls.right].map((w) => poly(m, w.poly, '#4fc3f7', 0.22) + line(m, w.gutter, '#0288d1', 1.6)).join('');
      const domes = [R.domes.left, R.domes.right].map((d) => poly(m, d.poly, '#ffd54f', 0.35)).join('');
      const gr = [R.grooves.left, R.grooves.right].map((x) => line(m, x.line, '#ff7043', 2.4) + line(m, x.cheekBlend, '#ff7043', 1.4, '4 3')).join('');
      const nos = [R.nostrils.left, R.nostrils.right].map((n) => poly(m, n.outer, '#ab47bc', 0.25) + poly(m, n.aperture, '#e1bee7', 0.5)).join('');
      const base = poly(m, R.base.poly, '#66bb6a', 0.3) + poly(m, R.columella.poly, '#26a69a', 0.4);
      const ph = poly(m, R.philtrum.poly, '#ec407a', 0.18) + line(m, R.philtrum.columns.left, '#ec407a', 1.6) + line(m, R.philtrum.columns.right, '#ec407a', 1.6);
      const t = [tag(m, { x: 0, y: m.nose.root.y }, 20, 40, 'racine', '#fff176'), tag(m, R.sidewalls.right.gutter[2] ?? { x: 0, y: 0 }, 330, 90, 'paroi latérale + gouttière', '#4fc3f7'), tag(m, R.domes.right.c, 330, 150, 'dôme alaire', '#ffd54f'), tag(m, R.grooves.right.line[R.grooves.right.line.length - 1] ?? { x: 0, y: 0 }, 330, 280, 'sillon alaire', '#ff7043'), tag(m, R.nostrils.left.aperture[0] ?? { x: 0, y: 0 }, 20, 300, 'narine : rebord + ouverture', '#ce93d8'), tag(m, { x: 0, y: R.base.y + R.base.depthPx / 2 }, 20, 340, 'base du nez', '#a5d6a7'), tag(m, { x: 0, y: R.columella.topY * 0.5 + R.columella.bottomY * 0.5 }, 330, 330, 'columelle', '#80cbc4'), tag(m, { x: 0, y: m.lm.lips.topY - R.philtrum.lengthPx / 2 }, 330, 400, 'philtrum → lèvre', '#f48fb1')].join('');
      return sw + domes + gr + nos + base + ph + t;
    };
    save('01-nez-regions', 'Nez : volume continu à régions distinctes (T1)', [{ label: 'rendu', focus: 'nose' }, { label: 'régions exposées par la géométrie', focus: 'nose', overlay: regions }, { label: 'ancien nez (classic)', focus: 'nose', patch: { anatomyEngine: 'classic' } }], 3, 460, 560);
  },
  '02-nez-sept-axes': () => {
    const V: [string, object, object][] = [['longueur', { nose: { length: 0.11 } }, { nose: { length: 0.2 } }], ['largeur', { nose: { width: 0.11 } }, { nose: { width: 0.22 } }], ['projection', { nose: { tip: { projection: 0.05 } } }, { nose: { tip: { projection: 0.95 } } }], ['hauteur de racine', { nose: { root: { height: 0.05 } } }, { nose: { root: { height: 0.95 } } }], ['forme de la pointe', { nose: { tip: { roundness: 0.05 } } }, { nose: { tip: { roundness: 0.95 } } }], ['ouverture des narines', { nose: { nostrils: { opening: 0.05 } } }, { nose: { nostrils: { opening: 0.95 } } }], ['largeur de la base', { nose: { base: { width: -0.9 } } }, { nose: { base: { width: 0.9 } } }]];
    save('02-nez-sept-axes', 'Nez : sept axes dissociés, chacun à son minimum puis son maximum (T2)', V.flatMap(([n, a, b]) => [{ label: `${n} — bas`, focus: 'nose' as const, patch: a as never }, { label: `${n} — haut`, focus: 'nose' as const, patch: b as never }]), 4, 340, 420);
  },
  '03-machoire-decomposee': () => {
    const sil = (m: CellMeta): string => {
      const { st } = g(m);
      const s = st.mandible.silhouette;
      const yG = m.lm.jaw.gonion.y;
      const bone = [{ x: -s.boneHalf, y: yG }, { x: s.boneHalf, y: yG }];
      const outer = [{ x: -s.outerHalf, y: yG + 6 }, { x: s.outerHalf, y: yG + 6 }];
      return line(m, bone, '#4fc3f7', 3) + line(m, outer, '#ffb74d', 3) + note(14, 28, `os ${(2 * s.boneHalf).toFixed(0)}  + muscle ${(2 * s.muscleHalf).toFixed(0)}  + graisse ${(2 * s.fatHalf).toFixed(0)}`) + note(14, 46, `silhouette ${(2 * s.outerHalf).toFixed(0)} px`, '#ffb74d');
    };
    const base = { jawWidth: 0.78 };
    save('03-machoire-decomposee', 'Largeur de mâchoire décomposée : os · muscle · graisse · silhouette (T6)', [
      { label: 'os seul', focus: 'lower', patch: base, overlay: sil },
      { label: 'os plus large', focus: 'lower', patch: { jawWidth: 0.9 }, overlay: sil },
      { label: '+ masséters développés', focus: 'lower', patch: { ...base, softTissue: { masseter: { volume: 1, relief: 0.9 } } }, overlay: sil },
      { label: '+ graisse (angle adouci)', focus: 'lower', patch: { ...base, softTissue: { fat: 1 } }, overlay: sil },
    ], 4, 380, 470);
  },
  '04-mandibule-regions': () => {
    const reg = (m: CellMeta): string => {
      const { st } = g(m);
      const md = st.mandible;
      const out = poly(m, [...md.ramus, ...[...md.ramus].reverse().map((q) => ({ x: q.x - 2, y: q.y }))], '#4fc3f7', 0.5) + poly(m, [...md.body, ...[...md.body].reverse().map((q) => ({ x: q.x - 2, y: q.y - 2 }))], '#66bb6a', 0.5);
      const mirror = (a: readonly { x: number; y: number }[]) => a.map((q) => ({ x: -q.x, y: q.y }));
      return out + poly(m, mirror([...md.ramus, ...[...md.ramus].reverse().map((q) => ({ x: q.x - 2, y: q.y }))]), '#4fc3f7', 0.5) + poly(m, mirror([...md.body, ...[...md.body].reverse().map((q) => ({ x: q.x - 2, y: q.y - 2 }))]), '#66bb6a', 0.5) + line(m, md.lowerBorder, '#ffd54f', 2.4) + poly(m, md.preauricular.right, '#ce93d8', 0.45) + poly(m, md.preauricular.left, '#ce93d8', 0.45) + blob(m, md.masseter.right, '#ff7043', 0.3) + blob(m, md.masseter.left, '#ff7043', 0.3) + dot(m, md.gonion, '#ffffff') + dot(m, { x: -md.gonion.x, y: md.gonion.y }, '#ffffff') + tag(m, md.ramus[Math.floor(md.ramus.length / 2)] ?? md.gonion, 20, 60, 'branche montante', '#4fc3f7') + tag(m, md.gonion, 20, 110, `angle mandibulaire ${md.gonialDeg.toFixed(0)}°`, '#ffffff') + tag(m, md.body[Math.floor(md.body.length / 2)] ?? md.gonion, 20, 160, 'corps horizontal', '#66bb6a') + tag(m, md.lowerBorder[Math.floor(md.lowerBorder.length / 2)] ?? md.gonion, 20, 210, 'bord inférieur', '#ffd54f') + tag(m, md.masseter.right.c, 360, 70, 'masséter', '#ff7043') + tag(m, md.preauricular.right[0] ?? md.gonion, 360, 120, 'préauriculaire', '#ce93d8');
    };
    save('04-mandibule-regions', 'Mandibule : régions osseuses lues sur le contour réel (T3, T4)', [{ label: 'rendu', focus: 'face' }, { label: 'régions (face)', focus: 'face', overlay: reg }, { label: 'courbure : rectiligne', focus: 'lower', patch: { mandible: { bodyCurve: 0.05 } } }, { label: 'courbure : bombée', focus: 'lower', patch: { mandible: { bodyCurve: 0.95 } } }], 4, 380, 470);
  },
  '05-menton-controles': () => {
    const V: [string, object][] = [['forme : pointu', { chin: { form: -1 } }], ['forme : rond', { chin: { form: 0 } }], ['forme : carré', { chin: { form: 1 } }], ['projection faible', { chin: { projection: 0.1 } }], ['projection forte', { chin: { projection: 0.95 } }], ['symphyse large', { chin: { form: 0.3, symphysisWidth: 1 } }], ['symphyse étroite', { chin: { form: 0.3, symphysisWidth: 0 } }], ['hauteur réduite', { chin: { height: 0.09 } }], ['fossette', { chin: { dimple: 1 } }], ['sillon vertical', { chin: { groove: 1 } }], ['transitions nettes', { chin: { upperBlend: 0, lateralBlend: 0, lowerBlend: 0 } }], ['transitions fondues', { chin: { upperBlend: 1, lateralBlend: 1, lowerBlend: 1 } }]];
    save('05-menton-controles', 'Menton : contrôles séparés (T5)', V.map(([n, p]) => ({ label: n, focus: 'chin' as const, patch: p as never })), 4, 340, 400);
  },
  '06-tissus-mous': () => {
    const reg = (m: CellMeta): string => {
      const { st } = g(m);
      const c = [st.tissue.cheeks.left, st.tissue.cheeks.right];
      return c.map((k) => blob(m, k.volume, '#ffcc80', 0.18) + blob(m, k.zygoma, '#fff59d', 0.4) + blob(m, k.hollow, '#5c6bc0', 0.45) + blob(m, k.masseterBlend, '#ef5350', 0.4)).join('') + blob(m, st.tissue.perioral.upper, '#f48fb1', 0.3) + blob(m, st.tissue.perioral.lower, '#f48fb1', 0.3) + blob(m, st.tissue.submental.blob, '#80cbc4', 0.35) + line(m, st.tissue.folds.nasolabial.left, '#e53935', 2) + line(m, st.tissue.folds.nasolabial.right, '#e53935', 2) + line(m, st.tissue.folds.perioral.left, '#ab47bc', 2) + line(m, st.tissue.folds.perioral.right, '#ab47bc', 2) + tag(m, c[1]!.zygoma.c, 340, 60, 'pommette', '#fff59d') + tag(m, c[1]!.hollow.c, 340, 110, 'creux sous-malaire', '#9fa8da') + tag(m, c[1]!.volume.c, 340, 160, 'volume de la joue', '#ffcc80') + tag(m, c[1]!.masseterBlend.c, 340, 210, 'transition → masséter', '#ef9a9a') + tag(m, st.tissue.submental.blob.c, 20, 400, 'tissu sous-mentonnier', '#80cbc4');
    };
    save('06-tissus-mous', 'Joues, creux, masséter, plis, tissus péri-labiaux (T6, T8)', [{ label: 'régions', focus: 'face', overlay: reg }, { label: 'joues creuses', focus: 'face', patch: { cheek: { volume: 0.1, hollow: 1, boneProjection: 0.9 } } }, { label: 'joues pleines', focus: 'face', patch: { cheek: { volume: 0.95, hollow: 0, boneProjection: 0.2 } } }, { label: 'sourire : plis déplacés', focus: 'face', patch: { deform: { expression: { smile: 1 } } } }], 4, 380, 470);
  },
  '07-bouche-elements': () => {
    const el = (m: CellMeta): string => {
      const { mo } = g(m);
      return poly(m, mo.upperLip, '#ef5350', 0.2) + poly(m, mo.lowerLip, '#ffa726', 0.2) + poly(m, mo.cavity, '#7e57c2', 0.4) + poly(m, mo.upperTeeth, '#ffffff', 0.5) + poly(m, mo.lowerTeeth, '#b3e5fc', 0.5) + poly(m, mo.gums, '#f06292', 0.5) + poly(m, mo.tongue, '#ff8a65', 0.5) + dot(m, mo.corners.left, '#fff176') + dot(m, mo.corners.right, '#fff176') + dot(m, mo.cupid.peakLeft, '#4dd0e1') + dot(m, mo.cupid.peakRight, '#4dd0e1') + dot(m, mo.cupid.dip, '#00acc1') + dot(m, mo.cupid.tubercle, '#80deea') + line(m, mo.folds.left, '#ce93d8', 2) + line(m, mo.folds.right, '#ce93d8', 2) + tag(m, mo.cupid.peakRight, 330, 40, 'arc de Cupidon', '#4dd0e1') + tag(m, mo.cupid.tubercle, 330, 80, 'tubercule', '#80deea') + tag(m, mo.corners.right, 330, 120, 'commissure D', '#fff176') + tag(m, mo.corners.left, 20, 120, 'commissure G', '#fff176') + tag(m, mo.upperLip[3] ?? mo.corners.left, 20, 160, 'lèvre sup.', '#ef9a9a') + tag(m, mo.lowerLip[24] ?? mo.corners.left, 20, 200, 'lèvre inf.', '#ffcc80') + tag(m, mo.tongue[0] ?? mo.corners.left, 330, 240, 'langue', '#ffab91') + tag(m, mo.upperTeeth[10] ?? mo.corners.left, 330, 280, 'dents sup.', '#ffffff') + tag(m, mo.lowerTeeth[10] ?? mo.corners.left, 20, 280, 'dents inf.', '#b3e5fc') + tag(m, mo.gums[2] ?? mo.corners.left, 330, 320, 'gencive', '#f48fb1') + tag(m, mo.folds.right[3] ?? mo.corners.left, 330, 360, 'plis péri-buccaux', '#ce93d8');
    };
    const OPEN = { mouth: { open: 0.85, gums: 1, tongue: 0.9, teeth: { upper: 0.9, lower: 0.7 }, cupid: { depth: 0.8 } }, deform: { expression: { smile: 0.9, grimace: 0.3 } } };
    save('07-bouche-elements', 'Bouche : structure indépendante, éléments individualisés (T7)', [
      { label: 'rendu', focus: 'lower', patch: OPEN },
      { label: 'éléments exposés', focus: 'lower', patch: OPEN, overlay: el },
      { label: 'asymétrique + ligne ondulée', focus: 'lower', patch: { mouth: { cornerAsym: -0.9, lineWave: 0.9, open: 0.15 } } },
      { label: 'large, mâchoire carrée', focus: 'lower', patch: { jawWidth: 0.95, chin: { form: 1 }, mouth: { width: 0.5, fit: 1, open: 0.3 } } },
      { label: 'étroite, menton proéminent', focus: 'lower', patch: { chin: { projection: 0.95 }, mouth: { width: 0.17 } } },
      { label: 'caricature extrême', focus: 'lower', patch: { stylization: { mouthSize: 1, cornerAsymmetry: 0.8, angularity: 1 }, mouth: { open: 0.9 }, deform: { expression: { smile: 1, caricature: 1 } } } },
    ], 3, 400, 480);
  },
  '08-articulation': () => {
    const mk = (open: number, extra: object = {}): Cell => ({ label: `ouverture ${open}`, focus: 'lower', patch: { mouth: { open, gums: 0.2, teeth: { upper: 0.9, lower: 0.8 } }, ...extra } as never, overlay: (m) => { const { mo, st } = g(m); return line(m, [{ x: -80, y: mo.upperTeethTopY }, { x: 80, y: mo.upperTeethTopY }], '#4fc3f7', 1.2, '4 3') + line(m, [{ x: -80, y: mo.lowerTeethY }, { x: 80, y: mo.lowerTeethY }], '#ffb74d', 1.2, '4 3') + note(12, 24, `dents inf. ${mo.lowerTeethY.toFixed(1)}`, '#ffb74d') + note(12, 42, `dents sup. ${mo.upperTeethTopY.toFixed(1)} (fixes)`, '#4fc3f7') + note(12, 60, `angle cervico-mentonnier ${st.neck.cervicomentalDeg.toFixed(0)}°`, '#a5d6a7'); } });
    save('08-articulation', 'Articulation : la mandibule suit, la lèvre inférieure et les dents inférieures avec elle (T11)', [mk(0), mk(0.4), mk(0.8), mk(0.8, { deform: { articulation: { jawShift: 1 } } }), mk(0.8, { deform: { articulation: { protrusion: 1 } } }), mk(0.8, { deform: { articulation: { headPitchDeg: 22 } } })], 3, 400, 480);
  },
  '09-trois-deformations': () => {
    const MASSIVE = { jawWidth: 0.95, softTissue: { masseter: { volume: 0.7, relief: 0.8 } }, chin: { form: 1, projection: 0.75 }, jaw: { angle: 0.15 } };
    const ghost = (rest: CellMeta | null) => (m: CellMeta): string => { const { st } = g(m); return line(m, st.mandible.lowerBorder, '#00e5ff', 2.4, '6 4') + note(12, 24, `gonion ${st.mandible.gonion.x.toFixed(2)} · menton ${(st.chin.widthPx).toFixed(2)} px`, '#00e5ff') + (rest ? '' : ''); };
    const mk = (label: string, patch: object): Cell => ({ label, focus: 'lower', patch: { ...MASSIVE, ...patch } as never, overlay: ghost(null) });
    save('09-trois-deformations', 'Mâchoire massive : A morphologie · B articulation · C expression se combinent sans s’écraser (T12) — cyan = contour osseux, identique', [
      mk('A seule (repos)', {}), mk('C : sourire', { deform: { expression: { smile: 1 } } }), mk('C : grimace', { deform: { expression: { grimace: 1 } } }),
      mk('C : colère', { deform: { expression: { anger: 1 } } }), mk('B : parler (bouche ouverte)', { mouth: { open: 0.7 } }), mk('B + C : parler en souriant', { mouth: { open: 0.7 }, deform: { expression: { smile: 0.8 }, articulation: { jawShift: 0.4 } } }),
      mk('C : caricature (sourire ×2,5)', { deform: { expression: { smile: 1, caricature: 1 } } }), mk('B : serrage des mâchoires', { deform: { articulation: { clench: 1 } } }),
    ], 4, 340, 420);
  },
  '10-cou': () => {
    const mk = (label: string, patch: object): Cell => ({ label, focus: 'face', patch: { neck: { visible: true }, ...patch } as never, overlay: (m) => { const { st } = g(m); return note(12, 26, `angle cervico-mentonnier ${st.neck.cervicomentalDeg.toFixed(0)}°`, '#a5d6a7') + note(12, 44, `ombre sous le menton ${st.neck.shadowReachPx.toFixed(1)} px`, '#a5d6a7') + note(12, 62, `tension du platysma ${st.neck.platysmaTension.toFixed(2)}`, '#a5d6a7') + note(12, 80, `demi-cou ${st.neck.halfWidthPx.toFixed(1)} px`, '#fff59d'); } });
    save('10-cou', 'Cou : angle cervico-mentonnier, platysma, muscles ; menton ≠ cou (T9)', [mk('repos', {}), mk('tête inclinée +22°', { deform: { articulation: { headPitchDeg: 22 } } }), mk('tête relevée −20°', { deform: { articulation: { headPitchDeg: -20 } } }), mk('bouche ouverte', { mouth: { open: 1 } }), mk('menton très projeté (cou inchangé)', { chin: { projection: 0.98 } }), mk('cou épais, muscles marqués', { neck: { width: 0.55, muscles: 1, thickness: 0.8 } })], 3, 380, 470);
  },
  '11-dependances': () => {
    const mk = (p: number): Cell => ({ label: `projection du menton ${p}`, focus: 'lower', patch: { chin: { projection: p } }, overlay: (m) => { const { st } = g(m); return blob(m, st.chin.lateral.right, '#ff7043', 0.35) + blob(m, st.chin.lateral.left, '#ff7043', 0.35) + blob(m, st.chin.lower, '#26c6da', 0.35) + line(m, st.mandible.body, '#66bb6a', 3.2) + line(m, st.mandible.body.map((q) => ({ x: -q.x, y: q.y })), '#66bb6a', 3.2) + note(12, 24, `raccord latéral ${st.chin.lateral.right.rx.toFixed(1)} px`, '#ffab91') + note(12, 42, `ombre sous-mentonnière ${st.neck.shadowReachPx.toFixed(1)} px`, '#80deea') + note(12, 60, `corps de mandibule ${st.mandible.bodyLengthPx.toFixed(2)} px (inchangé)`, '#a5d6a7') + note(12, 78, `cou ${st.neck.halfWidthPx.toFixed(1)} px (inchangé)`, '#fff59d'); } });
    save('11-dependances', 'Dépendances : la projection du menton recalcule les raccords, pas la mandibule ni le cou (T10)', [mk(0.1), mk(0.5), mk(0.95)], 3, 420, 500);
  },
  '12-stylisation': () => {
    const mk = (label: string, st: object): Cell => ({ label, focus: 'face', patch: { stylization: st } as never });
    save('12-stylisation', 'Profil de stylisation : mêmes relations essentielles, exagération croissante (T13)', [mk('profil neutre', {}), mk('menton + mâchoire 0,5', { chinProjection: 0.5, jawWidth: 0.5 }), mk('menton + mâchoire 1', { chinProjection: 1, jawWidth: 1 }), mk('angularité 1 + contraste cou 1', { angularity: 1, jawNeckContrast: 1 }), mk('bouche +1, asymétrie 0,8', { mouthSize: 1, cornerAsymmetry: 0.8 }), mk('tout au maximum', { chinProjection: 1, jawWidth: 1, angularity: 1, jawNeckContrast: 1, mouthSize: 1, cornerAsymmetry: 0.8, simplify: 1, outline: 0.6 })], 3, 340, 420);
  },
  '13-modes-de-rendu': () => {
    const STY = { chinProjection: 0.8, jawWidth: 0.8, angularity: 0.7, jawNeckContrast: 0.6, mouthSize: 0.4, cornerAsymmetry: 0.5, simplify: 0.5, outline: 0.7 };
    const t = Date.now();
    const out: { png: Buffer; label: string }[] = [];
    for (const [label, mode] of [['réaliste', 'realistic'], ['anime (aplats nets)', 'anime'], ['encrage noir et blanc', 'ink']] as const) {
      const r = cellSvg({ seed: SEED, focus: 'face', background: mode === 'ink' ? '#ffffff' : undefined, patch: { ...S, stylization: STY, renderMode: mode, mouth: { open: 0.35 }, deform: { expression: { smile: 0.5 } } } }, 420, 520);
      out.push({ png: rasterize(mode === 'ink' ? inkWrapScene(r.svg, 0.4) : r.svg), label: `${label} — MÊME géométrie` });
    }
    writeFileSync(`${OUT}/13-modes-de-rendu.png`, board('Même géométrie caricaturale, trois traitements : l’anatomie n’est jamais reconstruite (T13)', out, 3, 420, 520));
    console.log(`13-modes-de-rendu.png  ${((Date.now() - t) / 1000).toFixed(0)} s`);
  },
  '14-galerie': () => {
    const seeds = [11, 207, 4242, 90210, 777, 31337];
    const specs: Cell[] = seeds.flatMap((s) => [{ label: `seed ${s} — classic`, seed: s, focus: 'face' as const, patch: { anatomyEngine: 'classic' } as never }, { label: `seed ${s} — structured`, seed: s, focus: 'face' as const, opts: { structure: true } as never }]);
    save('14-galerie', 'Galerie : visages classic / structured (mêmes graines)', specs, 4, 300, 380);
  },
};

const want = process.argv.slice(2);
for (const [name, run] of Object.entries(BOARDS)) if (want.length === 0 || want.some((w) => name.startsWith(w))) run();

/**
 * ARTEFACTS DE LA TÊTE EN ROTATION — écrit dans `artefacts/head-turntable/` : rendus des lacets de la planche (0° → 180°) et du tour complet
 * (45° en 45°), vues agrandies pour les détails, rapport de vérification JSON (3 couches) et table d'erreurs de silhouette.
 * Les montages (planche, superpositions sur la référence, détails) sont faits ensuite par `compose-artefacts.py`.
 * Usage : npx tsx scripts/head-turntable/artefacts-turntable.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { encodePngRgba } from '../../src/core/png';
import { cachedRenderer, defaultFrame, FIT_YAWS, REF_PITCH, REF_RESIDUAL, REF_SPEC, refView, renderHead, silhouetteError, verifyHeadTurn, type RotationMeasures } from '../../src/head-turntable';

const OUT = process.env.OUT ?? 'artefacts/head-turntable';
const measures = JSON.parse(readFileSync('references/face/rotation_head.measures.json', 'utf8')) as RotationMeasures;
for (const d of ['turntable', 'details', 'verification']) mkdirSync(`${OUT}/${d}`, { recursive: true });
const save = (path: string, r: { w: number; h: number; rgba: Uint8ClampedArray }): void => writeFileSync(`${OUT}/${path}`, encodePngRgba(r.w, r.h, r.rgba));
const pad = (n: number): string => String(((n % 360) + 360) % 360).padStart(3, '0');

// 1. Les 9 lacets de la planche, au cadre de la vérification (520 px) pour que les superpositions tombent pile.
const at = cachedRenderer(REF_SPEC, 520);
for (const yaw of [0, 20, 45, 70, 90, 110, 135, 160, 180]) save(`turntable/yaw_${pad(yaw)}.png`, at(yaw));
// 2. Tour complet : 8 lacets de 45° en 45° (la planche s'arrête à 180° ; le moteur couvre 360°), haute définition.
const full = defaultFrame(760);
for (let yaw = 0; yaw < 360; yaw += 45) save(`turntable/full_${pad(yaw)}.png`, renderHead(refView(yaw), REF_SPEC, { frame: full, ss: 3 }));
// 3. Vues agrandies pour les détails (yeux, nez, bouche, oreille, cheveux) : de face, 3/4 et profil à 1800 px.
const big = defaultFrame(1800);
for (const yaw of [0, 30, 90]) save(`details/big_${pad(yaw)}.png`, renderHead(refView(yaw), REF_SPEC, { frame: big, ss: 2 }));
// 4. Vérification : rapport complet + erreurs de silhouette de tous les lacets (calage / hors échantillon).
const report = verifyHeadTurn(measures, REF_SPEC, at);
writeFileSync(`${OUT}/verification/verification_report.json`, JSON.stringify({ pitchDeg: REF_PITCH, rigidFitResidualU: REF_RESIDUAL, pass: report.pass, layers: report.layers }, null, 1));
const rows = [0, 20, 45, 70, 90, 110, 135, 160, 180].map((yaw) => { const e = silhouetteError(measures, yaw, at(yaw)); return `${yaw},${(FIT_YAWS as readonly number[]).includes(yaw) ? 'calage' : 'hors-echantillon'},${e.toFixed(4)},${(e * 150).toFixed(2)}`; });
writeFileSync(`${OUT}/verification/silhouette_error.csv`, ['yaw_deg,statut,erreur_moyenne_U,erreur_moyenne_px_planche', ...rows].join('\n') + '\n');
console.log(`artefacts écrits dans ${OUT} — vérification : ${report.pass ? 'OK' : 'ÉCHEC'} (${report.layers.map((l) => `${l.layer}:${l.checks.length}`).join(', ')})`);
console.log(rows.join('\n'));

/**
 * Artefacts de preuve des contrats, de la résolution et des nouvelles fonctions → artefacts/contrats/ :
 *  influence.json (carte paramètre → mesures + couverture), ordre.json, corrections-cas-difficiles.json,
 *  planche-expressions.png (8 axes), planche-profils.png (6 profils nommés), planche-corrections.png (bouche écrasée visible).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { CONTRACTS, influenceMap, resolutionOrder } from '../src/face/contracts';
import { HARD_CASES } from '../src/regression/cases';
import { FaceParams } from '../src/schema';
import { faceLandmarks } from '../src/face';
import { STYLIZATION_PROFILES } from '../src/face/stylize';
import { board, cell } from './lib/board';

const OUT = 'artefacts/contrats'; mkdirSync(OUT, { recursive: true });
const NON_GEO = /appearance|^skin\.|^skinMaterial|^lighting|^hair\.|^facialHair\.|^blush/;
const map = influenceMap();
const geo = Object.entries(map.influences).filter(([k]) => !NON_GEO.test(k));
const unmeasured = geo.filter(([, v]) => v.length === 0).map(([k]) => k).sort();
writeFileSync(`${OUT}/influence.json`, JSON.stringify({ geometricParams: geo.length, measured: geo.length - unmeasured.length, unmeasured, skipped: map.skipped, influences: map.influences }, null, 1));
writeFileSync(`${OUT}/ordre.json`, JSON.stringify({ order: resolutionOrder(CONTRACTS), contracts: CONTRACTS }, null, 1));
const corr = HARD_CASES.map((c) => ({ id: c.id, corrections: faceLandmarks(FaceParams.parse({ anatomyEngine: 'structured', ...(c.patch ?? {}) }), 300, 380).corrections.map((k) => `${k.id}: ${k.requested.toFixed(1)} → ${k.applied.toFixed(1)}`) }));
writeFileSync(`${OUT}/corrections-cas-difficiles.json`, JSON.stringify(corr, null, 1));
console.log(`paramètres géométriques : ${geo.length}, mesurés : ${geo.length - unmeasured.length}, sans mesure : ${unmeasured.length}`);

const W = 200; const H = 250; const S = { anatomyEngine: 'structured' };
const AX = ['smile', 'grimace', 'anger', 'surprise', 'disgust', 'disdain', 'ooh'] as const;
const exp = [{ png: cell({ seed: 321, patch: S, focus: 'lower' }, W, H).png, label: 'neutre' }, ...AX.map((a) => ({ png: cell({ seed: 321, patch: { ...S, mouth: { open: a === 'surprise' || a === 'ooh' ? 0.45 : 0.1 }, deform: { expression: { [a]: 1 } } }, focus: 'lower' }, W, H).png, label: a }))];
writeFileSync(`${OUT}/planche-expressions.png`, board('Expressions du bas du visage : 7 axes à 1 (+ neutre)', exp, 4, W, H));
const prof = Object.entries(STYLIZATION_PROFILES).map(([n, p]) => ({ png: cell({ seed: 321, patch: { ...S, ...p } }, W, H).png, label: n }));
writeFileSync(`${OUT}/planche-profils.png`, board('Profils de stylisation nommés (même graine)', prof, 3, W, H));
const crush = [HARD_CASES[0]!, HARD_CASES[2]!, HARD_CASES[12]!].map((c) => ({ png: cell({ seed: c.seed, patch: c.patch, focus: 'lower' }, W, H).png, label: c.id.slice(5, 28) }));
writeFileSync(`${OUT}/planche-corrections.png`, board('Corrections du résolveur : bouche ramenée 45→12,6 / 46→30 / 45→29 px', crush, 3, W, H));

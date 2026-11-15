import { writeFileSync } from 'node:fs';
import { faceLandmarks, noseGeometry } from '../../src/face';
import { FaceParams } from '../../src/schema';
import { widthProfile25 } from '../../src/face/nose/measure';
import { ZONE_LIMITS } from '../../src/face/zones-limits';

/**
 * PLAFOND du rapport L/H de la silhouette de face du nez (cause du « 0,825 » constaté sur 4 ajustements de `fit.ts`, `docs/NOSE-REFS-REMAINING.md`).
 * Le script MESURE (aucune valeur supposée) : L/H = largeur de la silhouette ÷ (base du nez − racine), balayé sur les trois axes qui le gouvernent
 * (largeur `nose.width`, évasement `nose.alae.flare`, hauteur de racine `nose.root.height`) et sur `nose.length` jusqu'au plancher de zone.
 *   npx tsx scripts/nose-refs/aspect-ceiling.ts   -> references/nez/aspect-ceiling.json
 */
const W = 300, H = 380;
const asp = (patch: Record<string, unknown>) => { const p = FaceParams.parse({ anatomyEngine: 'structured', ...patch }); const g = noseGeometry(p, faceLandmarks(p, W, H)); const m = widthProfile25(g.silhouette); return { aspect: m.aspect, w: m.width, h: m.height, baseY: g.baseY, rootY: g.root.y }; };
const nose = (o: Record<string, unknown>, root: Record<string, unknown> = {}, alae: Record<string, unknown> = {}) => ({ nose: { ...o, root, alae } });
// 1) la longueur sous le plancher de zone est inerte : même silhouette que le plancher
const floor = ZONE_LIMITS.nose.min;
const lenProbe = [0.08, 0.1, 0.139, 0.161, floor, 0.2, 0.26].map((len) => ({ length: len, ...asp(nose({ width: 0.28, length: len })) }));
// 2) plafond atteignable : racine au plus bas (0), évasement max (1), largeur max du schéma (0,3), longueur au plancher de zone
const ceiling = asp(nose({ width: 0.3, length: floor }, { height: 0 }, { flare: 1 }));
// 3) ce que l'ajustement v1 explorait : flare ≥ 0, largeur ≤ 0,28, root.height laissé à 0,5 (non exploré)
const v1Best = asp(nose({ width: 0.28, length: floor }, { height: 0.5 }, { flare: 0 }));
const v1Flare = asp(nose({ width: 0.28, length: floor }, { height: 0.5 }, { flare: 1 }));
const REF = { pyramide: 0.73, 'ellipse-large': 1.597, 'cloche-ailes': 0.9767, 'plat-trapeze': 1.2282, 'losange-petit': 1.5205 };
const reach = Object.fromEntries(Object.entries(REF).map(([k, v]) => [k, { refAspect: v, reachable: v <= ceiling.aspect }]));
const out = { zoneFloorLength: floor, lenProbe, ceiling, v1Best, v1Flare, reach };
writeFileSync('references/nez/aspect-ceiling.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify({ floor, ceiling, v1Best, v1Flare, reach }, null, 1));
for (const r of lenProbe) console.log('length', r.length, 'L/H', r.aspect.toFixed(3), 'h', r.h.toFixed(1));

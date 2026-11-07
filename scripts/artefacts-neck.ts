import { mkdirSync, writeFileSync } from 'node:fs';
import { board, cell, rasterize, type CellSpec } from './lib/board';
import { CASES, measure, neckPatch } from './lib/neck-cases';
import { frontSilhouette, neckModelFor } from '../src/neck';
import { NECK_OPERATORS } from '../src/schema/neck-system';
import { generateRandomFace } from '../src';
import { verifyFace } from '../src/verify';
import { checkNeckModel } from '../src/verify/neck';

/**
 * Artefacts de preuve du MOTEUR DE COU : `npx tsx scripts/artefacts-neck.ts [planche …]`. Chaque image est un rendu réel (jamais retouché) dans
 * `artefacts/neck/`. Une planche à cadrage « cou » montre le détail, une planche « tête entière » le rend en contexte. Sans argument : toutes.
 */
const OUT = 'artefacts/neck';
mkdirSync(OUT, { recursive: true });
type Cell = { label: string; patch?: Record<string, unknown>; face?: Record<string, unknown>; focus?: CellSpec['focus']; seed?: number; light?: CellSpec['light']; yaw?: number };
const sys = (s: Record<string, unknown>, flat: Record<string, unknown> = {}) => ({ ...flat, system: s });
const save = (name: string, title: string, cells: Cell[], cols: number, w: number, h: number, focus: CellSpec['focus'] = 'neck'): void => {
  const t = Date.now();
  const rendered = cells.map((c) => ({ ...cell({ seed: c.seed ?? 321, patch: { ...(c.face ?? {}), ...neckPatch(c.patch ?? {}) }, focus: c.focus ?? focus, ...(c.light ? { light: c.light } : {}) }, w, h), label: c.label }));
  writeFileSync(`${OUT}/${name}.png`, board(title, rendered, cols, w, h));
  console.log(`${name}.png  ${((Date.now() - t) / 1000).toFixed(0)} s`);
};
const R = (v: number) => ({ larynx: v, hyoid: v, trachea: v, vessels: v, clavicle: v });

const BOARDS: Record<string, () => void> = {
  '01-morphologies': () => save('01-morphologies', 'Morphologies : une seule grammaire (largeur, longueur, profil, courbure) → des cous très différents', [
    { label: 'référence (humain moyen)' },
    { label: 'long et fin', patch: { length: 0.62, width: 0.3, flare: 0.15, ...sys({ modifiers: { mass: 0.1 }, musculature: { trapezius: 0.2 } }) } },
    { label: 'massif de taureau (caricature)', patch: { width: 0.52, length: 0.22, ...sys({ style: { mode: 'caricature', exaggeration: 0.5 }, modifiers: { mass: 0.85 }, musculature: { trapezius: 1 } }) } },
    { label: 'très court', patch: { length: 0.1, width: 0.5 } },
    { label: 'cône (taper 0,9)', patch: { length: 0.6, ...sys({ profile: { taper: 0.9 } }) } },
    { label: 'sablier (waist 1)', patch: { length: 0.7, ...sys({ profile: { waist: 1 } }) } },
    { label: 'asymétrique (+0,9 droite, torsion)', patch: sys({ asymmetry: { leftRightBias: 0.9 }, orientation: { torsionDeg: 40 } }) },
    { label: 'exagération 1 (écart amplifié)', patch: { length: 0.55, width: 0.3, ...sys({ style: { exaggeration: 1 } }) } },
  ], 4, 300, 440),
  '02-anatomie': () => save('02-anatomie', 'Anatomie : la visibilité des structures découle de la morphologie, de la posture et de la peau', [
    { label: 'reliefs forcés à 0', patch: { muscles: 0.3, ...sys({ reliefs: R(0), modifiers: { mass: 0.1 } }) } },
    { label: 'reliefs forcés à 1 (mince)', patch: { muscles: 0.3, ...sys({ reliefs: R(1), modifiers: { mass: 0.1 } }) } },
    { label: 'mince, tendu, peau tendue', patch: { muscles: 0.9, ...sys({ modifiers: { mass: 0.1 }, musculature: { tension: 1, tendonVisibility: 1, separation: 1 }, surface: { skinTension: 1 } }) } },
    { label: 'massif : reliefs enfouis', patch: { muscles: 0.5, ...sys({ modifiers: { mass: 0.95 } }) } },
    { label: 'âgé : plis + fanon + fosse', patch: sys({ modifiers: { age: 1, mass: 0.6 }, softTissue: { foldDepth: 0.8, foldDistribution: 0.7 } }) },
    { label: 'tête relevée (extension −18°) : larynx saillant', face: { deform: { articulation: { headPitchDeg: -18 } } }, patch: sys({ modifiers: { mass: 0.2 } }) },
    { label: 'tête baissée (flexion +25°) : plis du menton', face: { deform: { articulation: { headPitchDeg: 25 } } }, patch: sys({ modifiers: { mass: 0.5 } }) },
    { label: 'trapèzes 0 → 1 (pente nuque-épaule)', patch: sys({ musculature: { trapezius: 1 } }) },
  ], 4, 300, 440),
  '03-operateurs': () => save('03-operateurs', 'Les 12 opérateurs de déformation (un seul à la fois, amount 0,9 sauf mention)', NECK_OPERATORS.map((op) => ({ label: op, patch: { length: 0.55, muscles: 0.6, ...sys({ operators: [{ op, amount: op === 'local_compression' || op === 'muscle_exaggeration' || op === 'topology_extension' || op === 'silhouette_simplification' || op === 'fold_amplification' || op === 'surface_ripple' ? 1 : 0.9, at: 0.55, span: 0.5, side: op === 'local_bulge' ? 1 : 0 }], modifiers: { mass: 0.5 } }) } })), 6, 220, 380),
  '04-mouvements': () => save('04-mouvements', 'Pose et langage corporel : la même morphologie, huit expressions + compression/étirement', [
    { label: 'neutre' },
    ...(['fear', 'pride', 'shame', 'defiance', 'fatigue', 'curiosity', 'anger'] as const).map((e) => ({ label: e, patch: sys({ pose: { bodyLanguage: e, bodyLanguageAmount: 1 } }) })),
    { label: 'compression 0,8', patch: sys({ pose: { compression: 0.8 } }) },
    { label: 'étirement 0,8', patch: sys({ pose: { stretch: 0.8 } }) },
    { label: 'inclinaison cou 12° + tête avancée', patch: sys({ orientation: { rollDeg: 12 }, pose: { headTranslate: 0.8 } }) },
    { label: 'collier + écharpe (contact)', patch: sys({ attachments: [{ kind: 'collar', at: 0.55, size: 0.5, count: 1, color: '#b0442a' }, { kind: 'scarf', at: 0.88, size: 0.5, count: 1, color: '#2f6fa8' }] }) },
  ], 4, 300, 440, 'face'),
  '05-especes': () => save('05-especes', 'Espèces et surfaces : écailles, plaques, plumes, segments — distribuées sur la surface déformée', [
    { label: 'reptile : écailles en rangées', patch: { length: 0.6, ...sys({ species: 'reptile', surface: { pattern: 'scales', layout: 'rows', size: 0.14, smoothThroat: 0.4 }, profile: { curvature: 0.3 } }) } },
    { label: 'dragon : spirale + crête', patch: { length: 0.8, flare: 0.5, ...sys({ species: 'dragon', profile: { sCurve: 0.5, taper: 0.4 }, surface: { pattern: 'scales', layout: 'spiral', size: 0.12, elementColor: '#5a7d52' }, attachments: [{ kind: 'crest', at: 0.9, size: 0.35, count: 10, color: '#7b3b3b' }] }) } },
    { label: 'cuirassé : plaques', patch: { length: 0.5, ...sys({ species: 'armored', profile: { segments: 6, crossSection: 0.8 }, surface: { pattern: 'plates', size: 0.2, density: 0.5, elementColor: '#8a8f9c' } }) } },
    { label: 'aviaire : plumes', patch: { length: 0.9, width: 0.3, ...sys({ species: 'avian', profile: { sCurve: 0.9, curvature: 0.5 }, surface: { pattern: 'feathers', size: 0.16, density: 0.8, overlap: 0.6, elementColor: '#d9d2c3' } }) } },
    { label: 'serpent : segments', patch: { length: 0.9, width: 0.3, ...sys({ species: 'serpent', profile: { segments: 12 }, surface: { pattern: 'scales', layout: 'tiling', size: 0.1, elementColor: '#4d6b3a' } }) } },
    { label: 'fantasy : pointes + collerette', patch: { length: 0.5, ...sys({ species: 'fantasy', surface: { pattern: 'scales', layout: 'clusters', size: 0.12, density: 0.8, elementColor: '#6a4fa0' }, attachments: [{ kind: 'spikes', at: 0.5, size: 0.4, count: 7, color: '#d6c27a' }, { kind: 'frill', at: 0.2, size: 0.6, count: 11, color: '#c9506a' }] }) } },
  ], 3, 330, 480),
  '06-styles': () => save('06-styles', 'Couches de style : le même cou lu en réaliste, caricature, anime, sculpture, peinture', (['realistic', 'caricature', 'anime', 'sculpture', 'painting'] as const).map((mode) => ({ label: mode, patch: { length: 0.5, muscles: 0.7, ...sys({ style: { mode } }) }, ...(mode === 'anime' ? {} : {}) })), 5, 260, 400),
  '07-lumiere': () => save('07-lumiere', 'Éclairage : le côté éclairé du cou suit la lumière (azimut 40°/120° éclairent la droite, 220°/320° la gauche ; écart mesuré par test) ; torsion 40° en colonne paire', [40, 120, 220, 320].flatMap((az) => [{ label: `azimut ${az}°`, light: { azimuthDeg: az, elevationDeg: 50 }, patch: { length: 0.5 } }, { label: `azimut ${az}° · torsion`, light: { azimuthDeg: az, elevationDeg: 50 }, patch: { length: 0.5, ...sys({ orientation: { torsionDeg: 40 }, modifiers: { mass: 0.2 } }) } }]), 4, 260, 380),
  '08-tetes-entieres': () => save('08-tetes-entieres', 'Têtes entières : visage, cou et lumière dans le même rendu (six identités, six cous)', [
    { label: 'identité 1 · référence', seed: 7, patch: {} },
    { label: 'identité 2 · long, fin, tendu', seed: 19, patch: { length: 0.55, width: 0.3, muscles: 0.8, ...sys({ modifiers: { mass: 0.1 }, musculature: { tension: 0.8 }, surface: { skinTension: 0.9 } }) } },
    { label: 'identité 3 · taureau', seed: 33, patch: { width: 0.62, ...sys({ style: { mode: 'caricature', exaggeration: 0.6 }, modifiers: { mass: 0.85 } }) } },
    { label: 'identité 4 · âgé', seed: 41, patch: sys({ modifiers: { age: 1, mass: 0.55 }, softTissue: { foldDepth: 0.7, foldDistribution: 0.6 } }) },
    { label: 'identité 5 · dragon', seed: 52, patch: { length: 0.75, flare: 0.45, ...sys({ species: 'dragon', profile: { sCurve: 0.4, taper: 0.4 }, surface: { pattern: 'scales', layout: 'spiral', size: 0.12, elementColor: '#5a7d52' }, attachments: [{ kind: 'crest', at: 0.9, size: 0.35, count: 9, color: '#7b3b3b' }] }) } },
    { label: 'identité 6 · cuirassé', seed: 63, patch: { length: 0.5, ...sys({ species: 'armored', profile: { segments: 6, crossSection: 0.8 }, surface: { pattern: 'plates', size: 0.2, density: 0.5, elementColor: '#8a8f9c' } }) } },
  ], 3, 340, 520, 'face'),
  '09-lacet-silhouettes': () => {
    // Silhouettes de FACE du modèle sous rotation de la tête (le visage hôte n'est pas pivoté ici : preuve de GÉOMÉTRIE, pas de rendu).
    const f = generateRandomFace(321, { id: 'f', neck: { visible: true } } as never);
    const c = cell({ seed: 321, patch: neckPatch({ length: 0.5 }), focus: 'neck' }, 200, 300);
    const yaws = [0, 20, 40, 60, 80];
    const shapes = yaws.map((yaw, k) => {
      const m = neckModelFor(c.meta.params, c.meta.lm, yaw), s = frontSilhouette(m), sc = 1.1, ox = 160 + k * 300, oy = 40 - m.stations[0]!.y * sc + 40;
      const pts = [...s.left, ...[...s.right].reverse()].map((p) => `${(ox + p.x * sc).toFixed(1)},${(oy + p.y * sc).toFixed(1)}`).join(' ');
      return `<polygon points="${pts}" fill="#c9a37a" stroke="#fff" stroke-width="1.5"/><text x="${ox - 40}" y="${oy + (m.stations[m.stations.length - 1]!.y) * sc + 30}" fill="#e8ecf5" font-size="15" font-family="DejaVu Sans">lacet ${yaw}°</text>`;
    }).join('');
    void f;
    writeFileSync(`${OUT}/09-lacet-silhouettes.png`, rasterize(`<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="520"><rect width="1500" height="520" fill="#1b1f2e"/><text x="12" y="28" fill="#fff" font-size="20" font-family="DejaVu Sans">Silhouette de face du cou sous rotation de la tête (twistShare 0,55) — géométrie du modèle</text>${shapes}</svg>`));
    console.log('09-lacet-silhouettes.png');
  },
  '10-verification': () => {
    // Couche de vérification : 24 visages + contrôles négatifs (corruptions détectées). Résultats en JSON : pas une image truquée.
    const rows: Record<string, unknown>[] = [];
    for (let seed = 1; seed <= 24; seed++) { const face = generateRandomFace(seed, { id: 'f', neck: { visible: true } } as never); const r = verifyFace(face); const neck = r.checks.filter((c) => c.id.startsWith('neck.')); rows.push({ seed, neckChecks: neck.length, failedErrors: neck.filter((c) => !c.ok && c.severity === 'error').map((c) => c.id), warnings: neck.filter((c) => !c.ok && c.severity === 'warn').map((c) => c.id) }); }
    const c = cell({ seed: 321, patch: neckPatch({}), focus: 'neck' }, 100, 100), m = neckModelFor(c.meta.params, c.meta.lm);
    const corrupt = (name: string, mut: (s: (typeof m.stations)[number], i: number) => object) => ({ name, detected: checkNeckModel({ ...m, stations: m.stations.map((s, i) => ({ ...s, ...mut(s, i) })) }).filter((k) => !k.ok && k.severity === 'error').map((k) => k.id) });
    const negatives = [corrupt('axe inversé', (_s, i) => (i === 5 ? { y: m.stations[3]!.y } : {})), corrupt('section écrasée', (s, i) => (i === 7 ? { aL: s.aL * 0.1 } : {})), corrupt('haut hors de la tête', (_s, i) => (i === 0 ? { x: m.ctx.chinHalf * 2 } : {})), corrupt('valeur NaN', (_s, i) => (i === 2 ? { aL: Number.NaN } : {})), corrupt('base déplacée', (s, i) => (i === m.stations.length - 1 ? { y: s.y + 5 } : {}))];
    writeFileSync(`${OUT}/10-verification.json`, JSON.stringify({ faces: rows, controlesNegatifs: negatives }, null, 1));
    console.log('10-verification.json', rows.filter((r) => (r.failedErrors as string[]).length).length, 'visage(s) avec erreur');
  },
  '11-tableau-preuves': () => {
    const rows = CASES.map((c) => { const m = measure(c.base ?? {}, c.patch, c.yaw ?? 0); return { parametre: c.id, cas: c.label, pixelsBoiteCou: +(100 * m.pixels).toFixed(2), silhouetteFace: +(100 * m.front).toFixed(2), profil: +(100 * m.profile).toFixed(2), preuve: m.view }; });
    writeFileSync(`${OUT}/11-tableau-preuves.json`, JSON.stringify(rows, null, 1));
    const md = ['# Preuves de visibilité par paramètre (généré par `scripts/artefacts-neck.ts`)', '', 'Seuils : ≥ 0,6 % des pixels de la boîte du cou, ou ≥ 1 % de H de silhouette (face ou profil). Valeurs en %.', '', '| Paramètre | Cas | Pixels | Sil. face | Profil | Preuve |', '|---|---|---:|---:|---:|---|', ...rows.map((r) => `| \`${r.parametre}\` | ${r.cas} | ${r.pixelsBoiteCou} | ${r.silhouetteFace} | ${r.profil} | ${r.preuve} |`)];
    writeFileSync('docs/NECK-PROOF.md', `${md.join('\n')}\n`);
    console.log('11-tableau-preuves.json + docs/NECK-PROOF.md', rows.filter((r) => r.preuve === 'aucune').length, 'sans preuve');
  },
};

const wanted = process.argv.slice(2);
for (const [name, run] of Object.entries(BOARDS)) if (wanted.length === 0 || wanted.some((w) => name.startsWith(w))) run();

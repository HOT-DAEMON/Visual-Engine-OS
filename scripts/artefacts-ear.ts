import { mkdirSync, writeFileSync } from 'node:fs';
import { board, cell, type CellMeta } from './lib/board';
import { rasterPng } from './lib/raster';
import { resolveAppearance } from '../src/appearance';
import { earGeometry } from '../src/face';
import { faceZones } from '../src/face/zones';
import { projectEar, VIEW_YAW, type ViewName } from '../src/face/ear/project';
import type { Vec } from '../src/geometry/eye/primitives';
import { checkEars } from '../src/verify/ear';
import { checkZones } from '../src/verify/zones';
import { earViewSvg } from '../src/render/face/ear/sheet';
import { lightVector } from '../src/lighting/light';
import { FaceParams } from '../src/schema';
import { faceLandmarks } from '../src/face/landmarks';
import { line, note, poly as polyO, tag } from './lib/overlays-structure';

/**
 * Artefacts de preuve du moteur d'oreille et des zones du visage : `npx tsx scripts/artefacts-ear.ts [planche …]`.
 * Chaque image est un rendu RÉEL (jamais retouché) ; les surcouches dessinent ce que la géométrie expose (repères, polygones, lignes d'alignement).
 */
const OUT = 'artefacts/ear-system';
mkdirSync(OUT, { recursive: true });
const SKIN = '#b98a62';
const S = (patch: object = {}) => FaceParams.parse({ anatomyEngine: 'structured', ...patch });
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const png = (svg: string): Buffer => rasterPng(svg, { fonts: true });
const earSvg = (p: FaceParams, view: ViewName, w: number, h: number, extra: Record<string, unknown> = {}): string => { const lm = faceLandmarks(p, 300, 400); return earViewSvg(p, lm, { view, width: w, height: h, skin: SKIN, ...(extra as object) }); };
const save = (name: string, title: string, cells: { png: Buffer; label: string }[], cols: number, w: number, h: number): void => { writeFileSync(`${OUT}/${name}.png`, board(title, cells, cols, w, h)); console.log(`${name}.png`); };
const colors = ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#c77dff', '#ff9f1c', '#2ec4b6', '#f72585', '#90be6d', '#43aa8b', '#f9c74f'];

/** Surcouche sur une vue d'oreille : les polygones des structures du modèle, projetés dans CETTE vue. */
function overlayView(p: FaceParams, view: ViewName, w: number, h: number, labels: boolean): string {
  const lm = faceLandmarks(p, 300, 400);
  const e = earGeometry(p, lm)[1]!;
  const pe = projectEar(e.model!, e.placement!, VIEW_YAW[view], view);
  const hh = e.placement!.hPx;
  const c = { x: (pe.bbox.x0 + pe.bbox.x1) / 2, y: (pe.bbox.y0 + pe.bbox.y1) / 2 };
  const k = ((h * 0.78) / hh);
  const X = (q: Vec): string => `${(w / 2 + (q.x - c.x) * k).toFixed(1)},${(h / 2 + (q.y - c.y) * k).toFixed(1)}`;
  const ids = ['helix', 'scapha', 'antihelix', 'fossa', 'crus', 'cymba', 'cavum', 'canal', 'tragus', 'antitragus', 'lobule'];
  let out = '';
  for (const { s, poly } of pe.structures) {
    const base = String(s.id).split(':')[0] as string;
    const i = ids.indexOf(base);
    if (i < 0) continue;
    out += `<polygon points="${poly.map(X).join(' ')}" fill="${colors[i]}" fill-opacity="0.22" stroke="${colors[i]}" stroke-width="1.2"/>`;
  }
  if (labels) {
    const lab = (id: string, text: string, tx: number, ty: number, i: number): string => { const s = pe.structures.find((q) => String(q.s.id).split(':')[0] === id); if (!s) return ''; const m = s.poly.reduce((a, q) => ({ x: a.x + q.x / s.poly.length, y: a.y + q.y / s.poly.length }), { x: 0, y: 0 }); const [px, py] = X(m).split(',').map(Number) as [number, number]; return `<line x1="${tx}" y1="${ty - 4}" x2="${px}" y2="${py}" stroke="${colors[i]}" stroke-width="1"/><text x="${tx}" y="${ty}" fill="${colors[i]}" font-size="12" font-weight="bold" font-family="DejaVu Sans" stroke="#000" stroke-width="0.4" paint-order="stroke">${esc(text)}</text>`; };
    out += [['helix', 'EAR-01 hélix', 8, 22, 0], ['scapha', 'EAR-03 scapha', 8, 44, 1], ['antihelix', 'EAR-02 anthélix (A–E)', 8, 66, 2], ['fossa', 'EAR-04 fosse triangulaire', 8, 88, 3], ['crus', 'crus de l’hélix', 8, 110, 4], ['cymba', 'EAR-05A cymba', 8, 132, 5], ['cavum', 'EAR-05B cavum', 8, 154, 6], ['canal', 'EAR-05F conduit', 8, 176, 7], ['tragus', 'EAR-06 tragus', 8, h - 70, 8], ['antitragus', 'EAR-06 antitragus', 8, h - 48, 9], ['lobule', 'EAR-07 lobule', 8, h - 26, 10]].map((a) => lab(a[0] as string, a[1] as string, a[2] as number, a[3] as number, a[4] as number)).join('');
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${out}</svg>`;
}
const withOverlay = (base: string, ov: string): string => base.replace(/<\/svg>\s*$/, ov.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '') + '</svg>');

const BOARDS: Record<string, () => void> = {
  '01-quatre-vues-meme-modele': () => {
    const p = S();
    const lm = faceLandmarks(p, 300, 400);
    const e = earGeometry(p, lm)[1]!;
    const W = 400, H = 560;
    const cells = (['face', 'three-quarter', 'profile', 'close-up'] as ViewName[]).map((v) => {
      const base = earSvg(p, v, W, H);
      const pe = projectEar(e.model!, e.placement!, VIEW_YAW[v], v);
      const c = { x: (pe.bbox.x0 + pe.bbox.x1) / 2, y: (pe.bbox.y0 + pe.bbox.y1) / 2 };
      const k = (H * 0.78) / e.placement!.hPx;
      const Y = (y: number): number => H / 2 + (y - c.y) * k;
      // Lignes horizontales de repère : MÊMES ordonnées dans les quatre vues (invariant de projection).
      const ys = [['sommet', pe.landmarks.top!.y, '#ffd93d'], ['racine hélix', pe.landmarks.crus!.y, '#4d96ff'], ['bas lobule', pe.landmarks.lobuleBottom!.y, '#6bcb77']] as const;
      const ov = ys.map(([n, y, col]) => `<line x1="0" y1="${Y(y).toFixed(1)}" x2="${W}" y2="${Y(y).toFixed(1)}" stroke="${col}" stroke-width="1.2" stroke-dasharray="6 4"/><text x="6" y="${(Y(y) - 4).toFixed(1)}" fill="${col}" font-size="12" font-family="DejaVu Sans" font-weight="bold" stroke="#000" stroke-width="0.4" paint-order="stroke">${n} y=${y.toFixed(2)}</text>`).join('');
      return { png: png(withOverlay(base, `<svg>${ov}</svg>`)), label: `${v} — lacet ${VIEW_YAW[v]}°` };
    });
    save('01-quatre-vues-meme-modele', 'Une oreille, quatre vues : face · trois-quarts · profil · gros plan éclairé (mêmes ordonnées de repères)', cells, 4, W, H);
  },
  '02-anatomie-atomique': () => {
    const p = S();
    const W = 520, H = 700;
    const base = earSvg(p, 'profile', W, H, { zoom: 1.0 });
    save('02-anatomie-atomique', 'Anatomie atomique : structures exposées par la géométrie (profil)', [
      { png: png(base), label: 'rendu' },
      { png: png(withOverlay(base, overlayView(p, 'profile', W, H, true))), label: 'structures EAR-01 … EAR-07, 02A–E, 05A–F' },
    ], 2, W, H);
  },
  '03-contour-sept-segments': () => {
    const p = S();
    const lm = faceLandmarks(p, 300, 400);
    const e = earGeometry(p, lm)[1]!;
    const m = e.model!;
    const W = 520, H = 700;
    const cols = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c77dff', '#ff9f1c', '#2ec4b6'];
    const pe = projectEar(m, e.placement!, 90, 'profile');
    const c = { x: (pe.bbox.x0 + pe.bbox.x1) / 2, y: (pe.bbox.y0 + pe.bbox.y1) / 2 };
    const k = (H * 0.78) / e.placement!.hPx;
    const X = (q: Vec): string => `${(W / 2 + (q.x - c.x) * k).toFixed(1)},${(H / 2 + (q.y - c.y) * k).toFixed(1)}`;
    const segs = m.segments.map((s, i) => { const pts: Vec[] = []; for (let j = s.from; j <= s.to; j++) pts.push(pe.plate[j % pe.plate.length]!); return `<polyline points="${pts.map(X).join(' ')}" fill="none" stroke="${cols[i]}" stroke-width="5" stroke-linecap="round"/><text x="${W - 8}" y="${24 + i * 22}" text-anchor="end" fill="${cols[i]}" font-size="13" font-weight="bold" font-family="DejaVu Sans" stroke="#000" stroke-width="0.4" paint-order="stroke">${s.id} ${esc(s.label)}</text>`; }).join('');
    const base = earSvg(p, 'profile', W, H);
    save('03-contour-sept-segments', 'Le contour n’est pas une ligne : sept segments C01–C07 contrôlables', [{ png: png(withOverlay(base, `<svg>${segs}</svg>`)), label: 'C01 pôle · C02 postérieur · C03 inférieur/lobule · C04 antérieur · C05 tragus · C06 oreille-joue · C07 oreille-crâne' }], 1, W, H);
  },
  '04-familles-et-hybrides': () => {
    const fam = ['human', 'feline', 'canid', 'equid', 'elven', 'draconic', 'alien'] as const;
    const W = 300, H = 420;
    const cells: { png: Buffer; label: string }[] = fam.map((f) => ({ png: png(earSvg(S({ ears: { family: f, extensions: f === 'draconic' ? [{ kind: 'membrane_panel', at: 0.5, length: 0.7 }, { kind: 'ornamental_growth', at: 0.35, length: 0.6 }] : f === 'alien' ? [{ kind: 'bioluminescent_channel' }, { kind: 'branching_ridge' }] : [] } }), 'profile', W, H, { zoom: 0.8 })), label: f }));
    const hyb: [string, object][] = [['humain 50 % elfe', { family: 'human', blend: { elven: 0.5 } }], ['félin 60 % draconique', { family: 'feline', blend: { draconic: 0.6 } }], ['elfe 40 % équidé', { family: 'elven', blend: { equid: 0.4 } }]];
    for (const [l, ears] of hyb) cells.push({ png: png(earSvg(S({ ears }), 'profile', W, H, { zoom: 0.8 })), label: `hybride : ${l}` });
    save('04-familles-et-hybrides', 'Sept familles (préréglages, pas des lois) et trois hybrides par mélange de familles', cells, 5, W, H);
  },
  '05-axes-morphologiques': () => {
    const axes: [string, string, string][] = [['pole', 'height', 'pôle : hauteur'], ['pole', 'round', 'pôle : rondeur'], ['posterior', 'convexity', 'bord postérieur : convexité'], ['lobule', 'length', 'lobule : longueur'], ['lobule', 'attach', 'lobule : attache'], ['helix', 'thickness', 'hélix : épaisseur'], ['antihelix', 'relief', 'anthélix : relief'], ['antihelix', 'branchAngle', 'anthélix : écart des branches'], ['concha', 'depth', 'conque : profondeur'], ['scapha', 'width', 'scapha : largeur'], ['tragus', 'projection', 'tragus : projection'], ['notch', 'depth', 'incisure : profondeur']];
    const W = 240, H = 330;
    const cells = axes.flatMap(([g, k, l]) => [-1, 1].map((v) => ({ png: png(earSvg(S({ ears: { morph: { [g]: { [k]: v } } } }), 'profile', W, H, { zoom: 0.85 })), label: `${l} ${v < 0 ? '−1' : '+1'}` })));
    save('05-axes-morphologiques', 'Axes morphologiques indépendants : chacun à son minimum puis à son maximum', cells, 6, W, H);
  },
  '06-styles-et-materiaux': () => {
    const W = 260, H = 360;
    const kinds = ['skin', 'cartilage', 'scaly', 'membrane', 'ceramic', 'crystal', 'hybrid'] as const;
    const cells = [
      ...kinds.map((kd) => ({ png: png(earSvg(S({ ears: { material: { kind: kd, glow: kd === 'crystal' ? 0.5 : 0 } } }), 'close-up', W, H, { zoom: 0.85 })), label: `réaliste · ${kd}` })),
      ...kinds.map((kd) => ({ png: png(earSvg(S({ ears: { style: { look: 'anime', angularity: 0.3, softness: 0.2 }, material: { kind: kd } } }), 'profile', W, H, { zoom: 0.85 })), label: `anime · ${kd}` })),
    ];
    save('06-styles-et-materiaux', 'Matériaux et styles : la géométrie est inchangée, seuls matériau et rendu varient', cells, 7, W, H);
  },
  '07-eclairage-gros-plan': () => {
    const W = 340, H = 460;
    const p = S();
    const az: [number, number, string][] = [[300, 32, 'haut-gauche rasante'], [60, 32, 'haut-droite rasante'], [0, 70, 'zénithale'], [180, 25, 'sous l’oreille']];
    const cells = az.map(([a, el, l]) => ({ png: png(earSvg(p, 'close-up', W, H, { light: lightVector({ azimuthDeg: a, elevationDeg: el, color: '#ffffff', intensity: 1 }) })), label: `gros plan · ${l}` }));
    save('07-eclairage-gros-plan', 'Gros plan éclairé : reliefs, creux, transitions et ombres selon la direction de la lumière', cells, 4, W, H);
  },
  '08-alignement-sur-le-visage': () => {
    const W = 460, H = 620;
    const ov = (m: CellMeta): string => {
      const lm = m.lm;
      const e = earGeometry(m.params, lm);
      const Y = (y: number): number => m.px(0, y)[1];
      const row = (y: number, label: string, col: string): string => `<line x1="0" y1="${Y(y).toFixed(1)}" x2="${m.w}" y2="${Y(y).toFixed(1)}" stroke="${col}" stroke-width="1.3" stroke-dasharray="7 4"/><text x="6" y="${(Y(y) - 4).toFixed(1)}" fill="${col}" font-size="12" font-weight="bold" font-family="DejaVu Sans" stroke="#000" stroke-width="0.4" paint-order="stroke">${label}</text>`;
      const ear = e.map((q) => `<polygon points="${q.poly.map((v) => m.px(v.x, v.y).map((n) => n.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="#fff" stroke-width="1" stroke-opacity="0.5"/>`).join('');
      const marks = e.map((q) => { const t = q.placement!.topY; const cr = t + q.model!.landmarks.crus!.y * q.placement!.hPx; const bo = t + q.placement!.hPx; return [t, cr, bo].map((y, i) => `<circle cx="${m.px(q.side * (q.front!.bbox.x1 > 0 ? q.front!.bbox.x1 : -q.front!.bbox.x0), y)[0].toFixed(1)}" cy="${Y(y).toFixed(1)}" r="4" fill="${['#ffd93d', '#4d96ff', '#6bcb77'][i]}" stroke="#000"/>`).join(''); }).join('');
      return ear + row(lm.eyeY, 'ligne des yeux = racine de l’hélix (fosse triangulaire)', '#4d96ff') + row(lm.mouthY, 'ligne de la bouche = bas du lobule', '#6bcb77') + row(e[0]!.placement!.topY, 'sommet de l’hélix', '#ffd93d') + marks;
    };
    const mk = (label: string, patch: object, seed = 321) => ({ ...cell({ seed, patch: { anatomyEngine: 'structured', ...patch } as never, overlay: ov }, W, H), label });
    save('08-alignement-sur-le-visage', 'Oreille alignée sur les repères du visage : racine de l’hélix sur les yeux, lobule sur la ligne de la bouche', [mk('visage 321', {}), mk('visage 77', {}, 77), mk('visage 1234 (yeux hauts)', { eyeLine: 0.42 }, 1234)], 3, W, H);
  },
  '09-zones-du-visage': () => {
    const W = 420, H = 560;
    const cols = ['#9e9e9e', '#ffd93d', '#4d96ff', '#6bcb77', '#f72585', '#ff9f1c', '#c77dff'];
    const ov = (m: CellMeta): string => {
      const z = faceZones(m.params, m.lm);
      const Y = (y: number): number => m.px(0, y)[1];
      const bands = z.bands.map((b, i) => `<rect x="${(W - 34).toFixed(0)}" y="${Y(b.topY).toFixed(1)}" width="30" height="${(Y(b.bottomY) - Y(b.topY)).toFixed(1)}" fill="${cols[i]}" fill-opacity="0.45" stroke="${cols[i]}"/><text x="${W - 40}" y="${((Y(b.topY) + Y(b.bottomY)) / 2 + 4).toFixed(1)}" text-anchor="end" fill="${cols[i]}" font-size="12" font-weight="bold" font-family="DejaVu Sans" stroke="#000" stroke-width="0.4" paint-order="stroke">${esc(b.label)} ${(b.share * 100).toFixed(1)} %</text>`).join('');
      const hair = line(m, z.hair.line, '#ff4d4d', 3) + line(m, z.hair.crownArc, '#ffffff', 1.5, '5 4') + `<circle cx="${m.px(z.hair.temple.x, z.hair.temple.y)[0].toFixed(1)}" cy="${m.px(z.hair.temple.x, z.hair.temple.y)[1].toFixed(1)}" r="5" fill="#ff4d4d" stroke="#000"/><circle cx="${m.px(-z.hair.temple.x, z.hair.temple.y)[0].toFixed(1)}" cy="${m.px(-z.hair.temple.x, z.hair.temple.y)[1].toFixed(1)}" r="5" fill="#ff4d4d" stroke="#000"/>`;
      return bands + hair + note(10, 18, 'rouge : implantation · tirets : arc du crâne', '#ffffff') + note(10, 34, 'points rouges : tempes', '#ffffff');
    };
    const mk = (label: string, patch: object, seed = 321) => ({ ...cell({ seed, patch: { anatomyEngine: 'structured', ...patch } as never, overlay: ov }, W, H), label });
    save('09-zones-du-visage', 'Sept zones verticales (hauteur / H) et frontière d’implantation : sommet du crâne → tempe → front', [mk('défaut', {}), mk('implantation abaissée (hairline 1)', { hair: { hairline: 1 } }), mk('yeux bas (eyeLine 0,56)', { eyeLine: 0.56 })], 3, W, H);
  },
  '10-nez-philtrum-menton-avant-apres': () => {
    const W = 300, H = 420;
    const cases: [string, object][] = [['nez court 0,08', { nose: { length: 0.08 } }], ['bouche basse 0,9', { mouth: { y: 0.9 } }], ['nez long + bouche haute', { nose: { length: 0.24 }, mouth: { y: 0.72 } }]];
    const ovZ = (m: CellMeta): string => { const z = faceZones(m.params, m.lm); const Y = (y: number): number => m.px(0, y)[1]; return z.bands.filter((b) => ['nose', 'philtrum', 'chin'].includes(b.id)).map((b) => `<text x="8" y="${((Y(b.topY) + Y(b.bottomY)) / 2 + 4).toFixed(1)}" fill="#ffd93d" font-size="12" font-weight="bold" font-family="DejaVu Sans" stroke="#000" stroke-width="0.4" paint-order="stroke">${b.label} ${(b.share * 100).toFixed(1)} %</text><line x1="0" y1="${Y(b.topY).toFixed(1)}" x2="${m.w}" y2="${Y(b.topY).toFixed(1)}" stroke="#ffd93d" stroke-opacity="0.5" stroke-dasharray="4 4"/>`).join(''); };
    const cells = cases.flatMap(([l, patch]) => [
      { ...cell({ seed: 321, patch: { anatomyEngine: 'classic', ...patch } as never, overlay: ovZ }, W, H), label: `AVANT — ${l}` },
      { ...cell({ seed: 321, patch: { anatomyEngine: 'structured', ...patch } as never, overlay: ovZ }, W, H), label: `APRÈS — ${l}` },
    ]);
    save('10-nez-philtrum-menton-avant-apres', 'Nez abaissé, philtrum raccourci, menton défini : avant / après sur des cas extrêmes', cells, 6, W, H);
  },
  '12-extensions': () => {
    const kinds = ['terminal_tip', 'secondary_ridge', 'branching_ridge', 'membrane_panel', 'ornamental_growth', 'bioluminescent_channel'];
    const cells = kinds.map((k) => ({ png: png(earSvg(S({ ears: { family: 'alien', extensions: [{ kind: k, at: 0.4, length: 0.8, intensity: 1 }] } }), 'profile', 260, 360, { zoom: 0.85 })), label: k }));
    save('12-extensions', 'EAR-08 extensions : chacune ajoutée seule au noyau (famille extraterrestre)', cells, 6, 260, 360);
  },
  '11-bijoux-et-cheveux': () => {
    const W = 340, H = 480;
    const pierc = [{ kind: 'ear_lobe_piercing', jewel: 'drop', hang: 0.8, size: 0.09 }, { kind: 'helix_piercing', jewel: 'ring', size: 0.07 }, { kind: 'tragus_piercing', jewel: 'stud', size: 0.05 }, { kind: 'conch_piercing', jewel: 'stud', size: 0.05 }, { kind: 'industrial_piercing', jewel: 'chain', size: 0.05 }];
    const cells = [
      { png: png(earSvg(S({ ears: { piercings: pierc } }), 'profile', W, H)), label: 'cinq points d’attache (profil)' },
      { png: png(earSvg(S({ ears: { piercings: pierc, attach: { openingDeg: 40, rotationDeg: 12 } } }), 'profile', W, H)), label: 'angle et rotation changés : les bijoux suivent' },
      ...[['bald', 'oreille visible'], ['short', 'coiffure courte'], ['long', 'cheveux longs'], ['braids', 'tresses']].map(([style, l]) => ({ ...cell({ seed: 321, patch: { anatomyEngine: 'structured', hair: { style }, ears: { piercings: pierc.slice(0, 2) } } as never, opts: { hairEngine: 'classic' } as never }, W, H), label: `visage — ${l}` })),
    ];
    save('11-bijoux-et-cheveux', 'Bijoux sur points d’attache dédiés ; géométrie conservée sous les cheveux', cells, 3, W, H);
  },
};

const want = process.argv.slice(2);
for (const [name, fn] of Object.entries(BOARDS)) if (want.length === 0 || want.some((w) => name.startsWith(w))) fn();

// Rapport de vérification (trois couches) sur des visages représentatifs.
if (want.length === 0) {
  const lines: string[] = ['# Rapport de vérification — oreilles et zones', '', '| cas | contrôles | erreurs | avertissements |', '|---|---|---|---|'];
  const cases: [string, FaceParams][] = [['défaut', S()], ...(['feline', 'canid', 'equid', 'elven', 'draconic', 'alien'] as const).map((f): [string, FaceParams] => [`famille ${f}`, S({ ears: { family: f } })]), ['anime', S({ ears: { style: { look: 'anime' } } })], ['nez court', S({ nose: { length: 0.08 } })], ['bouche basse', S({ mouth: { y: 0.9 } })]];
  for (const [n, p] of cases) { const lm = faceLandmarks(p, 300, 400); const c = [...checkEars(p, lm, SKIN), ...checkZones(p, lm)]; lines.push(`| ${n} | ${c.length} | ${c.filter((x) => !x.ok && x.severity === 'error').length} | ${c.filter((x) => !x.ok && x.severity === 'warn').length} |`); }
  writeFileSync(`${OUT}/verification.md`, lines.join('\n') + '\n');
  void resolveAppearance; void tag; void polyO;
}

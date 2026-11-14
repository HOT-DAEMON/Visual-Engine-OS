import type { EyeInput } from './random-eye-helpers';

/**
 * LOOKS tirés des références (references/eyes) — construits UNIQUEMENT avec les paramètres existants de l'œil (`sclera`, `skin`, `lids`, `iris.layers/aspect`, `pupil`,
 * `highlights.list`) ; aucun moteur par référence. Chaque constante porte sa provenance :
 *  - `natural` : palette de sclère (3 bandes haut / milieu / bas) et peau périoculaire MESURÉES sur les photos 04, 07, 10a, 10b, 11 (references/eyes/measures.json),
 *    épaisseur du trait de paupière haute MESURÉE (fraction de la largeur de l'ouverture : 0,0061 pour 04, 0,0084 pour 10a ; 07 et 10b : < 1 px).
 *    Exposition normalisée : la sclère photographiée est ombrée (5ᵉ centile 60–73) alors que le moteur ombre déjà sous la paupière ; on garde la TEINTE et le rapport
 *    d'ombrage haut / bas mesurés, on remet le milieu à 0,93 de luminance (`normaliseSclera`).
 *  - `sprite-tall` : iris ovale haut (aspect 1,49) et pupille ovale, dégradé haut sombre -> bas clair, gros reflet haut-droite + petit reflet bas-gauche MESURÉS
 *    sur les sprites 15 rangées 1–2 (references/eyes/measures-sprites.json ; rangées 3–5 : ajustement du limbe échoué -> non consommées).
 *  - `ink` : yeux manga au trait des réfs 13 et 17 : sclère blanche, iris gris dégradé, pupille noire, gros trait de paupière, reflets en lentille. Les silhouettes
 *    sont MESURÉES ; les teintes grises et la forme des reflets sont une INTERPRÉTATION (non mesurée).
 */
export type EyeLook = 'natural' | 'ink' | 'sprite-tall' | 'graphic';

export const REF_NATURAL = [
  { id: '04', top: '#5b6a84', mid: '#8a92a6', bottom: '#b4afc1', skin: '#a7807a' },
  { id: '10a', top: '#8a7283', mid: '#baa1a1', bottom: '#cbb5b4', skin: '#b69794' },
  { id: '10b', top: '#665e78', mid: '#b0a3a9', bottom: '#a0848c', skin: '#9f8b8c' },
  { id: '07', top: '#685a56', mid: '#bbb1b1', bottom: '#e8e5e3', skin: '#aca199' },
  { id: '11', top: '#9b8e8f', mid: '#b9bbb3', bottom: '#b1b3ab', skin: '#b47b71' },
] as const;
/** Épaisseur du trait de paupière haute / largeur de l'ouverture : plage des deux photos où elle est mesurable (04, 10a). */
export const LID_LINE_OVER_WIDTH = [0.0061, 0.0084] as const;
/** Diamètre vertical de l'iris / hauteur d'ouverture des sprites 15 (rangées 1–2, mesuré 0,859–0,897 ; photos : 0,98–1,08). */
export const SPRITE_IRIS_OVER_HEIGHT = 0.88;
export const SPRITE_TALL = [
  { id: '15-row1', irisAspect: 1.49, pupil: 0.67, top: '#29374e', bottom: '#49636e' },
  { id: '15-row2', irisAspect: 1.49, pupil: 0.47, top: '#407986', bottom: '#4b8282' },
] as const;
/** Reflets des sprites 15 (rangée 2, mesurés) : x, y en fraction du rayon horizontal de l'iris (y < 0 = haut), taille = rayon / rayon de l'iris. */
export const SPRITE_HIGHLIGHTS = { primary: { x: 0.1, y: -0.26, size: 0.27 }, secondary: { x: -0.43, y: 0.35, size: 0.15 }, tertiary: { x: 0.27, y: -0.62, size: 0.11 } } as const;

const hex2 = (n: number): string => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
const rgb = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
const lum = (h: string): number => { const [r, g, b] = rgb(h); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
/** Remet l'exposition de la bande du milieu à `target` (0..1) en gardant teinte et rapports haut / milieu / bas. */
export function normaliseSclera(p: { top: string; mid: string; bottom: string }, target = 0.93, floor = 0.72): [string, string, string] {
  const f = (target * 255) / lum(p.mid);
  const lift = (c: string): string => {
    const v = rgb(c).map((x) => Math.min(255, x * f)); const l = 0.2126 * v[0]! + 0.7152 * v[1]! + 0.0722 * v[2]!; const min = floor * 255;
    const k = l < min ? (min - l) / (255 - l) : 0; // le moteur ombre déjà sous la paupière : l'ombre mesurée est bornée à (1 − floor) de luminance
    return `#${v.map((x) => hex2(x + (255 - x) * k)).join('')}`;
  };
  return [lift(p.top), lift(p.mid), lift(p.bottom)];
}

type Mut = Record<string, unknown>;
const solid = (color: string): Mut => ({ base: { type: 'solid', color } });
/** Applique `look` à un œil déjà construit. `aspect` = hauteur nominale / largeur de l'enveloppe (pour convertir l'épaisseur du trait en fraction de la hauteur). */
export function applyLook(eye: EyeInput, look: EyeLook, rnd: () => number, aspect: number): EyeInput {
  const e = eye as unknown as Mut & { iris: Mut; pupil: Mut; lids?: Mut };
  if (look === 'graphic') return eye;
  if (look === 'natural') {
    const p = REF_NATURAL[Math.floor(rnd() * REF_NATURAL.length)]!; const [t, m, b] = normaliseSclera(p);
    const over = LID_LINE_OVER_WIDTH[0] + rnd() * (LID_LINE_OVER_WIDTH[1] - LID_LINE_OVER_WIDTH[0]);
    return { ...e, sclera: { base: { type: 'linear', angleDeg: 0, stops: [{ offset: 0, color: t }, { offset: 0.5, color: m }, { offset: 1, color: b }] } }, skin: solid(p.skin), lids: { ...(e.lids ?? {}), thickness: Math.max(0.01, over / aspect) } } as unknown as EyeInput;
  }
  const hl = (x: number, y: number, size: number, o: Mut = {}): Mut => ({ kind: 'graphic', shape: 'circle', anchor: 'iris', x, y, size, confine: 'iris', ...o });
  if (look === 'sprite-tall') {
    const s = SPRITE_TALL[Math.floor(rnd() * SPRITE_TALL.length)]!; const h = SPRITE_HIGHLIGHTS;
    return { ...e, sclera: solid('#ffffff'), iris: { ...e.iris, aspect: s.irisAspect, layers: [{ color: s.top, color2: s.bottom, gradient: 'angular', angleDeg: 0, opacity: 1 }], detail: { bubbles: { count: 6, size: 0.06, opacity: 0.7 } } }, pupil: { ...e.pupil, shape: 'round', size: s.pupil },
      highlights: { list: [hl(h.primary.x, h.primary.y, h.primary.size), hl(h.secondary.x, h.secondary.y, h.secondary.size), hl(h.tertiary.x, h.tertiary.y, h.tertiary.size, { opacity: 0.8 })] } } as unknown as EyeInput;
  }
  // ink : encre (interprétation des réfs 13 / 17)
  return { ...e, sclera: solid('#ffffff'), lids: { ...(e.lids ?? {}), thickness: 0.13, wing: 0.9 }, iris: { ...e.iris, layers: [{ color: '#1c1c1c', color2: '#a6a6a6', gradient: 'radial', opacity: 1 }] }, pupil: { ...e.pupil, shape: 'round', size: 0.42, fill: { type: 'solid', color: '#050505' } },
    highlights: { list: [hl(-0.3, -0.38, 0.36, { shape: 'ellipse', aspect: 0.45, rotationDeg: -20 }), hl(0.38, 0.34, 0.22, { shape: 'ellipse', aspect: 0.4, rotationDeg: -15 })] } } as unknown as EyeInput;
}
export const lookForRef = (id: string | undefined, rnd: () => number): EyeLook => (!id ? (rnd() < 0.4 ? 'natural' : 'graphic') : id === '15-A' || id === '15-B' ? 'sprite-tall' : id.startsWith('15-') ? 'graphic' : 'ink');

import { el, num, urlRef } from '../core/svg';
import type { Appearance } from '../schema/appearance';
import type { ResolvedAppearance } from './resolve';

/** Zone du filtre (repère utilisateur de l'objet) : assez large pour contenir un halo, jamais infinie. */
export interface FilterBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface EffectResult {
  /** `<filter>` à placer dans `<defs>` ; vide si aucun effet n'est actif. */
  readonly defs: string[];
  /** Valeur de l'attribut `filter` (`url(#id)`) ou `undefined` : rien à appliquer. */
  readonly filter: string | undefined;
}

/**
 * Débordement MAXIMAL (px) que les effets actifs peuvent ajouter autour de la silhouette de la source : halo du glow et du bloom
 * (flou gaussien : BLUR_REACH·σ), amplitude du déplacement de la réfraction. Sert à donner au filtre une région SERRÉE
 * (silhouette + débordement) au lieu d'une région large : le coût de rastérisation est proportionnel à l'aire de la région.
 */
export function effectsReach(a: Appearance, scale = 1): number {
  let r = 0;
  if (a.glow.intensity > MIN) r = Math.max(r, 3.5 * (2 + 14 * a.glow.radius) * scale);
  if (a.bloom.intensity > MIN) r = Math.max(r, 3.5 * (3 + 12 * a.bloom.radius) * scale);
  if (a.refraction.strength > MIN) r = Math.max(r, a.refraction.strength * 14 * scale);
  return Math.ceil(r) + 2;
}

const NONE: EffectResult = { defs: [], filter: undefined };

/** Un effet est actif dès que son intensité dépasse ce seuil (évite les filtres coûteux pour rien). */
const MIN = 0.02;

/**
 * Compile les effets de l'apparence en UN SEUL filtre SVG, chaînés dans cet ordre :
 *  1. réfraction  (feTurbulence → feDisplacementMap : déforme légèrement ce qui est derrière le matériau) ;
 *  2. grain       (feTurbulence fractal, découpé par l'alpha de la source) ;
 *  3. glow        (halo de la silhouette, teinte `glow.color`) ;
 *  4. bloom       (halo des seules zones claires : luminance au-dessus du seuil) ;
 *  5. émission    (voile de la couleur d'émission, découpé par l'alpha).
 * Chaque primitive est « inerte » (liste blanche de `core/svg.ts`) : aucune ressource externe.
 */
export function compileEffects(id: string, a: Appearance, ra: ResolvedAppearance, box: FilterBox, scale = 1): EffectResult {
  const steps: string[] = [];
  let last = 'SourceGraphic';
  // Chaque primitive empilée DOIT porter son `result` : la suivante la lit par ce nom (un nom sans primitive correspondante donne un résultat vide,
  // donc une forme noire ou transparente dès que deux effets s'enchaînent).
  const push = (node: string, result: string): void => {
    steps.push(node);
    last = result;
  };

  if (a.refraction.strength > MIN) {
    const f = 0.01 + 0.06 * (1 - a.refraction.scale);
    steps.push(el('feTurbulence', { type: 'fractalNoise', baseFrequency: f / scale, numOctaves: 2, seed: 7, result: 'rn' }));
    push(el('feDisplacementMap', { in: last, in2: 'rn', scale: a.refraction.strength * 14 * scale, xChannelSelector: 'R', yChannelSelector: 'G', result: 'rf' }), 'rf');
  }
  if (a.texture.kind !== 'none' && a.texture.intensity > MIN) {
    // Les 4 textures partagent le même bruit ; seule la fréquence/anisotropie change (traits, points, hachures).
    const k = 0.35 + 1.4 * a.texture.scale;
    const freq: Record<string, string> = { grain: `${k} ${k}`, strands: `${k * 0.15} ${k * 1.6}`, dots: `${k * 0.7} ${k * 0.7}`, hatch: `${k * 1.5} ${k * 0.1}` };
    steps.push(el('feTurbulence', { type: 'fractalNoise', baseFrequency: (freq[a.texture.kind] as string).split(' ').map((v) => Number(v) / scale).join(' '), numOctaves: 2, seed: 11, result: 'tn' }));
    steps.push(el('feColorMatrix', { in: 'tn', type: 'matrix', values: `0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${num(-2.2)} ${num(1.25)}`, result: 'tm' }));
    steps.push(el('feComposite', { in: 'tm', in2: 'SourceAlpha', operator: 'in', result: 'tc' }));
    steps.push(el('feColorMatrix', { in: 'tc', type: 'matrix', values: `0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${num(a.texture.intensity * 0.5)} 0`, result: 'tx' }));
    push(el('feMerge', { result: 'tg' }, [el('feMergeNode', { in: last }), el('feMergeNode', { in: 'tx' })]), 'tg');
  }
  if (a.glow.intensity > MIN) {
    const col = a.glow.color ?? ra.light;
    steps.push(el('feFlood', { 'flood-color': col, 'flood-opacity': a.glow.intensity, result: 'gf' }));
    steps.push(el('feComposite', { in: 'gf', in2: 'SourceAlpha', operator: 'in', result: 'gc' }));
    steps.push(el('feGaussianBlur', { in: 'gc', stdDeviation: (2 + 14 * a.glow.radius) * scale, result: 'gb' }));
    push(el('feMerge', { result: 'gm' }, [el('feMergeNode', { in: 'gb' }), el('feMergeNode', { in: last })]), 'gm');
  }
  if (a.bloom.intensity > MIN) {
    // Alpha = (luminance − seuil) × gain : seules les zones claires alimentent le halo.
    const gain = 3 + 6 * a.bloom.intensity;
    steps.push(el('feColorMatrix', { in: last, type: 'matrix', values: `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  ${num(0.2126 * gain)} ${num(0.7152 * gain)} ${num(0.0722 * gain)} 0 ${num(-a.bloom.threshold * gain)}`, result: 'bb' }));
    // Le halo ne naît que des pixels PRÉSENTS : l'alpha issu de la luminance est borné par l'alpha d'entrée (`in`). Sans cela, avec un glow actif
    // (pixels de halo clairs et translucides autour de la forme), la matrice rend ces pixels opaques et un voile blanc recouvre toute la forme.
    steps.push(el('feComposite', { in: 'bb', in2: last, operator: 'in', result: 'bi' }));
    steps.push(el('feGaussianBlur', { in: 'bi', stdDeviation: (3 + 12 * a.bloom.radius) * scale, result: 'bg' }));
    push(el('feMerge', { result: 'bm' }, [el('feMergeNode', { in: last }), el('feMergeNode', { in: 'bg' })]), 'bm');
  }
  if (a.emission.intensity > MIN) {
    steps.push(el('feFlood', { 'flood-color': a.emission.color ?? ra.light, 'flood-opacity': a.emission.intensity * 0.45, result: 'ef' }));
    steps.push(el('feComposite', { in: 'ef', in2: 'SourceAlpha', operator: 'in', result: 'ec' }));
    push(el('feMerge', { result: 'em' }, [el('feMergeNode', { in: last }), el('feMergeNode', { in: 'ec' })]), 'em');
  }
  if (steps.length === 0) return NONE;
  const fid = `${id}-fx`;
  const node = el('filter', { id: fid, filterUnits: 'userSpaceOnUse', x: box.x, y: box.y, width: box.w, height: box.h, 'color-interpolation-filters': 'sRGB' }, steps);
  return { defs: [node], filter: urlRef(fid) };
}

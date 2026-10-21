/**
 * Constructeur SVG à liste blanche.
 *
 * Sécurité : un SVG peut embarquer du script. Le moteur n'émet QUE les éléments
 * et attributs listés ici, construits depuis un JSON déjà validé. Toute autre
 * valeur lève une erreur : rien n'est « laissé passer » silencieusement.
 */
export type AttrValue = string | number | undefined;
export type Attrs = Record<string, AttrValue>;

const ELEMENTS: ReadonlySet<string> = new Set([
  'svg', 'defs', 'g', 'path', 'ellipse', 'circle', 'rect', 'clipPath',
  'linearGradient', 'radialGradient', 'stop', 'filter', 'feGaussianBlur',
  // Primitives de filtre inertes (aucune ne charge de ressource ni n'exécute de code) : glow, bloom, réfraction, grain.
  'feColorMatrix', 'feComponentTransfer', 'feFuncA', 'feFuncR', 'feFuncG', 'feFuncB', 'feMerge', 'feMergeNode', 'feOffset', 'feComposite', 'feFlood', 'feTurbulence', 'feDisplacementMap',
]);

const ATTRIBUTES: ReadonlySet<string> = new Set([
  'xmlns', 'viewBox', 'width', 'height', 'role', 'aria-label', 'id',
  'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'fx', 'fy',
  'fill', 'fill-opacity', 'fill-rule',
  'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-opacity',
  'opacity', 'transform', 'clip-path', 'clip-rule', 'filter',
  'gradientUnits', 'offset', 'stop-color', 'stop-opacity', 'stdDeviation',
  'in', 'in2', 'result', 'operator', 'values', 'tableValues', 'type', 'slope', 'intercept', 'dx', 'dy', 'flood-color', 'flood-opacity',
  'k1', 'k2', 'k3', 'k4', 'baseFrequency', 'numOctaves', 'seed', 'scale', 'xChannelSelector', 'yChannelSelector',
  'filterUnits', 'color-interpolation-filters',
]);

const ID_RE = /^[A-Za-z][A-Za-z0-9_-]*$/;

/** Formate un nombre de façon déterministe (3 décimales max, pas de -0, pas de NaN/Infinity). */
export function num(v: number): string {
  if (!Number.isFinite(v) || Math.abs(v) > 1e9) {
    throw new RangeError(`Nombre SVG invalide : ${String(v)}`);
  }
  return String(Number(v.toFixed(3)));
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function idOf(id: string): string {
  if (!ID_RE.test(id)) throw new Error(`Identifiant SVG invalide : ${id}`);
  return id;
}

export function urlRef(id: string): string {
  return `url(#${idOf(id)})`;
}

export function el(name: string, attrs: Attrs = {}, children: readonly string[] = []): string {
  if (!ELEMENTS.has(name)) throw new Error(`Élément SVG non autorisé : ${name}`);
  let out = `<${name}`;
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined) continue;
    if (!ATTRIBUTES.has(key)) throw new Error(`Attribut SVG non autorisé : ${key}`);
    if (key === 'id') idOf(String(value));
    out += ` ${key}="${typeof value === 'number' ? num(value) : escapeXml(value)}"`;
  }
  return children.length === 0 ? `${out}/>` : `${out}>${children.join('')}</${name}>`;
}

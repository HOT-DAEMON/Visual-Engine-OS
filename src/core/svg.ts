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
  // Tuile de bruit pré-calculée : `feImage` ne charge QUE un data-URI PNG base64 (vérifié dans `el`), jamais d'URL ; `feTile` la répète.
  'feImage', 'feTile',
  // Éclairage de relief (oreille) : carte de hauteur = canal alpha ; sources distantes uniquement, aucune ressource externe.
  'feDiffuseLighting', 'feSpecularLighting', 'feDistantLight',
]);

const ATTRIBUTES: ReadonlySet<string> = new Set([
  'xmlns', 'viewBox', 'width', 'height', 'role', 'aria-label', 'id',
  'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'fx', 'fy',
  'fill', 'fill-opacity', 'fill-rule',
  'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-opacity', 'stroke-dasharray',
  'opacity', 'transform', 'clip-path', 'clip-rule', 'filter',
  'gradientUnits', 'offset', 'stop-color', 'stop-opacity', 'stdDeviation',
  'in', 'in2', 'result', 'operator', 'values', 'tableValues', 'type', 'slope', 'intercept', 'dx', 'dy', 'flood-color', 'flood-opacity',
  'k1', 'k2', 'k3', 'k4', 'baseFrequency', 'numOctaves', 'seed', 'scale', 'xChannelSelector', 'yChannelSelector',
  'filterUnits', 'color-interpolation-filters', 'href', 'preserveAspectRatio',
  'surfaceScale', 'diffuseConstant', 'specularConstant', 'specularExponent', 'azimuth', 'elevation', 'lighting-color',
]);

/** Seule ressource embarquée admise : PNG en base64, alphabet strict (aucun guillemet, aucune URL, aucun schéma autre). */
const DATA_PNG_RE = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;
const ID_RE = /^[A-Za-z][A-Za-z0-9_-]*$/;

/** Formate un nombre de façon déterministe (3 décimales max, pas de -0, pas de NaN/Infinity). */
export function num(v: number): string {
  if (!Number.isFinite(v) || Math.abs(v) > 1e9) {
    throw new RangeError(`Nombre SVG invalide : ${String(v)}`);
  }
  // Chemin rapide EXACT : loin d'une demi-unité de la 3e décimale, Math.round et toFixed(3) donnent le même arrondi ; près d'un demi (rare),
  // on retombe sur toFixed, la référence. (Profil : `num` pesait ≈ 8 % du temps d'un visage ; le résultat est identique caractère pour caractère, testé.)
  const k = v * 1000;
  const f = k - Math.floor(k);
  if (f > 0.499 && f < 0.501) return String(Number(v.toFixed(3)));
  return String(Math.round(k) / 1000);
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
    if ((key === 'href' || key === 'preserveAspectRatio') && name !== 'feImage') throw new Error(`Attribut SVG non autorisé : ${key} (réservé à feImage)`);
    if (key === 'href' && !DATA_PNG_RE.test(String(value))) throw new Error('Attribut href refusé : seul un data-URI PNG base64 est autorisé');
    if (key === 'preserveAspectRatio' && value !== 'none') throw new Error('preserveAspectRatio : seule la valeur "none" est autorisée');
    out += ` ${key}="${typeof value === 'number' ? num(value) : escapeXml(value)}"`;
  }
  return children.length === 0 ? `${out}/>` : `${out}>${children.join('')}</${name}>`;
}

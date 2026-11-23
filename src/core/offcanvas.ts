import { IDENTITY, intersectBox, mul, parseTransform, transformBox, type Mat } from './affine';
import { padBox, pathBox, unionBox, type Box } from './pathbox';

/**
 * GARDE CONTRE LE PLANTAGE NATIF DE `resvg` (calque hors cadre). Mesuré (docs/PERF-4.md) : un calque — `clip-path`, filtre, etc. — dont l'emprise est ENTIÈREMENT
 * hors du canevas, à plus d'une largeur/hauteur (à droite, en bas) ou de deux (à gauche, en haut), fait paniquer `resvg` ; le panic traverse le FFI et AVORTE
 * le processus entier (« failed to initiate panic »), sans exception rattrapable. Une scène à plusieurs personnages dont l'un sort du cadre suffit.
 *
 * Remède : un calque dont l'emprise est entièrement hors du canevas est INVISIBLE ; le supprimer ne change aucun pixel et supprime le déclencheur.
 * Sûreté : l'emprise est toujours MAJORÉE (boîtes de `pathbox` conservatives, filtre = sa région, clip = intersection, trait élargi) ; on ne supprime que ce
 * qui est mesurable (transformation, géométrie et référence connues, sinon l'élément est laissé tel quel) ; les DÉFINITIONS contenues dans un sous-arbre
 * supprimé (`defs`, dégradés, clips, filtres…) sont conservées, car un élément resté en vue peut les référencer.
 */
export interface OffCanvasResult { readonly svg: string; readonly culled: number }
interface Node { tag: string; start: number; openEnd: number; end: number; kids: Node[]; attrs?: Map<string, string> }
const ALL: Box = { x: -1e12, y: -1e12, w: 2e12, h: 2e12 };
const DEFLIKE = new Set(['defs', 'clipPath', 'mask', 'filter', 'linearGradient', 'radialGradient', 'pattern', 'symbol', 'marker']);
const SKIP = new Set([...DEFLIKE, 'style', 'title', 'desc', 'metadata']);
const num = (s: string | undefined, d = 0): number => { const v = Number.parseFloat(s ?? ''); return Number.isFinite(v) ? v : d; };

/** Arbre minimal des balises (pas de texte, pas de commentaires) ; les valeurs d'attributs entre guillemets sont sautées d'un bloc (images base64 de plusieurs Mo). */
function parse(s: string): Node | null {
  let root: Node | null = null; const stack: Node[] = []; let i = s.indexOf('<');
  while (i >= 0 && i < s.length) {
    if (s.startsWith('<!--', i)) { i = s.indexOf('-->', i) + 3; if (i < 3) return null; i = s.indexOf('<', i); continue; }
    if (s[i + 1] === '?' || s[i + 1] === '!') { i = s.indexOf('>', i) + 1; if (i < 1) return null; i = s.indexOf('<', i); continue; }
    let j = i + 1;
    for (; j < s.length; j++) { const c = s.charCodeAt(j); if (c === 34 || c === 39) { j = s.indexOf(s[j] as string, j + 1); if (j < 0) return null; } else if (c === 62) break; }
    if (j >= s.length) return null;
    if (s[i + 1] === '/') { const n = stack.pop(); if (!n) return null; n.end = j + 1; }
    else {
      const m = /^[A-Za-z][\w:-]*/.exec(s.slice(i + 1, i + 48)); if (!m) return null;
      const n: Node = { tag: m[0], start: i, openEnd: j + 1, end: j + 1, kids: [] };
      if (stack.length) stack[stack.length - 1]!.kids.push(n); else if (!root) root = n; else return null;
      if (s[j - 1] !== '/') stack.push(n);
    }
    i = s.indexOf('<', j + 1);
  }
  return stack.length === 0 ? root : null;
}

export function cullOffCanvas(svg: string): OffCanvasResult {
  const none = { svg, culled: 0 };
  if (svg.includes('<use')) return none; // `use` référence un sous-arbre par son id : emprise non mesurable ici
  const root = parse(svg); if (!root || root.tag !== 'svg') return none;
  const ids = new Map<string, Node>(), at = (n: Node): Map<string, string> => {
    if (n.attrs) return n.attrs; const m = new Map<string, string>(), raw = svg.slice(n.start + 1 + n.tag.length, n.openEnd - 1);
    for (const a of raw.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) m.set(a[1] as string, (a[2] ?? a[3]) as string);
    return (n.attrs = m);
  };
  const walkIds = (n: Node): void => { const id = at(n).get('id'); if (id !== undefined && !ids.has(id)) ids.set(id, n); n.kids.forEach(walkIds); }; walkIds(root);
  const ra = at(root), vb = (ra.get('viewBox') ?? '').split(/[\s,]+/).map(Number);
  const cv: Box = vb.length === 4 && vb.every(Number.isFinite) ? { x: vb[0]!, y: vb[1]!, w: vb[2]!, h: vb[3]! } : { x: 0, y: 0, w: num(ra.get('width')), h: num(ra.get('height')) };
  if (!(cv.w > 0 && cv.h > 0)) return none;
  const ref = (v: string | undefined): Node | null | undefined => { if (!v || v === 'none') return undefined; const m = /url\(\s*#([^)\s]+)\s*\)/.exec(v); return m ? (ids.get(m[1] as string) ?? null) : undefined; };
  const layerOf = (a: Map<string, string>, key: 'clip-path' | 'filter'): Node | null | undefined => ref(a.get(key) ?? new RegExp(`${key}\\s*:\\s*([^;"]+)`).exec(a.get('style') ?? '')?.[1]);
  const isLayer = (n: Node, a: Map<string, string>): boolean => (n.tag === 'svg' && n !== root) || (a.get('clip-path') ?? 'none') !== 'none' || (a.get('filter') ?? 'none') !== 'none' || (a.get('mask') ?? 'none') !== 'none' || num(a.get('opacity'), 1) < 1 || /mix-blend-mode|isolation|filter\s*:|clip-path\s*:/.test(a.get('style') ?? '');
  const frame = (n: Node): Mat | null => {
    const a = at(n), t = parseTransform(a.get('transform')); if (!t) return null;
    if (n.tag !== 'svg' || n === root) return t;
    const x = num(a.get('x')), y = num(a.get('y')), w = num(a.get('width')), h = num(a.get('height')), v = (a.get('viewBox') ?? '').split(/[\s,]+/).map(Number);
    if (!(w > 0 && h > 0)) return null; if (v.length !== 4 || !v.every(Number.isFinite) || !(v[2]! > 0 && v[3]! > 0)) return mul(t, [1, 0, 0, 1, x, y]);
    const none2 = (a.get('preserveAspectRatio') ?? '').startsWith('none'), sx = w / v[2]!, sy = h / v[3]!, s = Math.min(sx, sy);
    if (!none2 && /slice/.test(a.get('preserveAspectRatio') ?? '')) return null;
    const kx = none2 ? sx : s, ky = none2 ? sy : s, ox = x + (none2 ? 0 : (w - v[2]! * s) / 2), oy = y + (none2 ? 0 : (h - v[3]! * s) / 2);
    return mul(t, [kx, 0, 0, ky, ox - v[0]! * kx, oy - v[1]! * ky]);
  };
  const memo = new Map<Node, Box | null>();
  /** Épaisseur de trait MAJORANTE : le plus grand `stroke-width` de la chaîne (élément + ancêtres) si l'un d'eux trace un trait, sinon 0. */
  const strokeOf = (n: Node, par: Node[]): number => {
    let on = false, w = 0; for (const q of [n, ...par]) { const a = at(q); if ((a.get('stroke') ?? 'none') !== 'none') on = true; if (a.has('stroke-width')) w = Math.max(w, num(a.get('stroke-width'))); }
    return on ? 2 * (w || 1) : 0;
  };
  const ext = (n: Node, par: Node[]): Box | null => {
    const hit = memo.get(n); if (hit !== undefined) return hit;
    const a = at(n), t = frame(n); let box: Box | null;
    if (!t || n.tag === 'svg' && n !== root && !(num(a.get('width')) > 0)) box = ALL;
    else {
      const sw = strokeOf(n, par); let g: Box | null = null;
      if (SKIP.has(n.tag)) g = null;
      else if (n.tag === 'path') { const b = pathBox(a.get('d') ?? ''); g = b && padBox(b, sw); }
      else if (n.tag === 'rect' || n.tag === 'image') g = padBox({ x: num(a.get('x')), y: num(a.get('y')), w: num(a.get('width')), h: num(a.get('height')) }, sw);
      else if (n.tag === 'ellipse' || n.tag === 'circle') { const rx = num(a.get('rx') ?? a.get('r')), ry = num(a.get('ry') ?? a.get('r')); g = padBox({ x: num(a.get('cx')) - rx, y: num(a.get('cy')) - ry, w: 2 * rx, h: 2 * ry }, sw); }
      else if (n.tag === 'g' || n.tag === 'a' || n.tag === 'svg') {
        if (n.tag === 'svg' && n !== root) g = { x: 0, y: 0, w: 0, h: 0 }; // remplacé plus bas par le cadre de vue
        else { const ks = n.kids.map((k) => ext(k, [...par, n])).filter((b): b is Box => b !== null); g = ks.length ? unionBox(ks) : null; }
      } else g = ALL; // balise dessinante inconnue : jamais supprimée
      if (n.tag === 'svg' && n !== root) { const w = num(a.get('width')), h = num(a.get('height')); g = { x: num(a.get('x')), y: num(a.get('y')), w, h }; box = transformBox(parseTransform(a.get('transform')) ?? IDENTITY, g); memo.set(n, box); return box; }
      const f = layerOf(a, 'filter');
      if (g && f === null) g = ALL; else if (g && f) {
        const fa = at(f), us = fa.get('filterUnits') === 'userSpaceOnUse', p = (k: string, d: number): number => { const v = fa.get(k); return v === undefined ? d : v.endsWith('%') ? num(v) / 100 : num(v); };
        g = us ? { x: p('x', -0.1), y: p('y', -0.1), w: p('width', 1.2), h: p('height', 1.2) } : { x: g.x + p('x', -0.1) * g.w, y: g.y + p('y', -0.1) * g.h, w: p('width', 1.2) * g.w, h: p('height', 1.2) * g.h };
        if (us && (['x', 'y', 'width', 'height'] as const).some((k) => fa.get(k) === undefined || fa.get(k)!.endsWith('%'))) g = ALL;
      }
      const c = layerOf(a, 'clip-path');
      if (g && c) {
        const ca = at(c), ct = parseTransform(ca.get('transform'));
        if (!ct || ca.get('clipPathUnits') === 'objectBoundingBox') { /* non mesurable : pas de réduction */ } else {
          const ks = c.kids.map((k) => ext(k, [...par, n])).filter((b): b is Box => b !== null);
          g = ks.length ? intersectBox(g, transformBox(ct, unionBox(ks))) : null;
        }
      }
      box = g && transformBox(t, g);
    }
    memo.set(n, box); return box;
  };
  const m = 2, out = (b: Box): boolean => b.x + b.w <= cv.x - m || b.x >= cv.x + cv.w + m || b.y + b.h <= cv.y - m || b.y >= cv.y + cv.h + m;
  const cuts: { s: number; e: number; keep: string }[] = [];
  const defsOf = (n: Node, acc: string[]): string => { for (const k of n.kids) { if (DEFLIKE.has(k.tag)) acc.push(svg.slice(k.start, k.end)); else defsOf(k, acc); } return acc.join(''); };
  const walk = (n: Node, A: Mat, par: Node[]): void => {
    if (n !== root) {
      const a = at(n); // l'emprise n'est calculée (paresseusement, mémoïsée) que pour les vrais calques : un groupe simple n'en a pas besoin
      if (isLayer(n, a) && !SKIP.has(n.tag)) { const e = ext(n, par); if (e === null || out(transformBox(A, e))) { cuts.push({ s: n.start, e: n.end, keep: defsOf(n, []) }); return; } }
    }
    const F = frame(n); if (!F) return; const B = mul(A, F);
    for (const k of n.kids) if (!SKIP.has(k.tag)) walk(k, B, [...par, n]);
  };
  walk(root, IDENTITY, []);
  if (cuts.length === 0) return none;
  let o = '', p = 0; for (const c of cuts) { o += svg.slice(p, c.s) + c.keep; p = c.e; } o += svg.slice(p);
  return { svg: o, culled: cuts.length };
}

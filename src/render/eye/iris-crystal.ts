import { darken, lighten, mix } from '../../core/color';
import { el } from '../../core/svg';
import type { z } from 'zod';
import type { IrisDetail as IrisDetailSchema } from '../../schema/eye-iris-pupil';
import { P } from './helpers';
import { cutFacets } from './iris-atoms';
import type { IrisFrame, IrisPalette } from './iris-strands';

type Rnd = () => number;
/** Teinte spectrale (rouge 0° -> violet 270°) en hex, saturation et clarté fixes : couleur d'un liseré de dispersion. */
export function spectral(deg: number): string {
  const h = (((deg % 360) + 360) % 360) / 60; const c = 0.85; const x = c * (1 - Math.abs((h % 2) - 1)); const m = 0.12;
  const [r, g, b] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
  return `#${[r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('')}`;
}
type IrisDetail = z.infer<typeof IrisDetailSchema>;
type Facets = NonNullable<IrisDetail['facets']>;
type Bubbles = NonNullable<IrisDetail['bubbles']>;
const TAU = Math.PI * 2;

/**
 * FACETTES : `rings` couronnes de `count` quadrilatères entre `rhoFrom` (bord de la pupille) et le limbe. Les sommets sont perturbés (angle et rayon, graine de
 * l'œil) pour une cristallisation irrégulière ; chaque facette reçoit un ton de la palette (sombre -> clair) et un biseau clair sur son arête haute-gauche
 * (la lumière vient du haut-gauche, comme les reflets par défaut). `contrast` pilote l'écart de ton et l'opacité du biseau.
 */
export function facets(f: IrisFrame, pal: IrisPalette, rnd: Rnd, o: Facets, rhoFrom: number): string {
  if (o.cut > 0) return cutFacets(f, pal, rnd, o, rhoFrom, spectral);   // passe 12 : facettes taillées (diagramme de puissance), opt-in
  const out: string[] = [];
  const band = (0.96 - rhoFrom) / o.rings;
  for (let k = 0; k < o.rings; k++) {
    const n = o.count + 2 * k;
    const r0 = rhoFrom + band * k; const r1 = r0 + band;
    const off = rnd() * TAU; const jitterA = (TAU / n) * 0.28; const jitterR = band * 0.22;
    const ring = Array.from({ length: n }, () => ({ a: (rnd() - 0.5) * jitterA * 2, rIn: (rnd() - 0.5) * jitterR * 2, rOut: (rnd() - 0.5) * jitterR * 2 }));
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n; const a0 = off + (TAU * i) / n + ring[i]!.a; const a1 = off + (TAU * (i + 1)) / n + ring[j]!.a + (j === 0 ? TAU : 0);
      const pts = [f.at(Math.max(r0 + ring[i]!.rIn, rhoFrom), a0), f.at(Math.min(r1 + ring[i]!.rOut, 0.985), a0), f.at(Math.min(r1 + ring[j]!.rOut, 0.985), a1), f.at(Math.max(r0 + ring[j]!.rIn, rhoFrom), a1)];
      const t = rnd(); const mid = (a0 + a1) / 2;
      // Les facettes tournées vers le haut-gauche (angle ~ 225°) sont plus claires : le modelé suit la lumière, le hasard fait le reste.
      const toward = 0.5 + 0.5 * Math.cos(mid - (Math.PI * 5) / 4);
      const tone = Math.min(1, Math.max(0, 0.5 * toward + 0.5 * t));
      const col = tone < 0.5 ? mix(darken(pal.dark, 0.35), pal.mid, tone * 2) : mix(pal.mid, lighten(pal.light, 0.35), (tone - 0.5) * 2);
      out.push(el('path', { d: `M${pts.map(P).join('L')}Z`, fill: col, 'fill-opacity': 0.2 + 0.62 * o.contrast * Math.abs(tone - 0.5) * 2, stroke: darken(pal.edge, 0.55), 'stroke-width': f.rx * 0.006, 'stroke-opacity': 0.3 + 0.4 * o.contrast }));
      out.push(el('path', { d: `M${P(pts[3]!)}L${P(pts[0]!)}L${P(pts[1]!)}`, fill: 'none', stroke: lighten(pal.light, 0.6), 'stroke-width': f.rx * 0.009, 'stroke-opacity': Math.min(0.95, 0.2 + 0.7 * o.contrast * toward) }));
      if (o.dispersion > 0) {
        // Prisme : la lumière se sépare au bord de la facette. Teinte = angle de la facette autour de l'iris (0° -> 270° : rouge -> violet) ; le liseré complémentaire (teinte + 150°) longe l'arête interne.
        const hue = ((mid % TAU) / TAU) * 270; const w = f.rx * 0.017; const a = 0.75 * o.dispersion;
        out.push(el('path', { d: `M${P(pts[1]!)}L${P(pts[2]!)}`, fill: 'none', stroke: spectral(hue), 'stroke-width': w, 'stroke-opacity': a, 'stroke-linecap': 'round' }));
        out.push(el('path', { d: `M${P(pts[0]!)}L${P(pts[3]!)}`, fill: 'none', stroke: spectral(hue + 150), 'stroke-width': w * 0.8, 'stroke-opacity': a * 0.7, 'stroke-linecap': 'round' }));
      }
    }
  }
  return el('g', {}, out);
}

/**
 * BULLES : sphères translucides (remplissage très léger, liseré clair, reflet interne en haut-gauche, croissant d'ombre en bas-droite), tirées par la graine
 * de l'œil dans la moitié basse de l'iris (`zone: 'lower'`) ou partout ; elles ne se chevauchent pas (rejet simple) et restent à l'intérieur du limbe.
 */
export function bubbles(f: IrisFrame, pal: IrisPalette, rnd: Rnd, o: Bubbles, rhoPupil: number): string {
  const out: string[] = []; const placed: { x: number; y: number; r: number }[] = [];
  for (let n = 0; n < o.count * 12 && placed.length < o.count; n++) {
    const a = o.zone === 'lower' ? Math.PI * (0.1 + 0.8 * rnd()) : TAU * rnd();
    const rho = Math.max(rhoPupil + 0.14, 0.3) + (0.8 - Math.max(rhoPupil + 0.14, 0.3)) * rnd();
    const r = f.rx * o.size * (0.55 + 0.7 * rnd()); const c = f.at(rho, a);
    if (placed.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < (p.r + r) * 1.05)) continue;
    placed.push({ x: c.x, y: c.y, r });
    const g = o.opacity;
    if (o.crisp > 0) { out.push(crispBubble(c, r, pal, g, o.crisp)); continue; }
    out.push(el('circle', { cx: c.x, cy: c.y, r, fill: lighten(pal.light, 0.5), 'fill-opacity': 0.14 * g, stroke: '#ffffff', 'stroke-width': r * 0.16, 'stroke-opacity': 0.5 * g }));
    out.push(el('path', { d: `M${P({ x: c.x + r * 0.62, y: c.y - r * 0.5 })}A${r * 0.8} ${r * 0.8} 0 0 1 ${P({ x: c.x - r * 0.4, y: c.y + r * 0.7 })}`, fill: 'none', stroke: darken(pal.edge, 0.4), 'stroke-width': r * 0.2, 'stroke-opacity': 0.35 * g }));
    out.push(el('circle', { cx: c.x - r * 0.36, cy: c.y - r * 0.4, r: r * 0.2, fill: '#ffffff', 'fill-opacity': 0.9 * g }));
  }
  return el('g', {}, out);
}

/**
 * RAYONS DE LUMIÈRE : `count` faisceaux triangulaires très fins, issus du bord haut-gauche de l'iris (la lumière vient de là, comme les reflets par défaut) et qui traversent l'iris
 * vers le côté opposé, dispersés en éventail autour de la direction du centre. Largeur, éventail et opacité tirés par `rnd` (graine dédiée : aucun autre tirage ne bouge) ;
 * clarté de la palette (`light` éclaircie), opacité 0,07 à 0,6.
 */
export function lightRays(f: IrisFrame, pal: IrisPalette, rnd: Rnd, count: number, contrast: number): string {
  if (count <= 0) return '';
  const out: string[] = []; const src = (Math.PI * 5) / 4; const col = lighten(pal.light, 0.7);
  for (let i = 0; i < count; i++) {
    const spread = (i / Math.max(1, count - 1) - 0.5) * 1.5 + (rnd() - 0.5) * 0.18;
    const apex = f.at(0.97, src + (rnd() - 0.5) * 0.35); const target = src + Math.PI + spread; const half = 0.02 + 0.045 * rnd();
    const reach = 0.78 + 0.2 * rnd();
    out.push(el('path', { d: `M${P(apex)}L${P(f.at(reach, target - half))}L${P(f.at(reach, target + half))}Z`, fill: col, 'fill-opacity': Math.min(0.6, (0.12 + 0.26 * rnd()) * (0.6 + contrast)) }));
  }
  return el('g', {}, out);
}

/**
 * BULLE NETTE (réf. 07, `bubbles.crisp` > 0) : sphère de verre lue comme dans la référence — contour extérieur SOMBRE franc, liseré interne clair (épaisseur de la
 * paroi), remplissage très léger plus clair vers le bas, CROISSANT CAUSTIQUE lumineux du côté opposé à la lumière (la sphère focalise la lumière : bas-droite), reflet
 * spéculaire ponctuel et reflet secondaire minuscule. `k` (0–1) pilote la franchise du contour et l'intensité de la caustique.
 */
function crispBubble(c: { x: number; y: number }, r: number, pal: IrisPalette, g: number, k: number): string {
  const at = (a: number, rr: number): string => P({ x: c.x + Math.cos(a) * rr, y: c.y + Math.sin(a) * rr });
  const a0 = Math.PI * 0.12, a1 = Math.PI * 0.62; const rc = r * 0.74;
  return el('g', {}, [
    el('circle', { cx: c.x, cy: c.y, r, fill: lighten(pal.light, 0.55), 'fill-opacity': 0.12 * g * (0.5 + k) }),
    el('circle', { cx: c.x, cy: c.y, r, fill: 'none', stroke: darken(pal.edge, 0.9), 'stroke-width': r * (0.16 + 0.16 * k), 'stroke-opacity': Math.min(1, 0.7 + 0.3 * k) * g }),
    el('circle', { cx: c.x, cy: c.y, r: r * 0.86, fill: 'none', stroke: lighten(pal.light, 0.7), 'stroke-width': r * 0.08, 'stroke-opacity': 0.75 * g }),
    el('path', { d: `M${at(a0, rc)}A${rc} ${rc} 0 0 1 ${at(a1, rc)}`, fill: 'none', stroke: '#ffffff', 'stroke-width': r * (0.16 + 0.14 * k), 'stroke-linecap': 'round', 'stroke-opacity': (0.35 + 0.5 * k) * g }),
    el('circle', { cx: c.x - r * 0.36, cy: c.y - r * 0.38, r: r * 0.17, fill: '#ffffff', 'fill-opacity': 0.95 * g }),
    el('circle', { cx: c.x + r * 0.42, cy: c.y + r * 0.36, r: r * 0.07, fill: '#ffffff', 'fill-opacity': 0.8 * g }),
  ]);
}

type Rainbow = NonNullable<IrisDetail['rainbow']>;
/**
 * ARC-EN-CIEL PRISMATIQUE (réf. 04, `detail.rainbow`) : le spectre (`hueFrom` -> `hueTo`, rouge 0° -> violet 270°) parcouru sur l'ouverture angulaire du secteur ; deux couches
 * (large et douce, puis étroite et vive) pour un fondu en profondeur, plus des STRIES radiales fines de dispersion, dont la teinte suit l'angle. Pas de dégradé conique
 * en SVG : un quadrilatère par pas de 3°, recouvrement de 0,6° pour éviter les coutures.
 */
export function rainbow(f: IrisFrame, rnd: Rnd, o: Rainbow): string {
  const out: string[] = []; const steps = Math.max(6, Math.round(o.span / 3)); const dA = (o.span / steps) * (Math.PI / 180);
  const a0 = ((o.angleDeg - o.span / 2) * Math.PI) / 180 - Math.PI / 2;
  // l'angle du moteur : 0° = haut, horaire -> f.at attend un angle trigonométrique (voir irisFrame) : on réutilise la même convention que `facets` (angle en radians).
  // enveloppe douce : l'opacité monte puis retombe sur l'ouverture (pas de bord franc), le bord externe ondule (sommes de sinus à phases tirées par la graine)
  const ph = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28];
  const env = (i: number): number => Math.sin((Math.PI * (i + 0.5)) / steps) ** 0.8;
  const wob = (i: number): number => 1 + 0.07 * (Math.sin(i * 0.55 + (ph[0] as number)) + 0.6 * Math.sin(i * 1.3 + (ph[1] as number)) + 0.3 * Math.sin(i * 2.9 + (ph[2] as number)));
  const wedge = (i: number, r0: number, r1: number, op: number): void => {
    const hue = o.hueFrom + ((o.hueTo - o.hueFrom) * (i + 0.5)) / steps; const aA = a0 + dA * i - 0.01; const aB = a0 + dA * (i + 1) + 0.01; const rr = Math.min(0.985, r1 * wob(i));
    out.push(el('path', { d: `M${P(f.at(r0, aA))}L${P(f.at(rr, aA))}L${P(f.at(rr, aB))}L${P(f.at(r0, aB))}Z`, fill: spectral(hue), 'fill-opacity': op * env(i) }));
  };
  for (let i = 0; i < steps; i++) { wedge(i, o.inner, o.outer, 0.3 * o.opacity); wedge(i, o.inner + (o.outer - o.inner) * 0.3, o.outer - (o.outer - o.inner) * 0.12, 0.42 * o.opacity); wedge(i, o.inner + (o.outer - o.inner) * 0.55, o.outer - (o.outer - o.inner) * 0.2, 0.3 * o.opacity); }
  for (let k = 0; k < o.streaks; k++) {
    const t = (k + rnd() * 0.8) / Math.max(1, o.streaks); const a = a0 + dA * steps * Math.min(1, t); const hue = o.hueFrom + (o.hueTo - o.hueFrom) * Math.min(1, t);
    const r0 = o.inner + (o.outer - o.inner) * (0.05 + 0.4 * rnd()); const r1 = o.inner + (o.outer - o.inner) * (0.6 + 0.4 * rnd());
    out.push(el('path', { d: `M${P(f.at(r0, a))}L${P(f.at(r1, a))}`, fill: 'none', stroke: spectral(hue), 'stroke-width': f.rx * (0.006 + 0.01 * rnd()), 'stroke-opacity': Math.min(0.95, (0.35 + 0.5 * o.opacity) * (0.25 + 0.75 * Math.sin(Math.PI * Math.min(1, t)))), 'stroke-linecap': 'round' }));
  }
  return el('g', {}, out);
}

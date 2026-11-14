import { Resvg } from '@resvg/resvg-js';
import { compileScene } from '../../src';
import { openingGeometry, openingPolygon } from '../../src/geometry/eye';
import { irisCenter, irisRadii } from '../../src/render/eye/helpers';
import { resolveEye } from '../../src/render/eye/eye';
import { EyeSpec } from '../../src/schema';
import { dominantColor } from '../../src/materials';

/**
 * VÉRIFICATION DU RENDU D'UN ŒIL SUR L'IMAGE : les trois couches mesurées sur les PIXELS rastérisés (resvg), aux positions données par la géométrie — complète
 * `verifyEye` (src/verify/eye.ts, qui contrôle les paramètres et la géométrie) et `verifyEyeEnvelope` (profil vs références) par ce que l'on VOIT réellement.
 *   géométrie : l'œil ne dessine rien hors de sa zone (cils compris) ; le centre de l'iris est peint ; l'ouverture est remplie (pas de trou de fond) ;
 *   anatomie  : la pupille est plus sombre que l’iris ; une sclère claire reste claire à l’image (luminance ≥ 60 = 5ᵉ centile mesuré des références, moyenne 150–180) ;
 *   style     : l'œil n'est pas un aplat (écart-type de luminance dans l'iris > seuil : texture/fibres/limbe présents).
 */
export interface EyeImageCheck { readonly layer: 'geometry' | 'anatomy' | 'style'; readonly id: string; readonly ok: boolean; readonly value: number; readonly limit: number; readonly message: string }
const BG = [0xff, 0x00, 0xff] as const;
const W = 700, H = 460;
const lum = (px: Uint8Array, x: number, y: number): number => { const i = (Math.round(y) * W + Math.round(x)) * 4; return 0.2126 * (px[i] as number) + 0.7152 * (px[i + 1] as number) + 0.0722 * (px[i + 2] as number); };
const isBg = (px: Uint8Array, x: number, y: number): boolean => { const i = (Math.round(y) * W + Math.round(x)) * 4; return Math.abs((px[i] as number) - BG[0]) + Math.abs((px[i + 1] as number) - BG[1]) + Math.abs((px[i + 2] as number) - BG[2]) < 12; };
const inside = (poly: readonly { x: number; y: number }[], x: number, y: number): boolean => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i]!, b = poly[j]!; if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c; } return c; };

export function verifyEyeRender(input: Record<string, unknown>): EyeImageCheck[] {
  const raw = EyeSpec.parse({ ...input, eyebrow: null });
  const eye = resolveEye(raw);
  const g = openingGeometry(eye.shape, eye.canthi);
  const r = compileScene({ width: W, height: H, background: '#ff00ff', objects: [{ kind: 'eye', id: 'e', transform: { x: W / 2, y: H / 2 }, ...input, eyebrow: null }] } as never);
  if (!r.ok) throw new Error(r.issues.join('\n'));
  const px = new Resvg(r.svg, { fitTo: { mode: 'width', value: W } }).render().pixels as unknown as Uint8Array;
  const ox = W / 2, oy = H / 2, c = irisCenter(eye, g), { rx, ry } = irisRadii(eye);
  const poly = openingPolygon(g).map((p) => ({ x: p.x + ox, y: p.y + oy }));
  const out: EyeImageCheck[] = [];
  const add = (layer: EyeImageCheck['layer'], id: string, ok: boolean, value: number, limit: number, message: string): void => { out.push({ layer, id, ok, value: Math.round(value * 1e3) / 1e3, limit, message }); };

  // géométrie : rien de dessiné au-delà de la boîte de l'ouverture élargie (cils ≤ 0,5 de la plus grande dimension)
  const m = 0.55 * Math.max(g.bbox.w, g.bbox.h);
  let leaks = 0;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if ((x < g.bbox.x + ox - m || x > g.bbox.x + g.bbox.w + ox + m || y < g.bbox.y + oy - m || y > g.bbox.y + g.bbox.h + oy + m) && !isBg(px, x, y)) leaks++;
  add('geometry', 'no-paint-outside-zone', leaks === 0, leaks, 0, 'de la peinture dépasse la zone de l’œil (cils compris)');
  add('geometry', 'iris-centre-painted', !isBg(px, c.x + ox, c.y + oy), Number(!isBg(px, c.x + ox, c.y + oy)), 1, 'le centre de l’iris n’est pas peint');
  let n = 0, filled = 0;
  for (let y = g.bbox.y + oy; y < g.bbox.y + g.bbox.h + oy; y += 3) for (let x = g.bbox.x + ox; x < g.bbox.x + g.bbox.w + ox; x += 3) if (inside(poly, x, y)) { n++; if (!isBg(px, x, y)) filled++; }
  add('geometry', 'opening-filled', filled / Math.max(n, 1) >= 0.98, filled / Math.max(n, 1), 0.98, 'l’ouverture contient des trous de fond');

  // anatomie : pupille (centre) plus sombre que l'iris (anneau à 0,7 rayon, médiane de 4 directions, points dans l'ouverture)
  const ring = [[0.7, 0], [-0.7, 0], [0, 0.7], [0, -0.7]].map(([a, b]) => ({ x: c.x + ox + (a as number) * rx, y: c.y + oy + (b as number) * ry })).filter((p) => inside(poly, p.x, p.y)).map((p) => lum(px, p.x, p.y)).sort((a, b) => a - b);
  const irisL = ring.length ? (ring[Math.floor(ring.length / 2)] as number) : NaN;
  // le reflet blanc couvre souvent le centre de la pupille : on mesure la pupille au plus sombre de 5 points (centre + 4 à 0,5 de son rayon)
  const pr = eye.pupil.size * rx * 0.5;
  const pupilL = Math.min(...[[0, 0], [pr, 0], [-pr, 0], [0, pr], [0, -pr]].map(([a, b]) => lum(px, c.x + ox + (a as number), c.y + oy + (b as number))));
  if (eye.pupil.visible && eye.pupil.shape === 'round' && Number.isFinite(irisL)) add('anatomy', 'pupil-darker-than-iris-pixels', pupilL <= irisL + 2, pupilL - irisL, 2, 'la pupille rendue est plus claire que l’iris');
  // sclère : point entre le limbe et le canthus interne (s'il est dans l'ouverture) ; références : luminance moyenne 150–180, 5ᵉ centile 60–73 (ombre de paupière)
  const s = g.s, sy = c.y + oy + (g.pi.y - c.y) * 0.1;
  const sc = dominantColor(eye.sclera.base); // sclère volontairement sombre (démon, alien…) : le ton clair n'est exigé que si la sclère SPÉCIFIÉE est claire
  const scLum = sc.startsWith('#') ? 0.2126 * parseInt(sc.slice(1, 3), 16) + 0.7152 * parseInt(sc.slice(3, 5), 16) + 0.0722 * parseInt(sc.slice(5, 7), 16) : 0;
  // Robuste à la graine : 6 points (2 côtés de l'iris × 3 distances) dans l'ouverture ; un seul point pouvait tomber sur la caroncule ou l'ombre de paupière. On exige la MAXIMALE (une sclère claire reste claire quelque part).
  const probes = [-1, 1].flatMap((side) => [1.3, 1.55, 1.85].map((k) => ({ x: c.x + ox + side * s * rx * k, y: sy }))).filter((p) => inside(poly, p.x, p.y)).map((p) => lum(px, p.x, p.y));
  if (scLum >= 170 && probes.length) { const best = Math.max(...probes); add('anatomy', 'sclera-is-light-tone', best >= 60, best, 60, 'la sclère claire rendue est plus sombre que le 5ᵉ centile mesuré sur les références (60–73) en tout point sondé'); }

  // style : l'iris n'est pas un aplat (écart-type de luminance sur 5 × 5 échantillons dans le disque 0,2–0,9 rayon)
  const vals: number[] = [];
  for (let i = 0; i < 24; i++) for (const f of [0.35, 0.55, 0.75]) { const a = (i / 24) * Math.PI * 2; const x = c.x + ox + Math.cos(a) * rx * f, y = c.y + oy + Math.sin(a) * ry * f; if (inside(poly, x, y)) vals.push(lum(px, x, y)); }
  const mean = vals.reduce((a, b) => a + b, 0) / Math.max(vals.length, 1);
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(vals.length, 1));
  add('style', 'iris-not-flat', sd >= 3, sd, 3, 'l’iris est un aplat (aucune texture, fibre ni dégradé mesurable)');
  return out;
}

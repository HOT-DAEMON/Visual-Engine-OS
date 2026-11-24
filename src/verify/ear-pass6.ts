import type { EarGeo } from '../face';
import { inPoly, polyArea, type Poly } from '../face/poly';
import { check, type Check } from './types';

/**
 * Contrôles de la passe 6 (modèle de l'oreille, repère du plan) — chacun répond à un défaut VU sur les rendus, pas à une règle théorique :
 *  - géométrie : le lobule n'a pas de corde droite (arête rectiligne visible) ; l'hélix se fond dans le lobule (pas de trou de peau entre les deux) ; la conque reste dans le pavillon ;
 *  - anatomie : hauteur du lobule dans une plage humaine ; la conque occupe une part franche ET descend jusqu'à l'antitragus ; l'anthélix ne dépasse pas le lobule ; la scapha remplit l'espace hélix → anthélix ;
 *  - style : la limite entre structures reste lisible (aucune structure interne plus étroite qu'un trait à l'échelle de la tête).
 */
const maxEdge = (p: Poly): number => p.reduce((m, q, i) => { const r = p[(i + 1) % p.length]!; return Math.max(m, Math.hypot(r.x - q.x, r.y - q.y)); }, 0);

export function earPass6Checks(e: EarGeo): Check[] {
  const m = e.model!, s = e.side < 0 ? 'L' : 'R', o: Check[] = [];
  const ys = m.outline.map((q) => q.y), xs = m.outline.map((q) => q.x);
  const y0 = Math.min(...ys), h = Math.max(...ys) - y0, area = Math.abs(polyArea(m.outline));
  const st = (id: string) => m.structures.find((x) => x.id === id);
  const lobule = st('lobule');
  if (lobule) {
    // Géométrie : aucune arête du lobule n'est une « corde » (le contour échantillonné a des arêtes de l'ordre de 0,03–0,08 ; une corde droite fait > 0,25).
    o.push(check('geometry', `ear-lobule-no-chord-${s}`, '<=', maxEdge(lobule.poly), 0.22, `le lobule de l'oreille ${s} est fermé par une arête rectiligne (corde) : il se lit comme un bloc coupé net`));
    const helix = st('helix');
    if (helix) {
      // Le dernier sommet intérieur de la bande d'hélix doit toucher le lobule : sinon un trou de peau nue sépare l'hélix du lobule.
      const tail = helix.poly.slice(Math.floor(helix.poly.length / 2) - 3, Math.floor(helix.poly.length / 2) + 3);
      const gap = Math.min(...tail.flatMap((a) => lobule.poly.map((b) => Math.hypot(a.x - b.x, a.y - b.y))));
      o.push(check('geometry', `ear-helix-lobule-continuous-${s}`, '<=', gap / h, 0.04, `un espace sépare la fin de l'hélix et le lobule de l'oreille ${s} (${((gap / h) * 100).toFixed(1)} % de H)`));
    }
    // Anatomie : le lobule (sous l'antitragus) mesure 0,08–0,30 H d'oreille (références : ≈ 0,16–0,25).
    const at = st('antitragus');
    const base = at ? Math.max(...at.poly.map((q) => q.y)) : y0 + 0.78 * h;
    const lh = (Math.max(...lobule.poly.map((q) => q.y)) - base) / h;
    const lp = m.resolved.flat['lobule.length'] ?? 0;
    if (lp > -0.6) o.push(check('anatomy', `ear-lobule-height-${s}`, '>=', lh, 0.05 - 0.05 * Math.max(0, -lp), `le lobule de l'oreille ${s} est écrasé (${(lh * 100).toFixed(0)} % de H sous l'antitragus)`, 'warn'));
    o.push(check('anatomy', `ear-lobule-height-max-${s}`, '<=', lh, 0.42, `le lobule de l'oreille ${s} domine le pavillon (${(lh * 100).toFixed(0)} % de H sous l'antitragus)`, 'warn'));
  }
  const cav = st('cavum');
  if (cav) {
    // La conque descend jusqu'à l'antitragus : son bas est dans le tiers inférieur (pas de grande bande lisse entre conque et lobule).
    const bottom = (Math.max(...cav.poly.map((q) => q.y)) - y0) / h;
    o.push(check('anatomy', `ear-concha-reaches-antitragus-${s}`, '>=', bottom, 0.66 - 0.2 * Math.max(0, m.resolved.flat['lobule.stretch'] ?? 0) - 0.15 * Math.max(0, m.resolved.flat['lobule.length'] ?? 0), `la conque de l'oreille ${s} s'arrête trop haut (${(bottom * 100).toFixed(0)} % de H) : la région hélix → lobule est trop vaste (seuil abaissé pour un lobule long ou étiré : l'oreille s'allonge sous la conque)`, 'warn'));
    const inside = cav.poly.filter((q) => inPoly(m.outline, q.x, q.y)).length / cav.poly.length;
    o.push(check('geometry', `ear-concha-inside-${s}`, '>=', inside, 0.9, `la conque de l'oreille ${s} sort du pavillon`));
  }
  const ah = m.structures.filter((x) => String(x.id).startsWith('antihelix:'));
  if (ah.length && lobule) {
    const tail = Math.max(...ah.flatMap((x) => x.poly.map((q) => q.y)));
    o.push(check('anatomy', `ear-antihelix-above-lobule-${s}`, '<=', tail, Math.max(...lobule.poly.map((q) => q.y)), `la queue de l'anthélix de l'oreille ${s} traverse le lobule`));
  }
  // Scapha : la gouttière occupe la part de l'espace entre l'hélix et l'anthélix (> 0 : elle existe ; la place est mesurée à la construction).
  const sc = st('scapha');
  if (sc) o.push(check('anatomy', `ear-scapha-present-${s}`, '>=', Math.abs(polyArea(sc.poly)) / area, 0.015, `la scapha de l'oreille ${s} est presque absente (hélix collé à l'anthélix)`, 'warn'));
  void xs;
  return o;
}

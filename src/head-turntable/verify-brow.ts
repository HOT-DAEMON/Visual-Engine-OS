import { REGION, type HeadTurnSpec, type HostBrow, type TurnRender } from './types';
import { check, type Check } from './verify-types';

/**
 * SOURCILS DE L'HÔTE : contrôles sur l'IMAGE (régions peintes) et sur la donnée. Un côté sans sourcil (l'hôte peut en avoir un seul : yeux et sourcils sont par œil) n'en reçoit pas : contrôle `head.host.brow.<côté>.none`.
 *  - à 0° : la ligne médiane du sourcil de l'hôte (moteur de sourcil du dessin de face) est à moins de 0,006 U d'un pixel de sourcil rendu ; l'aire rendue (remplissage + filet) reste proche de celle du contour ;
 *  - anatomie : le sourcil est au-dessus de la paupière supérieure, ni sur l'axe du visage ni hors de la face ;
 *  - rotation : à `yawProbe`° le sourcil du côté proche est encore peint (les sourcils tournent avec la tête, ils ne restent pas à plat sur la vue de face).
 */
const area = (o: readonly { x: number; y: number }[]): number => { let a = 0; for (let i = 0; i < o.length; i++) { const p = o[i]!, q = o[(i + 1) % o.length]!; a += p.x * q.y - q.x * p.y; } return Math.abs(a) / 2; };

export interface BrowMeasure { readonly meanD: number; readonly areaRatio: number; readonly gap: number }

/** Mesures d'un sourcil rendu à `r` (côté `side` = +1 : x > 0) ; `gap` = plus petit écart vertical (U) entre le bas du sourcil et la paupière supérieure, sur la largeur de l'œil. */
export function browMeasure(r: TurnRender, side: 1 | -1, b: HostBrow, upper: readonly { x: number; y: number }[]): BrowMeasure {
  const ppu = r.ppu, R = Math.ceil(0.03 * ppu), n = 14, ds: number[] = [];
  let px = 0;
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (r.regions[y * r.w + x] === REGION.brow && (x + 0.5 - r.originX) * side > 0) px++;
  for (let i = 0; i < n; i++) {
    const q = b.line[Math.round(2 + ((b.line.length - 5) * i) / (n - 1))]!, cx = Math.round(r.originX + side * q.x * ppu - 0.5), cy = Math.round(r.originY + q.y * ppu - 0.5);
    let best = Infinity;
    for (let y = Math.max(0, cy - R); y <= Math.min(r.h - 1, cy + R); y++) for (let x = Math.max(0, cx - R); x <= Math.min(r.w - 1, cx + R); x++) if (r.regions[y * r.w + x] === REGION.brow) best = Math.min(best, Math.hypot(x - cx, y - cy));
    ds.push(best / ppu);
  }
  const eyeY = (x: number): number => { let bq = upper[0]!, d = Infinity; for (const q of upper) { const dd = Math.abs(q.x - x); if (dd < d) { d = dd; bq = q; } } return bq.y; };
  const x0 = Math.min(...upper.map((q) => q.x)), x1 = Math.max(...upper.map((q) => q.x));
  const gaps = b.line.map((q, i) => ({ q, w: b.widths[i]! })).filter(({ q }) => q.x >= x0 && q.x <= x1).map(({ q, w }) => eyeY(q.x) - (q.y + w / 2));
  return { meanD: ds.reduce((a, c) => a + c, 0) / ds.length, areaRatio: px / (ppu * ppu) / (area(b.outline) || 1), gap: gaps.length ? Math.min(...gaps) : 0.1 };
}

/** Contrôles des sourcils d'un hôte : `r0` = vue de face (0°, tangage 0), `rYaw` = vue tournée de `yawProbe`°. */
export function browChecks(spec: HeadTurnSpec, r0: TurnRender, rYaw: TurnRender, yawProbe: number): Check[] {
  const E = spec.eyeHost, c: Check[] = [];
  if (!E) return c;
  const A = 'anatomy' as const, sides = [[1, 'right', E.right], [-1, 'left', E.left]] as const;
  for (const [side, name, e] of sides) {
    const b = e.brow;
    if (!b) { const none = Array.from(r0.regions).filter((v, k) => v === REGION.brow && (k % r0.w + 0.5 - r0.originX) * side > 0).length; c.push(check(A, `head.host.brow.${name}.none`, `Sourcil ${name} : l'hôte n'en a pas, aucun pixel de sourcil rendu (nombre)`, none, 0, 0)); continue; }
    const m = browMeasure(r0, side, b, e.upper);
    c.push(check(A, `head.host.brow.${name}.line`, `Sourcil ${name} à 0° : distance moyenne (U) de la ligne médiane du sourcil de l'hôte au sourcil rendu`, m.meanD, 0, 0.006));
    c.push(check(A, `head.host.brow.${name}.area`, `Sourcil ${name} à 0° : aire rendue / aire du contour de l'hôte (remplissage + filet d'encre intérieur ; 1 = identique ; mesuré 0,96–1,03 sur 13 hôtes)`, m.areaRatio, 0.85, 1.2));
    c.push(check(A, `head.host.brow.${name}.above-eye`, `Sourcil ${name} : écart vertical minimal (U) entre le bas du sourcil et la paupière supérieure (≥ 0 : le sourcil ne descend pas dans l'œil)`, m.gap, 0, 0.5));
    const xs = b.outline.map((q) => q.x);
    c.push(check(A, `head.host.brow.${name}.midline`, `Sourcil ${name} : distance (U) du bord interne à l'axe du visage (≥ 0,01 : pas de monosourcil franchissant l'axe)`, Math.min(...xs), 0.01, 0.4));
    // Rotation : à yawProbe° le sourcil du côté du visage tourné vers l'avant (x · lacet < 0 sur la planche : à lacet > 0 le visage regarde à gauche, le côté x < 0 est le côté proche) reste peint.
    if (side === -1) { const near = Array.from(rYaw.regions).filter((v) => v === REGION.brow).length; c.push(check(A, 'head.host.brow.rotates', `Sourcils à ${yawProbe}° : pixels de sourcil encore peints (nombre ; > 0 : le sourcil suit la tête)`, near, 30, 1e9)); }
  }
  return c;
}

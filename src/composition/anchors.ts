import { rad } from '../core/math';
import type { HostSpec } from '../schema';

/**
 * Transformation de similarité 2D : p' = scale · R(rotationDeg) · p + (x, y).
 * Rotation SVG (sens horaire, y vers le bas). Pas de mise à l'échelle non uniforme : les reflets
 * et la lumière resteraient faux sous un cisaillement.
 */
export interface Similarity {
  readonly x: number;
  readonly y: number;
  readonly rotationDeg: number;
  readonly scale: number;
}

export function normalizeDeg(d: number): number {
  const r = ((((d + 180) % 360) + 360) % 360) - 180;
  return r === -180 ? 180 : r;
}

/** a ∘ b : applique b, puis a. */
export function compose(a: Similarity, b: Similarity): Similarity {
  const t = rad(a.rotationDeg);
  const c = Math.cos(t);
  const s = Math.sin(t);
  return {
    x: a.x + a.scale * (b.x * c - b.y * s),
    y: a.y + a.scale * (b.x * s + b.y * c),
    rotationDeg: normalizeDeg(a.rotationDeg + b.rotationDeg),
    scale: a.scale * b.scale,
  };
}

export interface ResolvedAnchor {
  readonly id: string;
  /** Identifiant du motif qui a généré cette ancre, ou null pour une ancre explicite. */
  readonly group: string | null;
  /** Position dans le repère local de l'hôte, en unités de l'hôte (pixels avant transformation de l'hôte). */
  readonly x: number;
  readonly y: number;
  readonly rotationDeg: number;
  readonly scale: number;
}

/**
 * Angle (degrés, 0 = haut, sens horaire) de la normale sortante de l'hôte au point (px, py),
 * exprimé dans le repère local de l'hôte. Utilisé pour orienter un objet posé sur la surface.
 */
export function surfaceNormalDeg(host: HostSpec, px: number, py: number): number {
  const rx = host.width / 2;
  const ry = host.height / 2;
  let nx: number;
  let ny: number;
  if (host.shape === 'ellipse') {
    nx = px / (rx * rx);
    ny = py / (ry * ry);
  } else {
    const u = px / rx;
    const v = py / ry;
    if (Math.abs(u) >= Math.abs(v)) {
      nx = Math.sign(u);
      ny = 0;
    } else {
      nx = 0;
      ny = Math.sign(v);
    }
  }
  if (nx === 0 && ny === 0) return 0;
  return normalizeDeg((Math.atan2(nx, -ny) * 180) / Math.PI);
}

/** Ancres explicites, puis ancres générées par les motifs, dans l'ordre de déclaration. */
export function resolveAnchors(host: HostSpec): ResolvedAnchor[] {
  const rx = host.width / 2;
  const ry = host.height / 2;
  const out: ResolvedAnchor[] = [];
  const push = (
    id: string,
    group: string | null,
    x: number,
    y: number,
    rotationDeg: number,
    scale: number,
    follow: 'none' | 'surface',
  ): void => {
    const extra = follow === 'surface' ? surfaceNormalDeg(host, x, y) : 0;
    out.push({ id, group, x, y, rotationDeg: normalizeDeg(rotationDeg + extra), scale });
  };

  for (const a of host.anchors) push(a.id, null, a.x * rx, a.y * ry, a.rotationDeg, a.scale, a.follow);

  for (const p of host.patterns) {
    for (let i = 0; i < p.count; i++) {
      const id = `${p.id}-${i + 1}`;
      if (p.type === 'ring') {
        const a = rad(p.startDeg + (360 * i) / p.count);
        push(id, p.id, p.radius * rx * Math.sin(a), -p.radius * ry * Math.cos(a), 0, p.scale, p.follow);
      } else {
        const t = p.count === 1 ? 0.5 : i / (p.count - 1);
        push(id, p.id, (p.from.x + (p.to.x - p.from.x) * t) * rx, (p.from.y + (p.to.y - p.from.y) * t) * ry, 0, p.scale, p.follow);
      }
    }
  }
  return out;
}

export interface AnchorSelection {
  readonly anchors: ResolvedAnchor[];
  readonly missing: { readonly kind: 'anchors' | 'patterns'; readonly index: number; readonly name: string }[];
}

/** Sélectionne les ancres d'un hôte demandées par un `place` : ancres nommées d'abord, puis motifs entiers. */
export function selectAnchors(
  host: HostSpec,
  place: { readonly anchors: readonly string[]; readonly patterns: readonly string[] },
): AnchorSelection {
  const all = resolveAnchors(host);
  const byId = new Map(all.map((a) => [a.id, a] as const));
  const anchors: ResolvedAnchor[] = [];
  const missing: { kind: 'anchors' | 'patterns'; index: number; name: string }[] = [];
  place.anchors.forEach((name, index) => {
    const a = byId.get(name);
    if (a) anchors.push(a);
    else missing.push({ kind: 'anchors', index, name });
  });
  place.patterns.forEach((name, index) => {
    const group = all.filter((a) => a.group === name);
    if (group.length > 0) anchors.push(...group);
    else missing.push({ kind: 'patterns', index, name });
  });
  return { anchors, missing };
}

import type { NeckModel, P2, P3, Station } from './types';

/**
 * PROJECTIONS du modèle de cou — l'UNIQUE endroit où une station devient un point, une silhouette ou une normale. La vue de face, le profil
 * et le maillage 3D lisent ces fonctions : ils ne peuvent donc pas diverger (test « rendu 2D et 3D : contrat commun »).
 * Convention d'angle de section ψ : 0 = face antérieure (vers le spectateur, +z), +π/2 = droite de l'image, π = nuque, −π/2 = gauche.
 */
/**
 * Paramétrisation par RAYON de la superellipse |x/a|ⁿ + |z/b|ⁿ = 1 : ψ est un vrai angle (uniforme pour toute valeur de n). Le point est
 * (a·sinψ·r, b·cosψ·r) avec r = (|sinψ|ⁿ + |cosψ|ⁿ)^(−1/n). Pour n = 2 (ellipse) r = 1. L'ancienne forme x = a·sin(ψ)^(2/n) concentrait toute la face
 * antérieure d'une section rectangulaire dans |ψ| < 0,1 (positions de reliefs et d'écailles faussées, constaté sur la cuirasse).
 */
const radius = (s: number, c: number, n: number): number => (Math.abs(s) ** n + Math.abs(c) ** n) ** (-1 / n);

/** Point de la section `st` à l'angle ψ, avec torsion, `lift` px vers l'extérieur le long de la normale de section. */
export function sectionPoint(st: Station, psi: number, lift = 0): P3 {
  const s = Math.sin(psi), c = Math.cos(psi), r = radius(s, c, st.n);
  const a = s >= 0 ? st.aR : st.aL, b = c >= 0 ? st.bF : st.bB;
  const lx = a * s * r, lz = b * c * r;
  // Normale du gradient de F : n ∝ ( sgn(x)|x/a|ⁿ⁻¹ / a , sgn(z)|z/b|ⁿ⁻¹ / b ).
  let nx = (Math.sign(lx) * Math.abs(lx / a) ** (st.n - 1)) / a, nz = (Math.sign(lz) * Math.abs(lz / b) ** (st.n - 1)) / b;
  const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
  const ct = Math.cos(st.twist), sn = Math.sin(st.twist);
  const px = lx + nx * lift, pz = lz + nz * lift;
  return { x: st.x + px * ct + pz * sn, y: st.y, z: st.z - px * sn + pz * ct };
}

/** Silhouette de face : enveloppe en x de toutes les sections tordues (la torsion fait varier la largeur projetée, comme `√((a cos θ)²+(b sin θ)²)`). */
export function frontSilhouette(model: NeckModel): { left: P2[]; right: P2[] } {
  const key = model as unknown as object;
  const hit = FRONT.get(key);
  if (hit) return hit;
  const left: P2[] = [], right: P2[] = [];
  for (const st of model.stations) {
    let lo = Infinity, hi = -Infinity;
    for (let k = 0; k < 48; k++) { const x = sectionPoint(st, (k / 48) * 2 * Math.PI - Math.PI).x; if (x < lo) lo = x; if (x > hi) hi = x; }
    left.push({ x: lo, y: st.y }); right.push({ x: hi, y: st.y });
  }
  const out = { left, right };
  FRONT.set(key, out);
  return out;
}
const FRONT = new WeakMap<object, { left: P2[]; right: P2[] }>();

/** Silhouette de profil (x = profondeur z, y = hauteur) : face antérieure et nuque, pour le moteur de crâne et la planche tournante. */
export function profileSilhouette(model: NeckModel): { front: P2[]; back: P2[] } {
  const front: P2[] = [], back: P2[] = [];
  for (const st of model.stations) {
    let lo = Infinity, hi = -Infinity;
    for (let k = 0; k < 48; k++) { const z = sectionPoint(st, (k / 48) * 2 * Math.PI - Math.PI).z; if (z < lo) lo = z; if (z > hi) hi = z; }
    front.push({ x: hi, y: st.y }); back.push({ x: lo, y: st.y });
  }
  return { front, back };
}

/** Station interpolée à `u` ∈ [0,1] (interpolation linéaire des champs). */
export function stationAt(model: NeckModel, u: number): Station {
  const S = model.stations, f = Math.min(S.length - 1, Math.max(0, u * (S.length - 1))), i = Math.min(S.length - 2, Math.floor(f)), t = f - i;
  const a = S[i]!, b = S[i + 1]!, L = (p: number, q: number): number => p + (q - p) * t;
  return { u, x: L(a.x, b.x), y: L(a.y, b.y), z: L(a.z, b.z), aL: L(a.aL, b.aL), aR: L(a.aR, b.aR), bF: L(a.bF, b.bF), bB: L(a.bB, b.bB), n: L(a.n, b.n), twist: L(a.twist, b.twist), seg: t < 0.5 ? a.seg : b.seg };
}

/** Champ de déformation interpolé à `u`. */
export function fieldAt(model: NeckModel, key: 'compression' | 'muscle' | 'ripple' | 'fold' | 'compressionSide' | 'muscleSide', u: number): number {
  const a = model.fields[key], f = Math.min(a.length - 1, Math.max(0, u * (a.length - 1))), i = Math.min(a.length - 2, Math.floor(f)), t = f - i;
  return a[i]! + (a[i + 1]! - a[i]!) * t;
}

/** Ordonnée y → u (inverse monotone de l'axe) : permet de placer un repère du visage (menton) sur le cou. */
export function uAtY(model: NeckModel, y: number): number {
  const S = model.stations;
  if (y <= S[0]!.y) return 0;
  for (let i = 1; i < S.length; i++) if (y <= S[i]!.y) return ((i - 1) + (y - S[i - 1]!.y) / (S[i]!.y - S[i - 1]!.y || 1)) / (S.length - 1);
  return 1;
}

/**
 * Normale unitaire (repère visage, z vers le spectateur) de la surface à la station `i`, angle ψ : normale de la section tordue, rendue perpendiculaire
 * à la tangente de l'axe (un cou qui se penche incline ses normales : l'ombrage réagit à la courbure, à la torsion, à l'asymétrie).
 */
export function surfaceNormal(model: NeckModel, i: number, psi: number): P3 {
  const S = model.stations, st = S[i]!, s = Math.sin(psi), c = Math.cos(psi), r = radius(s, c, st.n);
  const a = s >= 0 ? st.aR : st.aL, b = c >= 0 ? st.bF : st.bB, lx = a * s * r, lz = b * c * r;
  let nx = (Math.sign(lx) * Math.abs(lx / a) ** (st.n - 1)) / a, nz = (Math.sign(lz) * Math.abs(lz / b) ** (st.n - 1)) / b;
  const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
  const ct = Math.cos(st.twist), sn = Math.sin(st.twist);
  const wx = nx * ct + nz * sn, wz = -nx * sn + nz * ct;
  nx = wx; nz = wz;
  const p = S[Math.max(0, i - 1)]!, q = S[Math.min(S.length - 1, i + 1)]!;
  let tx = q.x - p.x, ty = q.y - p.y, tz = q.z - p.z; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
  const dot = nx * tx + nz * tz;
  nx -= dot * tx; const ny = -dot * ty; nz -= dot * tz;
  const l = Math.hypot(nx, ny, nz) || 1;
  return { x: nx / l, y: ny / l, z: nz / l };
}

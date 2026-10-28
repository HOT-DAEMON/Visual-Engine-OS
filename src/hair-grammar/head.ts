import { clamp, lerp, rad, smooth, v3, type V2, type V3 } from './vec';

/**
 * MODÈLE DE TÊTE 3D (support de la grammaire de coiffure) : crâne ellipsoïdal + mâchoire effilée, repères du visage en 3D.
 * Toutes les mèches sont ANCRÉES sur ce support (coordonnées de surface), jamais en pixels : une rotation de la tête
 * (vue de face, 3/4, profil) déplace donc racines, mèches et repères de façon cohérente.
 * Unité H = hauteur de tête (sommet du crâne y = −0,46 → menton y = +0,54).
 */
export interface HeadSpec {
  /** Demi-axes du crâne (x, y, z) et décalage du centre en z. */
  readonly rx: number; readonly ry: number; readonly rz: number; readonly cz: number;
  /** Ordonnée où le crâne se raccorde à la mâchoire, menton, et finesse du menton (demi-largeur au menton). */
  readonly jawStart: number; readonly chinY: number; readonly chinHalf: number;
  /** Ordonnées des repères du visage. */
  readonly eyeY: number; readonly noseY: number; readonly mouthY: number; readonly earY: number; readonly earH: number;
  /** Demi-écart des yeux (centres). */
  readonly eyeX: number;
}

export const DEFAULT_HEAD: HeadSpec = { rx: 0.45, ry: 0.46, rz: 0.5, cz: -0.03, jawStart: 0.2, chinY: 0.54, chinHalf: 0.075, eyeY: 0.04, noseY: 0.22, mouthY: 0.37, earY: 0.13, earH: 0.22, eyeX: 0.23 };

/** Section horizontale de la tête à l'ordonnée y : ellipse (demi-largeur a, centre zc, demi-profondeur b). */
export interface Section { readonly a: number; readonly zc: number; readonly b: number }

export function sectionAt(h: HeadSpec, y: number): Section {
  if (y <= h.jawStart) {
    const q = Math.sqrt(Math.max(0, 1 - (y / h.ry) ** 2));
    return { a: h.rx * q, zc: h.cz, b: h.rz * q };
  }
  const u = clamp((y - h.jawStart) / (h.chinY - h.jawStart), 0, 1);
  const a0 = h.rx * Math.sqrt(Math.max(0, 1 - (h.jawStart / h.ry) ** 2));
  const b0 = h.rz * Math.sqrt(Math.max(0, 1 - (h.jawStart / h.ry) ** 2));
  // Mâchoire effilée : la largeur chute vite (menton d'anime), la profondeur diminue en reculant l'arrière.
  const a = lerp(h.chinHalf, a0, (1 - smooth(u)) ** 1.15);
  const front0 = h.cz + b0;
  const front = lerp(front0, 0.31, smooth(u) ** 0.9);
  const back = lerp(h.cz - b0, 0.12, smooth(u) ** 0.8);
  return { a, zc: (front + back) / 2, b: (front - back) / 2 };
}

/** Point de la surface de la tête à l'ordonnée y et à l'azimut `az` (0 = face, +90° = côté +x, ±180° = nuque). */
export function surface(h: HeadSpec, y: number, azDeg: number): V3 {
  const s = sectionAt(h, y);
  const t = rad(azDeg);
  return v3(s.a * Math.sin(t), y, s.zc + s.b * Math.cos(t));
}

/** Repères 3D du visage (sur la surface, z = face avant de la section ; le nez dépasse). */
export interface Landmarks3 {
  readonly eyeR: V3; readonly eyeL: V3; readonly noseTip: V3; readonly noseBase: V3; readonly mouth: V3; readonly chin: V3;
  readonly earR: V3; readonly earL: V3; readonly jawAngleR: V3; readonly jawAngleL: V3; readonly browR: V3; readonly browL: V3; readonly top: V3;
}

export function landmarks(h: HeadSpec): Landmarks3 {
  const front = (x: number, y: number, extra = 0): V3 => {
    const s = sectionAt(h, y);
    const k = Math.sqrt(Math.max(0, 1 - (x / Math.max(1e-6, s.a)) ** 2));
    return v3(x, y, s.zc + s.b * k + extra);
  };
  const side = (sg: number, y: number): V3 => { const s = sectionAt(h, y); return v3(sg * s.a, y, s.zc); };
  return {
    eyeR: front(h.eyeX, h.eyeY, -0.015), eyeL: front(-h.eyeX, h.eyeY, -0.015),
    browR: front(h.eyeX, h.eyeY - 0.075, 0.005), browL: front(-h.eyeX, h.eyeY - 0.075, 0.005),
    noseTip: front(0, h.noseY, 0.075), noseBase: front(0, h.noseY - 0.01, 0.05), mouth: front(0, h.mouthY, 0.012), chin: front(0, h.chinY - 0.012, 0.005),
    earR: side(1, h.earY), earL: side(-1, h.earY), jawAngleR: side(1, 0.3), jawAngleL: side(-1, 0.3),
    top: v3(0, -h.ry, h.cz),
  };
}

/** Vue : rotation (lacet, tangage) + échelle + translation vers l'image. Projection orthographique. */
export interface View { readonly yaw: number; readonly pitch: number; readonly s: number; readonly tx: number; readonly ty: number }

/** Projette un point de tête : `d` est la profondeur (grand = proche de la caméra), utile pour l'occultation. */
export function project(v: View, p: V3): V2 & { readonly d: number } {
  const a = rad(v.yaw);
  const x1 = p.x * Math.cos(a) + p.z * Math.sin(a);
  const z1 = -p.x * Math.sin(a) + p.z * Math.cos(a);
  const b = rad(v.pitch);
  const y2 = p.y * Math.cos(b) - z1 * Math.sin(b);
  const z2 = p.y * Math.sin(b) + z1 * Math.cos(b);
  return { x: v.tx + v.s * x1, y: v.ty + v.s * y2, d: z2 };
}

/** Rotation inverse (image → tête) d'un vecteur de direction de vue : sert à lancer un rayon caméra dans le repère de tête. */
export function viewRayInHead(v: View): V3 {
  // Direction caméra (0,0,1) exprimée dans le repère de tête : on inverse tangage puis lacet.
  const b = rad(v.pitch); const a = rad(v.yaw);
  const y1 = Math.sin(b); const z1 = Math.cos(b); // inverse du tangage appliqué à (0,0,1)
  return v3(-Math.sin(a) * z1, y1, Math.cos(a) * z1);
}

/** Inverse de `project` à profondeur donnée : point de la tête vu en (x, y) image à la profondeur `d` (repère caméra). */
export function unprojectAt(v: View, x: number, y: number, d: number): V3 {
  const X = (x - v.tx) / v.s; const Y2 = (y - v.ty) / v.s;
  const b = rad(v.pitch); const a = rad(v.yaw);
  // Inverse du tangage : [y; z1] = [[cb, sb], [-sb, cb]] [y2; z2].
  const y1 = Math.cos(b) * Y2 + Math.sin(b) * d; const z1 = -Math.sin(b) * Y2 + Math.cos(b) * d;
  // Inverse du lacet : [x; z] = [[ca, -sa], [sa, ca]] [x1; z1].
  return v3(Math.cos(a) * X - Math.sin(a) * z1, y1, Math.sin(a) * X + Math.cos(a) * z1);
}

/**
 * Rayon caméra → coque capillaire (ellipsoïde du crâne gonflé de `lift`) : renvoie (élévation, azimut) en degrés du point visé,
 * côté caméra (`far = false`) ou côté opposé. `null` si le rayon manque la coque. Sert à convertir une position image en ancrage
 * de tête (outil d'analyse de la référence et de placement des racines).
 */
export function aimOnShell(h: HeadSpec, v: View, x: number, y: number, lift: number, far = false): { el: number; az: number } | null {
  const o = unprojectAt(v, x, y, 3);
  const dir = viewRayInHead(v);
  const rx = h.rx + lift; const ry = h.ry + lift; const rz = h.rz + lift;
  const ox = o.x / rx; const oy = o.y / ry; const oz = (o.z - h.cz) / rz;
  const dx = -dir.x / rx; const dy = -dir.y / ry; const dz = -dir.z / rz;
  const A = dx * dx + dy * dy + dz * dz; const B = 2 * (ox * dx + oy * dy + oz * dz); const C = ox * ox + oy * oy + oz * oz - 1;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return null;
  const t = (-B + (far ? 1 : -1) * Math.sqrt(disc)) / (2 * A);
  const p = v3(o.x - dir.x * t, o.y - dir.y * t, o.z - dir.z * t);
  const qy = -(p.y / ry);
  const el = (Math.asin(clamp(qy, -1, 1)) * 180) / Math.PI;
  const az = (Math.atan2(p.x / rx, (p.z - h.cz) / rz) * 180) / Math.PI;
  return { el, az };
}

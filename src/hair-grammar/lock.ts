import { evalProgram, type CurveSegment } from './curve-program';
import type { HeadSpec } from './head';
import { offsetNormal, onShell, shellNormal, shellPoint, shellTangents, toShell } from './shell';
import { add, clamp, cross, dot, lerp, mul, norm, rad, smooth, sub, v3, type V3 } from './vec';
import type { WidthOp } from './width-program';

/**
 * MÈCHE (primitive unique de la grammaire). Une mèche est décrite dans le repère de la TÊTE, jamais en pixels :
 *  - une RACINE posée sur la coque (élévation, azimut) ;
 *  - une DIRECTION de départ `aim` (vecteur de tête, projeté sur le plan tangent) ;
 *  - une LONGUEUR ;
 *  - un CAP qui évolue le long de la mèche : courbure globale, ondulation en S, FLICK de pointe ;
 *  - un DÉCOLLEMENT par rapport à la coque (la mèche se soulève : `lift0` → `lift1`) et une chute par gravité ;
 *  - une LARGEUR (profil lame) et des attributs de rendu (ton, couche, nombre de brins, hachures).
 * Toutes les coiffures sont des ensembles de mèches produits par des RÈGLES (`grammar.ts`) ou posées explicitement.
 */
export interface LockSpec {
  readonly id: string;
  /** Racine : élévation (90 = sommet du crâne, 0 = équateur, <0 = plus bas) et azimut (0 = face, +90 = côté +x, 180 = nuque), en degrés. */
  readonly root: { readonly el: number; readonly az: number };
  readonly aim: V3;
  readonly length: number;
  /** Rotation totale du cap sur la mèche (rad, positif = vers +azimut) puis ondulation (amplitude rad, fréquence, phase 0–1). */
  readonly bend: number;
  readonly wave: { readonly amp: number; readonly freq: number; readonly phase: number };
  /** Retroussé de pointe : rotation supplémentaire (rad) sur la dernière fraction `len` de la mèche. */
  readonly flick: { readonly amt: number; readonly len: number };
  readonly lift0: number;
  readonly lift1: number;
  /** Pente initiale du décollement (unités H par unité de longueur) : si donnée, `lift0 → lift1` suit un Hermite cubique de pente de départ `liftSlope0` et de pente finale nulle (continuité de la direction 3D avec la mère, `emerge.ts`). */
  readonly liftSlope0?: number;
  /** Exposant de la montée du décollement (1 = linéaire ; >1 = reste plaquée puis se soulève). */
  readonly liftPow: number;
  /** Gravité (0–1) : composante vers le bas ajoutée au cap, croissante vers la pointe. */
  readonly gravity: number;
  /** Largeur maximale (unités H), position du maximum (0–1) et acuité de la pointe (exposant, >1 = pointe longue). */
  readonly width: number;
  readonly peak: number;
  readonly taper: number;
  /** Ton clair/sombre relatif (−1…1), nombre de brins fins dessinés dans la lame, couche. */
  readonly tone: number;
  readonly strands: number;
  readonly layer: 'auto' | 'back' | 'front' | 'over';
  /** Famille (statistiques, vérification). */
  readonly family: string;
  /** GRAMMAIRE DE COURBES (optionnelle) : si présent, remplace `bend`/`wave`/`flick` par un programme de segments (`curve-program.ts`). */
  readonly program?: readonly CurveSegment[];
  /** GRAMMAIRE DE LARGEUR (optionnelle) : renflements, étranglements, sections aplaties, changements de volume (`width-program.ts`). */
  readonly widthProg?: readonly WidthOp[];
  /** Mèche ÉMERGENTE : issue du volume de la mèche `id` à la position `t` de celle-ci (`emerge.ts`). */
  readonly parent?: { readonly id: string; readonly t: number };
  /** Mèche qui REJOINT la mèche `id` à la position `t` de celle-ci (sa pointe y arrive : `branch.ts`, `joinLocks`). */
  readonly join?: { readonly id: string; readonly t: number };
  /** Groupe de TRESSAGE : les mèches d'un même groupe se croisent en alternance, résolue par la profondeur locale (`occlusion.ts`). Absent = ordre de la coiffure. */
  readonly weave?: string;
  /** Racine EXACTE en coordonnées de coque (y, azimut en radian) : prioritaire sur `root` (une mèche émergente part du point exact de sa mère). */
  readonly shellRoot?: { readonly y: number; readonly az: number };
}

/** Échantillon 3D d'une mèche : position, paramètre t, normale de coque ; `twist` = torsion du ruban autour de l'axe (rad), seulement avec un programme. */
export interface Sample { readonly p: V3; readonly t: number; readonly n: V3; /** Décollement EFFECTIF (unités H) : le décollement demandé, plafonné dans les creux de la coque (`liftCaps`). */ readonly off: number; readonly twist?: number; /** Point de coque (y, azimut en radian) sous l'échantillon : permet de poser une mèche fille exactement dessus (`emerge.ts`). */ readonly shell: { readonly y: number; readonly az: number } }

/** Rotation de `d` autour de l'axe `n` d'un angle `a` (Rodrigues). */
export function rotAbout(d: V3, n: V3, a: number): V3 {
  const c = Math.cos(a); const s = Math.sin(a);
  return add(add(mul(d, c), mul(cross(n, d), s)), mul(n, dot(n, d) * (1 - c)));
}

/** Racine d'une mèche en coordonnées de coque (y, azimut radian) : `shellRoot` si donnée, sinon le point de l'ellipsoïde (élévation, azimut) ramené à la coque. */
export function rootShell(h: HeadSpec, L: LockSpec): { y: number; az: number } {
  if (L.shellRoot) return L.shellRoot;
  const el = rad(L.root.el); const az = rad(L.root.az);
  return toShell(h, v3(h.rx * Math.cos(el) * Math.sin(az), -h.ry * Math.sin(el), h.cz + h.rz * Math.cos(el) * Math.cos(az)));
}

/**
 * Vitesse minimale (fraction de la vitesse nominale) du point DÉCOLLÉ. Dans un creux de la coque de courbure κ, le point décalé de `off` avance à
 * `1 − off·κ` fois la vitesse du point de coque : à 0 il s'arrête, en dessous il RECULE (la courbe décalée se replie en queue d'aronde, d'où une boucle
 * de pointe dans l'image). 0,3 garde un pas lisible tout en laissant la mèche passer au-dessus d'un creux.
 */
export const MIN_SPEED = 0.3;
/** Pente maximale (unités H de décollement par unité H de longueur) de la partie RETIRÉE du décollement : le retrait se propage en pente douce, sans marche. */
const CUT_SLOPE = 0.2;
/** Cosinus minimal entre le pas du point décalé et le pas de coque (0,5 = 60°) : au-delà, le décalage ne fait plus que tourner autour d'un creux. */
const MIN_ALIGN = 0.5;

/**
 * Décollement EFFECTIF d'une marche. On mesure la vitesse du point réellement décalé (normale de décollement lissée comprise) : là où elle tombe sous
 * `MIN_SPEED` (ou que le pas décalé s'écarte de plus de 60° du pas de coque), on retire 25 % du décollement demandé et on propage ce retrait aux échantillons voisins avec une pente bornée (transformée en distance,
 * aller puis retour), puis on recommence (8 passes au plus). Le décollement demandé n'est JAMAIS augmenté ; une mèche qui ne passe sur aucun creux
 * (le cas général) n'est pas modifiée. L'estimation analytique de la courbure (normales exactes) a été essayée d'abord et abandonnée : elle voit le coude
 * que la normale lissée traite déjà, et ses marches de plafond créaient elles-mêmes les sauts (mesuré : neutre 1 → 8 mèches repliées sur 400).
 */
function effectiveLift(h: HeadSpec, rows: readonly { y: number; az: number; base: V3; n: V3; off: number }[]): { off: number[]; p: V3[] } {
  const n = rows.length; const req = rows.map((r) => r.off); const cut = new Array<number>(n).fill(0);
  const gap = rows.map((r, k) => (k ? len3(sub(r.base, (rows[k - 1] as { base: V3 }).base)) : 0));
  const place = (): { off: number[]; p: V3[] } => { const off = req.map((o, k) => (o > 0 ? Math.max(0, o - (cut[k] as number)) : o)); return { off, p: rows.map((r, k) => add(r.base, mul(offsetNormal(h, r.y, r.az, off[k] as number, r.n), off[k] as number))) }; };
  let cur = place();
  for (let it = 0; it < 8; it++) {
    let bad = false;
    for (let k = 1; k < n; k++) {
      const db = sub((rows[k] as { base: V3 }).base, (rows[k - 1] as { base: V3 }).base); const l2 = dot(db, db);
      if (l2 < 1e-12 || (req[k] as number) <= 0) continue;
      const dp = sub(cur.p[k] as V3, cur.p[k - 1] as V3); const ld = len3(dp);
      // Deux critères : la vitesse (pas de recul) ET l'alignement du pas décalé sur le pas de coque (pas de pas minuscule dont la direction est dictée par la rotation de la normale).
      if (dot(dp, db) / l2 < MIN_SPEED || dot(dp, db) < MIN_ALIGN * ld * Math.sqrt(l2)) { bad = true; cut[k] = Math.min(req[k] as number, (cut[k] as number) + 0.25 * (req[k] as number)); }
    }
    if (!bad) break;
    for (let k = 1; k < n; k++) cut[k] = Math.max(cut[k] as number, (cut[k - 1] as number) - CUT_SLOPE * (gap[k] as number));
    for (let k = n - 2; k >= 0; k--) cut[k] = Math.max(cut[k] as number, (cut[k + 1] as number) - CUT_SLOPE * (gap[k + 1] as number));
    for (let k = 0; k < n; k++) cut[k] = Math.min(Math.max(0, req[k] as number), cut[k] as number);
    cur = place();
  }
  return cur;
}
const len3 = (v: V3): number => Math.hypot(v.x, v.y, v.z);

/** Décollement demandé à la position t : rampe `lift0 → lift1` (exposant `liftPow`) ou, avec `liftSlope0`, Hermite de pente de départ imposée (jamais < 0). */
export function liftAt(L: LockSpec, t: number): number {
  if (L.liftSlope0 === undefined) return lerp(L.lift0, L.lift1, t ** L.liftPow);
  const t2 = t * t; const t3 = t2 * t;
  return Math.max(0, (2 * t3 - 3 * t2 + 1) * L.lift0 + (t3 - 2 * t2 + t) * L.liftSlope0 * L.length + (-2 * t3 + 3 * t2) * L.lift1);
}

/** Marche d'une mèche sur la coque : renvoie `steps + 1` échantillons 3D (position décollée, paramètre t, normale). */
export function walk(h: HeadSpec, L: LockSpec, steps = 28): Sample[] {
  let { y, az: a } = rootShell(h, L);
  const ds = L.length / steps;
  const rows: { y: number; az: number; base: V3; n: V3; off: number; t: number; twist: number | undefined }[] = [];
  // Cap de référence : `aim` projeté sur le plan tangent de la racine, puis transporté le long de la coque (plan tangent courant).
  let ref: V3 | null = null;
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    const n = shellNormal(h, y, a);
    const base = shellPoint(h, y, a);
    const st = L.program ? evalProgram(L.program, t) : null;
    // Décollement : rampe `lift0 → lift1` + oscillation d'entrelacs du programme (nulle sans segment `weave`).
    const off = liftAt(L, t) + (st ? st.lift : 0);
    rows.push({ y, az: a, base, n, off, t, twist: st?.twist });
    if (k === steps) break;
    const tg = shellTangents(h, y, a);
    ref = norm(sub(ref ?? L.aim, mul(n, dot(ref ?? L.aim, n))));
    // Cap : programme de segments s'il existe (grammaire de courbes), sinon courbure + ondulation + retroussé (historique, inchangé).
    const flick = L.flick.amt * smooth((t - (1 - L.flick.len)) / Math.max(1e-6, L.flick.len));
    const theta = L.program ? evalProgram(L.program, t).theta : L.bend * t + L.wave.amp * Math.sin(2 * Math.PI * (L.wave.freq * t + L.wave.phase)) + flick;
    let d = rotAbout(ref, n, theta);
    // Gravité : mélange vers le bas du plan tangent, croissant (quadratique) vers la pointe.
    const g = L.gravity * t * t;
    d = norm(add(mul(d, 1 - g), mul(tg.down, g)));
    const s2 = toShell(h, add(base, mul(d, ds)));
    y = s2.y; a = s2.az;
  }
  // Seconde passe : décollement effectif (retiré seulement dans les creux), décalage selon la normale LISSÉE à l'échelle de ce décollement (`offsetNormal`).
  // `n` (exacte) reste celle de l'échantillon : facing, tangente, ruban. Le chemin de coque ne dépend pas du décollement : on peut le corriger après coup.
  const eff = effectiveLift(h, rows);
  return rows.map((r, k): Sample => {
    const off = eff.off[k] as number; const p = eff.p[k] as V3;
    return r.twist === undefined ? { p, t: r.t, n: r.n, off, shell: { y: r.y, az: r.az } } : { p, t: r.t, n: r.n, off, twist: r.twist, shell: { y: r.y, az: r.az } };
  });
}

export { onShell, clamp };

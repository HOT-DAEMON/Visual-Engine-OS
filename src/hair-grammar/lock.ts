import { evalProgram, type CurveSegment } from './curve-program';
import type { HeadSpec } from './head';
import { onShell, shellNormal, shellPoint, shellTangents, toShell } from './shell';
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
  /** Groupe de TRESSAGE : les mèches d'un même groupe se croisent en alternance, résolue par la profondeur locale (`occlusion.ts`). Absent = ordre de la coiffure. */
  readonly weave?: string;
  /** Racine EXACTE en coordonnées de coque (y, azimut en radian) : prioritaire sur `root` (une mèche émergente part du point exact de sa mère). */
  readonly shellRoot?: { readonly y: number; readonly az: number };
}

/** Échantillon 3D d'une mèche : position, paramètre t, normale de coque ; `twist` = torsion du ruban autour de l'axe (rad), seulement avec un programme. */
export interface Sample { readonly p: V3; readonly t: number; readonly n: V3; readonly twist?: number; /** Point de coque (y, azimut en radian) sous l'échantillon : permet de poser une mèche fille exactement dessus (`emerge.ts`). */ readonly shell: { readonly y: number; readonly az: number } }

/** Rotation de `d` autour de l'axe `n` d'un angle `a` (Rodrigues). */
function rotAbout(d: V3, n: V3, a: number): V3 {
  const c = Math.cos(a); const s = Math.sin(a);
  return add(add(mul(d, c), mul(cross(n, d), s)), mul(n, dot(n, d) * (1 - c)));
}

/** Marche d'une mèche sur la coque : renvoie `steps + 1` échantillons 3D (position décollée, paramètre t, normale). */
export function walk(h: HeadSpec, L: LockSpec, steps = 28): Sample[] {
  const el = rad(L.root.el); const az = rad(L.root.az);
  // Racine : point de l'ellipsoïde (élévation, azimut) ramené à la coque.
  const root3 = v3(h.rx * Math.cos(el) * Math.sin(az), -h.ry * Math.sin(el), h.cz + h.rz * Math.cos(el) * Math.cos(az));
  let { y, az: a } = L.shellRoot ?? toShell(h, root3);
  const out: Sample[] = [];
  const ds = L.length / steps;
  // Cap de référence : `aim` projeté sur le plan tangent de la racine, puis transporté le long de la coque (plan tangent courant).
  let ref: V3 | null = null;
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    const n = shellNormal(h, y, a);
    const base = shellPoint(h, y, a);
    const off = lerp(L.lift0, L.lift1, t ** L.liftPow);
    const st = L.program ? evalProgram(L.program, t) : null;
    out.push(st ? { p: add(base, mul(n, off)), t, n, twist: st.twist, shell: { y, az: a } } : { p: add(base, mul(n, off)), t, n, shell: { y, az: a } });
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
  return out;
}

export { onShell, clamp };

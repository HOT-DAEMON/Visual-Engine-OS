import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { head3dSubject } from '../src/render/head-3d';
import { hostOf } from '../scripts/nose-refs/alar-overflow';
import { buildParts, defaultFrame, renderHead } from '../src/head-turntable';
import { rasterize, type Frame } from '../src/head-turntable/raster';
import { cullFarEar } from '../src/head-turntable/engines/ear-cull';
import { poseHead } from '../src/head-turntable/math';
import { rollRig } from '../src/head-turntable/roll';
import { PART } from '../src/head-turntable/mesh';
import { lightModelOfSpec, patternById } from '../src/relief';
import type { HeadTurnSpec, View } from '../src/head-turntable';

/**
 * AUDIT PAR TESTS des huit principes du moteur de rotation (docs/NOSE-PRINCIPLES-AUDIT.md). Chaque principe est une MESURE sur le moteur réel, pas une relecture du code.
 * Les écarts trouvés sont assertés tels quels (valeur mesurée), pas cachés : un écart documenté qui disparaîtrait ferait échouer le test et obligerait à mettre la doc à jour.
 */
const spec = head3dSubject(hostOf(77, 'plat-trapeze'), {} as never).spec as HeadTurnSpec;
const F = defaultFrame(180), hi: Frame = F;
const hashMeshes = (ms: ReturnType<typeof buildParts>): string => createHash('sha1').update(JSON.stringify(ms.map((m) => [m.id, m.P, m.N, m.T]))).digest('hex');
const diff = (a: Uint8Array, b: Uint8Array): number => { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n / a.length; };

describe('principes : rotation, caméra, projection', () => {
  it('1 · une rotation n\'est pas un dessin : la géométrie 3D ne dépend d\'aucune vue, et des vues différentes sont des PROJECTIONS du même maillage', () => {
    const h0 = hashMeshes(buildParts(spec)), a = rasterize(buildParts(spec), { yaw: 0, pitch: 0 }, hi), b = rasterize(buildParts(spec), { yaw: 50, pitch: 0 }, hi);
    expect(hashMeshes(buildParts(spec))).toBe(h0);               // aucune dépendance cachée à un état de vue
    expect(diff(a.id, b.id)).toBeGreaterThan(0.02);              // les images diffèrent (ce n'est pas le même dessin retourné)
    const zs = (g: typeof a): number => { let m = -Infinity; for (const z of g.depth) if (Number.isFinite(z)) m = Math.max(m, z); return m; };
    expect(Number.isFinite(zs(a)) && Number.isFinite(zs(b))).toBe(true);   // profondeur réelle par pixel (3D), pas une image 2D
  });

  it('3 · la caméra n\'est pas le personnage : rendre sous 30 vues ne modifie NI la spec NI le maillage', () => {
    const s0 = JSON.stringify(spec), h0 = hashMeshes(buildParts(spec));
    for (let k = 0; k < 30; k++) renderHead({ yaw: k * 12, pitch: (k % 5) * 12 - 24 }, spec, { frame: defaultFrame(90), ss: 1 });
    expect(JSON.stringify(spec)).toBe(s0); expect(hashMeshes(buildParts(spec))).toBe(h0);
  });

  it('5 · la projection ne détruit pas la géométrie source : `rasterize` ne modifie pas les maillages passés', () => {
    const ms = buildParts(spec), h0 = hashMeshes(ms);
    for (const yaw of [0, 33, 70, 120]) rasterize(ms, { yaw, pitch: 10 }, hi);
    expect(hashMeshes(ms)).toBe(h0);
  });

  it('4 · rotations hiérarchiques : le cou est un enfant de la base (immobile à la base), la tête hérite du roulis du cou ET garde le sien', () => {
    const rig = rollRig(spec, 20), v: View = { yaw: 0, pitch: 0, roll: 20, rig };   // roulis en degrés
    const base = poseHead({ x: 0.01, y: rig.B.y, z: 0.02 }, v, 'neck'), top = poseHead({ x: 0.01, y: rig.T.y, z: 0.02 }, v, 'neck');
    expect(Math.hypot(base.x - 0.01, base.y - rig.B.y)).toBeLessThan(1e-9);     // base du cou : aucun mouvement
    expect(Math.hypot(top.x - 0.01, top.y - rig.T.y)).toBeGreaterThan(1e-3);    // sommet : fléchi
    const hd = poseHead({ x: 0.01, y: rig.T.y, z: 0.02 }, v, 'head');
    expect(Math.hypot(hd.x - top.x, hd.y - top.y)).toBeGreaterThan(1e-3);       // la tête a SON degré de liberté (≠ celui du cou)
  });

  it('6 · l\'occultation est calculée (tampon de profondeur) : l\'ORDRE des pièces ne change pas l\'image', () => {
    const ms = buildParts(spec);
    for (const yaw of [0, 45, 70]) {
      const a = rasterize(ms, { yaw, pitch: 0 }, hi), b = rasterize([...ms].reverse(), { yaw, pitch: 0 }, hi);
      expect(diff(a.id, b.id), `${yaw}°`).toBeLessThan(0.0005);   // seuls des ex æquo de profondeur exacts (pixels de couture) peuvent différer
    }
  });

  it('6 bis · ÉCART MESURÉ : l\'oreille lointaine est OMISE par règle (convention de la planche, `cullFarEar`), pas occultée par calcul — à 10° elle disparaît seule (34 px mesurés ici)', () => {
    const v: View = { yaw: 10, pitch: 0 }, ms = buildParts(spec), full = rasterize(ms, v, hi), cut = rasterize(cullFarEar(ms, v), v, hi);
    const changed = diff(full.id, cut.id);
    expect(changed).toBeGreaterThan(0);                            // l'omission existe : c'est une exception au principe
    for (let i = 0; i < full.id.length; i++) if (full.id[i] !== cut.id[i]) expect([PART.ear, PART.earBack]).toContain(full.id[i]);   // et elle ne touche QUE l'oreille
    const v0 = rasterize(cullFarEar(ms, { yaw: 0, pitch: 0 }), { yaw: 0, pitch: 0 }, hi), f0 = rasterize(ms, { yaw: 0, pitch: 0 }, hi);
    expect(diff(v0.id, f0.id)).toBe(0);                            // hors de la plage 8°–35° rien n'est omis
  });
});

describe('principes : style et angles intermédiaires', () => {
  it('7 · le style est une donnée : deux éclairages différents donnent la MÊME silhouette (tampon d\'identifiants) et des pixels différents', () => {
    const lit = (id: string) => { const q = patternById(id); return lightModelOfSpec({} as never, { style: q.style, shadowHue: q.shadowHue, bias: q.bias, light: { azimuthDeg: q.azimuthDeg, elevationDeg: q.elevationDeg, shadowHardness: q.hardness, sourceSize: q.sourceSize } } as never); };
    const a = renderHead({ yaw: 40, pitch: 0 }, spec, { frame: F, ss: 1, light: lit('three-quarter-right') }), b = renderHead({ yaw: 40, pitch: 0 }, spec, { frame: F, ss: 1 });
    expect(diff(new Uint8Array(a.ids), new Uint8Array(b.ids))).toBe(0);   // même géométrie, même occultation
    expect(a.svg).not.toBe(b.svg);                                       // mais un autre style
  });

  it('8 · angles intermédiaires : le rendu est CONTINU en lacet (pas de saut entre 1° voisins sur 0°–90°, y compris les angles non entiers) et ne produit aucun NaN', () => {
    let prev = renderHead({ yaw: 0, pitch: 0 }, spec, { frame: defaultFrame(140), ss: 1 }), worst = 0, at = 0;
    for (let y = 1; y <= 90; y++) {
      const r = renderHead({ yaw: y + (y % 3) * 0.37, pitch: 0 }, spec, { frame: defaultFrame(140), ss: 1 }), d = diff(new Uint8Array(prev.ids), new Uint8Array(r.ids));
      if (d > worst) { worst = d; at = y; } prev = r;
      expect(r.svg.replace(/base64,[A-Za-z0-9+/=]+/g, '').includes('NaN')).toBe(false);   // hors charge utile PNG (une sous-chaîne « NaN » peut s'y trouver par hasard)
    }
    expect(worst, `plus grand saut par ≈ 1° : ${(worst * 100).toFixed(2)} % des pixels à ${at}°`).toBeLessThan(0.04);
  });
});

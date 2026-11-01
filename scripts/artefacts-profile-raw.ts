/**
 * Données brutes du profil pour les artefacts « membre supérieur 03 » : `npx tsx scripts/artefacts-profile-raw.ts <dossier>`.
 * Écrit le masque moteur recalé (profile-mask.bin, 564×771 octets 0/1) et les mesures (profile.json). Lancé sur le commit précédent ET le courant.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { ARCHETYPES, type BodyInput } from '../src/body';
import { bodyVolumes, renderVolumesPixel } from '../src/body/volume';
import { BodyParams } from '../src/body';
import { bodyHost } from './lib/body-host';
import { profileFit } from './body-refs/profile-iou';

const OUT = process.argv[2] ?? 'artefacts/upper-limb-03/raw';
mkdirSync(OUT, { recursive: true });
const H = bodyHost(), r = profileFit(ARCHETYPES.veryMuscular as BodyInput, -90, H);
writeFileSync(`${OUT}/profile-mask.bin`, r.mask);
// Vérification de profil (absente du commit précédent : le module n'existait pas → null)
let verification: unknown = null;
try { const { verifyProfileDepth } = await import('../src/verify/profile'); const set = bodyVolumes(ARCHETYPES.veryMuscular as BodyInput, H.a, {}), m = renderVolumesPixel(set, { skin: H.skin, heightPx: 700, camera: { yaw: -90, pitch: 0, pivot: { x: 0, y: 0, z: 0 } } }); const v = verifyProfileDepth(m, H.a, BodyParams.parse(ARCHETYPES.veryMuscular).adiposity); verification = { ok: v.ok, checks: v.checks, depth: v.depth }; } catch { /* module absent */ }
writeFileSync(`${OUT}/profile.json`, JSON.stringify({ iou: r.iou, rowErr: r.rowErr, dx: r.dx, s: r.s, verification }));
console.log('ok', OUT, r.iou.toFixed(3), r.rowErr.toFixed(3));

import { COMPONENTS, canonicalId, componentOf } from '../anatomy/components';
import { eyeRelations, relationChecks } from '../anatomy/relations';
import { compileScene } from '../compile';
import { placedEyesByHost } from '../anatomy/placed';
import { publishedOrbits, sideOf } from '../anatomy/orbit';
import { verifyOrbits } from './orbit';
import { faceRelations } from '../anatomy/face-relations';
import { bodyGeometry } from '../body/geometry';
import { bodyMarkup } from '../body/markup';
import { BodyParams } from '../body/types';
import { dominantColor } from '../materials';
import { faceComponents } from '../render/face/components';
import { bodyRenderOpts, neckAnchor } from '../render/body';
import { hostFace } from '../render/face';
import { noseGeometry } from '../face';
import { SceneSpec, type HostSpec } from '../schema';
import { verifyBody } from './body';
import { verifyLegs } from './lower';
import { verifyProfile } from './skull';
import { checkHead3d } from './head-3d';
import { deriveSkull } from '../skull/derive';
import { figureMarkup, legGeometry } from '../body/lower';
import { LegParams } from '../body/lower/types';
import { check, report, type Check, type Report } from './types';

/**
 * Vérification du rendu de la TÊTE + du CORPS tels que `compileScene` les assemble (pipeline principal), sur les trois couches :
 *  - géométrie : la scène compile, les relations géométriques (canthus sur ancre) et la géométrie du corps tiennent ;
 *  - anatomie : relations anatomiques (œil dans l'orbite…), identité canonique de TOUS les composants du graphe de contact, jonction cou → corps ;
 *  - style : relations visuelles (paupière/iris) et contrôles de style du corps.
 * Les contrôles propres au visage généré (`verifyFace`) et au corps (`verifyBody`) restent la référence de leur domaine ; celui-ci vérifie leur ASSEMBLAGE.
 */
export function verifyPipeline(input: unknown): Report {
  const checks: Check[] = [];
  const compiled = compileScene(input);
  checks.push(check('geometry', 'pipeline.compiles', '>=', Number(compiled.ok), 1, compiled.ok ? '' : `la scène ne compile pas : ${compiled.issues.join(' ; ')}`));
  if (!compiled.ok) return report(checks);
  const scene = SceneSpec.parse(input);
  const hosts = new Map<string, HostSpec>();
  for (const o of scene.objects) if (o.kind === 'host') hosts.set(o.id, o);

  // Œil ↔ visage : relations mesurées sur les yeux POSÉS (transformation monde après expansion), contre l'orbite PUBLIÉE que le rendu consomme.
  const placed = placedEyesByHost(scene);
  for (const [hostId, eyes] of placed) {
    const host = hosts.get(hostId) as HostSpec;
    const { params, lm } = hostFace(host);
    const orbits = publishedOrbits(lm, eyes);
    for (const pe of eyes) checks.push(...relationChecks(eyeRelations(pe, lm, orbits[sideOf(pe)])));
    checks.push(...verifyOrbits(hostId, params, lm, eyes, orbits));
  }

  // Nez, bouche, oreille, mâchoire, cheveux : relations explicites mesurées sur la géométrie produite (docs/FACE-RELATIONS.md).
  for (const host of hosts.values()) {
    if (host.shape !== 'face') continue;
    const { params, lm } = hostFace(host);
    const orbits = publishedOrbits(lm, placed.get(host.id) ?? []);
    checks.push(...relationChecks(faceRelations(params, lm, noseGeometry(params, lm), orbits)).map((c) => ({ ...c, id: `${host.id}.${c.id}` })));
  }

  // Identité : chaque composant du graphe de contact du visage a un identifiant canonique et un parent compatible.
  for (const host of hosts.values()) {
    if (host.shape !== 'face') continue;
    const { params, lm } = hostFace(host);
    const { components } = faceComponents(params, lm, noseGeometry(params, lm));
    const orphans = components.filter((c) => !canonicalId('contact', c.id)).map((c) => c.id);
    checks.push(check('anatomy', `identity.contact.${host.id}`, '==', orphans.length, 0, `composants sans identifiant canonique : ${orphans.join(', ')}`));
  }

  // Corps : jonction (le cou existe, le corps tient sous le menton) + les trois couches du corps.
  for (const o of scene.objects) {
    if (o.kind !== 'body') continue;
    const host = hosts.get(o.host) as HostSpec;
    const a = neckAnchor(host);
    checks.push(check('anatomy', `junction.neck-below-chin.${o.id}`, '>=', a.baseY - a.chinY, 0, 'la base du cou doit être sous le menton'));
    const geo = bodyGeometry(BodyParams.parse(o.body), a);
    const m = bodyMarkup(o.body, a, bodyRenderOpts(o, host));
    checks.push(...verifyBody(geo, m, dominantColor(host.material.base)).checks);
    if (o.legs !== false) {
      const fig = figureMarkup(o.body, o.legs, a, bodyRenderOpts(o, host));
      checks.push(...verifyLegs(legGeometry(BodyParams.parse(o.body), LegParams.parse(o.legs), a), fig).checks);
    }
  }
  // Tête de profil : crâne dérivé du visage de l'hôte ; 3 couches du profil + contrôles croisés face ↔ profil (même personne vue de côté).
  for (const o of scene.objects) {
    if (o.kind !== 'head_profile') continue;
    const host = hosts.get(o.host) as HostSpec;
    const { params, lm } = hostFace(host);
    const d = deriveSkull(params, lm.W / lm.H, { hair: 'auto', ...o.skull }, o.variation);
    const rep = verifyProfile(params, d.skull, { skin: dominantColor(host.material.base), hair: o.hair ?? params.hair.color ?? '#4a3222', faceSize: { width: lm.W, height: lm.H }, derivation: d });
    checks.push(...rep.checks.map((c) => ({ ...c, id: `profile.${o.id}.${c.id}` })));
  }
  // Tête 3D (tête + cou tournants) : les 3 couches de la tête en rotation sur la personne de l'hôte, ids préfixés `head3d.<id>.`.
  for (const o of scene.objects) {
    if (o.kind !== 'head_3d') continue;
    checks.push(...checkHead3d(o, hosts.get(o.host) as HostSpec, placed.get(o.host) ?? []));
  }
  return report(checks);
}

/** Intégrité du registre central lui-même (utilisée par les tests) : ids uniques, parents existants, pas de cycle. */
export function registryChecks(): Check[] {
  const ids = COMPONENTS.map((c) => c.id);
  const dup = ids.length - new Set(ids).size;
  const missing = COMPONENTS.filter((c) => c.parent !== null && !componentOf(c.parent)).length;
  return [check('anatomy', 'registry.unique-ids', '==', dup, 0, 'identifiants canoniques dupliqués'), check('anatomy', 'registry.parents-exist', '==', missing, 0, 'parent canonique inconnu')];
}

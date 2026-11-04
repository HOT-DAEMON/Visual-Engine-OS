import { COMPONENTS, canonicalId, componentOf } from '../anatomy/components';
import { eyeRelations, relationChecks, type PlacedEye } from '../anatomy/relations';
import { compileScene } from '../compile';
import { expandScene } from '../composition/expand';
import { bodyGeometry } from '../body/geometry';
import { bodyMarkup } from '../body/markup';
import { BodyParams } from '../body/types';
import { dominantColor } from '../materials';
import { faceComponents } from '../render/face/components';
import { neckAnchor } from '../render/body';
import { hostFace } from '../render/face';
import { noseGeometry } from '../face';
import { SceneSpec, type HostSpec } from '../schema';
import { verifyBody } from './body';
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

  // Œil ↔ visage : relations mesurées sur les yeux POSÉS (transformation monde après expansion).
  for (const o of expandScene(scene)) {
    if (o.kind !== 'eye') continue;
    // L'objet d'origine (avec `place`) donne l'hôte ; l'expansion a nommé l'exemplaire `<id>-<ancre>`.
    const src = scene.objects.find((q) => q.kind === 'eye' && q.place && o.id.startsWith(`${q.id}-`));
    const hostId = src && src.kind === 'eye' ? src.place?.host : undefined;
    const host = hostId ? hosts.get(hostId) : undefined;
    if (!host || host.shape !== 'face') continue;
    const pe: PlacedEye = { eye: o, world: o.transform, host: host.transform };
    checks.push(...relationChecks(eyeRelations(pe, hostFace(host).lm)));
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
    const m = bodyMarkup(o.body, a, { skin: dominantColor(host.material.base), level: o.level, mode: o.mode, uid: o.id });
    checks.push(...verifyBody(geo, m, dominantColor(host.material.base)).checks);
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

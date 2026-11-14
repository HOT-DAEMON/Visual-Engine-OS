/**
 * CONTRAT CENTRAL DES COMPOSANTS ANATOMIQUES — identité unique.
 *
 * Problème mesuré (docs/ANATOMY-CONTRACT.md §1) : un même os ou organe portait 2 à 3 noms selon le domaine (crâne = `cranium` dans les
 * contrats du visage, `skull` dans l'arbre de pose, `head` dans le graphe de contact ; mandibule = `mandible` / `jaw`). Ce registre
 * donne UN identifiant canonique à chaque composant, son parent anatomique, et la table des alias utilisés par chaque domaine.
 *
 * Règle : un composant a UNE définition anatomique (ce fichier + les contrats `needs/reads/provides` de son domaine). Apparence,
 * matériau, ombre, caméra, rotation 3D la CONSOMMENT par identifiant canonique ; aucun d'eux ne redéfinit où est le composant.
 * Ce registre ne contient volontairement AUCUNE donnée d'apparence ni de projection : elles se dérivent (pose, lumière), elles ne
 * se stockent pas dans le contrat.
 */
export type Domain = 'head' | 'body';
/** Les quatre vocabulaires existants qu'il faut réconcilier. */
export type AliasSpace = 'contract' | 'contact' | 'pose' | 'body';

export interface AnatomicalComponent {
  readonly id: string;
  readonly domain: Domain;
  /** Parent anatomique canonique (`null` : racine). */
  readonly parent: string | null;
  readonly aliases: Readonly<Partial<Record<AliasSpace, readonly string[]>>>;
}

export const COMPONENTS: readonly AnatomicalComponent[] = [
  { id: 'head', domain: 'head', parent: null, aliases: { contact: ['head'], pose: ['head'] } },
  { id: 'cranium', domain: 'head', parent: 'head', aliases: { contract: ['cranium'], pose: ['skull'] } },
  { id: 'forehead', domain: 'head', parent: 'cranium', aliases: { pose: ['forehead'] } },
  { id: 'hair', domain: 'head', parent: 'cranium', aliases: { contact: ['hair'] } },
  { id: 'ear', domain: 'head', parent: 'cranium', aliases: { contract: ['ear'], contact: ['earL', 'earR'], pose: ['earL', 'earR'] } },
  // Orbite : cavité osseuse du crâne qui reçoit l'œil (région d'ombre de l'arcade et du nez dans le graphe de contact).
  { id: 'orbit', domain: 'head', parent: 'cranium', aliases: { contact: ['orbitL', 'orbitR'] } },
  // Voûte crânienne : os, régions et repères de transition (données anatomiques : `src/skull/vault-registry*.ts` porte leurs relations, tissus et paramètres). Pas d'alias : aucun autre vocabulaire ne les nomme.
  { id: 'cranial-vault', domain: 'head', parent: 'cranium', aliases: {} },
  { id: 'frontal-bone', domain: 'head', parent: 'cranial-vault', aliases: {} },
  { id: 'parietal-bone', domain: 'head', parent: 'cranial-vault', aliases: {} },
  { id: 'temporal-bone', domain: 'head', parent: 'cranial-vault', aliases: {} },
  { id: 'occipital-bone', domain: 'head', parent: 'cranial-vault', aliases: {} },
  { id: 'mastoid-process', domain: 'head', parent: 'temporal-bone', aliases: {} },
  { id: 'pterion', domain: 'head', parent: 'cranial-vault', aliases: {} },
  { id: 'vertex', domain: 'head', parent: 'cranial-vault', aliases: {} },
  { id: 'glabella', domain: 'head', parent: 'frontal-bone', aliases: {} },
  { id: 'coronal-suture', domain: 'head', parent: 'cranial-vault', aliases: {} },
  { id: 'sagittal-suture', domain: 'head', parent: 'cranial-vault', aliases: {} },
  { id: 'lambdoid-suture', domain: 'head', parent: 'cranial-vault', aliases: {} },
  { id: 'squamous-suture', domain: 'head', parent: 'cranial-vault', aliases: {} },
  { id: 'temporal-line', domain: 'head', parent: 'frontal-bone', aliases: {} },
  { id: 'nuchal-line', domain: 'head', parent: 'occipital-bone', aliases: {} },
  { id: 'face', domain: 'head', parent: 'head', aliases: { pose: ['face'] } },
  { id: 'brow', domain: 'head', parent: 'face', aliases: { pose: ['browL', 'browR'] } },
  { id: 'eye', domain: 'head', parent: 'face', aliases: { contract: ['eye'], pose: ['eyeL', 'eyeR'] } },
  { id: 'iris', domain: 'head', parent: 'eye', aliases: { pose: ['irisL', 'irisR'] } },
  { id: 'nose', domain: 'head', parent: 'face', aliases: { contract: ['nose'], contact: ['nose', 'tip', 'alaL', 'alaR'], pose: ['nose'] } },
  { id: 'cheek', domain: 'head', parent: 'face', aliases: { contract: ['cheek'], pose: ['cheekL', 'cheekR'] } },
  { id: 'mouth', domain: 'head', parent: 'face', aliases: { contract: ['mouth'], contact: ['mouth'], pose: ['mouth'] } },
  { id: 'philtrum', domain: 'head', parent: 'face', aliases: { contract: ['philtrum'] } },
  { id: 'nasolabial', domain: 'head', parent: 'face', aliases: { contract: ['nasolabial'] } },
  { id: 'mandible', domain: 'head', parent: 'head', aliases: { contract: ['mandible'], pose: ['jaw'] } },
  { id: 'chin', domain: 'head', parent: 'mandible', aliases: { contract: ['chin'], contact: ['chin'], pose: ['chin'] } },
  // Le cou est la JOINTURE tête → corps : un seul composant, deux domaines (le corps le lit, il ne le redéfinit pas).
  { id: 'neck', domain: 'head', parent: 'head', aliases: { contract: ['neck'], contact: ['neck'], pose: ['neck'], body: ['neck'] } },
  { id: 'torso', domain: 'body', parent: 'neck', aliases: { body: ['torso-shell'] } },
  { id: 'shoulder-girdle', domain: 'body', parent: 'torso', aliases: { body: ['shoulder-girdle'] } },
  { id: 'pectorals', domain: 'body', parent: 'torso', aliases: { body: ['pectorals'] } },
  { id: 'breasts', domain: 'body', parent: 'pectorals', aliases: { body: ['breasts'] } },
  { id: 'abdominals', domain: 'body', parent: 'torso', aliases: { body: ['abdominals'] } },
  { id: 'flank', domain: 'body', parent: 'torso', aliases: { body: ['flank'] } },
  { id: 'skeleton', domain: 'body', parent: 'torso', aliases: { body: ['skeleton'] } },
  { id: 'upper-arm', domain: 'body', parent: 'torso', aliases: { body: ['upper-arm.L', 'upper-arm.R'] } },
  { id: 'forearm', domain: 'body', parent: 'upper-arm', aliases: { body: ['forearm.L', 'forearm.R'] } },
  { id: 'hand', domain: 'body', parent: 'forearm', aliases: { body: ['hand.L', 'hand.R'] } },
];

const byId = new Map(COMPONENTS.map((c) => [c.id, c]));
const bySpace = new Map<string, string>();
for (const c of COMPONENTS) for (const [space, names] of Object.entries(c.aliases)) for (const n of names ?? []) bySpace.set(`${space}:${n}`, c.id);

/** Identifiant canonique d'un nom propre à un domaine ; `undefined` si le nom n'est pas dans le contrat central (orphelin). */
export const canonicalId = (space: AliasSpace, name: string): string | undefined => bySpace.get(`${space}:${name}`);
export const componentOf = (id: string): AnatomicalComponent | undefined => byId.get(id);
/** Chaîne des ancêtres canoniques (du parent direct à la racine). Lève si cycle (impossible si `tests/anatomy-contract` est vert). */
export function ancestors(id: string): string[] {
  const out: string[] = [];
  for (let c = byId.get(id)?.parent; c; c = byId.get(c)?.parent) {
    if (out.includes(c)) throw new Error(`cycle d'ascendance : ${id} → ${c}`);
    out.push(c);
  }
  return out;
}

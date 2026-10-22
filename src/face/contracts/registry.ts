/**
 * CONTRATS EXPLICITES entre composants du visage.
 *
 * Un contrat dit, pour un composant : de qui il dépend (`needs`), quels paramètres il lit (`reads`, préfixes de chemin),
 * quelles mesures il fournit (`provides`, préfixes de mesure). Les lectures déclarées sont VÉRIFIÉES contre la carte d'influence
 * mesurée (tests/contracts.test.ts) : un paramètre qui change une mesure du composant sans être déclaré (directement ou par un
 * composant dont il dépend) fait échouer le test. Le contrat ne peut donc pas mentir en silence.
 */
export interface ComponentContract {
  readonly id: string;
  readonly needs: readonly string[];
  readonly reads: readonly string[];
  readonly provides: readonly string[];
}

export const CONTRACTS: readonly ComponentContract[] = [
  { id: 'cranium', needs: [], reads: ['templeY', 'jawWidth', 'chinWidth', 'jawY', 'chinY', 'jaw', 'stylization'], provides: ['cranium.'] },
  { id: 'eye', needs: ['cranium'], reads: ['eyeLine', 'eyeGap', 'asymmetry'], provides: ['eye.'] },
  { id: 'mandible', needs: ['cranium'], reads: ['mouth.open', 'mandible', 'softTissue', 'cheek', 'jaw', 'jawWidth', 'chin', 'chinWidth', 'neck', 'deform', 'stylization'], provides: ['mandible.'] },
  { id: 'nose', needs: ['eye', 'cranium'], reads: ['nose', 'stylization'], provides: ['nose.'] },
  { id: 'mouth', needs: ['nose', 'mandible', 'cranium'], reads: ['mouth', 'deform', 'stylization'], provides: ['mouth.'] },
  // Le philtrum et les jonctions naso-labiales relient le nez à la bouche : ils sont leur PROPRE composant (en aval des deux),
  // sinon « nez » et « bouche » se dépendraient mutuellement (cycle constaté par la carte d'influence mesurée).
  { id: 'philtrum', needs: ['nose', 'mouth', 'mandible'], reads: ['nose', 'mouth'], provides: ['philtrum.'] },
  { id: 'nasolabial', needs: ['nose', 'mouth', 'mandible'], reads: ['nose', 'mouth'], provides: ['nasolabial.'] },
  { id: 'chin', needs: ['mandible', 'mouth'], reads: ['chin', 'chinWidth', 'chinY', 'stylization', 'softTissue'], provides: ['chin.'] },
  { id: 'cheek', needs: ['nose', 'mouth', 'mandible'], reads: ['cheek', 'softTissue', 'deform', 'stylization'], provides: ['cheek.'] },
  { id: 'neck', needs: ['chin', 'mandible'], reads: ['neck', 'softTissue', 'deform'], provides: ['neck.'] },
  { id: 'ear', needs: ['cranium', 'eye', 'nose'], reads: ['ears', 'deform'], provides: ['ear.'] },
];

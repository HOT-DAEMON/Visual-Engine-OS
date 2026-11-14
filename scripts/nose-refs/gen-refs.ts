import { readFileSync, writeFileSync } from 'node:fs';
/**
 * Génère src/face/nose/refs.generated.ts à partir de references/nez/measures-03.json et measures-05.json (résumés mesurés, rien n'est recalculé ni arrondi ici).
 * Les planches 03 et 05 sont des DESSINS au trait / au graphite : on en tire des PROPORTIONS (séparation, hauteur et taille des narines, inclinaison, rapport d'aspect, moucheture),
 * jamais de matériau, de brillance ni de couleur (aucune de ces informations n'existe dans un dessin gris).
 *   npx tsx scripts/nose-refs/gen-refs.ts
 */
const read = (f: string) => (JSON.parse(readFileSync(`references/nez/${f}`, 'utf8')) as { summary: Record<string, unknown> }).summary;
const out = { r03: read('measures-03.json'), r05: read('measures-05.json') };
writeFileSync('src/face/nose/refs.generated.ts', `// FICHIER GÉNÉRÉ par scripts/nose-refs/gen-refs.ts à partir de references/nez/measures-03.json et measures-05.json — ne pas éditer à la main.\nexport const NOSE_REFS = ${JSON.stringify(out)} as const;\n`);
console.log('refs.generated.ts écrit');

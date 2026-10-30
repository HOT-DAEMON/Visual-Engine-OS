import type { BodyMarkup } from './render';

/**
 * Pose un corps DERRIÈRE un visage déjà compilé (`compileScene`) : `back` (torse, bras, mains) juste après le fond, avec la MÊME transformation que
 * l'hôte du visage ; `front` (fondu de la base du cou) après tout le reste. Le corps n'a ainsi aucune dépendance de schéma envers la scène.
 */
export function composeFigure(sceneSvg: string, m: BodyMarkup): string {
  const re = /(<rect [^>]*\/>)(<g transform="([^"]*)">)/;
  const hit = re.exec(sceneSvg);
  if (!hit) throw new Error('composeFigure : structure de scène inattendue (fond + groupe d’hôte attendus)');
  const g = `<g transform="${hit[3]}">`;
  const withBack = sceneSvg.replace(re, `$1${g}${m.back}</g>$2`);
  const end = withBack.lastIndexOf('</svg>');
  return `${withBack.slice(0, end)}${g}${m.front}</g></svg>`;
}

import { range as R, type FamilySpec } from '../grammar';
import { v3 } from '../vec';
import { HIME } from './hime';

/**
 * CADRE DE VISAGE commun aux coupes à attache (chignons, queue, tresses) : frange pleine à bord franc, mèches de tempe, dôme, nappes et mèches de joue de la hime — repris tels quels
 * (données de `hime.ts`, rien n'est recopié). Les trois étages de frange portent le MÊME `group: 'fringe'` : pour le dessin c'est UNE masse (leurs longueurs ne diffèrent que pour aligner les pointes
 * sur la ligne des sourcils), et la vérification de hiérarchie (une masse dominante, `compose.ts`) doit la compter d'un seul tenant. `fringeScale` > 1 épaissit la frange : dans une coupe à attache, c'est elle qui doit rester la masse dominante face au chignon.
 */
export const himeFrame = (keep: readonly string[], fringeScale = 1): FamilySpec[] => HIME.families.filter((f) => keep.includes(f.id)).map((f) => (f.id.startsWith('fringe') ? { ...f, group: 'fringe', count: Math.round(f.count * fringeScale) } : f));

/**
 * COUVERTURE ARRIÈRE des coupes attachées : la `back` de la hime (mèches de 1,0–1,2 H) n'a pas sa place quand les cheveux sont relevés, mais sans RIEN le crâne arrière est nu de profil
 * (vu sur la planche 07 de la passe 12 à 70° : crâne blanc derrière la frange). Nappes courtes sur la calotte arrière, calque `back`. Dérivée de la `back` de la hime (mêmes champs, une seule
 * définition de la peinture) ; seules la portée, la largeur et la hauteur changent.
 */
export const backCover = (count = 22): FamilySpec => ({ ...(HIME.families.find((f) => f.id === 'back') as FamilySpec), id: 'nape', count, el: R(14, 74), az: R(112, 248), aim: v3(0, 1, -0.1), length: R(0.4, 0.58), width: R(0.14, 0.22), taper: R(1.0, 1.4), tone: R(-0.1, 0.6), layer: 'back' });

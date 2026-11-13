/** Mesure les enveloppes du MOTEUR avec les mêmes descripteurs que `extract.py` : `npx tsx scripts/eye-refs/profile-engine.ts [style ...]` (sans argument : les 12). */
import { openingGeometry, openingProfile } from '../../src/geometry/eye';
import { Shape } from '../../src/schema/eye-shape';
import { Canthi } from '../../src/schema/eye-canthi-fold';

const styles = process.argv.slice(2).length ? process.argv.slice(2) : ['almond', 'round', 'sharp', 'drooping', 'chibi', 'angular', 'compressed', 'rounded_rect', 'triangle', 'circle', 'diamond', 'diamond_v2'];
for (const s of styles) {
  const p = openingProfile(openingGeometry(Shape.parse({ style: s }), Canthi.parse({})));
  console.log(s.padEnd(13), 'tilt', p.tiltDeg, 'asp', p.aspect, 'upF', p.upperFraction, 'peaks', p.upperPeakAt, p.lowerPeakAt, 'cantAng', p.canthusAngleDeg.inner, p.canthusAngleDeg.outer);
}

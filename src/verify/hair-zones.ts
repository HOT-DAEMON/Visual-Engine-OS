import { faceLandmarks } from '../face';
import { hairGeometry, type HairGeometry, type HairLock } from '../face/hair';
import { boxCoverage, targetBox } from '../face/hair/occlusion';
import { ARCHETYPES } from '../face/hair/sim/archetypes';
import { profileOf } from '../face/hair/sim/profiles';
import { depthLimit, sideSpan } from '../face/hair/sim/regions';
import { simBrowY } from '../face/hair/sim/drape';
import { halfWidthAt } from '../face/outline';
import { inPoly } from '../face/poly';
import type { RandomFace } from '../generation/random-face';
import { check, type Check } from './types';

/**
 * VÉRIFICATION PAR ZONES des cheveux à masses de région (`sim.regions`). Règle de fond : les cheveux ne PROTÈGENT que les yeux,
 * les sourcils, le nez et la bouche ; tempes, joues, oreilles et cou sont autorisés, chacun avec sa limite :
 *   tempe / yeux / joue : profondeur vers l'intérieur ≤ `depthLimit` (0,11 W → 0,035 W dans la bande des yeux → 0,10 W) ;
 *   nuque               : masse ARRIÈRE, jamais devant la tête ; débord sur les côtés du cou borné ;
 *   oreilles            : libres (le comportement annoncé est contrôlé ailleurs).
 * Silhouette : balayage, largeur, zone rasée et longueurs mesurées sur la géométrie, comparées au profil de l'archétype.
 */
const TOL = 0.012;

/** Part de la boîte couverte, en ignorant la bande de contour (|x| > hw(y) − marge) : le sourcil s'arrête avant le contour, la tempe y reste libre. */
function innerCoverage(polys: HairLock['poly'][], b: { minX: number; maxX: number; minY: number; maxY: number }, hw: (y: number) => number, margin: number): number {
  let n = 0;
  let c = 0;
  for (let i = 0; i < 24; i++) for (let j = 0; j < 24; j++) {
    const x = b.minX + ((b.maxX - b.minX) * (i + 0.5)) / 24;
    const y = b.minY + ((b.maxY - b.minY) * (j + 0.5)) / 24;
    if (Math.abs(x) > hw(y) - margin) continue;
    n++;
    if (polys.some((q) => inPoly(q, x, y))) c++;
  }
  return n ? c / n : 0;
}

export function checkHairZones(face: RandomFace): Check[] {
  const h = face.params.hair;
  if (!h.sim.enabled || !h.sim.regions) return [];
  const lm = faceLandmarks(face.params, face.width, face.height);
  const geo = hairGeometry(face.params, lm);
  if (!geo) return [];
  const { W, H } = lm;
  const name = h.sim.archetype === 'none' ? 'tousled' : h.sim.archetype;
  const prof = profileOf(name);
  const arch = ARCHETYPES[name];
  const out: Check[] = [];
  const hw = (y: number): number => halfWidthAt(lm.outline, Math.min(lm.chinY - 1e-3, Math.max(-H / 2, y)));
  const declaredEye = arch?.masses.some((m) => m.limit === 'eye') ?? false;
  const front = geo.locks.filter((l) => l.layer === 'front');
  const ctx = { lm, guard: { hw } } as unknown as Parameters<typeof targetBox>[1];

  // 1. Protégés : yeux, sourcils, nez, bouche (seuls). Une occlusion DÉCLARÉE par l'archétype (mèche `eye`) est exemptée pour les yeux / sourcils.
  const polys = front.map((l) => l.poly);
  for (const side of ['left', 'right'] as const) {
    const f = face.fits[side].footprint;
    out.push(check('anatomy', `zone-protected-eye-${side}`, '<=', declaredEye ? 0 : boxCoverage(polys, f), 0.02, `cheveux sur l'œil ${side}`));
  }
  out.push(check('anatomy', 'zone-protected-brows', '<=', declaredEye ? 0 : innerCoverage(polys, targetBox(face.params, ctx, 'brows'), hw, 0.05 * W), 0.03, 'cheveux sur les sourcils'));
  for (const t of ['nose', 'mouth'] as const) out.push(check('anatomy', `zone-protected-${t}`, '<=', boxCoverage(polys, targetBox(face.params, ctx, t)), 0.02, `cheveux sur ${t === 'nose' ? 'le nez' : 'la bouche'}`));

  // 2. Limites par zone : tempe / joue (bandes de contour) — dépassement de la profondeur admise, en fraction de W.
  let worst = 0;
  for (const l of geo.locks.filter((q) => q.zone === 'side' || q.zone === 'cheek')) {
    for (const q of l.poly) {
      if (q.y > lm.jawY + 0.02 * H) continue;
      worst = Math.max(worst, (hw(q.y) - Math.abs(q.x)) / W - depthLimit(lm, q.y) - TOL);
    }
  }
  out.push(check('geometry', 'zone-side-depth', '<=', Math.max(0, worst), 0, 'une masse de tempe / patte / joue dépasse la profondeur admise de sa zone'));

  // 3. Longueur de la tempe + patte : mesurée sur la bande, égale à celle demandée par la coiffure (±0,02 H).
  const side = geo.locks.filter((l) => l.zone === 'side');
  if (prof.region.temple > 0 || prof.region.burn > 0) {
    const sp = sideSpan(lm, prof.region);
    const got = side.length ? Math.max(...side.flatMap((l) => l.poly.map((q) => q.y))) : sp.y0;
    out.push(check('anatomy', 'zone-side-length', '<=', Math.abs(got - sp.yEnd) / H, 0.02, 'longueur de la tempe + patte différente de la longueur demandée par la coiffure'));
  }

  // 4. Nuque : derrière la tête (calque arrière) ; débord latéral sous la mâchoire borné.
  const nape = geo.locks.filter((l) => l.zone === 'nape');
  out.push(check('geometry', 'zone-nape-behind', '==', nape.filter((l) => l.layer !== 'back').length, 0, 'une masse de nuque est dessinée devant la tête'));
  const spill = nape.length ? Math.max(...nape.flatMap((l) => l.poly.filter((q) => q.y > lm.jawY).map((q) => Math.abs(q.x)))) : 0;
  out.push(check('geometry', 'zone-nape-spill', '<=', Math.max(0, spill - lm.neck.half) / W, 0.2, 'la nuque déborde trop sur les côtés du cou'));

  out.push(...checkSilhouette(geo, lm, prof, name, hw));
  return out;
}

/** Centre de masse (abscisse) des mèches de dessus / de frange ; sert au contrôle du sens du balayage. */
const centroidX = (ls: HairLock[]): number => {
  const pts = ls.flatMap((l) => l.poly);
  return pts.length ? pts.reduce((a, q) => a + q.x, 0) / pts.length : 0;
};

function checkSilhouette(geo: HairGeometry, lm: ReturnType<typeof faceLandmarks>, prof: ReturnType<typeof profileOf>, name: string, hw: (y: number) => number): Check[] {
  const { W, H } = lm;
  const out: Check[] = [];
  const front = geo.locks.filter((l) => l.layer === 'front' && l.zone === undefined);
  // Balayage : le sens (signe) du centre de masse des mèches du dessus suit `sweep` quand il est net (|sweep| ≥ 0,5).
  if (Math.abs(prof.sil.sweep) >= 0.5) {
    const cx = centroidX(front.filter((l) => l.kind === 'fringe' || l.kind === 'flow' || l.kind === 'lock'));
    out.push(check('style', `sil-sweep-${name}`, '>=', Math.sign(prof.sil.sweep) * cx / W, -0.01, `le balayage de ${name} ne va pas dans le sens du profil`, 'warn'));
  }
  // Largeur : étendue des cheveux avant / largeur du crâne à la tempe, bornée.
  const xs = [...geo.base.flat(), ...front.flatMap((l) => l.poly)].map((q) => q.x);
  const ratio = (Math.max(...xs) - Math.min(...xs)) / (2 * hw(lm.hair.templeY));
  out.push(check('style', 'sil-width', '>=', ratio, 0.95, 'la chevelure est plus étroite que le crâne', 'warn'));
  out.push(check('style', 'sil-width-max', '<=', ratio, 1.2 + 0.7 * prof.sil.width, 'la chevelure est démesurément large', 'warn'));
  // Zone rasée : les mèches du dessus ne retombent pas sur la zone rasée (couverture ≤ 0,3).
  if (prof.sil.shave.sides && geo.shaved?.length) {
    const z = geo.shaved[0]!;
    let n = 0;
    let c = 0;
    const b = { x0: Math.min(...z.map((q) => q.x)), x1: Math.max(...z.map((q) => q.x)), y0: Math.min(...z.map((q) => q.y)), y1: Math.max(...z.map((q) => q.y)) };
    for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) {
      const x = b.x0 + ((b.x1 - b.x0) * (i + 0.5)) / 12;
      const y = b.y0 + ((b.y1 - b.y0) * (j + 0.5)) / 12;
      if (!inPoly(z, x, y)) continue;
      n++;
      if (front.some((l) => inPoly(l.poly, x, y))) c++;
    }
    out.push(check('style', 'sil-shaved-clear', '<=', n ? c / n : 0, 0.3, 'des mèches recouvrent la zone rasée', 'warn'));
  }
  void H; void simBrowY;
  return out;
}

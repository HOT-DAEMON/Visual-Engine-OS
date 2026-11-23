import { analyzeComposition } from './compose';
import { domeLimit, verifyComposed, type Defect, type Verdict, type VerifyOpts } from './compose-verify';
import { joinLocks } from './branch';
import { domeMask, domeRatio } from './dome';
import { emergeFrom } from './emerge';
import { proposeDomeFill } from './repair-dome';
import { sampleLock, type HairProfile } from './grammar';
import { viewRayInHead, type View } from './head';
import { rotAbout, type LockSpec } from './lock';
import { paintLock } from './paint';
import { visibleMarks } from './lock-check';
import { clearCorridor, closeFlanks } from './part-shape';
import { PART_FLOOR, partOpenness } from './part-line';
import { refreshChildren, solveLock } from './repair-local';
import { clamp, norm, prng, v3, type V3 } from './vec';

/**
 * CYCLE DE RÉPARATION — détecter · identifier le composant · corriger LOCALEMENT · reconstruire · revérifier · GARDER ou ANNULER.
 * Deux phases. (1) SOLVEUR LOCAL (`repair-local.ts`) : les défauts qui ne dépendent que d'une mèche (yeux / nez / bouche recouverts, axe qui se coupe)
 * sont résolus par une édition minimale choisie sur un espace de plusieurs dizaines de candidats, évalués à ≈ 1 ms ; une seule vérification globale
 * valide le lot (repli : acceptation mèche par mèche, chacune exigeant une baisse stricte du score GLOBAL). (2) BOUCLE HISTORIQUE : pour ce qui reste
 * (style, jonctions, échecs du solveur), chaque code a une table de corrections essayées dans l'ordre, gardées seulement si le score BAISSE.
 * Jamais de régression silencieuse ; le journal garde chaque tentative gardée ou annulée. Pour une tentative `scope: 'local'`, `before` / `after`
 * sont les coûts de défauts de la MÈCHE (avant / après), pas le score global.
 */
export interface Attempt { readonly code: string; readonly lock?: string; readonly fix: string; readonly before: number; readonly after: number; readonly kept: boolean; readonly scope?: 'local' | 'global'; readonly tried?: number }
export interface RepairResult { readonly specs: LockSpec[]; readonly verdict: Verdict; readonly journal: Attempt[] }

const rotZ = (v: V3, a: number): V3 => v3(v.x * Math.cos(a) - v.y * Math.sin(a), v.x * Math.sin(a) + v.y * Math.cos(a), v.z);
/** Tourne le cap autour de l'AXE DE VUE : déplace la direction dans l'image quel que soit le lacet (rotZ ne bouge presque rien en vue de profil). */
const aroundView = (a: number): Fix => ({ name: `écarter le cap dans l'image (${a > 0 ? '+' : '−'}${Math.abs(a)} rad, axe de vue)`, apply: (L, c) => ({ ...L, aim: norm(rotAbout(L.aim, viewRayInHead(c.view), a)) }) });
/** Déplace la RACINE de ±`d`° d'azimut : seul remède quand c'est la racine, et non la pointe, qui recouvre le repère (mèche du côté, vue de profil). Inchangé pour une mèche émergente (racine imposée par sa mère). */
const moveRoot = (d: number): Fix => ({ name: `déplacer la racine (${d > 0 ? '+' : '−'}${Math.abs(d)}° d'azimut)`, apply: (L) => (L.parent || L.shellRoot ? L : { ...L, root: { el: L.root.el, az: L.root.az + d } }) });
type Fix = { readonly name: string; readonly apply: (L: LockSpec, ctx: Ctx) => LockSpec };
interface Ctx { readonly P: HairProfile; readonly view: View; readonly specs: readonly LockSpec[]; readonly seed: number; readonly defect: Defect }

const regenerate = (k: number): Fix => ({ name: `régénérer (tirage ${k})`, apply: (L, c) => { const F = c.P.families.find((f) => f.id === L.family); if (!F) return L; const i = Number(L.id.split('-').pop() ?? 0); const fresh = sampleLock(c.P, F, i, prng(c.seed * 977 + k * 131 + i)); return { ...fresh, id: L.id, ...(L.weave ? { weave: L.weave } : {}) }; } });
const FIXES: Record<string, Fix[]> = {
  'geom.finite': [regenerate(1), regenerate(2), regenerate(3)],
  'geom.layer': [{ name: 'repasser la mèche en couche arrière', apply: (L) => ({ ...L, layer: 'back' }) }, { name: 'laisser la couche automatique', apply: (L) => ({ ...L, layer: 'auto' }) }],
  'geom.join': [{ name: 'résoudre à nouveau la jonction', apply: (L, c) => { const a = c.specs.find((s) => s.id === L.parent?.id); const b = c.specs.find((s) => s.id === L.join?.id); return a && b && L.parent && L.join ? joinLocks(c.P.head, a, L.parent.t, b, L.join.t, { id: L.id, width: L.width, tone: L.tone }) : L; } }, regenerate(1)],
  'geom.degenerate': [{ name: 'allonger ×1,5', apply: (L) => ({ ...L, length: L.length * 1.5 }) }, regenerate(1), regenerate(2)],
  'geom.self': [{ name: 'réduire la courbure et le retroussé', apply: (L) => ({ ...L, bend: L.bend * 0.5, flick: { ...L.flick, amt: L.flick.amt * 0.5 } }) }, { name: 'raccourcir ×0,8', apply: (L) => ({ ...L, length: L.length * 0.8 }) }, regenerate(1)],
  'geom.emerge': [{ name: 'détachement ÷2', apply: (L, c) => { const par = c.specs.find((s) => s.id === L.parent?.id); return par && L.parent ? emergeFrom(c.P.head, par, L, { t: L.parent.t, peel: 0.3 }) : L; } }, regenerate(1)],
  'anat.eye': [{ name: 'écarter le cap de l\'œil (+0,4 rad)', apply: (L) => ({ ...L, aim: norm(rotZ(L.aim, 0.4)) }) }, { name: 'écarter le cap de l\'œil (−0,4 rad)', apply: (L) => ({ ...L, aim: norm(rotZ(L.aim, -0.4)) }) }, aroundView(0.5), aroundView(-0.5), moveRoot(15), moveRoot(-15), { name: 'plaquer le décollement (÷2)', apply: (L) => ({ ...L, lift0: L.lift0 * 0.5, lift1: L.lift1 * 0.5 }) }, { name: 'raccourcir ×0,7', apply: (L) => ({ ...L, length: L.length * 0.7 }) }, { name: 'raccourcir ×0,4', apply: (L) => ({ ...L, length: L.length * 0.4 }) }],
  'anat.face': [{ name: 'écarter le cap du visage (+0,4 rad)', apply: (L) => ({ ...L, aim: norm(rotZ(L.aim, 0.4)) }) }, { name: 'écarter le cap du visage (−0,4 rad)', apply: (L) => ({ ...L, aim: norm(rotZ(L.aim, -0.4)) }) }, aroundView(0.5), aroundView(-0.5), moveRoot(15), moveRoot(-15), { name: 'raccourcir ×0,6', apply: (L) => ({ ...L, length: L.length * 0.6 }) }, { name: 'plaquer le décollement (÷2)', apply: (L) => ({ ...L, lift0: L.lift0 * 0.5, lift1: L.lift1 * 0.5 }) }],
  'style.speckle': [{ name: 'élargir ×1,2', apply: (L) => ({ ...L, width: L.width * 1.2 }) }, { name: 'élargir ×1,4', apply: (L) => ({ ...L, width: L.width * 1.4 }) }],
  'style.coherence': [{ name: 'aligner le cap sur la lecture', apply: (L, c) => { const r = analyzeComposition(c.P.head, c.specs, c.view).reading.angle; return { ...L, aim: norm(rotZ(L.aim, clamp(r * 0.2, -0.5, 0.5))) }; } }],
};

/** Nombre maximal de mèches ajoutées pour combler la calotte (phase 3). */
const MAX_DOME_FILLS = 6;
/** Marge visée au-dessus du seuil de calotte une fois la phase 3 déclenchée (couverture, 0–1). */
const DOME_MARGIN = 0.1;
/** Codes de défaut que le solveur local sait résoudre (ils ne dépendent que de la mèche). */
const LOCAL = new Set(['geom.self', 'anat.eye', 'anat.face', 'style.part']);

/** Phase 1 : solveur local sur toutes les mèches fautives, du défaut le plus grave au moins grave. Renvoie la liste de coiffure et les tentatives (en attente de validation globale). */
function localPhase(P: HairProfile, specs: readonly LockSpec[], view: View, seed: number, v0: Verdict, part?: number): { trial: LockSpec[]; fixes: { att: Attempt; id: string; spec: LockSpec }[] } {
  const marks = visibleMarks(P.head, view); const worst = new Map<string, { sev: number; code: string }>();
  for (const d of v0.defects) if (d.lock && LOCAL.has(d.code)) { const w = worst.get(d.lock); worst.set(d.lock, { sev: (w?.sev ?? 0) + d.severity, code: w && w.sev >= d.severity ? w.code : d.code }); }
  let trial = [...specs]; const fixes: { att: Attempt; id: string; spec: LockSpec }[] = [];
  for (const [id, w] of [...worst.entries()].sort((a, b) => b[1].sev - a[1].sev)) {
    const idx = trial.findIndex((s) => s.id === id); if (idx < 0) continue;
    const r = solveLock(P, trial, idx, view, marks, seed, part); if (!r) continue;
    trial = trial.map((s, i) => (i === idx ? r.spec : s)); trial = refreshChildren(P, trial, id);
    fixes.push({ id, spec: r.spec, att: { code: w.code, lock: id, fix: r.fix, before: r.before, after: r.after, kept: true, scope: 'local', tried: r.tried } });
  }
  return { trial, fixes };
}

export function repairCycle(P: HairProfile, specs0: readonly LockSpec[], view: View, seed = 1, maxAttempts = 12, opts: VerifyOpts = {}): RepairResult {
  let specs = [...specs0]; let verdict = verifyComposed(P.head, specs, view, undefined, undefined, opts); const journal: Attempt[] = [];
  // ── Phase 1 : solveur local, un seul contrôle global pour le lot.
  const lp = localPhase(P, specs, view, seed, verdict, opts.part);
  if (lp.fixes.length) {
    const v1 = verifyComposed(P.head, lp.trial, view, lp.trial.map((L) => paintLock(P.head, L, view)), undefined, opts);
    if (v1.score < verdict.score) { specs = lp.trial; verdict = v1; journal.push(...lp.fixes.map((f) => f.att)); }
    else {
      // Le lot ne baisse pas le score global (une édition a abîmé la calotte, l'équilibre…) : on les accepte une à une, chacune sous la même exigence.
      for (const f of lp.fixes) {
        let cand = specs.map((s) => (s.id === f.id ? f.spec : s)); cand = refreshChildren(P, cand, f.id);
        const v = verifyComposed(P.head, cand, view, cand.map((L) => paintLock(P.head, L, view)), undefined, opts); const kept = v.score < verdict.score;
        journal.push({ ...f.att, kept, scope: 'global', before: verdict.score, after: v.score }); if (kept) { specs = cand; verdict = v; }
      }
    }
  }
  // ── Phase 2 : boucle historique pour ce qui reste. Budget : au moins `maxAttempts`, et 3 essais par défaut localisé restant.
  const budget = Math.max(maxAttempts, 3 * verdict.defects.filter((x) => x.lock).length);
  const tried = new Set<string>();
  for (let n = 0; n < budget && verdict.defects.length; n++) {
    const d = verdict.defects.filter((x) => x.lock && FIXES[x.code]).sort((a, b) => b.severity - a.severity).find((x) => FIXES[x.code]?.some((_, i) => !tried.has(`${x.code}|${x.lock}|${i}`)));
    if (!d) break;
    const fixes = FIXES[d.code] as Fix[]; const fi = fixes.findIndex((_, i) => !tried.has(`${d.code}|${d.lock}|${i}`)); tried.add(`${d.code}|${d.lock}|${fi}`);
    const idx = specs.findIndex((s) => s.id === d.lock); if (idx < 0) continue;
    const trial = specs.map((s, i) => (i === idx ? (fixes[fi] as Fix).apply(s, { P, view, specs, seed, defect: d }) : s));
    const v2 = verifyComposed(P.head, trial, view, trial.map((L) => paintLock(P.head, L, view)), undefined, opts);
    const kept = v2.score < verdict.score;
    journal.push({ code: d.code, ...(d.lock ? { lock: d.lock } : {}), fix: (fixes[fi] as Fix).name, before: verdict.score, after: v2.score, kept, scope: 'global' });
    if (kept) { specs = trial; verdict = v2; }
  }
  // ── Phase 2b : raie. Un défaut `style.part` restant = une mèche recouvre le couloir de la raie (une correction d'œil ou de cap l'y a poussée). Édition minimale du côté d'où elle naît (`clearCorridor`),
  // sans nouveau recouvrement d'œil / nez / bouche ; gardée seulement si le score ne monte pas.
  if (opts.part !== undefined && verdict.defects.some((x) => x.code === 'style.part')) {
    const c = clearCorridor(P, specs, view, opts.part);
    if (c.moved) {
      const v = verifyComposed(P.head, c.specs, view, undefined, undefined, opts); const kept = v.score <= verdict.score;
      journal.push({ code: 'style.part', fix: `écarter ${c.moved} mèche(s) du couloir de la raie`, before: verdict.score, after: v.score, kept, scope: 'global' });
      if (kept) { specs = c.specs; verdict = v; }
    }
  }
  // ── Phase 3 : calotte. `anat.dome` est un défaut GLOBAL (aucune mèche fautive, il en manque une) : la boucle ci-dessus l'ignore. On ajoute des mèches de la famille
  // dominante dans la plus grande zone nue (`repair-dome.ts`). Un ajout est gardé seulement si le score ne monte pas ET que la couverture progresse ; au premier refus on s'arrête.
  // Le défaut déclenche la phase ; une fois déclenchée, elle vise le seuil + `DOME_MARGIN` : le seuil détecte une panne, il n'est pas l'objectif de dessin (une zone nue juste sous le seuil
  // laisserait, en image, la moitié du front à nu). Le seuil lui-même n'est pas modifié.
  const domeOf = (v: Verdict): number => domeRatio(domeMask(P.head, view, v.composition.grid), v.composition.grid);
  const fam = verdict.composition.masses[0]?.family; const target = domeLimit(opts.wind) + DOME_MARGIN; const triggered = verdict.defects.some((x) => x.code === 'anat.dome');
  for (let k = 0; fam && triggered && k < MAX_DOME_FILLS && domeOf(verdict) < target; k++) {
    const prop = proposeDomeFill(P, specs, view, verdict.composition.grid, fam, seed, k, opts.part); if (!prop) break;
    const trial = [...specs, prop.spec]; const v3d = verifyComposed(P.head, trial, view, undefined, undefined, opts);
    const kept = v3d.score <= verdict.score && domeOf(v3d) > domeOf(verdict) + 0.005;
    journal.push({ code: 'anat.dome', lock: prop.spec.id, fix: `ajouter une mèche « ${fam} » (racine ${prop.root.el.toFixed(0)}°/${prop.root.az.toFixed(0)}°, cap latéral ${prop.lat}, +${prop.gain} cellules, couloir ${prop.corridor})`, before: verdict.score, after: v3d.score, kept, scope: 'global', tried: prop.tried });
    if (!kept) break; specs = trial; verdict = v3d;
  }
  // ── Phase 3b : flancs de la raie. Couloir libre mais ouverture trop large = FENÊTRE chauve, pas raie (`style.partgap`). On ajoute des rideaux près de la ligne (`closeFlanks`) ; gardé seulement si le score
  // ne monte pas ET que la netteté progresse. Après la phase 3 : le remplissage de calotte peut déjà avoir refermé un flanc.
  if (opts.part !== undefined && verdict.defects.some((x) => x.code === 'style.partgap')) {
    const clar = (sp: readonly LockSpec[]): number => partOpenness(P.head, view, sp.map((L) => paintLock(P.head, L, view)), opts.part as number).clarity;
    const f = closeFlanks(P, specs, view, opts.part, seed, PART_FLOOR + 0.2);
    if (f.added) {
      const v = verifyComposed(P.head, f.specs, view, undefined, undefined, opts); const kept = v.score <= verdict.score && clar(f.specs) > clar(specs);
      journal.push({ code: 'style.partgap', fix: `ajouter ${f.added} rideau(x) contre la raie`, before: verdict.score, after: v.score, kept, scope: 'global' });
      if (kept) { specs = f.specs; verdict = v; }
    }
  }
  return { specs, verdict, journal };
}

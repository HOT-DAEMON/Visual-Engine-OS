import { clamp } from '../../../core/math';
import type { Vec } from '../../../geometry/eye/primitives';
import type { Poly } from '../../poly';
import { lockFrom, type HairCtx } from '../flow';
import { arcAt } from '../hairline';
import type { HairLock } from '../types';
import { ARCHETYPES, type MassDef } from './archetypes';
import { makeCollider, type Collider, type P3 } from './collider';
import { makeDrape, skinShadow } from './drape';
import { asymEnvelope, columnEnvelope } from './mass';
import { simulateChain, type ChainSpec } from './verlet';
import { bunLocks } from '../tie';

/** Archétype par défaut d'un style de la grammaire historique (quand `sim.archetype` = none). */
const FALLBACK: Record<string, string> = { buzz: 'swept_back', short: 'tousled', spiky: 'tousled', curly: 'fluffy_messy', afro: 'fluffy_messy', bob: 'hime', long: 'hime', ponytail: 'rebel_lock', bun: 'bun_undercut', braids: 'cornrows_side' };

export interface SimResult { readonly locks: HairLock[]; readonly skinShadows: Poly[]; readonly mass: Poly | null; readonly backMass: Poly | null; readonly chains: { readonly mass: string; readonly pts: P3[]; readonly cls: string }[] }

const unit3 = (v: P3): P3 => { const n = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / n, y: v.y / n, z: v.z / n }; };
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Direction d'écoulement à la racine : tangente à la surface, loin de la raie, + biais de la masse (balayage, poussée, relevé, arrière). */
function flowDir(r: P3, P0: P3, body: Collider, m: MassDef, partX: number): P3 {
  const dy = r.y - body.yWide;
  const n = unit3({ x: r.x / (body.half(body.yWide) ** 2), y: dy / (body.yWide - body.topY) ** 2, z: r.z / (body.depth(body.yWide) ** 2) });
  let v = unit3({ x: r.x - P0.x, y: r.y - P0.y + 1e-3, z: r.z - P0.z });
  const dot = v.x * n.x + v.y * n.y + v.z * n.z;
  v = unit3({ x: v.x - dot * n.x, y: v.y - dot * n.y, z: v.z - dot * n.z });
  const sg = r.x - partX < 0 ? -1 : 1;
  return unit3({ x: v.x + m.sweep + m.out * sg + 0.15 * n.x, y: v.y - m.lift + 0.15 * n.y, z: v.z - m.back + 0.15 * n.z });
}

/** Masse → paquets → brins : simule chaque chaîne, projette en 2D, applique le drapé et range par profondeur. */
export function simLocks(ctx: HairCtx): SimResult {
  const { h, lm, hl, arc, rnd } = ctx;
  const sim = h.sim;
  const { W, H } = lm;
  const arch = ARCHETYPES[sim.archetype === 'none' ? (FALLBACK[h.style] ?? 'tousled') : sim.archetype] ?? ARCHETYPES['tousled']!;
  const body = makeCollider(lm, (0.012 + 0.03 * h.volume + (arch.puff ?? 0) * 0.04) * W);
  const drape = makeDrape(lm, sim, ctx.guard.hw, hl.yAt);
  const P0: P3 = { x: ctx.partX, y: body.topY, z: 0 };
  const tex = ctx.tex;
  const tCurl = tex === 'wavy' ? { c: 0, w: 0.12 } : tex === 'curly' ? { c: 0.12, w: 0.25 } : tex === 'coily' ? { c: 0.3, w: 0.4 } : { c: 0, w: 0 };
  const total = arch.masses.reduce((a, m) => a + m.share, 0);
  const locks: Array<HairLock & { z: number }> = [];
  const shadows: Poly[] = [];
  const chains: SimResult['chains'] = [];
  for (const m of arch.masses) {
    // Chignon : volume enroulé dédié (disque + spirales), posé au sommet ; pas de chaînes.
    if (m.cls === 'tail' && (m.curl ?? 0) >= 0.5) {
      const top = arc.reduce((a, q) => (q.y < a.y ? q : a), arc[0] as Vec);
      for (const l of bunLocks({ ...ctx, h: { ...h, tie: { ...h.tie, thickness: 0.85 } } }, { x: 0.1 * W, y: top.y + 0.075 * H })) locks.push({ ...l, layer: 'back', z: -1, sim: true });
      continue;
    }
    const nPk = Math.max(1, Math.round((sim.packets * m.share) / total));
    for (let k = 0; k < nPk; k++) {
      // Racine : abscisse stratifiée dans la masse, hauteur entre l'implantation et le contour du crâne.
      const s0 = lerp(m.s[0], m.s[1], (k + rnd() * 0.8) / nPk);
      // Mèches de côté : racines sur les tempes seulement (|s| ≥ 0,62), jamais au centre du front.
      const s = m.cls === 'side' ? Math.sign(s0 || 1) * (0.62 + 0.38 * Math.abs(s0)) : s0;
      const t = lerp(m.t[0], m.t[1], rnd());
      const A = hl.at(s);
      const B = arcAt(arc, s);
      const x = lerp(A.x, B.x, t);
      const y = lerp(A.y, B.y, t);
      const z0 = body.frontZ(x, y);
      const root: P3 = { x, y, z: m.rear ? -z0 : z0 };
      const dir = flowDir(root, P0, body, m, ctx.partX);
      const reach = m.cls === 'bang' && m.limit !== 'eye' ? 1 + 0.9 * sim.blade : 1;
      const len = (lerp(m.len[0], m.len[1], rnd()) * reach + sim.lengthBias * 0.2) * H * (1 + (rnd() - 0.5) * h.lengthVariance);
      const plaited = m.cls === 'braid' || m.cls === 'row';
      const nS = plaited ? 0 : sim.strandsPerPacket;
      for (let j = 0; j <= nS; j++) {
        const main = j === 0;
        const off = main ? 0 : (j / nS - 0.5) * 2.2 * m.w * W * (0.6 + rnd() * 0.8);
        const r2: P3 = { x: root.x + off, y: root.y, z: root.z };
        const pts = clamp(Math.round(len / (0.022 * H)), 8, 30);
        const spec: ChainSpec = {
          root: main ? root : (() => { const q = body.push(r2).p; return q; })(), dir: main ? dir : unit3({ x: dir.x + (rnd() - 0.5) * 0.25, y: dir.y + (rnd() - 0.5) * 0.15, z: dir.z }),
          length: len * (main ? 1 : 0.75 + rnd() * 0.4), points: pts, gravity: sim.gravity * (arch.gravity ?? 1), float: sim.float, wind: sim.wind * (0.6 + sim.windGust), gustPhase: rnd() * 6.28,
          stiffness: clamp(m.stiff * (0.5 + sim.stiffness), 0, 1), cling: sim.cling, az: Math.atan2(root.x, root.z), reach: (m.reach ?? (m.cls === 'crown' ? 0.09 + 0.1 * Math.max(0, m.lift - 0.5) : 0.06)) * W, curl: (m.curl ?? 0) + tCurl.c * h.curl, wave: (m.wave ?? 0) + tCurl.w * h.curl * 0.5,
        };
        const chain = simulateChain(spec, body);
        chains.push({ mass: m.name, pts: chain, cls: m.cls });
        const wMain = m.w * W * (plaited ? 1.3 : 1.9 + 1.7 * sim.blade) * (0.85 + 0.3 * rnd());
        let spine: Vec[] = chain.map((p) => ({ x: p.x, y: p.y }));
        // Limite sourcils : la mèche s'ARRÊTE à la limite (bout interpolé) au lieu d'être écrasée en un segment horizontal.
        if (m.limit === 'brow' || m.limit === undefined) {
          // Profondeur de retombée de la masse (implantation → sourcils), avec pente latérale : bord de frange propre à l'archétype.
          const yH = hl.yAt(root.x);
          const dEff = clamp((m.depth ?? (m.cls === 'bang' ? 1 : 0.5)) + (m.slope ?? 0) * (root.x / (0.5 * W)), 0.04, 1);
          const yCut0 = yH + (drape.yF - 0.45 * wMain - yH) * dEff - (m.cls === 'bang' ? rnd() * 0.06 * H * (0.4 + sim.blade) * dEff : 0);
          const yCut = Math.max(yCut0, Math.min(root.y + 0.07 * H, drape.yF - 0.45 * wMain)); // jamais au-dessus de la racine (corde dressée)
          const cut = spine.findIndex((v, i) => i > 0 && v.y > yCut && Math.abs(v.x) < ctx.guard.hw(v.y) - 0.012 * W);
          if (cut > 0) {
            const a = spine[cut - 1] as Vec; const b = spine[cut] as Vec;
            const f = clamp((yCut - a.y) / (b.y - a.y || 1), 0, 1);
            spine = [...spine.slice(0, cut), { x: a.x + (b.x - a.x) * f, y: yCut }];
          }
        }
        spine = spine.map((v) => drape.limit(v, m));
        if (spine.length < 3) continue;
        const zMean = chain.reduce((a, p) => a + p.z, 0) / chain.length;
        const behind = zMean < -0.06 * W || m.rear === true;
        const touchesFace = spine.some((v) => v.y > drape.yF);
        const layer: HairLock['layer'] = behind ? 'back' : touchesFace && m.limit === 'eye' ? 'over' : 'front';
        const made = lockFrom(ctx, spine, { width: main ? wMain : wMain * (0.32 + 0.12 * sim.blade), rank: main ? 'main' : 'fine', tone: m.tone + (rnd() - 0.5) * 0.3, layer: layer === 'over' ? 'back' : layer, sharp: m.sharp, raw: !plaited, tex: plaited ? 'braided' : undefined, kind: touchesFace && layer !== 'over' ? 'cheek' : m.cls === 'bang' ? 'fringe' : main ? 'flow' : 'lock', noGuard: true, ragged: h.tips.irregular, flick: h.tips.flick });
        // Les sommets du RUBAN (largeur comprise) passent aussi par le drapé : aucun bord de mèche ne déborde sur une zone interdite.
        for (const l of made) locks.push({ ...l, poly: m.limit === 'eye' || m.cls === 'bang' ? l.poly : l.poly.map((v) => drape.limit(v, m)), layer, z: zMean, sim: true });
        if (main && layer === 'front' && sim.skinShadow > 0) {
          const sh = skinShadow(spine, wMain, m.sharp, lm, drape.onSkin);
          if (sh) shadows.push(sh);
        }
      }
    }
  }
  // Ordre de profondeur : du plus loin (z petit) au plus proche, dans chaque calque.
  locks.sort((a, b) => a.z - b.z);
  const plain = locks.map(({ z: _z, ...l }) => l);
  // Masse de volume : tranche par tranche, du sommet jusqu'au bas des mèches AVANT ; masse arrière séparée (queue, nuque).
  const frontOnes = plain.filter((l) => l.layer !== 'back' && l.kind !== 'cheek');
  const backOnes = plain.filter((l) => l.layer === 'back');
  const mass = sim.mass && frontOnes.length > 4 ? columnEnvelope(frontOnes, drape.yF, 0.004 * W, 0.045 * H) : null;
  const backMass = sim.mass && backOnes.length > 4 ? asymEnvelope(backOnes, lm.hair.sideY, Math.max(...backOnes.flatMap((l) => l.poly.map((q) => q.y))), 0.006 * W) : null;
  return { locks: plain, skinShadows: shadows, mass, backMass, chains };
}

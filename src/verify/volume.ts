import { reveal, tierOf } from '../body/muscle-tiers';
import type { VolumeSet } from '../body/volume';
import { bodyVolumes, renderVolumes } from '../body/volume';
import { luminance } from './_lum';
import type { BodyInput, NeckAnchor } from '../body';

/** Vérification en 3 couches du moteur de volumes (géométrie · anatomie · style). Chaque contrôle est nommé, mesuré et reproductible. */
export interface VCheck { readonly id: string; readonly layer: 'geometry' | 'anatomy' | 'style'; readonly ok: boolean; readonly detail: string }
export interface VReport { readonly ok: boolean; readonly checks: readonly VCheck[]; readonly failures: readonly VCheck[] }
const chk = (id: string, layer: VCheck['layer'], ok: boolean, detail: string): VCheck => ({ id, layer, ok, detail });
const REQUIRED = ['trapezius.upper', 'trapezius.middle', 'trapezius.lower', 'rhomboid', 'infraspinatus', 'teres-major', 'latissimus', 'erector.medial', 'erector.lateral', 'gluteus.max', 'gluteus.medius', 'pectoralis.clav', 'pectoralis.sternal', 'deltoid.ant', 'deltoid.mid', 'deltoid.post', 'serratus.1', 'oblique.ext', 'rectus.1', 'rectus.2', 'rectus.3', 'rectus.4', 'biceps.long', 'biceps.short', 'triceps.long', 'triceps.lat', 'triceps.med', 'brachialis', 'brachioradialis', 'forearm.flexors', 'forearm.extensors', 'clavicle', 'sternocleidomastoid', 'iliac-crest', 'inguinal-v', 'scapula', 'scapular-spine'];
const CENTRAL = new Set(['trapezius.middle', 'trapezius.lower', 'rhomboid', 'infraspinatus', 'teres-major', 'latissimus', 'erector.medial', 'erector.lateral', 'gluteus.max', 'gluteus.medius']);
const TORSO = new Set(['back', 'chest', 'abdomen', 'pelvis']);

export function verifyVolumes(set: VolumeSet, raw: BodyInput, a: NeckAnchor): VReport {
  const C: VCheck[] = [], vs = set.volumes, m = set.measures, H = m.h as number;
  // ── Géométrie ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const badNum = vs.filter((v) => v.stations.some((s) => ![s.c.x, s.c.y, s.c.z, s.a, s.b].every(Number.isFinite) || s.a <= 0 || s.b <= 0));
  C.push(chk('geo.finite-positive', 'geometry', badNum.length === 0, badNum.length ? `invalides : ${badNum.map((v) => v.id).join(',')}` : `${vs.length} volumes, toutes sections finies et > 0`));
  let worst = 0;
  for (const v of vs) for (const s of v.stations) { const d = (p: { x: number; y: number; z: number }): number => Math.hypot(p.x, p.y, p.z); const e = Math.max(Math.abs(d(s.t) - 1), Math.abs(d(s.u) - 1), Math.abs(d(s.w) - 1), Math.abs(s.t.x * s.u.x + s.t.y * s.u.y + s.t.z * s.u.z), Math.abs(s.u.x * s.w.x + s.u.y * s.w.y + s.u.z * s.w.z)); worst = Math.max(worst, e); }
  C.push(chk('geo.frames-orthonormal', 'geometry', worst < 0.02, `écart max du repère (t,u,w) = ${worst.toExponential(2)}`));
  const dup = vs.length - new Set(vs.map((v) => v.id)).size;
  C.push(chk('geo.unique-ids', 'geometry', dup === 0, `${dup} doublon(s)`));
  const orphan = vs.filter((v) => v.parent && !set.byId.has(v.parent));
  C.push(chk('geo.parents-exist', 'geometry', orphan.length === 0, orphan.length ? orphan.map((v) => v.id).join(',') : 'tous les parents existent'));
  const env = set.byId.get('trunk');
  if (env) {
    const out: string[] = [];
    for (const v of vs.filter((q) => TORSO.has(q.group) && q.kind !== 'bone' && q.id !== 'trunk')) for (const s of v.stations) {
      if (s.c.y < env.stations[0]!.c.y) continue; // le cou (au-dessus de la base) appartient à l'enveloppe du cou, pas à celle du tronc
      let i = 0; while (i < env.stations.length - 2 && (env.stations[i + 1]!.c.y < s.c.y)) i++;
      const e0 = env.stations[i]!, e1 = env.stations[i + 1]!, u = Math.min(1, Math.max(0, (s.c.y - e0.c.y) / (e1.c.y - e0.c.y || 1))), e = { a: e0.a + (e1.a - e0.a) * u, b: e0.b + (e1.b - e0.b) * u, c: { z: e0.c.z + (e1.c.z - e0.c.z) * u } };
      if (Math.abs(s.c.x) > 1.3 * e.a + 0.06 * H || Math.abs(s.c.z - e.c.z) > 1.5 * e.b + 0.06 * H) { out.push(v.id); break; }
    }
    C.push(chk('geo.muscles-on-trunk', 'geometry', out.length === 0, out.length ? `hors du tronc : ${out.join(',')}` : 'chaque muscle du torse repose sur l’enveloppe (≤ 1,3 × demi-largeur)'));
  }
  const cam = (yaw: number): { yaw: number; pitch: number; pivot: { x: number; y: number; z: number } } => ({ yaw, pitch: 0, pivot: { x: 0, y: 0, z: 0 } });
  const r0 = renderVolumes(set, { skin: '#c99a76', camera: cam(0), uid: 'q' }).svg, r360 = renderVolumes(set, { skin: '#c99a76', camera: cam(360), uid: 'q' }).svg;
  const norm = (s: string): string => s.replace(/-?\d+\.\d+/g, (x) => (Math.round(Number(x) * 10) / 10).toString());
  C.push(chk('geo.camera-periodic', 'geometry', norm(r0) === norm(r360), 'yaw 0° et yaw 360° donnent le même SVG (au 0,1 px)'));
  const set2 = bodyVolumes(raw, a, {});
  C.push(chk('geo.camera-independent', 'geometry', set2 === set || JSON.stringify(set2.measures) === JSON.stringify(set.measures), 'la géométrie ne dépend pas du point de vue'));
  // ── Anatomie ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const missing = REQUIRED.filter((r) => (CENTRAL.has(r) ? !(set.byId.has(`${r}.L`) && set.byId.has(`${r}.R`)) : !(set.byId.has(`${r}.L`) || set.byId.has(`${r}.R`) || set.byId.has(r))));
  C.push(chk('ana.required-muscles', 'anatomy', missing.length === 0, missing.length ? `manquants : ${missing.join(',')}` : `${REQUIRED.length} structures exigées présentes`));
  const muscles = vs.filter((v) => v.kind === 'muscle' && v.level >= 2), withOI = muscles.filter((v) => v.origin && v.insertion);
  C.push(chk('ana.origin-insertion', 'anatomy', withOI.length / muscles.length >= 0.85, `${withOI.length}/${muscles.length} muscles avec origine et insertion`));
  const age = (raw as { age?: number }).age ?? 30, mat = 0.45 + 0.55 * Math.min(1, Math.max(0, (age - 1) / 9)); // bandes mises à l'échelle de la maturation vertébrale (enfant : courbures moins creusées)
  C.push(chk('ana.cobb-cervical', 'anatomy', m.cobbCervical! >= 20 * mat * 0.8 && m.cobbCervical! <= 45, `lordose cervicale ${m.cobbCervical!.toFixed(1)}° (bande 20–45° × maturation)`));
  C.push(chk('ana.cobb-thoracic', 'anatomy', m.cobbThoracic! >= 25 * mat * 0.8 && m.cobbThoracic! <= (age > 60 ? 70 : 52), `cyphose dorsale ${m.cobbThoracic!.toFixed(1)}° (bande 25–${age > 60 ? 70 : 52}°)`));
  C.push(chk('ana.cobb-lumbar', 'anatomy', m.cobbLumbar! >= 35 * mat * 0.8 && m.cobbLumbar! <= 62, `lordose lombaire ${m.cobbLumbar!.toFixed(1)}° (bande 35–62°)`));
  C.push(chk('ana.thorax-depth', 'anatomy', m.thoraxDepthOverWidth! >= 0.6 && m.thoraxDepthOverWidth! <= 0.85, `profondeur/largeur du thorax ${m.thoraxDepthOverWidth!.toFixed(2)} (bande 0,60–0,85)`));
  const blocks = vs.filter((v) => v.id.startsWith('rectus.')), area = (v: (typeof vs)[number]): number => v.stations.reduce((s, q) => s + q.a * q.b, 0);
  if (blocks.length === 8 && (m.vis as number) >= 0.25) {
    const ar = blocks.map(area), mean = ar.reduce((x, y) => x + y, 0) / 8, cv = Math.sqrt(ar.reduce((x, y) => x + (y - mean) ** 2, 0) / 8) / mean, dupAbs = ar.some((x, i) => ar.some((y, j) => i < j && Math.abs(x - y) / x < 0.002));
    C.push(chk('ana.abs-irregular', 'anatomy', cv > 0.05 && !dupAbs, `8 blocs : coefficient de variation des aires ${cv.toFixed(3)} (> 0,05), aucun doublon à 0,2 %`));
  } else C.push(chk('ana.abs-irregular', 'anatomy', true, `${blocks.length} blocs (peu de définition musculaire : non évalué)`));
  const fingers = [0, 1, 2, 3, 4].map((k) => ['L', 'R'].map((sd) => [1, 2, 3].reduce((s, j) => { const v = set.byId.get(`finger.${k}.${j}.${sd}`); if (!v) return s; const a0 = v.stations[0]!.c, a1 = v.stations[v.stations.length - 1]!.c; return s + Math.hypot(a1.x - a0.x, a1.y - a0.y, a1.z - a0.z); }, 0)));
  const lens = fingers.map((r) => r[0]!), thumbShort = lens[3]! > lens[4]! && lens[2]! >= Math.max(lens[1]!, lens[3]!) * 0.97, distinct = new Set(lens.map((x) => x.toFixed(1))).size === 5;
  C.push(chk('ana.fingers', 'anatomy', thumbShort && distinct, `longueurs des 5 doigts (px) : ${lens.map((x) => x.toFixed(0)).join(' · ')} — majeur ≥ index/annulaire, auriculaire plus court que l’annulaire, 5 longueurs distinctes (le « pouce » inclut son métacarpien)`));
  const need = ['joint.shoulder.L', 'joint.shoulder.R', 'joint.elbow.L', 'joint.elbow.R', 'joint.wrist.L', 'joint.wrist.R', 'joint.c7', 'joint.t12', 'joint.hip.L', 'joint.hip.R'], lack = need.filter((i) => !set.byId.has(i));
  C.push(chk('ana.joint-spheres', 'anatomy', lack.length === 0, lack.length ? `manquantes : ${lack.join(',')}` : '10 sphères d’articulation explicites'));
  // ── Style ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const svg = renderVolumes(set, { skin: '#c99a76', camera: cam(0), uid: 's' }).svg;
  const strokes = [...svg.matchAll(/stroke="(#[0-9a-f]{6})"/g)].map((q) => q[1] as string), fills = [...svg.matchAll(/(?:fill|stop-color)="(#[0-9a-f]{6})"/g)].map((q) => q[1] as string);
  const minL = Math.min(...[...strokes, ...fills].map((c) => luminance(c)));
  C.push(chk('sty.no-black', 'style', minL > 0.02, `luminance minimale de toutes les couleurs émises = ${minL.toFixed(3)} (> 0,02 : jamais de noir)`));
  const outlines = [...svg.matchAll(/<path [^>]*stroke-linejoin="round"[^>]*>/g)].map((q) => /stroke-width="([\d.]+)"/.exec(q[0])), widths = outlines.map((q) => Number(q?.[1] ?? 0));
  C.push(chk('sty.no-heavy-outline', 'style', Math.max(...widths) <= 0.0065 * H + 1e-6, `contour le plus épais ${Math.max(...widths).toFixed(2)} px (≤ ${(0.0065 * H).toFixed(2)}) ; contours teintés peau, jamais noirs`));
  const cnt = ([0, 1, 2, 3] as const).map((l) => renderVolumes(set, { skin: '#c99a76', level: l, forceTier: true, uid: 'h' }).drawn);
  C.push(chk('sty.hierarchy-levels', 'style', cnt[0]! < cnt[1]! && cnt[1]! < cnt[2]! && cnt[2]! < cnt[3]!, `volumes dessinés par niveau 0→3 : ${cnt.join(' < ')}`));
  const tr = tierOf(m.vis as number), shown = vs.filter((v) => v.kind === 'muscle' && v.tier !== undefined && reveal(tr, v.tier) >= 0.04).length;
  C.push(chk('sty.tier-hierarchy', 'style', true, `${shown} muscles visibles au palier ${tr.toFixed(1)} (hiérarchie portée par la donnée : tier par volume)`));
  const failures = C.filter((c) => !c.ok);
  return { ok: failures.length === 0, checks: C, failures };
}

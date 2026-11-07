import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultFrame, REF_SPEC, refView, renderHead } from '../../src/head-turntable';
import { encodePngRgba } from '../../src/core/png';
import { variedHead } from '../../src/head-turntable/engines/from-face';
import { HeadRenders, verifyHeadSubject, type HeadSubject } from '../../src/head-turntable/verify-head';
import { sectionAt } from '../../src/head-turntable';
import { jawCtx } from '../../src/head-turntable/engines/jaw-model';

/**
 * Galerie de têtes du moteur de visage : 9 lacets par graine (PNG à fond transparent), verdicts de la couche « tête quelconque », mesures de forme (CSV).
 * Usage : tsx artefacts-gallery.ts <dossier de sortie> [graines séparées par des virgules, défaut 1..12 ; les 6 premières sont rendues en images] [hauteurPx, défaut 600]
 */
const out = process.argv[2] ?? '/tmp/galerie', seeds = (process.argv[3] ?? '1,2,3,4,5,6,7,8,9,10,11,12').split(',').map(Number), H = Number(process.argv[4] ?? 600);
const YAWS = [0, 20, 45, 70, 90, 110, 135, 160, 180];
mkdirSync(out, { recursive: true });
const csv: string[] = ['seed;aspect;ci_moteur;longueur_crane_H;largeur_visage_U;largeur_machoire_95;gonion_y;menton_forme;taper;verdict;controles_hors_bornes'];
const reports: Record<string, unknown> = {};
const subjects: HeadSubject[] = [{ id: 'planche', spec: REF_SPEC }];
for (const s of seeds) { const v = variedHead(s); subjects.push({ id: `seed${s}`, spec: v.spec, lengthH: v.profile.derivation.lengthH }); }
for (const h of subjects) {
  const R = new HeadRenders(h.spec, 520), rep = verifyHeadSubject(h, R), all = rep.layers.flatMap((l) => l.checks), bad = all.filter((c) => !c.ok);
  reports[h.id] = { pass: rep.pass, checks: all.length, hors_bornes: bad.map((c) => ({ id: c.id, value: c.value, min: c.min, max: c.max, kind: c.kind })), couches: rep.layers.map((l) => ({ layer: l.layer, pass: l.pass, checks: l.checks })) };
  const n = Number(h.id.replace('seed', '')), v = h.id === 'planche' ? null : variedHead(n), e = h.spec.engine!, sec = sectionAt(h.spec, 0.45), aMax = Math.max(...h.spec.rows.map((r) => r.a));
  csv.push([h.id, v ? v.profile.derivation.aspect.toFixed(3) : '', v ? v.profile.derivation.ci.applied.toFixed(3) : '', (sec.zf - sec.zb).toFixed(3), (2 * aMax).toFixed(3), (sectionAt(h.spec, 0.95).a / aMax).toFixed(3), jawCtx(e).yG.toFixed(3), v ? (v.profile.face.params.chin.form ?? v.profile.face.params.chin.symphysis) : '', v ? v.profile.face.params.jaw.taper.toFixed(2) : '', rep.pass ? 'PASS' : 'FAIL', bad.filter((c) => c.kind === 'hard').length].join(';'));
  if (h.id !== 'planche' && n <= 6) { const d = join(out, h.id); mkdirSync(d, { recursive: true }); for (const yaw of YAWS) { const r = renderHead(refView(yaw), h.spec, { frame: defaultFrame(H), ss: 2 }); writeFileSync(join(d, `yaw_${yaw}.png`), encodePngRgba(r.w, r.h, r.rgba)); } }
}
writeFileSync(join(out, 'verification.json'), JSON.stringify(reports, null, 1)); writeFileSync(join(out, 'galerie.csv'), csv.join('\n') + '\n');
console.log(csv.join('\n'));

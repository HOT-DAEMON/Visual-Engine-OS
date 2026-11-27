/**
 * Rapport de vérification de l'itération 09 : tous les archétypes, toutes les couches (dos : relief du grand dorsal et du losange, niveau de l'angle inférieur ; épaule : enveloppe du deltoïde ; main : palmures, ordre des doigts).
 * Usage : `npx tsx scripts/artefacts-body-09-report.ts <dossier>` → écrit `<dossier>/rapport-verification.md` (limité à ce qui est mesuré ; les non-applicables sont signalés comme tels).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { ARCHETYPES, type BodyInput } from '../src/body';
import { bodyVolumes } from '../src/body/volume';
import { verifyBack, verifyJunctions } from '../src/verify';
import { bodyHost } from './lib/body-host';

const dir = process.argv[2] ?? 'artefacts/body-09', BH = bodyHost(), rows: string[] = [], lines: string[] = [];
mkdirSync(dir, { recursive: true });
let fails = 0, total = 0;
for (const n of Object.keys(ARCHETYPES)) {
  const raw = ARCHETYPES[n as keyof typeof ARCHETYPES] as BodyInput, set = bodyVolumes(raw, BH.a, {}), b = verifyBack(set, raw, BH.a), j = verifyJunctions(set, raw, BH.a);
  const all = [...b.checks, ...j.checks], mine = all.filter((c) => /lat-|trap-|inferior-angle-level|front-line-vertical|deltoid-wrap|hand-webs|finger-order/.test(c.id)), bad = mine.filter((c) => !c.ok);
  fails += bad.length; total += mine.length;
  // Deux contrôles portent l'identifiant `back.ana.inferior-angle-level` : celui du VOLUME de l'omoplate (back.ts, bande « T6–T9 ») et celui du RELIEF dessiné (back-relief.ts, bande « 6,0–8,6 »).
  const lvl = (re: RegExp): string => /à ([0-9.]+) vertèbres/.exec(all.find((c) => c.id === 'back.ana.inferior-angle-level' && re.test(c.detail))?.detail ?? '')?.[1] ?? '?', iaVol = lvl(/T6–T9/), iaRel = lvl(/6,0–8,6/), na = mine.filter((c) => c.detail.includes('non applicable')).length;
  rows.push(`| ${n} | ${mine.length} | ${bad.length} | ${na} | ${iaVol} | ${iaRel} |`);
  for (const c of mine) lines.push(`- \`${n}\` · ${c.layer} · \`${c.id}\` · ${c.ok ? 'OK' : '**ÉCHEC**'} — ${c.detail}`);
}
writeFileSync(`${dir}/rapport-verification.md`, `# Rapport de vérification — itération 09\n\n${total} contrôles évalués, ${fails} échec(s).\n\n| archétype | contrôles | échecs | non applicables (style non prouvé) | angle inférieur, volume (vertèbres sous C7) | angle inférieur, relief dessiné |\n|---|---|---|---|---|---|\n${rows.join('\n')}\n\n## Détail\n\n${lines.join('\n')}\n`);
console.log(`écrit ${dir}/rapport-verification.md : ${total} contrôles, ${fails} échec(s)`);

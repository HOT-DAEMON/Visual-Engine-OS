/**
 * Travailleur de campagne : reçoit des graines, renvoie pour chacune la cellule PNG, l'étiquette et la ligne de rapport.
 * Processus enfant (fork) : un cœur par travailleur, aucun état partagé ; le résultat d'une graine ne dépend que de la graine.
 */
import { generateRandomFace } from '../../src/generation/random-face';
import { verifyFace } from '../../src/verify';
import { faceLandmarks } from '../../src/face';
import { cell } from './board';

export interface CampaignCell { readonly seed: number; readonly png: string; readonly label: string; readonly row: Record<string, unknown>; readonly corrections: string[]; readonly warnings: string[] }
const now = (): number => Number(process.hrtime.bigint()) / 1e6;

export function runSeed(seed: number, W: number, H: number): CampaignCell {
  const t = now();
  const face = generateRandomFace(seed, { structure: true });
  const rep = verifyFace(face);
  const lm = faceLandmarks(face.params, face.width, face.height);
  const c = cell({ seed, opts: { structure: true } as never }, W, H);
  const label = `#${seed}${rep.failures.length ? ' ✗' : rep.warnings.length ? ' !' : ''}`;
  const row = { seed, ok: rep.ok, failures: rep.failures.map((f) => f.id), warnings: rep.warnings.map((f) => f.id), corrections: lm.corrections.map((k) => k.id), ms: +(now() - t).toFixed(0) };
  return { seed, png: c.png.toString('base64'), label, row, corrections: lm.corrections.map((k) => k.id), warnings: rep.warnings.map((f) => f.id) };
}

if (process.send) {
  process.on('message', (m: { seeds: number[]; W: number; H: number }) => {
    for (const s of m.seeds) process.send!(runSeed(s, m.W, m.H));
    process.send!('done');
  });
}

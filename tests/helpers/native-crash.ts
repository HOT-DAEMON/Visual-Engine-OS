import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** `true` si resvg avorte le processus enfant sur ce SVG (panic natif), `false` s'il le rastérise. */
export function crashesNatively(svg: string): boolean {
  const f = join(mkdtempSync(join(tmpdir(), 'vo-crash-')), 't.svg');
  writeFileSync(f, svg);
  try { execFileSync(process.execPath, ['--import', 'tsx', join(__dirname, 'raster-child.ts'), f], { stdio: 'pipe', timeout: 60000 }); return false; } catch { return true; }
}

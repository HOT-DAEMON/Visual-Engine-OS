/** COPIE FIGÉE de l'ancienne `pathBox` (regex + jetons), conservée comme ORACLE : la version rapide de `src/core/pathbox.ts` doit lui être strictement égale. Ne pas modifier. */
import type { Box } from '../../src/core/pathbox';
/** Nombre de paramètres de chaque commande (une commande peut répéter son jeu de paramètres). */
const ARITY: Readonly<Record<string, number>> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

export function pathBoxRef(d: string): Box | null {
  // Découpe en jetons : une lettre de commande ou un nombre (formes `1.5`, `-.5`, `1e-3`, `1.2.3` géré par la regex).
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g);
  if (!tokens) return null;
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  let cx = 0; let cy = 0; let sx = 0; let sy = 0; // point courant et début de sous-chemin
  const touch = (x: number, y: number): void => {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  };
  let i = 0;
  let cmd = '';
  while (i < tokens.length) {
    const t = tokens[i] as string;
    if (/[a-zA-Z]/.test(t)) { cmd = t; i++; if (cmd === 'Z' || cmd === 'z') { cx = sx; cy = sy; touch(cx, cy); } continue; }
    const up = cmd.toUpperCase();
    const n = ARITY[up];
    if (n === undefined || n === 0) { i++; continue; } // nombre orphelin : ignoré
    const a = tokens.slice(i, i + n).map(Number);
    if (a.length < n || a.some((v) => !Number.isFinite(v))) break;
    i += n;
    const rel = cmd !== up; // minuscule = coordonnées relatives au point courant
    const ox = rel ? cx : 0; const oy = rel ? cy : 0;
    if (up === 'H') { cx = a[0]! + ox; touch(cx, cy); }
    else if (up === 'V') { cy = a[0]! + oy; touch(cx, cy); }
    else if (up === 'A') {
      // Arc : la courbe reste à l'intérieur de [point courant, point final] élargi du plus grand rayon (majorant simple et sûr).
      const r = Math.max(Math.abs(a[0]!), Math.abs(a[1]!));
      const ex = a[5]! + ox; const ey = a[6]! + oy;
      touch(cx - r, cy - r); touch(cx + r, cy + r); touch(ex - r, ey - r); touch(ex + r, ey + r);
      cx = ex; cy = ey;
    } else {
      // M L T : un point ; C S Q : points de contrôle puis point final — tous inclus dans la boîte.
      for (let k = 0; k < n; k += 2) touch(a[k]! + ox, a[k + 1]! + oy);
      cx = a[n - 2]! + ox; cy = a[n - 1]! + oy;
      if (up === 'M') { sx = cx; sy = cy; cmd = rel ? 'l' : 'L'; } // paires suivantes d'un M = tracés L
    }
  }
  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}


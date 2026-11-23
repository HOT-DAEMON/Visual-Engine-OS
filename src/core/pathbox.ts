/**
 * Boîte englobante CONSERVATRICE d'un attribut `d` de chemin SVG.
 *
 * Contrat : la boîte retournée contient TOUJOURS la courbe (jamais plus petite) ; elle peut être un peu plus grande
 * (les points de contrôle des Bézier forment une enveloppe convexe qui contient la courbe). Elle sert à dimensionner
 * la région d'un filtre de flou : une boîte trop grande coûte du temps, une boîte trop petite COUPE le halo.
 * Commandes gérées : M L H V C S Q T A Z, absolues et relatives. Entrée vide ou sans nombre → `null`.
 */
export interface Box { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

/** Nombre de paramètres de chaque commande (une commande peut répéter son jeu de paramètres). */
const ARITY: Readonly<Record<string, number>> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

const P10 = [1, 1e1, 1e2, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10, 1e11, 1e12, 1e13, 1e14, 1e15, 1e16, 1e17, 1e18, 1e19, 1e20, 1e21, 1e22];
const isDigit = (c: number): boolean => c >= 48 && c <= 57;

/**
 * Découpage en jetons SANS regex ni tableau (c'était 70 % du coût de l'audit d'emprise, docs/PERF-4.md) ; mêmes jetons que l'ancienne expression
 * `/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g` (prouvé par test contre l'ancienne version). Un nombre sans exposant de ≤ 15 chiffres et ≤ 22
 * décimales vaut mantisse / 10^décimales : une seule division de deux flottants exacts, arrondie correctement, donc IDENTIQUE à `Number(jeton)`.
 */
class Scan {
  pos = 0; num = 0; cmd = '';
  constructor(private readonly d: string) {}
  /** 0 = fin, 1 = lettre (`cmd`), 2 = nombre (`num`). */
  next(): 0 | 1 | 2 {
    const d = this.d, n = d.length;
    while (this.pos < n) {
      const p = this.pos, c = d.charCodeAt(p);
      if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) { this.cmd = d[p] as string; this.pos = p + 1; return 1; }
      let q = p; const neg = c === 45; if (neg || c === 43) q++;
      let r = q; while (r < n && isDigit(d.charCodeAt(r))) r++;
      let end = -1, fracStart = -1;
      if (r < n && d.charCodeAt(r) === 46) {
        let f = r + 1; while (f < n && isDigit(d.charCodeAt(f))) f++;
        if (f > r + 1) { end = f; fracStart = r + 1; } else if (r > q) end = r + 1; // « 5. » : la 2e alternative prend le point
      } else if (r > q) end = r;
      if (end < 0) { this.pos = p + 1; continue; }
      const mant = end;
      let exp = false;
      if (end < n && (d.charCodeAt(end) | 32) === 101) { let k = end + 1; if (k < n && (d.charCodeAt(k) === 43 || d.charCodeAt(k) === 45)) k++; const k0 = k; while (k < n && isDigit(d.charCodeAt(k))) k++; if (k > k0) { end = k; exp = true; } }
      this.pos = end;
      const intEnd = r, fc = fracStart < 0 ? 0 : mant - fracStart, nd = (r - q) + fc; // `r` = fin des chiffres entiers (le point final de « 61. » n'est PAS un chiffre)
      if (!exp && nd <= 15 && fc <= 22) {
        let m = 0; for (let i = q; i < intEnd; i++) m = m * 10 + (d.charCodeAt(i) - 48);
        if (fracStart >= 0) for (let i = fracStart; i < mant; i++) m = m * 10 + (d.charCodeAt(i) - 48);
        const v = m / (P10[fc] as number); this.num = neg ? -v : v;
      } else this.num = Number(d.slice(p, end));
      return 2;
    }
    return 0;
  }
}

export function pathBox(d: string): Box | null {
  const sc = new Scan(d);
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  let cx = 0; let cy = 0; let sx = 0; let sy = 0; // point courant et début de sous-chemin
  const touch = (x: number, y: number): void => {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  };
  let cmd = ''; let any = false; const a: number[] = [0, 0, 0, 0, 0, 0, 0];
  for (let t = sc.next(); t !== 0; t = sc.next()) {
    any = true;
    if (t === 1) { cmd = sc.cmd; if (cmd === 'Z' || cmd === 'z') { cx = sx; cy = sy; touch(cx, cy); } continue; }
    const up = cmd.toUpperCase();
    const n = ARITY[up];
    if (n === undefined || n === 0) continue; // nombre orphelin : ignoré
    a[0] = sc.num;
    let ok = Number.isFinite(a[0]); // `1e999` : arrêt, comme avant
    for (let k = 1; ok && k < n; k++) { const u = sc.next(); if (u !== 2 || !Number.isFinite(sc.num)) { ok = false; break; } a[k] = sc.num; } // lettre ou fin au milieu d'un jeu de paramètres : arrêt, comme avant
    if (!ok) break;
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
  if (!any || !Number.isFinite(minX)) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Boîte élargie de `p` de chaque côté. */
export const padBox = (b: Box, p: number): Box => ({ x: b.x - p, y: b.y - p, w: b.w + 2 * p, h: b.h + 2 * p });

/** Réunion de boîtes (liste non vide). */
export function unionBox(bs: readonly Box[]): Box {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const b of bs) { x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

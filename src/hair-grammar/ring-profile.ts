/**
 * PROFIL LISSE DE L'OMBRE AVAL, dérivé des mesures brutes de l'éventail de `references/hair/60.jpg` (passe 8).
 * Les passes 6–7 modélisaient l'ombre par trois paliers à bords durs ; la référence est un dégradé. Ici le profil n'est pas inventé : il est lu sur les points mesurés
 * (`measures-ref60.json` → `fan.profile`, luminance médiane par rayon) puis réduit à des nœuds `[x, w]` :
 *   x = distance au bord aval du reflet / longueur de retour complet (0,418 R) ; w = creux relatif au creux maximal (1 = creux de −33,5 %, 0 = niveau du ruban).
 * Méthode (fonction pure, rejouée par `tests/hair-engine-ring-shade.test.ts` contre le JSON) :
 *   1. points entre le bord aval du reflet et r = 0,94 R (au-delà : liseré blanc du bord de l'éventail, +104 %, exclu comme dans `HAIR-PASS7-MEASURES.md`) ;
 *   2. régression ISOTONE non croissante (PAV) : l'ombre ne se creuse pas en s'éloignant du reflet, le bruit de la trame est absorbé ;
 *   3. interpolation linéaire entre les centres de blocs, échantillonnée à x = 0, 0,1 … 1 ; w(0) = 1 par définition du creux ; w(1) = 0 imposé : l'ombre doit s'éteindre sans bord
 *      (la mesure donne 0,058 à x ≈ 1, soit 1,9 % de luminance : écart assumé, documenté dans `HAIR-PASS8.md`).
 */
export type ShadeNode = readonly [x: number, w: number];

export function deriveShadeProfile(raw: readonly (readonly [number, number])[], edgeAt: number, dip: number, fullLen: number, steps = 10): ShadeNode[] {
  const sorted = raw.filter((p) => p[0] > 0.7).map((p) => p[1]).sort((a, b) => a - b); const base = sorted[Math.floor(sorted.length / 2)] as number;
  const pts = raw.filter((p) => p[0] > edgeAt && p[0] < 0.94).map((p) => [(p[0] - edgeAt) / fullLen, Math.max(0, (p[1] / base - 1) / dip)] as const);
  // PAV, ordre non croissant : on fusionne tout bloc plus bas que son voisin de droite.
  const blocks: { m: number; n: number; xs: number[] }[] = [];
  for (const [x, w] of pts) {
    blocks.push({ m: w, n: 1, xs: [x] });
    while (blocks.length > 1 && (blocks[blocks.length - 2] as { m: number }).m < (blocks[blocks.length - 1] as { m: number }).m) {
      const b = blocks.pop() as { m: number; n: number; xs: number[] }; const a = blocks.pop() as { m: number; n: number; xs: number[] };
      blocks.push({ m: (a.m * a.n + b.m * b.n) / (a.n + b.n), n: a.n + b.n, xs: [...a.xs, ...b.xs] });
    }
  }
  const knots: [number, number][] = blocks.map((b) => [b.xs.reduce((s, v) => s + v, 0) / b.xs.length, b.m]);
  const at = (x: number): number => {
    if (x <= (knots[0] as [number, number])[0]) return (knots[0] as [number, number])[1];
    for (let i = 1; i < knots.length; i++) { const p = knots[i - 1] as [number, number]; const q = knots[i] as [number, number]; if (x <= q[0]) return p[1] + ((q[1] - p[1]) * (x - p[0])) / (q[0] - p[0] || 1); }
    return (knots[knots.length - 1] as [number, number])[1];
  };
  return Array.from({ length: steps + 1 }, (_, j): ShadeNode => { const x = j / steps; return [x, j === 0 ? 1 : j === steps ? 0 : Math.max(0, Math.min(1, at(x)))]; });
}

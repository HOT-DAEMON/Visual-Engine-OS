import { VAULT_STRUCTURES } from '../skull/vault-registry';
import { headRelief } from './engines/head-relief';
import { vaultRise } from './engines/vault-model';
import { silhouetteProfile } from './silhouette';
import { fy } from './engines/units';
import { VAULT_VIEWS, vaultRender } from './vault-lab';
import { place, placeAll } from './vault-visibility';
import type { HeadTurnSpec } from './types';
import { check, layerOf, type Check, type LayerReport } from './verify-types';

/**
 * COUCHE DE VÉRIFICATION DE RENDU DE LA VOÛTE CRÂNIENNE : cohérence GÉOMÉTRIQUE (maillage valide, relief continu et borné, sommet monotone), cohérence ANATOMIQUE (ordre des repères,
 * profondeur des tissus, œil et glabelle, visibilité des structures, sutures masquées par défaut) et STYLE ARTISTIQUE (silhouette lisse, relief lu comme un modelé et non comme du bruit).
 * Les bornes sont des conventions écrites AVANT la mesure (docs/SKULL-VAULT-VALIDATION.md) ; elles valent pour toute combinaison de paramètres, y compris les extrêmes.
 */
const G = 'geometry' as const, A = 'anatomy' as const, S = 'style' as const, D = 180 / Math.PI;

function scanRelief(spec: HeadTurnSpec): { amp: number; step: number; face: number } {
  const rel = headRelief(spec.engine); if (!rel) return { amp: 0, step: 0, face: 0 };
  let amp = 0, step = 0, face = 0;
  for (let y = 0.02; y <= 1.0; y += 0.0125) for (let az = 0; az <= 180; az += 3) {
    const v = rel(y, az / D); amp = Math.max(amp, Math.abs(v));
    if (az > 0) step = Math.max(step, Math.abs(v - rel(y, (az - 3) / D)));
    if (y > 0.02) step = Math.max(step, Math.abs(v - rel(y - 0.0125, az / D)));
    if (az <= 4 && y > 0.5) face = Math.max(face, Math.abs(v));
  }
  return { amp, step, face };
}

export function vaultGeometryChecks(spec: HeadTurnSpec): Check[] {
  const e = spec.engine!, r = scanRelief(spec), rows = spec.rows, rise = vaultRise(e);
  const mono = rows.every((q, i) => i === 0 || q.y > rows[i - 1]!.y), valid = rows.every((q) => q.a >= 0 && q.zf > q.zb && [q.pf, q.qf, q.pb, q.qb].every((x) => x === undefined || (x >= 1.5 && x <= 3.3)));
  return [
    check(G, 'vault.geo.rows', 'Coupes : hauteurs strictement croissantes, a ≥ 0, zf > zb, exposants dans [1,5 ; 3,3] (1 = valide)', mono && valid ? 1 : 0, 1, 1),
    check(G, 'vault.geo.rise', 'Hauteur réelle de la voûte : déplacement du sommet (U), borné pour que le remappage reste monotone (|Δ| < 0,1)', Math.abs(rise), 0, 0.1),
    check(G, 'vault.geo.amplitude', 'Relief de la voûte et des joues : amplitude radiale maximale (U) [≈ 0,06 U ≈ 14 mm d\'une tête de 230 mm, extrêmes compris]', r.amp, 0, 0.06),
    check(G, 'vault.geo.continuity', 'Relief : plus grand saut entre deux échantillons voisins (0,0125 U ou 3°) : une falaise ferait une arête dans le maillage', r.step, 0, 0.014),
    check(G, 'vault.geo.face', 'Relief à moins de 4° du plan de face, sous la glabelle (U) : le nez, la bouche et le menton restent ceux des moteurs', r.face, 0, 0.002),
  ];
}

export function vaultAnatomyChecks(spec: HeadTurnSpec): Check[] {
  const e = spec.engine!, P = (id: string, s: -1 | 0 | 1 = 1) => place(spec, VAULT_STRUCTURES.find((q) => q.id === id)!, s, VAULT_VIEWS.profil), eyeY = fy(e.lm.eyeY);
  const gl = P('glabella', 0), pt = P('pterion'), ma = P('mastoid-process'), pa = P('parietal-bone'), fr = P('frontal-bone', 0), ve = P('vertex', 0), tb = P('temporal-bone'), nu = P('nuchal-line', 0);
  const vis = VAULT_VIEWS.dos, back = placeAll(spec, vis, vaultRender(spec, 'dos', 240));
  return [
    check(A, 'vault.anat.order', 'Ordre des repères de haut en bas (1 = vertex < front < glabelle < ptérion < mastoïde < ligne nuchale)', +(ve.local.y < fr.local.y && fr.local.y < gl.local.y && gl.local.y < pt.local.y && pt.local.y < ma.local.y && ma.local.y > nu.local.y - 0.2), 1, 1),
    check(A, 'vault.anat.glabella.eye', 'Glabelle au-dessus de la ligne des yeux (U ; y vers le bas) [canon : 0,03 – 0,2 U]', eyeY - gl.local.y, 0.03, 0.2),
    check(A, 'vault.anat.parietal.back', 'Éminence pariétale derrière le ptérion (z décroissant vers l\'arrière, U)', pt.local.z - pa.local.z, 0.05, 0.6),
    check(A, 'vault.anat.tissue.depth', 'Profondeur de l\'os : tempe (muscle temporal) plus profonde que glabelle et mastoïde (rapport tempe / glabelle)', tb.depthU / gl.depthU, 3, 9),
    check(A, 'vault.anat.sutures.hidden', 'Sutures et lignes masquées par défaut dans le rendu (nombre visibles par défaut parmi les sutures et lignes)', VAULT_STRUCTURES.filter((q) => (q.kind === 'suture' || q.kind === 'line') && q.visibleByDefault).length, 0, 0),
    check(A, 'vault.anat.visible.back', 'Vue de dos : occipital, mastoïdes et pariétaux sont visibles (nombre / 4)', back.filter((p) => ['occipital-bone', 'mastoid-process', 'parietal-bone'].includes(p.id) && p.visible).length, 4, 5),
  ];
}

export function vaultStyleChecks(spec: HeadTurnSpec): Check[] {
  const c: Check[] = [];
  for (const v of ['face', 'profil', 'dos'] as const) {
    const r = vaultRender(spec, v, 360, false), s = silhouetteProfile(r, Array.from({ length: 40 }, (_, i) => 0.05 + i * 0.02)), l = s.map((q) => q.left);
    let kink = 0; for (let i = 1; i + 1 < l.length; i++) kink = Math.max(kink, Math.abs(l[i - 1]! - 2 * l[i]! + l[i + 1]!));
    c.push(check(S, `vault.style.silhouette.${v}`, `Silhouette (${v}) : plus grande cassure (dérivée seconde, U) : un contour d'illustration est lisse, sans angle parasite`, kink, 0, 0.09));
  }
  const lit = vaultRender(spec, 'trois_quarts', 360, true); let hf = 0, n = 0;
  for (let y = 1; y + 1 < lit.h; y++) for (let x = 1; x + 1 < lit.w; x++) { const i = y * lit.w + x; if (lit.ids[i] === 0 || lit.ids[i - 1] === 0 || lit.ids[i + 1] === 0 || lit.ids[i - lit.w] === 0 || lit.ids[i + lit.w] === 0) continue; const k = (j: number): number => lit.rgba[j * 4]!; hf += Math.abs(4 * k(i) - k(i - 1) - k(i + 1) - k(i - lit.w) - k(i + lit.w)) / 255; n++; }
  c.push(check(S, 'vault.style.shading.noise', 'Modelé : énergie haute fréquence moyenne (laplacien, 0 – 1) : le relief se lit comme un volume et non comme du bruit', n ? hf / n : 0, 0, 0.06));
  return c;
}
export const vaultReport = (spec: HeadTurnSpec): LayerReport[] => [layerOf(G, vaultGeometryChecks(spec)), layerOf(A, vaultAnatomyChecks(spec)), layerOf(S, vaultStyleChecks(spec))];

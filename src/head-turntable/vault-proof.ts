import { SkullParams } from '../skull/types';
import { VAULT_KEYS } from '../skull/vault-params';
import { VAULT_STRUCTURES } from '../skull/vault-registry';
import type { VaultView } from '../skull/vault-registry-types';
import type { generateRandomProfile } from '../generation/random-skull';
import type { TurnRender } from './types';
import { mirrorXor, renderDiff, vaultRender, vaultSpec, VAULT_SEED, type Diff } from './vault-lab';

/**
 * CAS DE PREUVE DE LA VOÛTE : source UNIQUE des tests et des planches. Chaque paramètre a trois valeurs (minimale, nominale, maximale), une configuration de BASE commune aux trois
 * (même graine, même caméra, même lumière, même rendu : seule la valeur change) et les vues où son effet est attendu (lues dans le registre). Deux paramètres ne se prouvent qu'en
 * combinaison : `scalp` et `boneShow` FILTRENT le relief osseux (sans relief actif ils n'ont rien à filtrer), `asymFaceCoupling` ne reporte que l'asymétrie d'un visage asymétrique.
 */
type Profile = ReturnType<typeof generateRandomProfile>;
export interface ProofCase {
  readonly id: string; readonly lo: number; readonly hi: number;
  /** Valeur nominale : 0 (mesures neutres) ou la valeur de la graine (paramètres existants : `undefined` = ne pas surcharger). */
  readonly nom: number | undefined;
  readonly base: Partial<SkullParams>; readonly views: readonly VaultView[]; readonly faceOv?: (p: Profile) => Profile;
  /** `mirror` : l'effet est une DISSYMÉTRIE gauche / droite (quelques mm) : on compare la dissymétrie de silhouette (`mirrorXor`) au lieu des pixels ; seuil `MIRROR_MIN`. */
  readonly metric?: 'mirror';
}
/** Reliefs osseux tous actifs : ce que `scalp` et `boneShow` ont à filtrer. */
export const RELIEF_ON: Partial<SkullParams> = { mastoid: 1, nuchalLine: 1, glabella: 1, temporalHollow: 1, suturesShow: 1 };
/** Visage franchement asymétrique (asymétrie crânienne reportée = +1) avec un crâne sans asymétrie propre. */
const asymFace = (p: Profile): Profile => ({ ...p, face: { ...p.face, params: { ...p.face.params, asymmetry: { ...p.face.params.asymmetry, eyeDy: 0.012, eyeRollDeg: 4, mouthTiltDeg: 4 } } } });

const ALL_VIEWS: readonly VaultView[] = ['face', 'trois_quarts', 'profil', 'trois_quarts_arriere', 'dos', 'dessus'];
const viewsOf = (key: string): readonly VaultView[] => {
  const v = VAULT_STRUCTURES.filter((s) => s.params.includes(key)).flatMap((s) => s.influence.views);
  return v.length ? [...new Set(v)] : ALL_VIEWS;
};
/** Paramètres EXISTANTS du crâne (hors cou et cheveux) dont la valeur doit aussi être consommée et visible. */
export const EXISTING_PROOF_KEYS = ['length', 'vaultHeight', 'vaultPeak', 'foreheadSlope', 'frontalBulge', 'browRidge', 'occiput', 'inion', 'zygoma', 'maxilla'] as const;

export function proofCases(): ProofCase[] {
  const out: ProofCase[] = [];
  for (const k of VAULT_KEYS) {
    const lo = k === 'suturesShow' || k === 'asymFaceCoupling' ? 0 : -1;
    if (k === 'boneShow') continue;   // prouvé plus bas, avec les reliefs actifs
    const base: Partial<SkullParams> = {};
    out.push({ id: k, lo, hi: 1, nom: k === 'asymFaceCoupling' ? 0.5 : 0, base, views: k === 'asymFaceCoupling' ? ALL_VIEWS : viewsOf(k), ...(k === 'asymFaceCoupling' ? { faceOv: asymFace, metric: 'mirror' as const } : {}) });
  }
  out.push({ id: 'boneShow', lo: -1, hi: 1, nom: 0, base: RELIEF_ON, views: ['profil', 'trois_quarts', 'trois_quarts_arriere', 'dessus'] });
  out.push({ id: 'scalp', lo: 0.05, hi: 0.95, nom: undefined, base: RELIEF_ON, views: ['profil', 'trois_quarts', 'trois_quarts_arriere', 'dessus'] });
  for (const k of EXISTING_PROOF_KEYS) out.push({ id: k, lo: k === 'length' ? -1 : 0, hi: 1, nom: undefined, base: {}, views: viewsOf(k) });
  return out;
}
/** Valeurs absolues des surcharges pour une valeur du paramètre. */
export const caseOverride = (c: ProofCase, v: number | undefined): Partial<SkullParams> => ({ ...c.base, ...(v === undefined ? {} : { [c.id]: v }) });
const specs = new Map<string, ReturnType<typeof vaultSpec>>();
/** Spec mémoïsée par (cas, valeur, graine) : un même rendu n'est jamais refait (tests, planches et enregistrement partagent les mêmes têtes). */
export const caseSpec = (c: ProofCase, v: number | undefined, seed = VAULT_SEED) => {
  // La base fait partie de la clé : des cas de même id mais de base différente (grilles d'interactions) sont des têtes différentes.
  const k = `${c.id}|${v}|${seed}|${JSON.stringify(c.base)}`; let s = specs.get(k);
  if (!s) { s = vaultSpec(caseOverride(c, v), seed, true, c.faceOv); specs.set(k, s); }
  return s;
};

export interface ProofResult { readonly id: string; readonly perView: Record<string, { lo_nom: Diff; nom_hi: Diff; lo_hi: Diff }>; readonly perceptible: boolean; readonly best: { view: VaultView; xor: number; shadeFrac: number } }
/** Mesure : pour chaque vue attendue, rend min / nominal / max et compare (lo↔nom, nom↔hi, lo↔hi). Preuve = au moins une vue attendue où lo↔hi est perceptible ET où lo↔nom ou nom↔hi l'est aussi (le paramètre agit des deux côtés du nominal ou au moins d'un). */
/** Écart minimal de dissymétrie de silhouette (part de l'union) jugé perceptible pour une mesure `mirror`. */
export const MIRROR_MIN = 0.001;
export type Renderer = (spec: ReturnType<typeof vaultSpec>, view: VaultView, H: number) => TurnRender;
export function measureProof(c: ProofCase, H = 300, seed = VAULT_SEED, render: Renderer = vaultRender): ProofResult {
  const sLo = caseSpec(c, c.lo, seed), sNo = caseSpec(c, c.nom, seed), sHi = caseSpec(c, c.hi, seed), perView: ProofResult['perView'] = {};
  let best = { view: c.views[0]!, xor: 0, shadeFrac: 0 }, ok = false;
  for (const v of c.views) {
    const a = render(sLo, v, H), b = render(sNo, v, H), d = render(sHi, v, H);
    const md = (p: TurnRender, q: TurnRender): Diff => { const x = Math.abs(mirrorXor(p) - mirrorXor(q)); return { xor: x, shadeFrac: 0, perceptible: x >= MIRROR_MIN }; };
    const r = c.metric === 'mirror' ? { lo_nom: md(a, b), nom_hi: md(b, d), lo_hi: md(a, d) } : { lo_nom: renderDiff(a, b), nom_hi: renderDiff(b, d), lo_hi: renderDiff(a, d) };
    perView[v] = r;
    if (r.lo_hi.perceptible && (r.lo_nom.perceptible || r.nom_hi.perceptible)) ok = true;
    if (r.lo_hi.xor + r.lo_hi.shadeFrac > best.xor + best.shadeFrac) best = { view: v, xor: r.lo_hi.xor, shadeFrac: r.lo_hi.shadeFrac };
  }
  return { id: c.id, perView, perceptible: ok, best };
}

/**
 * CONTRATS DU CORPS : pour chaque composant, ce dont il DÉPEND (`needs`), les paramètres qu'il LIT (`reads`, préfixes de chemins) et les atomes qu'il
 * FOURNIT (`provides`, préfixes d'identifiants). Ce n'est pas de la documentation : `tests/body-contracts.test.ts` PERTURBE chaque paramètre et exige que
 * seuls changent des composants situés en aval d'un lecteur déclaré — un contrat qui ment fait échouer le test. Même principe que `src/face/contracts`.
 */
export interface BodyContract { readonly needs: readonly string[]; readonly reads: readonly string[]; readonly provides: readonly string[] }
const CORE = ['age', 'sex', 'adiposity', 'muscularity', 'frame.', 'posture.'] as const;
const arm = (s: 'left' | 'right'): readonly string[] => [...CORE, 'limbs.', `pose.${s}.`];

export const BODY_CONTRACTS: Readonly<Record<string, BodyContract>> = {
  neck: { needs: [], reads: [], provides: ['neck'] },
  'torso-shell': { needs: ['neck'], reads: CORE, provides: ['torso.shell'] },
  'shoulder-girdle': { needs: ['torso-shell'], reads: CORE, provides: ['shoulder.', 'neck.scm'] },
  pectorals: { needs: ['torso-shell'], reads: CORE, provides: ['pec'] },
  breasts: { needs: ['pectorals'], reads: [...CORE, 'breast.'], provides: ['breast', 'torso.nipple'] },
  abdominals: { needs: ['torso-shell'], reads: CORE, provides: ['torso.rectus', 'abs.', 'torso.inguinal'] },
  flank: { needs: ['torso-shell'], reads: CORE, provides: ['torso.serratus', 'serratus.', 'torso.lat', 'torso.oblique'] },
  skeleton: { needs: ['torso-shell'], reads: CORE, provides: ['bone.'] },
  'upper-arm.L': { needs: ['torso-shell'], reads: arm('left'), provides: ['arm.upper.L', 'arm.stump.L', 'deltoid', 'biceps', 'brachialis', 'coracobrachialis', 'triceps', 'shoulder.joint'] },
  'forearm.L': { needs: ['upper-arm.L'], reads: arm('left'), provides: ['arm.fore.L', 'forearm.', 'brachioradialis', 'pronator-teres', 'flexor-', 'palmaris-longus', 'extensor-', 'elbow.', 'wrist.'] },
  'hand.L': { needs: ['forearm.L'], reads: [...arm('left'), 'fingers'], provides: ['hand.', 'finger.'] },
  'upper-arm.R': { needs: ['torso-shell'], reads: arm('right'), provides: ['arm.upper.R', 'arm.stump.R', 'deltoid', 'biceps', 'brachialis', 'coracobrachialis', 'triceps', 'shoulder.joint'] },
  'forearm.R': { needs: ['upper-arm.R'], reads: arm('right'), provides: ['arm.fore.R', 'forearm.', 'brachioradialis', 'pronator-teres', 'flexor-', 'palmaris-longus', 'extensor-', 'elbow.', 'wrist.'] },
  'hand.R': { needs: ['forearm.R'], reads: [...arm('right'), 'fingers'], provides: ['hand.', 'finger.'] },
};

/** Ordre de résolution topologique ; lève si un `needs` est inconnu ou s'il y a un cycle. */
export function bodyOrder(c: Readonly<Record<string, BodyContract>> = BODY_CONTRACTS): string[] {
  const out: string[] = [], state = new Map<string, 1 | 2>();
  const visit = (k: string): void => {
    const st = state.get(k);
    if (st === 2) return;
    if (st === 1) throw new Error(`cycle de contrats au composant « ${k} »`);
    const ct = c[k];
    if (!ct) throw new Error(`composant inconnu : « ${k} »`);
    state.set(k, 1);
    ct.needs.forEach(visit);
    state.set(k, 2);
    out.push(k);
  };
  Object.keys(c).forEach(visit);
  return out;
}
/** Composants situés EN AVAL de `roots` (eux-mêmes inclus) : ce qui peut légitimement changer quand un de `roots` change. */
export function downstream(roots: readonly string[], c: Readonly<Record<string, BodyContract>> = BODY_CONTRACTS): Set<string> {
  const set = new Set(roots);
  for (let grew = true; grew; ) { grew = false; for (const [k, ct] of Object.entries(c)) if (!set.has(k) && ct.needs.some((n) => set.has(n))) { set.add(k); grew = true; } }
  return set;
}
/** Composants qui déclarent lire le paramètre `path` (ex. `pose.left.curl.2`). */
export const readersOf = (path: string, c: Readonly<Record<string, BodyContract>> = BODY_CONTRACTS): string[] => Object.entries(c).filter(([, ct]) => ct.reads.some((r) => (r.endsWith('.') ? path.startsWith(r) : path === r || path.startsWith(`${r}.`)))).map(([k]) => k);

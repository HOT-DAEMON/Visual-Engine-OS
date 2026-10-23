import { memoPure } from '../../perf';
import type { Vec } from '../../geometry/eye/primitives';
import type { FaceEars } from '../../schema/face-ear';
import { box, pt } from './plan-geom';
import { buildOutline } from './outline';
import { resolveEar } from './morph';
import { buildStructures } from './structures';
import type { EarModel, FlatMorph, PiercingAnchor, PlacedStructure } from './types';

/** Indices des contrôles remarquables dans `outlineControls` (15 contrôles, ordre fixe). */
const CTRL = { peak: 2, lobuleStart: 7, bottom: 9, lobuleEnd: 11 } as const;

/**
 * MODÈLE D'OREILLE (plan) : résolution morphologique → contour C01–C07 → structures → normalisation. Les structures et le contour sont construits dans un
 * repère CANONIQUE puis passent par UNE SEULE transformation affine (x ∈ [0, rapport L/H], y ∈ [0, 1]) : une pointe terminale ou un lobule long
 * changent la hauteur totale SANS déplacer les structures les unes par rapport aux autres. Pure et déterministe (mémoïsée par contenu).
 */
function earModelRaw(e: FaceEars, side: -1 | 1): EarModel {
  const r0 = resolveEar(e, side);
  // L'extension « pointe terminale » AJOUTE de la pointe au pôle (mécanisme du contour réutilisé, pas un deuxième contour).
  const tipExt = r0.extensions.filter((x) => x.kind === 'terminal_tip').reduce((s, x) => s + 1.0 * x.length * x.intensity, 0);
  const flat: FlatMorph = { ...r0.flat, 'pole.tip': (r0.flat['pole.tip'] ?? 0) + tipExt };
  const r = { ...r0, flat };
  const seed = (e.seed ^ (side < 0 ? 0xa5a5 : 0x5a5a)) >>> 0;
  const { outline: o0, segments } = buildOutline(flat, e.style.angularity, e.style.asymmetry, seed);
  const built = buildStructures(o0, flat, r, e.anchors.crusLevel, CTRL);
  // Normalisation : x ∈ [0, wr] (rapport largeur/hauteur de la famille, ± morph.width), y ∈ [0, 1].
  const b = box(o0);
  const wr = r.widthRatio * (1 + 0.35 * (flat.width ?? 0));
  const sx = wr / (b.x1 - b.x0);
  const sy = 1 / (b.y1 - b.y0);
  const T = (q: Vec): Vec => pt((q.x - b.x0) * sx, (q.y - b.y0) * sy);
  const structures: PlacedStructure[] = built.structures.map((s) => ({ ...s, poly: s.poly.map(T) }));
  const landmarks = Object.fromEntries(Object.entries(built.landmarks).map(([k, v]) => [k, T(v)]));
  const anchors: PiercingAnchor[] = built.anchors.map((a) => ({ ...a, at: T(a.at), ...(a.end ? { end: T(a.end) } : {}) }));
  return {
    side,
    resolved: r,
    widthRatio: wr,
    outline: o0.map(T),
    segments,
    structures,
    landmarks,
    anchors,
    thickness: built.thickness * sy,
    corrections: [...r.corrections, ...built.corrections],
  };
}

/** Version mémoïsée par contenu : une galerie de 100 visages ne recalcule pas deux fois la même oreille (temps compté dans l'étape `geometry`). */
export const earModel: (e: FaceEars, side: -1 | 1) => EarModel = memoPure('earModel', 'geometry', earModelRaw, 256);

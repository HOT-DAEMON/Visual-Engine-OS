/** Contrat commun des trois couches de vérification (géométrie, anatomie, style). */
export type Layer = 'geometry' | 'anatomy' | 'style';

/** Un contrôle : valeur mesurée, bornes, verdict. `info` = mesure rapportée sans être bloquante (écart de style assumé ou limite connue). */
export interface Check {
  readonly layer: Layer; readonly id: string; readonly label: string;
  readonly value: number; readonly min: number; readonly max: number;
  readonly ok: boolean; readonly kind: 'hard' | 'info'; readonly note?: string;
}

export interface LayerReport { readonly layer: Layer; readonly checks: readonly Check[]; readonly pass: boolean }
export interface TurnReport { readonly layers: readonly LayerReport[]; readonly pass: boolean; readonly hardFailures: readonly Check[] }

export const check = (layer: Layer, id: string, label: string, value: number, min: number, max: number, kind: 'hard' | 'info' = 'hard', note?: string): Check =>
  ({ layer, id, label, value: +value.toFixed(4), min, max, ok: Number.isFinite(value) && value >= min && value <= max, kind, ...(note ? { note } : {}) });

export const layerOf = (layer: Layer, checks: readonly Check[]): LayerReport => ({ layer, checks, pass: checks.every((c) => c.kind === 'info' || c.ok) });
export const reportOf = (layers: readonly LayerReport[]): TurnReport => ({ layers, pass: layers.every((l) => l.pass), hardFailures: layers.flatMap((l) => l.checks.filter((c) => c.kind === 'hard' && !c.ok)) });

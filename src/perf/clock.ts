/**
 * Horloge d'étapes : mesure SÉPARÉE du temps passé en calcul géométrique, en génération SVG, en filtres et en rastérisation.
 *
 * Contrat :
 *  - une étape = un nom parmi `STAGES` ; `time(stage, fn)` exécute `fn` et ajoute sa durée EXCLUSIVE à l'étape
 *    (le temps passé dans une étape imbriquée est retiré de l'étape parente : la somme des étapes = le temps total, sans double compte) ;
 *  - l'horloge est un simple accumulateur : elle ne change AUCUN résultat de calcul (désactivée = `fn()` direct) ;
 *  - `snapshot()` rend une copie ; `reset()` remet à zéro.
 * Les étapes `filters` et `raster` ne sont pas mesurables de l'intérieur du moteur (la rastérisation est externe) : elles sont
 * renseignées par le banc (`scripts/bench-render.ts`) en comparant le rendu complet au rendu sans attribut `filter`.
 */
export const STAGES = ['geometry', 'svg', 'filters', 'raster'] as const;
export type Stage = (typeof STAGES)[number];

export interface ClockSnapshot { readonly ms: Readonly<Record<Stage, number>>; readonly calls: Readonly<Record<Stage, number>> }

const now = (): number => Number(process.hrtime.bigint()) / 1e6;

class Clock {
  enabled = false;
  private ms: Record<Stage, number> = { geometry: 0, svg: 0, filters: 0, raster: 0 };
  private calls: Record<Stage, number> = { geometry: 0, svg: 0, filters: 0, raster: 0 };
  /** Pile des durées « enfants » accumulées pendant l'exécution de chaque étape ouverte. */
  private childMs: number[] = [];

  time<T>(stage: Stage, fn: () => T): T {
    if (!this.enabled) return fn();
    this.childMs.push(0);
    const t0 = now();
    try {
      return fn();
    } finally {
      const total = now() - t0;
      const children = this.childMs.pop() ?? 0;
      this.ms[stage] += total - children; // durée exclusive
      this.calls[stage]++;
      if (this.childMs.length) this.childMs[this.childMs.length - 1]! += total; // le parent retire notre durée totale
    }
  }

  /** Ajoute une durée mesurée ailleurs (rastérisation externe). */
  add(stage: Stage, ms: number): void {
    if (!this.enabled) return;
    this.ms[stage] += ms;
    this.calls[stage]++;
  }

  snapshot(): ClockSnapshot { return { ms: { ...this.ms }, calls: { ...this.calls } }; }

  reset(): void {
    this.ms = { geometry: 0, svg: 0, filters: 0, raster: 0 };
    this.calls = { geometry: 0, svg: 0, filters: 0, raster: 0 };
    this.childMs = [];
  }
}

/** Horloge unique du processus (désactivée par défaut : coût nul en production). */
export const clock = new Clock();

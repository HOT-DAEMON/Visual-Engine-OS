import type { EyeArchetypeName } from '../schema';
import { radial, type ArchetypeOverlay } from './types';

export const ARCHETYPE_PRESETS: Record<EyeArchetypeName, ArchetypeOverlay> = {
  // Iris multi-tons discret, sclère légèrement crème, reflets doux : vise la photo plutôt que l'anime.
  realistic: {
    iris: {
      material: {
        base: radial([
          [0, '#8a6a4a'],
          [0.45, '#5c4228'],
          [0.85, '#2c2015'],
          [1, '#15100b'],
        ]),
        metallic: 0,
        roughness: 0.45,
        clearcoat: 0.25,
        opacity: 1,
      },
      fibers: 70,
      limbalRing: 0.75,
      glow: null,
    },
    sclera: {
      base: { type: 'solid', color: '#efe8df' },
      metallic: 0,
      roughness: 0.9,
      clearcoat: 0,
      opacity: 1,
    },
    pupil: { shape: 'round', size: 0.32 },
    highlights: { primary: { size: 0.1, opacity: 0.8 }, secondary: null },
  },

  // Pupille fendue large, iris ambre, sclère teintée vert-jaune, aucun cil, canthus pointu.
  reptile: {
    shape: { style: 'sharp' },
    canthi: { inner: { roundness: 0.1 }, outer: { roundness: 0.1 } },
    iris: {
      material: {
        base: radial([
          [0, '#ffe9a0'],
          [0.5, '#d9a520'],
          [1, '#5a3b00'],
        ]),
        metallic: 0,
        roughness: 0.25,
        clearcoat: 0.35,
        opacity: 1,
      },
      fibers: 20,
      limbalRing: 0.85,
      glow: null,
    },
    sclera: {
      base: { type: 'solid', color: '#c3cf8f' },
      metallic: 0,
      roughness: 0.55,
      clearcoat: 0.15,
      opacity: 1,
    },
    pupil: { shape: 'slit_vertical', size: 0.6 },
    lashes: { upper: { count: 0, length: 0.22, curl: 0.6, sweep: 25, thickness: 0.5 }, lower: { count: 0, length: 0.09 } },
    eyebrow: null,
  },

  // Pupille fendue étroite, iris vert, sclère bleutée pâle, quelques cils courts.
  feline: {
    shape: { style: 'sharp', tiltDeg: 10 },
    iris: {
      material: {
        base: radial([
          [0, '#eaffb0'],
          [0.5, '#7fc93c'],
          [1, '#1f4d12'],
        ]),
        metallic: 0,
        roughness: 0.3,
        clearcoat: 0.3,
        opacity: 1,
      },
      fibers: 90,
      limbalRing: 0.6,
      glow: { color: '#d8ffb0', strength: 0.35 },
    },
    sclera: {
      base: { type: 'solid', color: '#eef3f6' },
      metallic: 0,
      roughness: 0.75,
      clearcoat: 0.1,
      opacity: 1,
    },
    pupil: { shape: 'slit_vertical', size: 0.3 },
    lashes: { upper: { count: 6, length: 0.12, curl: 0.4, sweep: 20, thickness: 0.6 }, lower: { count: 0, length: 0.09 } },
    eyebrow: null,
  },

  // Iris uni saturé très brillant, sclère nacrée, gros reflets doubles : porcelaine/jouet.
  doll: {
    shape: { style: 'round' },
    canthi: { inner: { roundness: 0.9 }, outer: { roundness: 0.9 } },
    iris: {
      material: { base: { type: 'solid', color: '#3a7bd5' }, metallic: 0, roughness: 0.08, clearcoat: 0.9, opacity: 1 },
      fibers: 0,
      limbalRing: 0.9,
      glow: null,
    },
    sclera: {
      base: { type: 'solid', color: '#ffffff' },
      metallic: 0,
      roughness: 0.12,
      clearcoat: 0.6,
      opacity: 1,
    },
    pupil: { shape: 'round', size: 0.4 },
    highlights: { primary: { size: 0.32, opacity: 1 }, secondary: { size: 0.14, opacity: 0.9 } },
    lashes: { upper: { count: 18, length: 0.3, curl: 0.85, sweep: 25, thickness: 0.6 }, lower: { count: 8, length: 0.12 } },
  },

  // Iris immense lumineux, sclère noire (pas de « blanc de l'œil »), aucune pilosité.
  alien: {
    shape: { style: 'sharp', upperFraction: 0.58 },
    canthi: { inner: { roundness: 0 }, outer: { roundness: 0 } },
    iris: {
      radius: 0.62,
      material: {
        base: radial([
          [0, '#eafcff'],
          [0.55, '#5be0ff'],
          [1, '#073a44'],
        ]),
        metallic: 0,
        roughness: 0.2,
        clearcoat: 0.4,
        emission: { color: '#5be0ff', intensity: 0.5 },
        opacity: 1,
      },
      fibers: 0,
      limbalRing: 0.3,
      glow: { color: '#bdfbff', strength: 0.6 },
    },
    sclera: {
      base: { type: 'solid', color: '#06070c' },
      metallic: 0,
      roughness: 0.3,
      clearcoat: 0.4,
      opacity: 1,
    },
    pupil: { shape: 'round', size: 0.14 },
    lashes: { upper: { count: 0, length: 0.22, curl: 0.6, sweep: 25, thickness: 0.5 }, lower: { count: 0, length: 0.09 } },
    eyebrow: null,
  },

  // Iris rouge ardent lumineux, pupille fendue, sclère sombre : pas une émotion (la colère
  // existe déjà via `expression`), une identité de créature que l'on peut combiner avec n'importe
  // quelle expression ensuite.
  demon: {
    shape: { style: 'sharp', tiltDeg: 14 },
    canthi: { inner: { roundness: 0.1 }, outer: { roundness: 0 } },
    iris: {
      material: {
        base: radial([
          [0, '#ffd27a'],
          [0.45, '#ff5a1f'],
          [1, '#4a0505'],
        ]),
        metallic: 0,
        roughness: 0.3,
        clearcoat: 0.3,
        emission: { color: '#ff5a1f', intensity: 0.35 },
        opacity: 1,
      },
      fibers: 40,
      limbalRing: 1,
      glow: { color: '#ffb066', strength: 0.6 },
    },
    sclera: {
      base: { type: 'solid', color: '#190406' },
      metallic: 0,
      roughness: 0.4,
      clearcoat: 0.2,
      opacity: 1,
    },
    pupil: { shape: 'slit_vertical', size: 0.45, fill: { type: 'solid', color: '#000000' } },
    lashes: { upper: { count: 0, length: 0.22, curl: 0.6, sweep: 25, thickness: 0.5 }, lower: { count: 0, length: 0.09 } },
    eyebrow: null,
  },
};

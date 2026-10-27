import { writeFileSync } from 'node:fs';
import { eyeSheetPng } from './lib/eye-sheet';
const V = { density: 0.85, thickness: 0.5, visibility: 0.65, branching: 0.8 };
const cells = [
 { label: 'sans microdétail (historique)', eye: {} },
 { label: 'microdétail complet', eye: { microdetail: { vessels: V, imperfections: 3 } } },
 { label: 'LOD : œil de 60 px', eye: { microdetail: { vessels: V, imperfections: 3, lod: { eyePixels: 60 } } } },
 { label: 'film lacrymal seul, humide fort', eye: { microdetail: { vessels: null, chroma: null, tearFilm: { wetness: 1, meniscus: 0.9 }, occlusion: 0.2 } } },
];
writeFileSync('/tmp/ev/micro.png', eyeSheetPng(cells, 2, 420, 300));

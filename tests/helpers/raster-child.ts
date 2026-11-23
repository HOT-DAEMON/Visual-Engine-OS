/** Rastérise un SVG dans un processus ENFANT : un panic natif de resvg avorte tout le processus, il ne peut se tester que de l'extérieur. Usage : raster-child.ts <fichier.svg> */
import { readFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
const r = new Resvg(readFileSync(process.argv[2] as string, 'utf8'), { font: { loadSystemFonts: false } }).render();
process.stdout.write(`OK ${r.width}x${r.height}`);

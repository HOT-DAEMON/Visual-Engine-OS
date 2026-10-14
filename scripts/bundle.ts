import { mkdirSync, writeFileSync } from 'node:fs';
import { buildPreview } from './build-preview';

const html = await buildPreview();
mkdirSync('dist', { recursive: true });
writeFileSync('dist/preview.html', html);
console.log(`dist/preview.html : ${(html.length / 1024).toFixed(1)} Ko`);

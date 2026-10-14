import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { compileScene } from '../src';

const [, , input = 'examples/first-eye.json', outDir = 'out', widthArg = '1280'] = process.argv;

const result = compileScene(JSON.parse(readFileSync(input, 'utf8')));
if (!result.ok) {
  console.error('Scène invalide :');
  for (const issue of result.issues) console.error(`  - ${issue}`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
const name = basename(input, '.json');
writeFileSync(`${outDir}/${name}.svg`, result.svg);
const png = new Resvg(result.svg, { fitTo: { mode: 'width', value: Number(widthArg) } }).render().asPng();
writeFileSync(`${outDir}/${name}.png`, png);
console.log(`${name}: svg ${result.svg.length} octets, png ${png.length} octets`);

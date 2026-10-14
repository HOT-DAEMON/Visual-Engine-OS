import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const here = (p: string): string => new URL(`../${p}`, import.meta.url).pathname;

/** Empaquette le moteur (IIFE global `EyeEngine`) et l'injecte dans la page de prévisualisation. */
export async function buildPreview(): Promise<string> {
  const out = await build({
    entryPoints: [here('src/index.ts')],
    bundle: true,
    minify: true,
    format: 'iife',
    globalName: 'EyeEngine',
    target: 'es2020',
    platform: 'browser',
    write: false,
    legalComments: 'none',
  });
  const engine = out.outputFiles[0]?.text ?? '';
  if (engine.length === 0) throw new Error('Bundle vide');
  if (/<\/script/i.test(engine)) throw new Error('Le bundle contient </script : injection inline impossible');

  const scenes = {
    'first-eye': JSON.parse(readFileSync(here('examples/first-eye.json'), 'utf8')),
    showcase: JSON.parse(readFileSync(here('examples/showcase.json'), 'utf8')),
    robots: JSON.parse(readFileSync(here('examples/robots.json'), 'utf8')),
    anatomy: JSON.parse(readFileSync(here('examples/anatomy.json'), 'utf8')),
    face: JSON.parse(readFileSync(here('examples/face.json'), 'utf8')),
    hosts: JSON.parse(readFileSync(here('examples/hosts.json'), 'utf8')),
    expressions: JSON.parse(readFileSync(here('examples/expressions.json'), 'utf8')),
    gallery: JSON.parse(readFileSync(here('examples/gallery.json'), 'utf8')),
    coordination: JSON.parse(readFileSync(here('examples/coordination.json'), 'utf8')),
    eyestyles: JSON.parse(readFileSync(here('examples/eye-styles.json'), 'utf8')),
    archetypes: JSON.parse(readFileSync(here('examples/archetypes.json'), 'utf8')),
    newkinds: JSON.parse(readFileSync(here('examples/new-kinds.json'), 'utf8')),
    pupils: JSON.parse(readFileSync(here('examples/pupil-richness.json'), 'utf8')),
    lashengine: JSON.parse(readFileSync(here('examples/lash-engine.json'), 'utf8')),
    pairs: JSON.parse(readFileSync(here('examples/gallery-pairs.json'), 'utf8')),
    gazesheet: JSON.parse(readFileSync(here('examples/gaze-sheet.json'), 'utf8')),
    headturn: JSON.parse(readFileSync(here('examples/head-turn-demo.json'), 'utf8')),
    newexpr: JSON.parse(readFileSync(here('examples/new-expressions.json'), 'utf8')),
  };
  const scenesJs = JSON.stringify(scenes).replace(/</g, '\\u003c');
  const template = readFileSync(here('preview/template.html'), 'utf8');
  // Fonctions de remplacement : le code minifié contient des `$&`, `$'` qui casseraient un remplacement par chaîne.
  return template.replace('/*__ENGINE__*/', () => engine).replace('/*__SCENES__*/', () => scenesJs);
}

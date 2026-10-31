/** Hôte de référence des artefacts du corps : visage n°11 (même personne, même ancre de cou). */
import { compileScene, generateRandomFace } from '../../src';
import { anchorFromFace, type NeckAnchor } from '../../src/body';

export const BG = '#3b4157';
export function bodyHost(seed = 11): { o: any; svg: string; a: NeckAnchor; skin: string } {
  const f = generateRandomFace(seed, { id: 'f', transform: { x: 190, y: 62, scale: 0.27 } });
  const o = f.objects[0] as any;
  const sc = compileScene({ width: 380, height: 700, background: BG, objects: f.objects });
  if (!sc.ok) throw new Error(sc.issues.join());
  return { o, svg: sc.svg, a: anchorFromFace(o.face, o.width, o.height) as NeckAnchor, skin: o.material.color as string };
}

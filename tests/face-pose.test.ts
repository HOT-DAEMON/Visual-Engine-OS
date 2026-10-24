import { describe, expect, it } from 'vitest';
import { generateRandomFace } from '../src';
import { faceLandmarks } from '../src/face';
import { posedFace, TWIST } from '../src/face/pose';

const lmOf = (seed = 321) => { const f = generateRandomFace(seed, { identity: 3 } as never); return faceLandmarks(f.params, f.width, f.height); };

describe('pose 3D du visage : parent → enfants → frères', () => {
  it('yaw 0 : les composants restent sur leurs repères frontaux (symétrie gauche / droite)', () => {
    const lm = lmOf();
    const p = posedFace(lm, 0);
    const g = (id: string) => p.nodes.get(id)!;
    expect(g('eyeL').x).toBeCloseTo(-g('eyeR').x, 3);
    expect(g('eyeL').y).toBeCloseTo(lm.eyeY, 3);
    expect(g('nose').x).toBeCloseTo(0, 6);
    expect(g('mouth').y).toBeCloseTo(lm.mouthY, 3);
    expect(g('chin').y).toBeCloseTo(lm.chinY, 3);
  });

  it('3/4 (yaw 35°) : l’œil lointain se raccourcit plus que le proche ; le nez et la bouche glissent du côté de la rotation', () => {
    const p = posedFace(lmOf(), 35);
    // Le visage se tourne vers la droite de l'image : l'œil de gauche vient vers la caméra (plus large), celui de droite fuit (raccourci).
    const near = p.nodes.get('eyeL')!;
    const far = p.nodes.get('eyeR')!;
    expect(far.scaleX).toBeLessThan(near.scaleX);
    expect(far.scaleX).toBeLessThan(0.8);
    expect(near.scaleX).toBeGreaterThan(1);
    expect(p.nodes.get('nose')!.x).toBeGreaterThan(5);
    expect(p.nodes.get('mouth')!.x).toBeGreaterThan(0);
    expect(p.nodes.get('nose')!.x).toBeGreaterThan(p.nodes.get('mouth')!.x);
  });

  it('visibilité : de face les deux oreilles dépassent ; à 40° vers la droite l’oreille gauche reste visible, la droite disparaît (et inversement)', () => {
    const lm = lmOf();
    const f = posedFace(lm, 0);
    expect(f.nodes.get('earL')!.visible && f.nodes.get('earR')!.visible).toBe(true);
    const r = posedFace(lm, 40);
    expect(r.nodes.get('earL')!.visible).toBe(true);
    expect(r.nodes.get('earR')!.visible).toBe(false);
    const l = posedFace(lm, -40);
    expect(l.nodes.get('earR')!.visible).toBe(true);
    expect(l.nodes.get('earL')!.visible).toBe(false);
  });

  it('enfants : l’iris suit l’œil (même position projetée à 1 px près en x, y) ; frères : écart sourcil → œil conservé en y', () => {
    const lm = lmOf();
    const n = posedFace(lm, 0);
    const p = posedFace(lm, 50);
    expect(Math.abs(p.nodes.get('irisR')!.y - p.nodes.get('eyeR')!.y)).toBeLessThan(1e-6);
    expect(Math.abs(p.nodes.get('irisR')!.x - p.nodes.get('eyeR')!.x)).toBeLessThan(0.02 * lm.W);
    const dy0 = n.nodes.get('browR')!.y - n.nodes.get('eyeR')!.y;
    const dy1 = p.nodes.get('browR')!.y - p.nodes.get('eyeR')!.y;
    expect(dy1).toBeCloseTo(dy0, 6);
  });

  it('cou : ne tourne que d’une fraction de la tête ; sa silhouette s’élargit avec la rotation (b < a)', () => {
    const p = posedFace(lmOf(), 40);
    expect(p.neck.yawOf(40)).toBeCloseTo(40 * TWIST, 6);
    expect(p.nodes.get('neck')!.yaw).toBeCloseTo(40 * TWIST, 6);
    expect(p.neckHalf()).toBeLessThan(p.neck.a);
    expect(p.neckHalf()).toBeGreaterThan(p.neck.b * 0.99);
  });

  it('crâne : silhouette projetée continue et finie ; profondeur z ≥ 0 sur la surface', () => {
    const lm = lmOf();
    const p = posedFace(lm, 45);
    for (let y = p.skull.topY + 1; y < lm.chinY; y += 10) { const h = p.skullHalf(y); expect(Number.isFinite(h) && h > 0).toBe(true); }
    expect(p.skull.zAt(0, lm.eyeY)).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from 'vitest';
import { generateRandomFace } from '../src';
import { earGeometry } from '../src/face';
import { projectEar, VIEW_YAW, faceVisible, type ViewName } from '../src/face/ear/project';
import { faceLandmarks } from '../src/face/landmarks';
import { FaceParams } from '../src/schema';
import { earVisibility } from '../src/face/ear/visibility';
import { earJewelry } from '../src/render/face/ear/jewelry';

const VIEWS: ViewName[] = ['face', 'three-quarter', 'profile', 'close-up'];
const S = (patch: object = {}) => FaceParams.parse({ anatomyEngine: 'structured', ...patch });
const ears = (p: FaceParams) => earGeometry(p, faceLandmarks(p, 300, 400));

describe('alignement de l\'oreille sur les repères du visage', () => {
  it('la racine de l\'hélix est sur la ligne des yeux ; le bas du lobule sur la ligne de la bouche (défaut)', () => {
    const p = S();
    const lm = faceLandmarks(p, 300, 400);
    for (const e of ears(p)) {
      expect(Math.abs(e.align!.crusToEyeLine)).toBeLessThan(0.5);
      expect(Math.abs(e.align!.lobuleToMouthLine)).toBeLessThan(0.5);
      const crusY = e.placement!.topY + (e.model!.landmarks.crus!.y) * e.placement!.hPx;
      expect(crusY).toBeCloseTo(lm.eyeY, 6);
      expect(e.placement!.topY + e.placement!.hPx).toBeCloseTo(lm.mouthY, 0);
    }
  });

  it('60 visages tirés : l\'alignement tient (yeux exacts ; bouche exacte sauf hauteur bornée)', () => {
    for (let s = 1; s <= 60; s++) {
      const f = generateRandomFace(s * 131, { structure: true });
      const lm = faceLandmarks(f.params, f.width, f.height);
      for (const e of earGeometry(f.params, lm)) {
        expect(Math.abs(e.align!.crusToEyeLine), `seed ${s}`).toBeLessThan(0.5);
        if (e.align!.corrections.length === 0) expect(Math.abs(e.align!.lobuleToMouthLine), `seed ${s}`).toBeLessThan(0.5);
      }
    }
  });

  it('ancrages libres (0) : l\'oreille ne suit plus les yeux ni la bouche', () => {
    const p = S({ ears: { anchors: { eye: 0, mouth: 0 } } });
    const lm = faceLandmarks(p, 300, 400);
    const e = ears(p)[1]!;
    expect(Math.abs(e.align!.crusToEyeLine)).toBeGreaterThan(1);
    expect(e.placement!.hPx).toBeCloseTo(0.3 * lm.H, 6);
  });

  it('une famille sans lobule (félin) n\'est pas forcée sur la ligne de la bouche', () => {
    const p = S({ ears: { family: 'feline' } });
    const e = ears(p)[1]!;
    expect(e.placement!.hPx).toBeCloseTo(0.3 * 400, 6);
    expect(Math.abs(e.align!.crusToEyeLine)).toBeLessThan(0.5);
  });

  it('hauteur bornée (strict) et enregistrée quand l\'alignement demanderait une oreille géante', () => {
    const p = S({ eyeLine: 0.4, mouth: { y: 0.9 } });
    const e = ears(p)[1]!;
    expect(e.placement!.hPx).toBeLessThanOrEqual(0.5 * 400 + 1e-9);
  });
});

describe('quatre vues d\'un même modèle', () => {
  it('l\'ordonnée de chaque repère est identique dans les quatre vues (la caméra tourne autour de l\'axe vertical)', () => {
    for (const p of [S(), S({ ears: { family: 'elven', attach: { pitchDeg: 8, rotationDeg: 6 } } }), S({ ears: { family: 'draconic' } })]) {
      for (const e of ears(p)) {
        const pr = VIEWS.map((v) => projectEar(e.model!, e.placement!, VIEW_YAW[v] * e.side, v));
        for (const q of pr) for (const [k, pt] of Object.entries(q.landmarks)) expect(pt.y).toBeCloseTo((pr[0]!.landmarks[k] as { y: number }).y, 9);
      }
    }
  });

  it('de face l\'oreille est comprimée (≈ sin α) ; elle est vue à plat quand la caméra est dans la normale du pavillon (lacet 90° − α)', () => {
    const e = ears(S())[1]!;
    const sc = VIEWS.map((v) => projectEar(e.model!, e.placement!, VIEW_YAW[v], v).xScale);
    const a = (e.placement!.openingDeg * Math.PI) / 180;
    expect(sc[0]!).toBeCloseTo(Math.sin(a) + (0.9 * e.model!.thickness * Math.cos(a)) / e.model!.widthRatio, 1);
    expect(sc[0]!).toBeLessThan(0.65);
    for (const k of [1, 2, 3]) expect(sc[k]!).toBeGreaterThan(0.85);
    // Gros plan (75°) ≈ pavillon vu à plat (66° pour 24°) : la compression est maximale (≈ 1) ; le profil strict (90°) vaut cos α.
    expect(sc[3]!).toBeGreaterThanOrEqual(sc[2]!);
    expect(sc[2]!).toBeCloseTo(Math.cos(a), 1);
  });

  it('la conque est cachée de l\'autre côté : l\'oreille droite est vue de profil par un lacet positif, la gauche par un lacet négatif', () => {
    const [L, R] = ears(S()) as [ReturnType<typeof ears>[0], ReturnType<typeof ears>[0]];
    expect(faceVisible(R.placement!, 90)).toBe(true);
    expect(faceVisible(R.placement!, -90)).toBe(false);
    expect(faceVisible(L.placement!, -90)).toBe(true);
    expect(faceVisible(L.placement!, 0)).toBe(true);
  });

  it('un angle d\'ouverture plus grand élargit l\'oreille de face (projection latérale) sans changer sa hauteur', () => {
    const a = ears(S({ ears: { attach: { openingDeg: 12 } } }))[1]!;
    const b = ears(S({ ears: { attach: { openingDeg: 40 } } }))[1]!;
    expect(b.rx).toBeGreaterThan(a.rx);
    expect(b.ry).toBeCloseTo(a.ry, 1);
  });

  it('l\'échelle relative et la rotation locale déplacent l\'oreille sans casser l\'attache au crâne', () => {
    const e = ears(S({ ears: { attach: { rotationDeg: 12, pitchDeg: 8 } } }))[1]!;
    const crus = e.front!.landmarks.crus!;
    expect(Math.abs(crus.x)).toBeCloseTo(e.placement!.skullX(crus.y) + Math.sin((e.placement!.openingDeg * Math.PI) / 180) * e.model!.landmarks.crus!.x * e.placement!.hPx, 9);
  });
});

describe('cheveux et bijoux', () => {
  it('la géométrie de l\'oreille est conservée quand elle est masquée ; l\'état de visibilité est mesuré', () => {
    const bald = S({ hair: { style: 'bald' } });
    const lm0 = faceLandmarks(bald, 300, 400);
    expect(earVisibility(bald, lm0, earGeometry(bald, lm0)[1]!).state).toBe('visible');
    const long = S({ hair: { style: 'long' } });
    const lm = faceLandmarks(long, 300, 400);
    const e = earGeometry(long, lm)[1]!;
    expect(e.poly.length).toBeGreaterThanOrEqual(3);
    const v = earVisibility(long, lm, e);
    expect(['partial', 'under_hair', 'visible', 'tucked_behind', 'covers_piercing']).toContain(v.state);
  });

  it('un piercing se pose sur son point d\'attache projeté et pend vers le bas ; refusé sans la structure d\'accueil', () => {
    const p = S({ ears: { piercings: [{ kind: 'ear_lobe_piercing', jewel: 'drop', hang: 1 }, { kind: 'tragus_piercing', jewel: 'stud' }] } });
    const lm = faceLandmarks(p, 300, 400);
    const e = earGeometry(p, lm)[1]!;
    const j = earJewelry(p, lm, e);
    expect(j).toHaveLength(2);
    expect(j[0]!.compatible).toBe(true);
    expect(j[0]!.end.y).toBeGreaterThan(j[0]!.at.y);
    // Félin : pas de lobule → le piercing de lobule est incompatible (non dessiné).
    const pf = S({ ears: { family: 'feline', piercings: [{ kind: 'ear_lobe_piercing' }] } });
    const lmf = faceLandmarks(pf, 300, 400);
    const jf = earJewelry(pf, lmf, earGeometry(pf, lmf)[1]!);
    expect(jf[0]!.compatible).toBe(false);
    expect(jf[0]!.markup).toBe('');
  });

  it('changer l\'angle d\'ouverture déplace les points d\'attache des bijoux', () => {
    const pp = (deg: number) => { const p = S({ ears: { attach: { openingDeg: deg }, piercings: [{ kind: 'helix_piercing' }] } }); const lm = faceLandmarks(p, 300, 400); return earJewelry(p, lm, earGeometry(p, lm)[1]!)[0]!.at.x; };
    expect(pp(40)).not.toBeCloseTo(pp(12), 1);
  });
});

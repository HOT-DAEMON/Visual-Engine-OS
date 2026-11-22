/** Paramètres de l'oreille audités (un à la fois, bas → haut de leur plage) : partagé par l'audit de face et l'audit des vues. Chemins dans `face.ears`. */
export type P = readonly [path: string, lo: unknown, hi: unknown, extra?: Record<string, unknown>];
const S = (p: string): P => [`morph.${p}`, -0.8, 0.8];
export const PARAMS: P[] = [
  S('pole.height'), S('pole.round'), S('pole.lean'), S('pole.tip'), S('posterior.convexity'), S('width'),
  S('lobule.length'), S('lobule.width'), S('lobule.attach'), S('lobule.sag'),
  S('tragus.size'), S('tragus.projection'), S('antitragus.size'), S('antitragus.orientation'), S('notch.depth'),
  S('helix.thickness'), S('helix.roll'),
  S('antihelix.relief'), S('antihelix.branchAngle'), S('antihelix.upperLength'), S('antihelix.lowerLength'),
  S('concha.depth'), S('concha.cymba'), S('scapha.width'), S('scapha.depth'), S('crus.thickness'),
  ['attach.openingDeg', 10, 45], ['attach.pitchDeg', -12, 12], ['attach.rotationDeg', -15, 15], ['attach.scale', 0.8, 1.3], ['attach.insertion', 0.1, 0.9],
  ['anchors.eye', 0, 1], ['anchors.mouth', 0, 1], ['anchors.crusLevel', 0.2, 0.34],
  ['style.exaggeration', 0.1, 0.9, { 'morph.lobule.length': 0.8, 'morph.pole.tip': 0.8 }], ['style.fidelity', 0.1, 0.9, { 'morph.concha.depth': 0.9, 'morph.helix.thickness': 0.9 }],
  ['style.angularity', 0.1, 0.9], ['style.softness', 0.1, 0.9], ['style.asymmetry', 0.0, 0.9], ['style.detail', 0.1, 0.9], ['style.look', 'realistic', 'anime'],
  ['material.translucency', 0.1, 0.9], ['material.roughness', 0.1, 0.9], ['material.glow', 0, 0.9, { 'material.kind': 'crystal' }], ['material.kind', 'skin', 'scaly'], ['material.kind', 'skin', 'ceramic'],
  ['family', 'human', 'feline'], ['family', 'human', 'elven'], ['family', 'human', 'draconic'],
  // Axes ajoutés après le premier audit (Darwin, hélix replié, lobule fendu/étiré, rebord de conque, fosse, crus, pointe du tragus, courbure de l'anthélix) et détails SURF-05.
  ['morph.helix.darwin', 0, 0.9], ['morph.helix.fold', 0, 0.9], ['morph.lobule.cleft', 0, 0.9], ['morph.lobule.stretch', 0, 0.9], ['morph.concha.wall', 0, 0.9],
  S('fossa.depth'), S('fossa.width'), S('crus.angle'), S('crus.length'), S('tragus.tip'), S('antihelix.curvature'),
  // Passe 4 : axes EAR-01…07 restants (torsion/continuité de l'hélix, courbure/dégradé de la scapha, orientation/courbure de la fosse, volume/inclinaison/transition de la conque, épaisseur du tragus, volume du lobule).
  S('helix.torsion'), S('helix.continuity'), S('scapha.curvature'), S('scapha.gradient'), S('fossa.tilt'), S('fossa.curvature'),
  S('concha.volume'), S('concha.tilt'), S('concha.transition'), S('tragus.thickness'), S('lobule.volume'),
  ['surface.pigmentation', 0, 0.9, { 'style.detail': 0.9 }], ['surface.folds', 0, 0.9, { 'style.detail': 0.9 }], ['surface.pores', 0, 0.9, { 'style.detail': 0.9 }], ['surface.vessels', 0, 0.9, { 'style.detail': 0.9 }], ['surface.hair', 0, 0.9, { 'style.detail': 0.9 }],
];

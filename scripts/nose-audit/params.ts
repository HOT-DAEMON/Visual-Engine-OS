/** Paramètres du nez audités (un à la fois, bas → haut de leur plage) : partagé par l'audit de face et l'audit 3D. */
export type P = readonly [path: string, lo: unknown, hi: unknown, extra?: Record<string, unknown>];
const U: [number, number] = [0.1, 0.9], S: [number, number] = [-0.8, 0.8];
const u = (p: string, extra?: Record<string, unknown>): P => [p, U[0], U[1], extra];
const s = (p: string): P => [p, S[0], S[1]];
export const PARAMS: P[] = [
  ['length', 0.1, 0.22], ['width', 0.1, 0.24], u('nostril'), u('bridge'),
  u('root.height'), u('root.depth'), u('root.width'),
  ['dorsum.shape', 'straight', 'convex'], ['dorsum.shape', 'straight', 'concave'], u('dorsum.width'), u('dorsum.curvature', { 'dorsum.shape': 'convex' }), ['dorsum.deviation', -0.8, 0.8, { 'dorsum.shape': 'asymmetric' }],
  u('tip.width'), u('tip.roundness'), u('tip.projection'), s('tip.rotation'), u('tip.alarBlend'), u('tip.highlight'),
  u('alae.thickness'), u('alae.volume'), u('alae.flare'), u('alae.attachment'),
  u('nostrils.shape'), ['nostrils.tiltDeg', 5, 45], s('nostrils.asymmetry'), u('nostrils.columella'), u('nostrils.visibility'), u('nostrils.opening'), u('nostrils.rim'),
  u('junction.glabella'), u('junction.orbital'), u('junction.cheek'), u('junction.nasolabial'),
  u('sidewall.slope'), u('sidewall.concavity'), u('domes.prominence'), u('domes.separation'), u('groove.depth'), u('groove.length'),
  s('base.width'), u('base.depth'), s('columella.hang'), u('philtrum.depth'), u('philtrum.width'), u('philtrum.blend'),
];

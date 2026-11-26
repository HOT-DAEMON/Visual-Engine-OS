import { Resvg } from '@resvg/resvg-js';
import { resolveAppearance, toHsl, hueDelta } from '../../src/appearance';
import type { HairLock } from '../../src/face/hair';
import { generate } from '../../src/hair-grammar/grammar';
import { DEFAULT_HEAD, landmarks, project } from '../../src/hair-grammar/head';
import { checkHairLockContract, frameFromEyes, grammarToHairLocks } from '../../src/hair-grammar/interop';
import { INK_PRO, MAIN_PRO, paintHairPro, type ProStyle } from '../../src/hair-grammar/paint-pro';
import { TOUSLED } from '../../src/hair-grammar/profiles/tousled';
import { bandZigzag, checkMainRender, litHueDrift } from '../../src/hair-grammar/render-verify';
import { norm, v3 } from '../../src/hair-grammar/vec';
import { lockMarkup, type LockStyle } from '../../src/render/face/hair-lock';
import { Appearance } from '../../src/schema';
import { ROI, headContent, png, save, sheetSvg, viewAt, type Panel } from './engine-kit';

/**
 * Artefacts de la PASSE 9 (docs/HAIR-PASS9.md) : rendu principal de la coiffure issue de la grammaire, AVANT / APRÈS les trois corrections mesurées.
 * `npx tsx scripts/hair-grammar/artefacts-pass9.ts` régénère artefacts/hair-engine-pass9/ (déterministe).
 *  01 TÊTE ENTIÈRE, lisse puis cel : avant | après ;  02 détail du sommet ×2,4 ;  03 nuancier : tons d'une couleur, ancien | cheveux ;
 *  04 TÊTE ENTIÈRE à −30° / 0° / +30° (après) ;  05 TÊTE ENTIÈRE, six couleurs de cheveux (après) ;  06 mesures (metrics.json).
 */
const OUT = 'artefacts/hair-engine-pass9'; const H = DEFAULT_HEAD; const BROWN = '#4a3326';
const LIGHT = { dir: norm(v3(-0.45, -0.65, 0.6)) };
const BEFORE: ProStyle = { ...INK_PRO, ring: 'add' };
const specOf = (cel: boolean) => Appearance.parse({ shading: { mode: cel ? 'cel' : 'smooth', bands: 3, highlightBand: 0.75, castShadow: 0.4 } });
const raBefore = (hex: string, cel: boolean) => resolveAppearance(hex, specOf(cel));
const raAfter = (hex: string, cel: boolean) => resolveAppearance(hex, specOf(cel), { model: 'hair' });
const metrics: Record<string, unknown> = {};

function scene(style: ProStyle, yaw: number, seed: number): { v: ReturnType<typeof viewAt>; locks: HairLock[]; headW: number } {
  const v = viewAt(yaw); const lm = landmarks(H); const eR = project(v, lm.eyeR); const eL = project(v, lm.eyeL); const headW = 2 * H.rx * v.s;
  return { v, headW, locks: grammarToHairLocks(paintHairPro(H, generate(TOUSLED, seed), v, style, LIGHT).locks as never, { frame: frameFromEyes(eR, eL, eR, eL), head: H, headW }) };
}
function head(locks: readonly HairLock[], v: ReturnType<typeof viewAt>, ra: ReturnType<typeof raAfter>, ring: LockStyle['ring'], id: string): string {
  const st: LockStyle = { id, ra, ld: { x: -0.6, y: -0.8 }, W: ROI.w, ring };
  const parts = locks.map((l, i) => lockMarkup(l, i, st, 0, true)); const pick = (back: boolean): string[] => parts.flatMap((p, i) => ((locks[i] as HairLock).layer === 'back') === back ? p.markup : []);
  return headContent({ back: pick(true).join(''), front: `<defs>${parts.flatMap((p) => p.defs).join('')}</defs>${pick(false).join('')}`, over: '' }, v);
}
const board = (name: string, panels: Panel[], cols: number, title: string): void => save(`${OUT}/${name}.png`, png(sheetSvg(panels, cols, title, 3)));
const crop = (content: string, x: number, y: number, w: number, h: number): Panel['content'] => `<svg x="0" y="0" width="${ROI.w}" height="${ROI.h}" viewBox="${x} ${y} ${w} ${h}" preserveAspectRatio="xMidYMid slice">${content}</svg>`;

// 01 / 02 · avant | après, tête entière puis détail.
{
  const A = scene(BEFORE, 0, 2); const B = scene(MAIN_PRO, 0, 2); const full: Panel[] = []; const det: Panel[] = [];
  for (const cel of [false, true]) {
    const a = head(A.locks, A.v, raBefore(BROWN, cel), 'add', `b-${cel}`); const b = head(B.locks, B.v, raAfter(BROWN, cel), 'replace', `a-${cel}`);
    full.push({ content: a, label: `${cel ? 'cel' : 'lisse'} · AVANT (lumière par défaut, bande à dents)` }, { content: b, label: `${cel ? 'cel' : 'lisse'} · APRÈS (lumière cheveux, lentille lisse)` });
    det.push({ content: crop(a, 18, 14, 120, 60), label: `${cel ? 'cel' : 'lisse'} · avant` }, { content: crop(b, 18, 14, 120, 60), label: `${cel ? 'cel' : 'lisse'} · après` });
  }
  board('01-toute-la-tete-avant-apres', full, 2, 'Rendu principal, tête entière : avant | après (brun #4a3326)');
  board('02-detail-sommet-avant-apres', det, 2, 'Détail du sommet : avant | après');
  const zig = (s: typeof A): number[] => s.locks.filter((l) => l.geom?.ring).map((l) => bandZigzag(l.geom!.ring!.highlight));
  metrics.ringEdges = { before: { bands: zig(A).length, zigzagPerBand: zig(A) }, after: { bands: zig(B).length, zigzagPerBand: zig(B) }, contractAfter: checkHairLockContract(B.locks, B.headW).length };
  metrics.verifyAfter = { smooth: checkMainRender(B.locks, raAfter(BROWN, false)), cel: checkMainRender(B.locks, raAfter(BROWN, true)) };
  metrics.verifyBefore = checkMainRender(A.locks, raBefore(BROWN, false)).map((i) => i.code);
}

// 03 · nuancier : les tons d'une couleur, ancien | cheveux.
{
  const cols: Record<string, string> = { noir: '#1a1a1f', 'brun foncé': BROWN, 'brun très foncé': '#2a1a10', auburn: '#6b3a22', blond: '#d8b868', roux: '#a03020' };
  const tones = [-0.5, 0, 0.25, 0.5, 0.75, 1]; const rows: string[] = []; const table: Record<string, unknown>[] = [];
  const sw = (x: number, y: number, c: string): string => `<rect x="${x}" y="${y}" width="44" height="30" fill="${c}" stroke="#999"/>`;
  Object.entries(cols).forEach(([n, c], i) => {
    const y = 40 + i * 78; const o = raBefore(c, false); const h = raAfter(c, false);
    rows.push(`<text x="8" y="${y + 20}" font-family="Inter,sans-serif" font-size="14" fill="#111">${n} ${c}</text>`);
    tones.forEach((t, k) => { rows.push(sw(190 + k * 50, y - 6, o.tone(t)), sw(190 + k * 50, y + 28, h.tone(t))); });
    rows.push(sw(500, y - 6, o.light), sw(500, y + 28, h.light));
    const b = toHsl(o.base); table.push({ couleur: n, base: c, lumiereAvant: o.light, lumiereApres: h.light, deriveAvant: Math.round(Math.abs(hueDelta(b.h, toHsl(o.light).h))), deriveApres: Math.round(Math.abs(hueDelta(b.h, toHsl(h.light).h))), deriveTonsEclairesApres: Math.round(litHueDrift(h)) });
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="570" height="${40 + 6 * 78}" viewBox="0 0 570 ${40 + 6 * 78}"><rect width="100%" height="100%" fill="#f4f3f1"/><text x="8" y="24" font-family="Inter,sans-serif" font-size="16" font-weight="600" fill="#111">Tons −0,5 … 1 puis lumière — ligne du haut : avant · ligne du bas : lumière cheveux</text>${rows.join('')}</svg>`;
  save(`${OUT}/03-nuancier-tons-avant-apres.png`, Buffer.from(new Resvg(svg, { font: { loadSystemFonts: true, defaultFontFamily: 'Inter' }, fitTo: { mode: 'width', value: 1140 } }).render().asPng()));
  metrics.hueTable = table;
}

// 04 · trois lacets (après) ; 05 · six couleurs (après).
{
  const panels: Panel[] = []; const rows: unknown[] = [];
  for (const yaw of [-30, 0, 30]) { const s = scene(MAIN_PRO, yaw, 2); panels.push({ content: head(s.locks, s.v, raAfter(BROWN, false), 'replace', `y${yaw}`), label: `lacet ${yaw}° · ${s.locks.filter((l) => l.geom?.ring).length} reflets · G·A·S ${checkMainRender(s.locks, raAfter(BROWN, false)).length === 0 ? '✓' : '✗'}` }); rows.push({ yaw, issues: checkMainRender(s.locks, raAfter(BROWN, false)) }); }
  board('04-trois-lacets-apres', panels, 3, 'Rendu principal après correction, rotation de la tête −30° / 0° / +30°'); metrics.yaw = rows;
  const s = scene(MAIN_PRO, 0, 2); const colors: [string, string][] = [['noir', '#1a1a1f'], ['brun foncé', BROWN], ['auburn', '#6b3a22'], ['blond', '#d8b868'], ['roux', '#a03020'], ['rose', '#ff3fa4']];
  board('05-six-couleurs-apres', colors.map(([n, c], i) => ({ content: head(s.locks, s.v, raAfter(c, false), 'replace', `c${i}`), label: `${n} ${c} · dérive des tons éclairés ${Math.round(litHueDrift(raAfter(c, false)))}°` })), 3, 'Rendu principal après correction : six couleurs de cheveux, même coiffure');
}
save(`${OUT}/metrics.json`, JSON.stringify(metrics, null, 1));
console.log(JSON.stringify({ ringEdges: metrics.ringEdges, verifyBefore: metrics.verifyBefore, verifyAfter: metrics.verifyAfter, hue: (metrics.hueTable as { couleur: string; deriveAvant: number; deriveApres: number }[]).map((r) => `${r.couleur}: ${r.deriveAvant}→${r.deriveApres}`) }, null, 1));

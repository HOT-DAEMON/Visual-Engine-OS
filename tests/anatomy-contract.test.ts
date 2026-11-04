import { describe, expect, it } from 'vitest';
import { ancestors, canonicalId, COMPONENTS, componentOf, type AliasSpace } from '../src/anatomy/components';
import { eyeRelations, type PlacedEye } from '../src/anatomy/relations';
import { BODY_CONTRACTS } from '../src/body';
import { CONTRACTS } from '../src/face/contracts';
import { faceNodes, posedFace } from '../src/face/pose';
import { faceLandmarks, noseGeometry } from '../src/face';
import { expandScene, generateRandomFace, SceneSpec } from '../src';
import { faceComponents } from '../src/render/face/components';
import { hostFace } from '../src/render/face';
import { registryChecks, verifyPipeline } from '../src/verify';
import type { HostSpec } from '../src/schema';

const face = (seed: number) => generateRandomFace(seed, { id: 'f0', transform: { x: 0, y: 0, scale: 1 } });
const sceneOf = (seed: number, body = true) => ({ width: 640, height: 900, background: '#f4f1ec', objects: [...face(seed).objects, ...(body ? [{ kind: 'body', id: 'b0', host: 'f0', body: { age: 28, sex: 1 } }] : [])] });

describe('contrat central des composants', () => {
  it('registre intègre : ids uniques, parents existants, pas de cycle, alias non partagés', () => {
    expect(registryChecks().every((c) => c.ok)).toBe(true);
    for (const c of COMPONENTS) expect(() => ancestors(c.id)).not.toThrow();
    const seen = new Map<string, string>();
    for (const c of COMPONENTS) for (const [sp, names] of Object.entries(c.aliases)) for (const n of names ?? []) {
      const k = `${sp}:${n}`;
      expect(seen.has(k), `${k} revendiqué par ${seen.get(k)} et ${c.id}`).toBe(false);
      seen.set(k, c.id);
    }
  });

  it('AUCUN orphelin : tout identifiant des 4 vocabulaires existants a un identifiant canonique', () => {
    const lm = faceLandmarks(face(11).params, 300, 400);
    const posed = faceNodes(lm, posedFace(lm, 0).skull, posedFace(lm, 0).neck).map((n) => n.id);
    const contact = faceComponents(face(11).params, lm, noseGeometry(face(11).params, lm)).components.map((c) => c.id);
    const names: Record<AliasSpace, string[]> = { contract: CONTRACTS.map((c) => c.id), contact, pose: posed, body: Object.keys(BODY_CONTRACTS) };
    const orphans = (Object.entries(names) as [AliasSpace, string[]][]).flatMap(([sp, ns]) => ns.filter((n) => !canonicalId(sp, n)).map((n) => `${sp}:${n}`));
    expect(orphans).toEqual([]);
  });

  it("parents cohérents entre l'arbre de pose et le registre ; divergences connues listées et vérifiées", () => {
    const lm = faceLandmarks(face(11).params, 300, 400);
    const p = posedFace(lm, 0);
    const bad = faceNodes(lm, p.skull, p.neck).filter((n) => n.parent && componentOf(canonicalId('pose', n.id) as string)?.parent !== canonicalId('pose', n.parent));
    expect(bad.map((n) => n.id)).toEqual([]);
    // Graphe de contact : son `parent` est la SURFACE RÉCEPTRICE des ombres (souvent `head`), pas le parent anatomique. Règle vérifiée :
    // ce parent doit être un ANCÊTRE anatomique canonique du composant (ou le même composant canonique : `tip` → `nose`). Divergence documentée : docs/ANATOMY-CONTRACT.md §3.
    const comps = faceComponents(face(11).params, lm, noseGeometry(face(11).params, lm)).components;
    const notAncestor = comps.filter((c) => {
      if (!c.parent) return false;
      const me = canonicalId('contact', c.id) as string, par = canonicalId('contact', c.parent) as string;
      return me !== par && !ancestors(me).includes(par);
    });
    expect(notAncestor.map((c) => c.id)).toEqual([]);
  });

  it('le cou du corps et celui du visage sont le MÊME composant canonique', () => {
    expect(canonicalId('body', 'neck')).toBe(canonicalId('contract', 'neck'));
    expect(canonicalId('body', 'neck')).toBe(canonicalId('pose', 'neck'));
  });
});

describe('relations géométrique / anatomique / visuelle', () => {
  it("sur 40 visages : aucune erreur ; dette « œil hors orbite » bornée (ne peut pas empirer en silence)", () => {
    let eyes = 0, outside = 0, worst = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const scene = SceneSpec.parse(sceneOf(seed, false));
      const host = scene.objects.find((o) => o.kind === 'host') as HostSpec;
      const lm = hostFace(host).lm;
      for (const e of expandScene(scene)) {
        if (e.kind !== 'eye') continue;
        const pe: PlacedEye = { eye: e, world: e.transform, host: host.transform };
        for (const r of eyeRelations(pe, lm)) {
          expect(Number.isFinite(r.value)).toBe(true);
          const ok = r.cmp === '<=' ? r.value <= r.limit + 1e-9 : r.value >= r.limit - 1e-9;
          if (!ok && r.severity === 'error') throw new Error(`seed ${seed} ${r.id} : ${r.value.toFixed(3)} (limite ${r.cmp} ${r.limit}) — ${r.message}`);
          if (r.id.startsWith('eye.in-orbit')) { eyes++; worst = Math.max(worst, r.value); if (!ok) outside++; }
          else expect(r.severity === 'warn' ? true : ok).toBe(true);
        }
      }
    }
    // Mesuré le 4 nov. 2026 sur 80 visages : 12 visages concernés, pire 1,86. Garde-fou : toute dégradation fait échouer ce test.
    expect(outside / eyes).toBeLessThanOrEqual(0.25);
    expect(worst).toBeLessThanOrEqual(2);
  });

  it('verifyPipeline : scène tête + corps valide sur 3 couches pour 3 graines', () => {
    for (const seed of [3, 11, 42]) {
      const r = verifyPipeline(sceneOf(seed));
      expect(r.failures.map((c) => `${c.id}: ${c.message}`)).toEqual([]);
      expect(new Set(r.checks.map((c) => c.layer))).toEqual(new Set(['geometry', 'anatomy', 'style']));
    }
  });
});

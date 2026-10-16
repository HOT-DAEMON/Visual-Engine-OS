import { z } from 'zod';
import { Hex } from './primitives';
import { resolveAnchors, selectAnchors } from '../composition/anchors';
import { EyeSpec } from './eye';
import { RobotEyeSpec } from './robot';
import { CompoundEyeSpec } from './compound-eye';
import { GemEyeSpec } from './gem-eye';
import { PanelSpec } from './panel';
import { HostSpec } from './host';
import { LightSpec } from './light-transform';

export const SceneSpec = z
  .object({
    schemaVersion: z.literal(1).default(1),
    width: z.number().int().min(64).max(4096).default(640),
    height: z.number().int().min(64).max(4096).default(400),
    background: Hex.nullable().default(null),
    label: z
      .string()
      .max(120)
      .regex(/^[^\u0000-\u001f]*$/, 'caractères de contrôle interdits')
      .optional(),
    light: LightSpec.default({}),
    objects: z.array(z.discriminatedUnion('kind', [EyeSpec, RobotEyeSpec, PanelSpec, HostSpec, CompoundEyeSpec, GemEyeSpec])).min(1).max(256),
  })
  .strict()
  .superRefine((scene, ctx) => {
    const issue = (path: (string | number)[], message: string): void =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });

    const hosts = new Map<string, HostSpec>();
    scene.objects.forEach((o) => {
      if (o.kind === 'host') hosts.set(o.id, o);
    });

    // Identifiants finaux (objets posés inclus) : tous uniques.
    const claimed = new Set<string>();
    const claim = (id: string, i: number): void => {
      if (claimed.has(id)) issue(['objects', i, 'id'], `identifiant dupliqué : ${id}`);
      claimed.add(id);
    };

    scene.objects.forEach((o, i) => {
      if (o.kind === 'host') {
        if (o.face !== undefined && o.shape !== 'face') issue(['objects', i, 'face'], "`face` n'est accepté que pour shape: 'face'");
        const seen = new Set<string>();
        for (const a of resolveAnchors(o)) {
          if (seen.has(a.id)) issue(['objects', i, 'anchors'], `ancre dupliquée dans l'hôte ${o.id} : ${a.id}`);
          seen.add(a.id);
        }
      }

      if ('place' in o && o.place) {
        const host = hosts.get(o.place.host);
        if (!host) {
          issue(['objects', i, 'place', 'host'], `hôte introuvable : ${o.place.host}`);
          return;
        }
        if (o.place.anchors.length === 0 && o.place.patterns.length === 0) {
          issue(['objects', i, 'place'], 'au moins une ancre ou un motif est requis');
        }
        const sel = selectAnchors(host, o.place);
        for (const m of sel.missing) {
          issue(
            ['objects', i, 'place', m.kind, m.index],
            `${m.kind === 'anchors' ? 'ancre' : 'motif'} introuvable dans l'hôte ${host.id} : ${m.name}`,
          );
        }
        for (const a of sel.anchors) claim(`${o.id}-${a.id}`, i);
      } else {
        claim(o.id, i);
      }

      if (o.kind === 'robot_eye' && o.sensor.size > o.lens.aperture) {
        issue(
          ['objects', i, 'sensor', 'size'],
          `le capteur (${o.sensor.size}) doit tenir dans l'ouverture (lens.aperture = ${o.lens.aperture})`,
        );
      }
    });
  });
export type SceneSpec = z.infer<typeof SceneSpec>;
export type SceneInput = z.input<typeof SceneSpec>;

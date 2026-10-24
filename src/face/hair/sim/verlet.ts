import type { Collider, P3 } from './collider';

/** Paramètres physiques d'UNE chaîne (une mèche) ; tout est déterministe (aucun tirage ici). */
export interface ChainSpec {
  readonly root: P3;
  /** Direction de départ (unitaire, 3D) des deux premiers segments (racine rigide). */
  readonly dir: P3;
  readonly length: number;
  readonly points: number;
  readonly gravity: number;
  /** Anti-gravité volontaire (0 = jamais). */
  readonly float: number;
  /** Vent : accélération horizontale (+x) et phase de rafale. */
  readonly wind: number;
  readonly gustPhase: number;
  readonly stiffness: number;
  /** Plaquage au corps : force qui ramène le point sur la surface de son azimut. */
  readonly cling: number;
  readonly az: number;
  /** Courbure de repos (rad / segment, plan écran) : ondulation, boucle. */
  readonly curl: number;
  readonly wave: number;
  /** Épaisseur max de l'enveloppe de volume au-dessus de la surface (px). */
  readonly reach: number;
}

const norm = (v: P3): P3 => {
  const n = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / n, y: v.y / n, z: v.z / n };
};

/**
 * Résout une mèche par intégration de Verlet avec contraintes de distance, raideur angulaire, gravité, vent, plaquage et
 * collision. Nombre de pas FIXE (convergence vers l'équilibre statique) : même entrée → mêmes points.
 */
export function simulateChain(c: ChainSpec, body: Collider, steps = 36): P3[] {
  const n = c.points;
  const ds = c.length / (n - 1);
  const pos: P3[] = [];
  const prev: P3[] = [];
  // Pose initiale : droite le long de `dir` (la chute vient ensuite des forces, pas du dessin).
  for (let i = 0; i < n; i++) {
    const p = { x: c.root.x + c.dir.x * ds * i, y: c.root.y + c.dir.y * ds * i, z: c.root.z + c.dir.z * ds * i };
    pos.push(p);
    prev.push({ ...p });
  }
  const g = 0.16 * ds * c.gravity * (1 - c.float) - 0.08 * ds * c.float;
  const damp = 0.9;
  for (let s = 0; s < steps; s++) {
    const gust = 1 + 0.4 * Math.sin(c.gustPhase + s * 0.35);
    for (let i = 2; i < n; i++) {
      const p = pos[i] as P3;
      const q = prev[i] as P3;
      const vx = (p.x - q.x) * damp;
      const vy = (p.y - q.y) * damp;
      const vz = (p.z - q.z) * damp;
      prev[i] = { x: p.x, y: p.y, z: p.z };
      // Raideur angulaire : le point est tiré vers la prolongation du segment précédent (tourné de la courbure de repos).
      const a = pos[i - 1] as P3;
      const b = pos[i - 2] as P3;
      let d = norm({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
      const rotAng = c.curl + c.wave * Math.sin(i * 1.4 + c.gustPhase);
      if (rotAng !== 0) d = norm({ x: d.x * Math.cos(rotAng) - d.y * Math.sin(rotAng), y: d.x * Math.sin(rotAng) + d.y * Math.cos(rotAng), z: d.z });
      const k = c.stiffness * (1 - 0.6 * (i / n));
      const tx = a.x + d.x * ds;
      const ty = a.y + d.y * ds;
      const tz = a.z + d.z * ds;
      let nx = p.x + vx + (tx - p.x) * k * 0.5;
      let ny = p.y + vy + (ty - p.y) * k * 0.5 + g;
      let nz = p.z + vz + (tz - p.z) * k * 0.5;
      nx += c.wind * 0.03 * ds * gust * (i / n);
      // Plaquage : tendre vers la surface de l'azimut de la mèche, tant que la mèche est à hauteur du corps.
      if (c.cling > 0 && ny < body.shoulderY + 0.05 * (body.shoulderY - body.topY)) {
        const sp = body.surface(ny, c.az);
        const pull = c.cling * 0.06;
        nx += (sp.x - nx) * pull;
        nz += (sp.z - nz) * pull;
      }
      pos[i] = { x: nx, y: ny, z: nz };
    }
    // Contraintes : distance (3 relaxations) puis collision.
    for (let it = 0; it < 3; it++) {
      for (let i = 1; i < n; i++) {
        const a = pos[i - 1] as P3;
        const b = pos[i] as P3;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const l = Math.hypot(dx, dy, dz) || 1e-6;
        const f = (l - ds) / l;
        if (i === 1) pos[i] = { x: b.x - dx * f, y: b.y - dy * f, z: b.z - dz * f };
        else {
          pos[i - 1] = { x: a.x + dx * f * 0.5, y: a.y + dy * f * 0.5, z: a.z + dz * f * 0.5 };
          pos[i] = { x: b.x - dx * f * 0.5, y: b.y - dy * f * 0.5, z: b.z - dz * f * 0.5 };
        }
      }
      pos[0] = { ...c.root };
      for (let i = 1; i < n; i++) pos[i] = body.shell(body.push(pos[i] as P3).p, c.reach);
    }
  }
  // Passe finale ROBUSTE : longueur des segments exacte (de la racine vers la pointe), quelle que soit la raideur de la résolution.
  for (let i = 1; i < n; i++) {
    const a = pos[i - 1] as P3;
    const b = pos[i] as P3;
    const l = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) || 1e-6;
    pos[i] = { x: a.x + ((b.x - a.x) / l) * ds, y: a.y + ((b.y - a.y) / l) * ds, z: a.z + ((b.z - a.z) / l) * ds };
  }
  return pos;
}

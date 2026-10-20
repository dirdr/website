export type Vec3 = [number, number, number];
export interface Atom {
  id: number;
  position: Vec3;
  color: [number, number, number, number];
  radius: number;
}
export interface Molecule {
  atoms: Atom[];
  bonds: [Atom, Atom][];
  radius: number;
  bondRadius: number;
}

const colors: Record<string, [number, number, number]> = {
  H: [1, 1, 1],
  He: [0.851, 1, 1],
  Li: [0.8, 0.502, 1],
  Be: [0.761, 1, 0],
  B: [1, 0.71, 0.71],
  C: [0.565, 0.565, 0.565],
  N: [0.188, 0.314, 0.973],
  O: [1, 0.051, 0.051],
  F: [0.565, 0.878, 0.314],
  Ne: [0.702, 0.89, 0.961],
  Na: [0.671, 0.361, 0.949],
  Mg: [0.541, 1, 0],
  Al: [0.749, 0.651, 0.651],
  Si: [0.941, 0.784, 0.627],
  P: [1, 0.502, 0],
  S: [1, 1, 0.188],
  Cl: [0.122, 0.941, 0.122],
  Ar: [0.502, 0.82, 0.89],
  K: [0.561, 0.251, 0.831],
  Ca: [0.239, 1, 0],
  Fe: [0.878, 0.4, 0.2],
  Cu: [0.784, 0.502, 0.2],
  Zn: [0.49, 0.502, 0.69],
  Br: [0.651, 0.161, 0.161],
  Ag: [0.753, 0.753, 0.753],
  I: [0.58, 0, 0.58],
  Au: [1, 0.82, 0.137],
  Pb: [0.341, 0.349, 0.38],
  U: [0, 0.561, 1],
};
const radii: Record<string, number> = {
  H: 1.2,
  C: 1.7,
  N: 1.55,
  O: 1.52,
  F: 1.47,
  Cl: 1.75,
  Br: 1.85,
  I: 1.98,
  He: 1.4,
  Ne: 1.54,
  Ar: 1.88,
  P: 1.8,
  S: 1.8,
  B: 2,
  Li: 1.82,
  Na: 2.27,
  K: 2.75,
  Rb: 3.03,
  Cs: 3.43,
  Fr: 3.48,
  Be: 1.53,
  Mg: 1.73,
  Ca: 2.31,
  Sr: 2.49,
  Ba: 2.68,
  Ra: 2.83,
  Ti: 1.6,
  Fe: 1.52,
};

export function parsePdb(text: string): Molecule {
  const atoms: Atom[] = [];
  const records: number[][] = [];
  const ids = new Map<number, Atom>();
  let modelEnded = false;
  for (const line of text.split(/\r?\n/)) {
    const record = line.slice(0, 6).trim();
    if (record === 'ENDMDL') modelEnded = true;
    if ((record === 'ATOM' || record === 'HETATM') && !modelEnded) {
      const alt = line[16];
      if (alt && alt !== ' ' && alt !== 'A') continue;
      const id = Number(line.slice(6, 11));
      const position: Vec3 = [
        Number(line.slice(30, 38)),
        Number(line.slice(38, 46)),
        Number(line.slice(46, 54)),
      ];
      if (
        !Number.isInteger(id) ||
        ids.has(id) ||
        line.length < 54 ||
        !position.every(Number.isFinite)
      )
        continue;
      const rawElement =
        line.slice(76, 78).trim() ||
        line.slice(12, 16).trim().replace(/^\d+/, '').slice(0, 1);
      const element =
        rawElement[0]?.toUpperCase() + rawElement.slice(1).toLowerCase();
      const color = colors[element] ?? [1, 0.078, 0.576];
      const atom: Atom = {
        id,
        position,
        color: [...color, 1],
        radius: (radii[element] ?? 1.75) * 0.25,
      };
      atoms.push(atom);
      ids.set(id, atom);
    } else if (record === 'CONECT') {
      const values: number[] = [];
      for (let i = 6; i < Math.min(line.length, 31); i += 5) {
        const value = Number(line.slice(i, i + 5).trim());
        if (Number.isInteger(value) && value > 0) values.push(value);
      }
      if (values.length > 1) records.push(values);
    }
  }
  if (!atoms.length)
    throw new Error('No readable atoms found in this PDB file.');
  const center: Vec3 = [0, 0, 0];
  const low: Vec3 = [Infinity, Infinity, Infinity],
    high: Vec3 = [-Infinity, -Infinity, -Infinity];
  atoms.forEach((atom) =>
    atom.position.forEach((v, i) => {
      center[i]! += v / atoms.length;
      low[i] = Math.min(low[i]!, v);
      high[i] = Math.max(high[i]!, v);
    }),
  );
  const size = Math.max(...high.map((v, i) => v - low[i]!));
  const scale = size > 5 ? 5 / size : 1;
  let radius = 0;
  atoms.forEach((atom) => {
    atom.position = atom.position.map(
      (v, i) => (v - center[i]!) * scale,
    ) as Vec3;
    atom.radius *= scale;
    radius = Math.max(radius, Math.hypot(...atom.position) + atom.radius);
  });
  const seen = new Set<string>();
  const bonds: [Atom, Atom][] = [];
  for (const [startId, ...ends] of records) {
    const start = ids.get(startId!);
    if (!start) continue;
    for (const id of ends) {
      const end = ids.get(id);
      const key = [start.id, id].sort((a, b) => a - b).join(':');
      if (
        !end ||
        end === start ||
        seen.has(key) ||
        Math.hypot(...start.position.map((v, i) => v - end.position[i]!)) < 1e-6
      )
        continue;
      seen.add(key);
      bonds.push([start, end]);
    }
  }
  return { atoms, bonds, radius, bondRadius: 0.15 * scale };
}

export type BiomeId = 'stadt' | 'vorstadt' | 'wald' | 'strand';

export interface BiomePalette {
  readonly groundA: string;
  readonly groundB: string;
  readonly groundC: string;
  readonly road: string;
  readonly wall: string;
  readonly wallEdge: string;
  readonly rock: string;
  readonly tree: string;
  readonly treeTrunk: string;
  readonly fence: string;
  readonly hedge: string;
  readonly car: string;
  readonly dumpster: string;
  readonly water: string;
  readonly waterEdge: string;
  readonly prop: string;
  readonly speck: string;
  readonly fog: string;
}

export interface BiomeDef {
  readonly id: BiomeId;
  readonly name: string;
  readonly palette: BiomePalette;
  /** Grobe Hindernisdichte, steuert unter anderem die Kistenverteilung. */
  readonly density: number;
}

export const BIOMES: Record<BiomeId, BiomeDef> = {
  stadt: {
    id: 'stadt',
    name: 'Stadt',
    density: 0.34,
    palette: {
      groundA: '#3c3f45', groundB: '#404349', groundC: '#44474e',
      road: '#2b2d31', wall: '#5a5148', wallEdge: '#6d6255',
      rock: '#54585f', tree: '#3d5a3a', treeTrunk: '#4a3a2c',
      fence: '#6b6b70', hedge: '#3f5f3c', car: '#7a4040', dumpster: '#3f6b52',
      water: '#26414f', waterEdge: '#33566a', prop: '#6a5a44',
      speck: 'rgba(255,255,255,0.05)', fog: 'rgba(10,12,16,0.55)',
    },
  },
  vorstadt: {
    id: 'vorstadt',
    name: 'Vorstadt',
    density: 0.24,
    palette: {
      groundA: '#4e6139', groundB: '#53663d', groundC: '#586c41',
      road: '#42454a', wall: '#8a7b64', wallEdge: '#a08e74',
      rock: '#6a6e73', tree: '#4b8241', treeTrunk: '#4a3a2c',
      fence: '#8d7a58', hedge: '#2f5a2c', car: '#5a6a86', dumpster: '#4a6b52',
      water: '#2f6f8f', waterEdge: '#4d93b4', prop: '#7a6748',
      speck: 'rgba(255,255,255,0.045)', fog: 'rgba(10,14,10,0.5)',
    },
  },
  wald: {
    id: 'wald',
    name: 'Wald',
    density: 0.3,
    palette: {
      groundA: '#2d3c26', groundB: '#31412a', groundC: '#293722',
      road: '#4a4132', wall: '#4a4033', wallEdge: '#5b4f3f',
      rock: '#5b6067', tree: '#4a8c40', treeTrunk: '#3d2f22',
      fence: '#5b4a34', hedge: '#2a4a26', car: '#5a5040', dumpster: '#3f5a44',
      water: '#254a5a', waterEdge: '#356b80', prop: '#4f4030',
      speck: 'rgba(255,255,255,0.04)', fog: 'rgba(8,14,10,0.6)',
    },
  },
  strand: {
    id: 'strand',
    name: 'Strand',
    density: 0.12,
    palette: {
      groundA: '#c9b285', groundB: '#cfb98c', groundC: '#c3ab7d',
      road: '#a89066', wall: '#9c8a6a', wallEdge: '#b39d78',
      rock: '#8d8577', tree: '#3f6b3a', treeTrunk: '#6a5232',
      fence: '#a58c60', hedge: '#5e7a44', car: '#8a7a5a', dumpster: '#7a8a6a',
      water: '#2a7fa0', waterEdge: '#4fb3cf', prop: '#a06a4a',
      speck: 'rgba(255,255,255,0.06)', fog: 'rgba(20,18,10,0.35)',
    },
  },
};

export const BIOME_IDS: readonly BiomeId[] = ['stadt', 'vorstadt', 'wald', 'strand'];

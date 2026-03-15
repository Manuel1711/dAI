export type Erc8004Entity = {
  id: string;
  type: string;
  label?: string;
  meta?: Record<string, unknown>;
};

export type Erc8004Edge = {
  source: string;
  target: string;
  relation: string;
  weight?: number;
};

export type Erc8004Summary = {
  title: string;
  updatedAt: string;
  stats?: {
    entities?: number;
    edges?: number;
  };
};

export type Erc8004Manifest = {
  version: string;
  generatedAt: string;
  summary: Erc8004Summary;
  entities: Erc8004Entity[];
  edges: Erc8004Edge[];
};

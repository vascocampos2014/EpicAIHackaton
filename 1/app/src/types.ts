export type Sentido = -1 | 0 | 1;

export interface Indicador {
  id: string;
  nome: string;
  descricao: string;
  unidade: string;
  pergunta: 0 | 1 | 2 | 3;
  sentido: Sentido;
}

export interface Municipio {
  id: string;
  nome: string;
  codigo_ine: string;
  nuts1: string;
  nuts2: string;
  nuts3: string;
  populacao: number;
  pequeno: boolean;
  v: Record<string, number | null>;
  p: Record<string, number | null>;
}

export interface Atlas {
  gerado: string;
  fontes: string[];
  notas: string[];
  indicadores: Indicador[];
  municipios: Municipio[];
}

export type Series = Record<string, { anos: number[]; valores: Record<string, (number | null)[]> }>;

export type Pesos = Record<string, number>;

export interface Cenario {
  id: string;
  curto: string;
  titulo: string;
  pergunta: string;
  criterio: string;
  pesos: Pesos;
}

export interface Resultado {
  score: Map<string, number>;
  ranking: Municipio[]; // elegíveis, do melhor para o pior
  rank: Map<string, number>; // 1-based, entre elegíveis
  melhor?: Municipio;
  alternativa?: Municipio;
  evitar?: Municipio;
}

export type Publico = "cidadao" | "investidor";

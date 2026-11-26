import type { Cenario } from "./types";

export const CENARIOS: Cenario[] = [
  {
    id: "c1",
    curto: "1 · Falta de casas",
    titulo: "Onde faltam casas a quem já lá vive",
    pergunta: "Onde é que faltam mais casas para quem já lá vive?",
    criterio:
      "Pouca folga no stock atual (alojamentos por agregado) e um défice que se acumulou na última década " +
      "(a população cresceu mais do que as casas), com pouca construção recente a compensar.",
    pesos: {
      defice_crescimento_por_1000: 0.4,
      alojamentos_por_agregado: 0.4,
      construcao_recente_por_1000: 0.2,
    },
  },
  {
    id: "c2",
    curto: "2 · Procura futura",
    titulo: "Onde vai haver mais gente à procura de casa",
    pergunta: "Onde é que vai haver mais gente à procura de casa nos próximos anos?",
    criterio:
      "Quem está a chegar (saldo migratório, novos residentes estrangeiros, crescimento recente), " +
      "quem está em idade de sair de casa dos pais (25–39 anos), descontando a oferta que já está licenciada.",
    pesos: {
      saldo_migratorio_por_1000: 0.3,
      novos_estrangeiros_por_1000: 0.25,
      crescimento_pop_21_23_pct: 0.2,
      jovens_adultos_pct: 0.15,
      oferta_a_caminho_por_1000: 0.1,
    },
  },
  {
    id: "c3",
    curto: "3 · Investimento que compensa",
    titulo: "Onde o investimento compensa para todos",
    pergunta: "Onde é que um investimento compensa, para a comunidade e para quem investe?",
    criterio:
      "Metade necessidade, metade mercado. Necessidade: défice acumulado e pessoas a chegar (retorno social). " +
      "Mercado: poder de compra para pagar a habitação e um território onde o que se licencia chega a ser construído (risco de execução).",
    pesos: {
      defice_crescimento_por_1000: 0.25,
      saldo_migratorio_por_1000: 0.25,
      poder_compra: 0.3,
      taxa_execucao: 0.2,
    },
  },
];

export const PERSONALIZADO_ID = "custom";

/** Linguagem simples para a vista do cidadão. */
export const NOME_SIMPLES: Record<string, string> = {
  alojamentos_por_agregado: "Casas disponíveis por família",
  defice_crescimento_por_1000: "Famílias novas sem casa nova (2011–21)",
  construcao_recente_por_1000: "Prédios e moradias acabados (2018–22)",
  saldo_migratorio_por_1000: "Pessoas a mudar-se para cá",
  crescimento_pop_21_23_pct: "Crescimento da população (2021–23)",
  novos_estrangeiros_por_1000: "Novos residentes estrangeiros",
  jovens_adultos_pct: "Jovens adultos (25–39 anos)",
  oferta_a_caminho_por_1000: "Obras aprovadas ainda por acabar",
  poder_compra: "Poder de compra",
  poder_compra_var_11_21: "Evolução do poder de compra",
  taxa_execucao: "Obras aprovadas que chegam ao fim",
  peso_reabilitacao_pct: "Peso da reabilitação nas obras",
  densidade: "Habitantes por km²",
  ensino_superior_pct_nuts2: "Ensino superior (região)",
};

export const VISTA_INDICADORES = {
  cidadao: [
    "alojamentos_por_agregado",
    "defice_crescimento_por_1000",
    "construcao_recente_por_1000",
    "saldo_migratorio_por_1000",
    "crescimento_pop_21_23_pct",
    "jovens_adultos_pct",
    "novos_estrangeiros_por_1000",
  ],
  investidor: [
    "poder_compra",
    "poder_compra_var_11_21",
    "taxa_execucao",
    "oferta_a_caminho_por_1000",
    "peso_reabilitacao_pct",
    "saldo_migratorio_por_1000",
    "defice_crescimento_por_1000",
    "densidade",
    "ensino_superior_pct_nuts2",
  ],
} as const;

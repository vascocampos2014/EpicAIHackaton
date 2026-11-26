import type { Atlas, Indicador, Municipio, Pesos, Resultado } from "./types";

/** Percentil orientado: 1 = mais necessidade/procura/atratividade para a pergunta. */
export function orientado(ind: Indicador, p: number): number {
  return ind.sentido < 0 ? 1 - p : p;
}

export function pontuar(atlas: Atlas, pesos: Pesos, excluirPequenos: boolean): Resultado {
  const byId = new Map(atlas.indicadores.map((i) => [i.id, i]));
  const score = new Map<string, number>();
  for (const m of atlas.municipios) {
    let num = 0;
    let den = 0;
    for (const [k, w] of Object.entries(pesos)) {
      const p = m.p[k];
      const ind = byId.get(k);
      if (!w || p == null || !ind) continue;
      num += w * orientado(ind, p);
      den += w;
    }
    if (den > 0) score.set(m.id, num / den);
  }
  const ranking = atlas.municipios
    .filter((m) => score.has(m.id) && !(excluirPequenos && m.pequeno))
    .sort((a, b) => score.get(b.id)! - score.get(a.id)!);
  const rank = new Map(ranking.map((m, i) => [m.id, i + 1]));
  return {
    score,
    ranking,
    rank,
    melhor: ranking[0],
    alternativa: ranking[1],
    evitar: ranking[ranking.length - 1],
  };
}

export type Resposta = { tipo: "Construir" | "Reabilitar" | "Misto"; razao: string };

/**
 * Construir ou reabilitar? Regra simples e explicável:
 * - stock com folga (alojamentos por agregado acima do percentil 60) → há casas, muitas vazias → reabilitar;
 * - stock apertado (abaixo do percentil 40) → faltam casas → construir;
 * - entre os dois, o mercado local decide: se a reabilitação já pesa ≥ 30 % das licenças, misto.
 */
export function respostaHabitacional(m: Municipio): Resposta {
  const folga = m.p.alojamentos_por_agregado;
  const reab = m.v.peso_reabilitacao_pct;
  const fmt = (x: number | null) => (x == null ? "—" : x.toFixed(2).replace(".", ","));
  const casas = `${fmt(m.v.alojamentos_por_agregado)} alojamentos por agregado`;
  if (folga == null) return { tipo: "Misto", razao: "Sem dados de stock." };
  if (folga >= 0.6)
    return { tipo: "Reabilitar", razao: `Há stock com folga (${casas}, acima da maioria dos municípios): recuperar casas vazias ou degradadas antes de construir.` };
  if (folga < 0.4)
    return { tipo: "Construir", razao: `O stock está apertado (${casas}, abaixo da maioria): reabilitar não chega, é preciso construção nova.` };
  return reab != null && reab >= 30
    ? { tipo: "Misto", razao: `Stock na média (${casas}) e a reabilitação já é ${Math.round(reab)} % das licenças: combinar as duas.` }
    : { tipo: "Construir", razao: `Stock na média (${casas}) e o mercado local é sobretudo de construção nova (${reab == null ? "—" : Math.round(reab)} % reabilitação).` };
}

const nf = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 2 });
export function fmtValor(v: number | null | undefined, unidade = ""): string {
  if (v == null) return "—";
  const s = Math.abs(v) < 10 ? nf2.format(v) : nf.format(v);
  return unidade.startsWith("%") ? `${s} %` : s;
}
export const fmtInt = (v: number) => new Intl.NumberFormat("pt-PT").format(Math.round(v));

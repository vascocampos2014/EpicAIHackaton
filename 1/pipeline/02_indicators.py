"""Passo 2 — indicadores por município.

Entradas (passos 0 e 1): data/tidy.csv, data/territorios.csv, data/populacao.csv, data/codigos_ine.csv
Saídas:
  data/indicadores.csv            1 linha por município (308), valores brutos
  app/public/data/atlas.json      o que o dashboard lê: catálogo de indicadores + valores + percentis
  app/public/data/series.json     séries anuais por município (gráficos de evolução)

O site (Vercel) é estático: este script corre localmente e os JSON são ficheiros servidos tal como estão.
As pontuações dos cenários NÃO são calculadas aqui — o front end combina os percentis com os pesos,
para que o utilizador possa definir os seus próprios critérios.

Uso: .venv/bin/python pipeline/02_indicators.py
"""
from __future__ import annotations

import json
import re
import unicodedata
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
PUBLIC = ROOT / "app" / "public" / "data"

POP_PEQUENO = 5000  # abaixo disto as taxas por habitante são muito voláteis

REAB = "Ampliações, alterações e reconstruções"
JOVENS = ["25 - 29 anos", "30 - 34 anos", "35 - 39 anos"]


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


# Catálogo: o front end usa isto para legendas, tooltips e para orientar os percentis.
# sentido = +1 → valor alto significa MAIS necessidade/procura/atratividade para a pergunta;
# sentido = -1 → valor alto significa MENOS.
CATALOGO = [
    # Pergunta 1 — falta de casas para quem já lá vive
    dict(id="alojamentos_por_agregado", pergunta=1, sentido=-1, unidade="alojamentos/agregado",
         nome="Alojamentos por agregado (2021)",
         descricao="Stock de alojamentos ÷ (população ÷ dimensão média do agregado da NUTS II). "
                   "Abaixo de ~1,2 há pouca folga; inclui casas vazias e 2.ª habitação, por isso "
                   "sobrestima a oferta real em zonas turísticas."),
    dict(id="defice_crescimento_por_1000", pergunta=1, sentido=+1, unidade="agregados/1000 hab.",
         nome="Défice acumulado 2011–2021",
         descricao="Agregados novos (saldo total 2012–2021 ÷ dimensão média) menos alojamentos novos "
                   "(stock 2021 − 2011), por 1000 habitantes. Positivo = a população cresceu mais do que as casas."),
    dict(id="construcao_recente_por_1000", pergunta=1, sentido=-1, unidade="edifícios/1000 hab.",
         nome="Edifícios concluídos 2018–2022",
         descricao="Edifícios para habitação familiar concluídos em 5 anos, por 1000 habitantes. "
                   "Conta edifícios, não fogos; 2021–2022 são estimativas."),
    # Pergunta 2 — procura futura
    dict(id="saldo_migratorio_por_1000", pergunta=2, sentido=+1, unidade="pessoas/1000 hab./ano",
         nome="Saldo migratório médio 2018–2022",
         descricao="Entradas − saídas por ano, média de 5 anos, por 1000 habitantes."),
    dict(id="crescimento_pop_21_23_pct", pergunta=2, sentido=+1, unidade="%",
         nome="Crescimento da população 2021–2023",
         descricao="Variação da população residente (INE, série revista em 2026). Não comparável com anos anteriores a 2021."),
    dict(id="novos_estrangeiros_por_1000", pergunta=2, sentido=+1, unidade="pessoas/1000 hab.",
         nome="Novos residentes estrangeiros 2017–2022",
         descricao="Aumento de estrangeiros com título de residência, por 1000 habitantes. Exclui irregulares e nómadas sem residência."),
    dict(id="jovens_adultos_pct", pergunta=2, sentido=+1, unidade="% da população",
         nome="População 25–39 anos (2023)",
         descricao="Idade típica de formação de novos agregados — procura futura de primeira habitação."),
    dict(id="oferta_a_caminho_por_1000", pergunta=2, sentido=-1, unidade="edifícios/1000 hab.",
         nome="Oferta a caminho (licenciados − concluídos 2020–2022)",
         descricao="Edifícios licenciados que ainda não foram concluídos no mesmo período, por 1000 habitantes. "
                   "Mais oferta a caminho reduz a pressão futura."),
    # Pergunta 3 — retorno para a comunidade e para o investidor
    dict(id="poder_compra", pergunta=3, sentido=+1, unidade="índice (PT = 100)",
         nome="Poder de compra per capita (2021)",
         descricao="Índice; não é rendimento em euros."),
    dict(id="poder_compra_var_11_21", pergunta=3, sentido=+1, unidade="pontos",
         nome="Variação do poder de compra 2011–2021",
         descricao="Pontos de índice ganhos ou perdidos face à média nacional."),
    dict(id="taxa_execucao", pergunta=3, sentido=+1, unidade="concluídos/licenciados",
         nome="Taxa de execução de licenças",
         descricao="Concluídos 2014–2022 ÷ licenciados 2012–2020 (desfasamento de 2 anos). "
                   "Alto = o que se licencia chega ao mercado."),
    dict(id="peso_reabilitacao_pct", pergunta=3, sentido=0, unidade="% das licenças",
         nome="Peso da reabilitação nas licenças 2018–2022",
         descricao="Ampliações, alterações e reconstruções ÷ total licenciado. Indica se o mercado local "
                   "já é de reabilitar ou de construir novo (não é bom nem mau)."),
    dict(id="densidade", pergunta=0, sentido=0, unidade="hab./km²",
         nome="Densidade populacional (2022)", descricao="Contexto."),
    dict(id="ensino_superior_pct_nuts2", pergunta=0, sentido=0, unidade="% (16+ anos)",
         nome="População com ensino superior — NUTS II (2022)",
         descricao="Valor regional, igual para todos os municípios da mesma NUTS II."),
]


def main() -> None:
    tidy = pd.read_csv(DATA / "tidy.csv")
    terr = pd.read_csv(DATA / "territorios.csv")
    pop_l = pd.read_csv(DATA / "populacao.csv")
    cod = pd.read_csv(DATA / "codigos_ine.csv")

    mun = terr[terr.nivel == "Município"].set_index("id")
    ids = mun.index

    def wide(quadro: str, cat: str = "Total", nivel_ids=ids) -> pd.DataFrame:
        d = tidy[(tidy.quadro == quadro) & (tidy.categoria == cat)]
        w = d.pivot(index="territorio_id", columns="ano", values="valor")
        return w.reindex(nivel_ids)

    def soma(w: pd.DataFrame, a0: int, a1: int) -> pd.Series:
        return w[[a for a in w.columns if a0 <= a <= a1]].sum(axis=1)

    pop = pop_l[pop_l.grupo_etario == "Total"].pivot(index="territorio_id", columns="ano", values="valor").reindex(ids)
    P21, P23 = pop[2021], pop[2023]

    # Dimensão média do agregado: só existe por NUTS II → atribuir a cada município.
    nuts2_id = "nuts-ii-" + mun.nuts2.map(slug)
    dim_n2 = wide("dimensao_media", nivel_ids=nuts2_id.unique())[2021]
    dim = nuts2_id.map(dim_n2)
    esc_tot = wide("escolaridade", "Total", nuts2_id.unique())[2022]
    esc_sup = wide("escolaridade", "Superior", nuts2_id.unique())[2022]
    superior_n2 = nuts2_id.map(esc_sup / esc_tot * 100)

    aloj = wide("alojamentos")
    saldo_tot = wide("saldos", "Saldo total")
    saldo_mig = wide("saldos", "Saldo migratório")
    lic, lic_reab = wide("licenciados"), wide("licenciados", REAB)
    conc = wide("concluidos")
    estr = wide("estrangeiros")
    pc = wide("poder_compra")
    dens = wide("densidade")

    jovens = (pop_l[(pop_l.ano == 2023) & pop_l.grupo_etario.isin(JOVENS)]
              .groupby("territorio_id").valor.sum().reindex(ids))

    agregados_novos = soma(saldo_tot, 2012, 2021) / dim
    aloj_novos = aloj[2021] - aloj[2011]

    ind = pd.DataFrame(index=ids)
    ind["alojamentos_por_agregado"] = aloj[2021] / (P21 / dim)
    ind["defice_crescimento_por_1000"] = (agregados_novos - aloj_novos) / P21 * 1000
    ind["construcao_recente_por_1000"] = soma(conc, 2018, 2022) / P21 * 1000
    ind["saldo_migratorio_por_1000"] = soma(saldo_mig, 2018, 2022) / 5 / P21 * 1000
    ind["crescimento_pop_21_23_pct"] = (P23 / P21 - 1) * 100
    ind["novos_estrangeiros_por_1000"] = (estr[2022] - estr[2017]) / P21 * 1000
    ind["jovens_adultos_pct"] = jovens / P23 * 100
    ind["oferta_a_caminho_por_1000"] = (soma(lic, 2020, 2022) - soma(conc, 2020, 2022)) / P21 * 1000
    ind["poder_compra"] = pc[2021]
    ind["poder_compra_var_11_21"] = pc[2021] - pc[2011]
    lic_base = soma(lic, 2012, 2020)
    ind["taxa_execucao"] = soma(conc, 2014, 2022) / lic_base.where(lic_base > 0)
    lic_rec = soma(lic, 2018, 2022)
    ind["peso_reabilitacao_pct"] = soma(lic_reab, 2018, 2022) / lic_rec.where(lic_rec > 0) * 100
    ind["densidade"] = dens[2022]
    ind["ensino_superior_pct_nuts2"] = superior_n2

    assert list(ind.columns) == [c["id"] for c in CATALOGO], "catálogo e colunas fora de ordem"

    base = pd.DataFrame({
        "nome": mun.nome, "codigo_ine": cod.set_index("territorio_id").codigo_ine.reindex(ids),
        "nuts1": mun.nuts1, "nuts2": mun.nuts2, "nuts3": mun.nuts3,
        "populacao_2021": P21, "populacao_2023": P23, "alojamentos_2021": aloj[2021],
        "dimensao_media_nuts2": dim, "pequeno": P23 < POP_PEQUENO,
    })
    out = base.join(ind.round(3))
    out.index.name = "territorio_id"
    out.to_csv(DATA / "indicadores.csv")

    # Percentis 0–1 (robustos a outliers como Corvo ou Lisboa). NaN fica NaN.
    pct = ind.rank(pct=True)

    def limpo(v):
        return None if pd.isna(v) else (round(float(v), 4) if isinstance(v, (float, np.floating)) else v)

    municipios = []
    for tid, b in base.iterrows():
        municipios.append({
            "id": tid, "nome": b.nome, "codigo_ine": b.codigo_ine,
            "nuts1": b.nuts1, "nuts2": b.nuts2, "nuts3": b.nuts3,
            "populacao": int(b.populacao_2023), "pequeno": bool(b.pequeno),
            "v": {k: limpo(ind.at[tid, k]) for k in ind.columns},
            "p": {k: limpo(pct.at[tid, k]) for k in ind.columns},
        })

    PUBLIC.mkdir(parents=True, exist_ok=True)
    atlas = {
        "gerado": date.today().isoformat(),
        "fontes": ["PORDATA (INE, SEF/MAI), extraído a 29-02-2024",
                   "INE API, indicador 0008273 — população residente 2011–2023"],
        "notas": [
            "Edifícios ≠ fogos: licenciados e concluídos contam edifícios.",
            "População INE de 2021 em diante foi revista (mais imigração): quebra de série em 2021.",
            "Dimensão média e escolaridade só existem por NUTS II.",
            f"Municípios com menos de {POP_PEQUENO} habitantes têm taxas voláteis (campo 'pequeno').",
        ],
        "indicadores": CATALOGO,
        "municipios": municipios,
    }
    (PUBLIC / "atlas.json").write_text(json.dumps(atlas, ensure_ascii=False, separators=(",", ":")))

    # Séries para gráficos: {serie: {anos: [...], valores: {id: [...]}}}
    series_src = {
        "populacao": pop, "alojamentos": aloj, "concluidos": conc, "licenciados": lic,
        "saldo_total": saldo_tot, "saldo_migratorio": saldo_mig, "estrangeiros": estr, "poder_compra": pc,
    }
    series = {}
    for nome, w in series_src.items():
        anos = [int(a) for a in w.columns]
        series[nome] = {"anos": anos,
                        "valores": {tid: [limpo(x) for x in w.loc[tid].tolist()] for tid in ids}}
    (PUBLIC / "series.json").write_text(json.dumps(series, ensure_ascii=False, separators=(",", ":")))

    # Resumo
    print(f"{len(out)} municípios × {len(ind.columns)} indicadores → data/indicadores.csv")
    for f in ("atlas.json", "series.json"):
        print(f"  app/public/data/{f}: {(PUBLIC / f).stat().st_size / 1024:.0f} KB")
    nan = ind.isna().sum()
    if nan.any():
        print("  valores em falta:", nan[nan > 0].to_dict())
    print(f"  municípios pequenos (<{POP_PEQUENO} hab.): {int(base.pequeno.sum())}")


if __name__ == "__main__":
    main()

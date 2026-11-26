"""Passo 0 — dados externos (INE).

Descarrega da API do INE a população residente por município e grupo etário
(indicador 0008273, estimativas anuais, 2011–2023) e liga cada município ao
`territorio_id` do passo 1.

Saídas:
  data/external/ine/0008273_<ano>.json   respostas em bruto (cache; apagar para voltar a descarregar)
  data/populacao.csv                     territorio_id, codigo_ine, ano, grupo_etario, valor
  data/codigos_ine.csv                   territorio_id, codigo_ine, nome_ine

Uso: .venv/bin/python pipeline/00_fetch.py   (correr depois de 01_extract.py)
"""
from __future__ import annotations

import json
import re
import time
import unicodedata
import urllib.request
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CACHE = DATA / "external" / "ine"

INDICADOR = "0008273"
ANOS = range(2011, 2024)
QUEBRA_ANO = 2021  # 1.º ano da série revista pelo INE (ver main)
URL = ("https://www.ine.pt/ine/json_indicador/pindica.jsp"
       "?op=2&varcd={var}&Dim1=S7A{ano}&Dim3=T&lang=PT")  # Dim3=T → ambos os sexos

# 1.º dígito do código INE → NUTS I usada no passo 1
NUTS1_POR_CODIGO = {"1": "Continente", "2": "Região Autónoma dos Açores",
                    "3": "Região Autónoma da Madeira"}


def slug(s: str) -> str:
    s = re.sub(r"\[.*?\]", "", s)  # "Calheta [R.A.M.]" → "Calheta"
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def fetch(ano: int) -> list[dict]:
    path = CACHE / f"{INDICADOR}_{ano}.json"
    if not path.exists():
        url = URL.format(var=INDICADOR, ano=ano)
        with urllib.request.urlopen(url, timeout=120) as r:
            payload = r.read()
        doc = json.loads(payload)[0]
        if "Verdadeiro" not in doc.get("Sucesso", {}):
            raise RuntimeError(f"INE {ano}: {doc.get('Sucesso')}")
        path.write_bytes(payload)
        print(f"  descarregado {ano}")
        time.sleep(0.5)
    doc = json.loads(path.read_text())[0]
    return doc["Dados"][str(ano)]


def main() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    rows = []
    for ano in ANOS:
        for r in fetch(ano):
            if len(r["geocod"]) != 7:  # 7 dígitos = município (NUTS III + DICOFRE)
                continue
            rows.append({"codigo_ine": r["geocod"], "nome_ine": r["geodsg"], "ano": ano,
                         "grupo_etario": r["dim_4_t"], "valor": int(r["valor"])})
    pop = pd.DataFrame(rows)

    # Ligação ao passo 1 por (nome normalizado, NUTS I) — resolve Calheta e Lagoa.
    terr = pd.read_csv(DATA / "territorios.csv")
    mun = terr[terr.nivel == "Município"].assign(chave=lambda d: d.nome.map(slug))
    codigos = (pop[["codigo_ine", "nome_ine"]].drop_duplicates()
               .assign(chave=lambda d: d.nome_ine.map(slug),
                       nuts1=lambda d: d.codigo_ine.str[0].map(NUTS1_POR_CODIGO)))
    assert codigos.codigo_ine.is_unique
    link = mun.merge(codigos, on=["chave", "nuts1"], how="outer", indicator=True)
    falhas = link[link._merge != "both"]
    if len(falhas):
        print(falhas[["nome", "nuts1", "nome_ine", "codigo_ine", "_merge"]].to_string())
        raise SystemExit("Municípios sem correspondência — rever a ligação acima.")
    link = link.rename(columns={"id": "territorio_id"})[["territorio_id", "codigo_ine", "nome_ine"]]
    assert len(link) == 308 and link.territorio_id.is_unique

    pop = pop.merge(link[["territorio_id", "codigo_ine"]], on="codigo_ine")
    # O INE reviu as estimativas de 2021 em diante (mais imigração) mas não as de 2011–2020:
    # Δ2020→2021 é +205 mil vs. saldo total PORDATA de +27 mil. Tratar como quebra de série.
    pop["quebra_serie"] = pop["ano"] == QUEBRA_ANO
    pop = pop[["territorio_id", "codigo_ine", "ano", "grupo_etario", "valor", "quebra_serie"]]
    pop.sort_values(["territorio_id", "ano", "grupo_etario"]).to_csv(DATA / "populacao.csv", index=False)
    link.sort_values("territorio_id").to_csv(DATA / "codigos_ine.csv", index=False)

    tot = pop[pop.grupo_etario == "Total"]
    print(f"308/308 municípios ligados → data/codigos_ine.csv")
    print(f"{len(pop)} valores ({tot.ano.min()}–{tot.ano.max()}) → data/populacao.csv")
    for a in (2011, 2021, 2023):
        print(f"  população total {a}: {tot[tot.ano == a].valor.sum():,}")


if __name__ == "__main__":
    main()

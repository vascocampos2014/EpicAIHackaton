"""Passo 1 — extração.

Lê os 9 quadros PORDATA (folha `Quadro`) e produz:
  data/territorios.csv  hierarquia: id, nome, nivel, nuts1, nuts2, nuts3
  data/tidy.csv         formato longo: quadro, territorio_id, categoria, ano, valor, quebra_serie, estimado

Uso: .venv/bin/python pipeline/01_extract.py
"""
from __future__ import annotations

import re
import unicodedata
from pathlib import Path

import openpyxl
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "dados" / "dados"
OUT = ROOT / "data"

HEADER_ROW = 12  # linha (1-based) com "Âmbito Geográfico | Anos | 2001 | ..."
CAT_ROWS = (10, 11)  # linhas onde aparecem as categorias (nível 1 e 2)
NIVEIS = {"NUTS 2013": "País", "NUTS I": "NUTS I", "NUTS II": "NUTS II",
          "NUTS III": "NUTS III", "Município": "Município"}

# Nome curto de cada quadro, identificado por uma palavra-chave no nome do ficheiro.
QUADROS = {
    "Conclu": "concluidos",
    "Licenciados": "licenciados",
    "Familiares": "alojamentos",
    "Densidade": "densidade",
    "Saldos": "saldos",
    "estrangeira": "estrangeiros",
    "Poder-de-compra": "poder_compra",
    "Dimens": "dimensao_media",
    "escolaridade": "escolaridade",
}

# Valores estimados segundo o README (o Excel não os marca célula a célula).
ESTIMADO_DESDE = {"concluidos": 2021, "alojamentos": 2011}


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def quadro_de(path: Path) -> str:
    name = unicodedata.normalize("NFC", path.name)
    for key, q in QUADROS.items():
        if unicodedata.normalize("NFC", key) in name:
            return q
    raise ValueError(f"Ficheiro não reconhecido: {path.name}")


def ler_quadro(path: Path) -> tuple[pd.DataFrame, list[dict]]:
    ws = openpyxl.load_workbook(path, read_only=True)["Quadro"]
    rows = list(ws.iter_rows(values_only=True))
    header = rows[HEADER_ROW - 1]
    assert header[0] == "Âmbito Geográfico", f"{path.name}: cabeçalho inesperado {header[:3]}"

    # Categoria de cada coluna: propagar para a direita as células mescladas.
    cats = []
    for r in CAT_ROWS:
        row, cur = rows[r - 1], None
        line = []
        for c in range(2, len(header)):
            v = row[c] if c < len(row) else None
            if v is not None:
                cur = str(v).strip()
            line.append(cur)
        cats.append(line)

    cols = []
    for i, c in enumerate(range(2, len(header))):
        h = header[c]
        if h is None:
            continue
        hs = str(h)
        quebra = "┴" in hs
        ano = int(re.sub(r"\D", "", hs))
        # Usa a categoria mais específica (linha 11) se existir, senão a da linha 10.
        cat = cats[1][i] or cats[0][i] or "Total"
        cols.append((c, ano, cat, quebra))

    terr, nuts1 = [], {}
    n1 = n2 = n3 = None
    records = []
    for row in rows[HEADER_ROW:]:
        nivel_raw = row[0] if row else None
        if nivel_raw not in NIVEIS:
            continue
        nome = str(row[1]).strip()
        nivel = NIVEIS[nivel_raw]
        if nome == "Ignorado/Outro":
            continue
        if nivel == "NUTS I":
            n1, n2, n3 = nome, None, None
        elif nivel == "NUTS II":
            n2, n3 = nome, None
        elif nivel == "NUTS III":
            n3 = nome
        if nivel == "Município":
            tid = f"mun-{slug(nome)}--{slug(n3)}"
        else:
            tid = f"{slug(nivel)}-{slug(nome)}"
        terr.append({"id": tid, "nome": nome, "nivel": nivel,
                     "nuts1": n1, "nuts2": n2, "nuts3": n3})
        for c, ano, cat, quebra in cols:
            v = row[c]
            records.append({"territorio_id": tid, "categoria": cat, "ano": ano,
                            "valor": v, "quebra_serie": quebra})
    return pd.DataFrame(records), terr


def main() -> None:
    OUT.mkdir(exist_ok=True)
    frames, territorios = [], {}
    for path in sorted(RAW.glob("*.xlsx")):
        q = quadro_de(path)
        df, terr = ler_quadro(path)
        df.insert(0, "quadro", q)
        if df["categoria"].nunique() == 1:  # série única: a "categoria" é só a unidade
            df["categoria"] = "Total"
        desde = ESTIMADO_DESDE.get(q)
        df["estimado"] = df["ano"] >= desde if desde else False
        frames.append(df)
        for t in terr:
            prev = territorios.setdefault(t["id"], t)
            assert prev == t, f"Hierarquia inconsistente para {t['id']}: {prev} vs {t}"
        n_mun = sum(t["nivel"] == "Município" for t in terr)
        print(f"{q:15s} {len(df):7d} valores  {n_mun:3d} municípios  "
              f"anos {df.ano.min()}–{df.ano.max()}  categorias {df.categoria.nunique()}")

    tidy = pd.concat(frames, ignore_index=True)
    tidy["valor"] = pd.to_numeric(tidy["valor"], errors="raise")
    terr = pd.DataFrame(territorios.values())

    assert terr["id"].is_unique
    assert (terr.nivel == "Município").sum() == 308, "esperados 308 municípios"
    assert not tidy.duplicated(["quadro", "territorio_id", "categoria", "ano"]).any()

    terr.to_csv(OUT / "territorios.csv", index=False)
    tidy.to_csv(OUT / "tidy.csv", index=False)
    print(f"\n{len(terr)} territórios → data/territorios.csv")
    print(f"{len(tidy)} valores → data/tidy.csv")


if __name__ == "__main__":
    main()

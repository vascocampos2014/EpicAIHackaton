"""Passo 3 — geometria dos municípios (GeoAPI.pt, dados CAOP/DGT).

Descarrega o contorno de cada município, confirma que o código DICOFRE devolvido bate com o
código INE (4 últimos dígitos) e grava um FeatureCollection com `properties.id = territorio_id`.

Saídas:
  data/external/geo/<dicofre>.json     geometria em bruto (cache)
  data/municipios_raw.geojson          308 features, resolução total
  app/public/data/municipios.geojson   simplificado (shapely) para o site

Uso: .venv/bin/python pipeline/03_geo.py
"""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pandas as pd
import shapely
from shapely.geometry import mapping, shape

TOLERANCIA = 0.002  # graus (~200 m) — suficiente para um mapa do país inteiro

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CACHE = DATA / "external" / "geo"
PUBLIC = ROOT / "app" / "public" / "data"
API = "https://json.geoapi.pt/municipio/{nome}?json=1{extra}"

# Nomes ambíguos na GeoAPI: o filtro `distrito` desambigua (valor = distrito/ilha).
NOMES_GEOAPI = {"4501": "Calheta de São Jorge", "4201": "Lagoa (açores)", "4302": "Praia da Vitória"}
DISTRITOS_TENTATIVA =["Faro", "Ilha de São Miguel", "São Miguel", "Ilha de São Jorge", "São Jorge",
                       "Ilha da Madeira", "Madeira", "Açores"]


def get(nome: str, extra: str = "") -> dict | None:
    url = API.format(nome=urllib.parse.quote(nome), extra=extra)
    for tentativa in range(3):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                d = json.loads(r.read())
            return None if "erro" in d else d
        except Exception:
            time.sleep(2 * (tentativa + 1))
    return None


def baixar(row) -> tuple[str, str]:
    dicofre = row.codigo_ine[-4:]
    path = CACHE / f"{dicofre}.json"
    if path.exists():
        return row.territorio_id, "cache"
    d = get(NOMES_GEOAPI.get(dicofre, row.nome_ine))
    if d is None or d.get("codigoine") != dicofre:
        d = next((x for dist in DISTRITOS_TENTATIVA
                  if (x := get(row.nome_ine, "&distrito=" + urllib.parse.quote(dist)))
                  and x.get("codigoine") == dicofre), None)
    if d is None:
        return row.territorio_id, "FALHOU"
    path.write_text(json.dumps({"dicofre": dicofre, "geometry": d["geojson"]["geometry"],
                                "area_ha": d["geojson"]["properties"].get("Area_T_ha")}))
    return row.territorio_id, "ok"


def main() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    cod = pd.read_csv(DATA / "codigos_ine.csv", dtype=str)
    with ThreadPoolExecutor(max_workers=4) as ex:
        res = list(ex.map(baixar, cod.itertuples()))
    falhas = [t for t, s in res if s == "FALHOU"]
    print(f"{sum(s == 'ok' for _, s in res)} descarregados, {sum(s == 'cache' for _, s in res)} em cache")
    if falhas:
        raise SystemExit(f"Sem geometria: {falhas}")

    feats = []
    for r in cod.itertuples():
        g = json.loads((CACHE / f"{r.codigo_ine[-4:]}.json").read_text())
        feats.append({"type": "Feature", "geometry": g["geometry"],
                      "properties": {"id": r.territorio_id, "area_km2": round((g["area_ha"] or 0) / 100, 2)}})
    raw = DATA / "municipios_raw.geojson"
    raw.write_text(json.dumps({"type": "FeatureCollection", "features": feats}))
    print(f"{len(feats)} municípios → {raw.relative_to(ROOT)} ({raw.stat().st_size / 1e6:.1f} MB)")

    out = PUBLIC / "municipios.geojson"
    simp = []
    for f in feats:
        g = shape(f["geometry"]).simplify(TOLERANCIA, preserve_topology=True)
        g = shapely.set_precision(g, 0.0001)  # ~10 m; reduz o tamanho do ficheiro
        assert not g.is_empty, f["properties"]["id"]
        pt = shape(f["geometry"]).representative_point()  # ponto garantidamente dentro do polígono
        props = {**f["properties"], "cx": round(pt.x, 4), "cy": round(pt.y, 4)}
        simp.append({**f, "properties": props, "geometry": mapping(g)})
    out.write_text(json.dumps({"type": "FeatureCollection", "features": simp}, separators=(",", ":")))
    print(f"→ {out.relative_to(ROOT)} ({out.stat().st_size / 1e6:.2f} MB, tolerância {TOLERANCIA}°)")


if __name__ == "__main__":
    main()

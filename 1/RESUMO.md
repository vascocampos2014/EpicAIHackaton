# Habitar+ Investment Atlas — resumo do trabalho (handoff)

## 1. O desafio
Hackathon "Epic AI Recruiting". A Habitar+ vai lançar um programa de construção/reabilitação habitacional em Portugal (continente + ilhas). Pede-se um **dashboard interativo** para **cidadãos e investidores** que responda a três perguntas:

1. Onde é que faltam mais casas para quem já lá vive?
2. Onde é que vai haver mais gente à procura de casa nos próximos anos?
3. Onde é que um investimento compensa, para a comunidade e para quem investe?

Cada pergunta = um **cenário** com critério próprio (pesos/filtros/regras) que escolhe **2 municípios prioritários (melhor + alternativa) e 1 a evitar**. No fim: recomendar um cenário, onde investir primeiro e se a resposta é **construir ou reabilitar**.

Entregáveis: (1) dashboard com seletor de cenários, áreas com mais/menos necessidade e vista cidadão/investidor; (2) recomendação com critérios, cenário escolhido e limites da análise; (3) bónus: o utilizador define os seus próprios critérios + pesquisa externa sobre retorno social/financeiro. "Não há uma resposta única correta: conta a ligação entre dados, cenários e recomendação."

**Entrega via Vercel** → site estático. O Python corre só localmente; o front end lê JSON pré-calculados.

## 2. Estrutura do projeto
```
1/
├── dados/dados/          9 Excel PORDATA originais + README.md (não alterar)
├── pipeline/
│   ├── 01_extract.py     Excel → data/tidy.csv + data/territorios.csv
│   ├── 00_fetch.py       API INE → data/populacao.csv + data/codigos_ine.csv (correr DEPOIS do 01)
│   └── 02_indicators.py  → data/indicadores.csv + app/public/data/{atlas,series}.json
├── data/                 intermédios (CSV) + data/external/ine/ (cache da API)
├── app/public/data/      JSON servidos pelo site  ← o front end só precisa disto
└── .venv/                Python 3.12 + pandas + openpyxl
```
Ordem: `.venv/bin/python pipeline/01_extract.py && .venv/bin/python pipeline/00_fetch.py && .venv/bin/python pipeline/02_indicators.py`

## 3. Dados
**PORDATA (fonte INE; estrangeiros SEF/MAI), extraído 29-02-2024**, 308 municípios, formato largo (território × ano):
concluídos e licenciados para habitação familiar (**edifícios, não fogos**; total / construções novas / ampliações-alterações-reconstruções), alojamentos familiares clássicos (stock), densidade, saldos (total/natural/migratório), estrangeiros residentes (total + 20 nacionalidades), poder de compra per capita (índice PT=100, bienal), dimensão média do agregado e escolaridade (**só NUTS II**).

**INE API** (`https://www.ine.pt/ine/json_indicador/pindica.jsp?op=2&varcd=0008273&Dim1=S7A{ano}&Dim3=T&lang=PT`): população residente por município e grupo etário, 2011–2023. Ligada aos municípios por (nome normalizado, NUTS I) — 308/308.

Não existe nos dados: preços, rendas, emprego, sobrelotação, área, geometria.

### Achados importantes
- Excel limpo: sem símbolos nem vazios nas células; quebras de série só no cabeçalho dos anos (dimensão média 2001/2011/2021, escolaridade 2011).
- Nomes repetidos (Calheta, Lagoa em continente/ilhas) → `territorio_id` = `mun-<nome>--<nuts3>`.
- Rodapé PORDATA diz que os valores seguem **NUTS 2024** apesar do nome "NUTS2013" (ilhas dos Açores/Madeira são NUTS III).
- **Quebra de série INE em 2021**: Δpop INE 2012–2020 bate exatamente com o saldo total PORDATA; em 2021 o INE dá +205 mil vs. +27 mil da PORDATA (estimativas de 2021+ revistas pelo INE, atualização jul-2026). Regra: **níveis** de população → INE 2021/2023; **crescimento** histórico → saldos PORDATA.

## 4. Indicadores (`app/public/data/atlas.json`)
`sentido`: +1 = valor alto significa mais necessidade/procura/atratividade para a pergunta; −1 = o contrário; 0 = contexto/neutro.

| id | P | sentido | definição |
|---|---|---|---|
| alojamentos_por_agregado | 1 | −1 | alojamentos 2021 ÷ (pop 2021 ÷ dimensão média NUTS II). Inclui casas vazias e 2.ª habitação |
| defice_crescimento_por_1000 | 1 | +1 | (saldo total 2012–21 ÷ dim. média − Δalojamentos 2011–21) / pop × 1000 |
| construcao_recente_por_1000 | 1 | −1 | concluídos 2018–22 / pop × 1000 |
| saldo_migratorio_por_1000 | 2 | +1 | média anual 2018–22 / pop × 1000 |
| crescimento_pop_21_23_pct | 2 | +1 | INE 2023/2021 − 1 |
| novos_estrangeiros_por_1000 | 2 | +1 | (estrangeiros 2022 − 2017) / pop × 1000 |
| jovens_adultos_pct | 2 | +1 | % 25–39 anos (2023) |
| oferta_a_caminho_por_1000 | 2 | −1 | (licenciados − concluídos 2020–22) / pop × 1000 |
| poder_compra | 3 | +1 | índice 2021 |
| poder_compra_var_11_21 | 3 | +1 | pontos 2021 − 2011 |
| taxa_execucao | 3 | +1 | concluídos 2014–22 ÷ licenciados 2012–20 (desfasamento 2 anos) |
| peso_reabilitacao_pct | 3 | 0 | % reabilitação nas licenças 2018–22 → apoia "construir vs reabilitar" |
| densidade | 0 | 0 | hab/km² 2022 |
| ensino_superior_pct_nuts2 | 0 | 0 | % superior, NUTS II 2022 |

Sanidade (excluindo municípios < 5000 hab.): menor folga de alojamentos → Vizela, Paços de Ferreira, Trofa, Lousada; maior défice acumulado → Sobral de Monte Agraço, Palmela, Mafra, Odemira; maior saldo migratório → Odemira, Sobral, Óbidos, Bombarral; mais novos estrangeiros → Odemira, Vila do Bispo, Aljezur, Lagos; maior poder de compra → Lisboa, Oeiras, Porto, Cascais.

### Formato dos JSON
```jsonc
// atlas.json (~330 KB)
{ "gerado": "2026-11-26", "fontes": [...], "notas": [...],
  "indicadores": [{ "id", "nome", "descricao", "unidade", "pergunta": 0-3, "sentido": -1|0|1 }],
  "municipios": [{ "id", "nome", "codigo_ine", "nuts1", "nuts2", "nuts3",
                   "populacao": 2023, "pequeno": bool /* <5000 hab */,
                   "v": { "<indicador>": valor|null },     // valor bruto
                   "p": { "<indicador>": 0..1|null } }]}   // percentil entre os 308
// series.json (~290 KB)
{ "<serie>": { "anos": [...], "valores": { "<territorio_id>": [...] } } }
// séries: populacao, alojamentos, concluidos, licenciados, saldo_total, saldo_migratorio, estrangeiros, poder_compra
```

## 5. Decisões de arquitetura
- **A pontuação dos cenários é feita no front end**: `score = Σ peso_i × orient(p_i)` com `orient(p) = sentido > 0 ? p : 1 − p`. Os cenários são só objetos de pesos/filtros, o que torna o bónus "critérios do utilizador" trivial (sliders).
- Usar percentis (não min-max) por causa de outliers (Lisboa, Corvo).
- Filtro por defeito sugerido: excluir `pequeno` da escolha "melhor/alternativa" (taxas voláteis), mas mostrá-los no mapa.
- "A evitar" = pior score do cenário (entre não-pequenos).

## 6. Próximos passos
1. **Mapa**: GeoJSON dos municípios (CAOP/DGT ou `https://json.geoapi.pt/municipio/{nome}` → `geojson`; atenção: o campo `areaha` da GeoAPI está errado, usar `geojson.properties.Area_T_ha`). Ligar por `codigo_ine` (4 últimos dígitos = DICOFRE). Simplificar geometria (ex.: mapshaper) para ficar < 1–2 MB, guardar em `app/public/data/`.
2. **Definir os 3 cenários** (pesos) e validar que melhor/alternativa/evitar fazem sentido.
3. **Front end** em `app/` (sugestão: Vite + React + MapLibre/Leaflet ou D3), deploy estático no Vercel com root `app/`.
4. Bónus: rendas/preços (INE tem indicadores de rendas por município na mesma API) para o cenário 3.
5. Escrever recomendação + limites.

## 7. Limites conhecidos
Edifícios ≠ fogos; alojamentos incluem vazios/2.ª habitação (sobrestima oferta em zonas turísticas); dimensão média e escolaridade só NUTS II; quebra de série INE 2021; concluídos 2021+ e alojamentos 2011+ são estimativas; estrangeiros exclui irregulares; poder de compra é índice, não rendimento; sem preços/rendas/emprego nos dados fornecidos.

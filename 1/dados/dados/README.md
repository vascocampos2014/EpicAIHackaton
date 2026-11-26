# Dados — Habitar+ Investment Atlas

Nove quadros PORDATA (fonte original: INE, e SEF/MAI no caso dos estrangeiros), extraídos a 29-02-2024 e organizados pela divisão territorial NUTS 2013. São séries anuais em formato largo: cada linha é um território (Portugal → NUTS I → NUTS II → NUTS III → Município, 308 municípios incluindo as ilhas) e as colunas são anos, agrupados por categoria quando o quadro tem mais do que uma.

**Atenção:** dois quadros só chegam ao nível NUTS II (7 regiões) e não têm dados por município. Não há dados de preços, rendas, emprego nem sobrelotação; esses indicadores têm de vir do ficheiro de pressupostos ou de outra fonte.

## Ficheiros

| Ficheiro | O que contém | Nível | Anos |
|---|---|---|---|
| `Concluídos-para-habitação-familiar-por-tipo-de-obra` | N.º de **edifícios** (não fogos) para habitação familiar cuja obra terminou no ano: construções novas vs. ampliações/alterações/reconstruções. É a oferta que chegou efetivamente ao mercado; valores de 2021 em diante são estimativas. | Município | 1995, 2001, 2009–2022 |
| `Licenciados-para-habitação-familiar-por-tipo-de-obra` | N.º de **edifícios** para habitação familiar licenciados pelas câmaras no ano, com a mesma divisão novas vs. reabilitação. Indica a construção que vem a caminho; nem tudo o que é licenciado chega a ser concluído. | Município | 1995, 2001, 2009–2022 |
| `Familiares-clássicos` | Stock total de alojamentos familiares clássicos (casas e apartamentos) existentes. Conta casas, não famílias, e inclui casas vazias e de segunda habitação; a partir de 2011 os valores são estimativas. | Município | 2001, 2009–2021 |
| `Densidade-populacional` | Habitantes por km². Não indica quantas pessoas vivem no território, só quão concentradas estão. | Município | 2001, 2009–2022 |
| `Saldos-anuais-total-natural-e-migratório` | Variação anual da população em n.º de pessoas: saldo natural (nascimentos − óbitos), saldo migratório (entradas − saídas) e saldo total. É o melhor indicador do crescimento ou declínio de cada município. | Município | 2001, 2009–2022 |
| `População-estrangeira-com-estatuto-legal-de-residente-por-nacionalidades` | N.º de estrangeiros com autorização de residência a 31/12, no total e por 20 nacionalidades/grupos (ex.: Brasil, Reino Unido, Índia, Nepal). Não inclui estrangeiros em situação irregular nem turistas ou nómadas digitais sem residência. | Município | 2008–2022 |
| `Poder-de-compra-per-capita` | Índice em que Portugal = 100 (ex.: 120 significa 20% acima da média nacional). **Não é em euros nem é rendimento**; é um estudo bienal, por isso só existem anos ímpares desde 2007. | Município | 1993, 2000, 2002, 2007–2021 (bienal) |
| `Dimensão-média` | N.º médio de pessoas por agregado doméstico, a partir de um inquérito amostral (Inquérito ao Emprego). | **Só NUTS II** | 1992, 2001, 2009–2021 |
| `População-com-16-e-mais-anos-por-nível-de-escolaridade` | População residente com 16–89 anos por nível de escolaridade mais elevado, de "sem nível" a "superior", **em milhares**. Vem de um inquérito amostral; até 2010 a faixa etária era 15+. | **Só NUTS II** | 1998, 2001, 2009–2022 |

## Notas de leitura

- **Estrutura do Excel:** os dados estão na folha `Quadro` e os cabeçalhos ocupam as primeiras ~12 linhas; a definição oficial de cada indicador está na folha `Metainformação`.
- **Símbolos:** `┴` = quebra de série (não compare diretamente com anos anteriores), `...` = confidencial, `//` = não aplicável, `-` = sem valor, `N` = valor negligenciável, `fr` = fiabilidade reduzida.
- **Não somar níveis:** as linhas incluem totais (Portugal, NUTS I/II/III) e municípios ao mesmo tempo; filtre pela coluna `Âmbito Geográfico` antes de agregar.

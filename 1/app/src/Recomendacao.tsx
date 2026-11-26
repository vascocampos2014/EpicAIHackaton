import { CENARIOS } from "./scenarios";
import { fmtValor, respostaHabitacional } from "./score";
import type { Atlas, Municipio, Resultado } from "./types";

interface Props {
  atlas: Atlas;
  todos: Record<string, Resultado>;
  onVer: (cenario: string, id: string) => void;
}

const RECOMENDADO = "c3";

export default function Recomendacao({ atlas, todos, onVer }: Props) {
  const ind = new Map(atlas.indicadores.map((i) => [i.id, i]));
  const regioes = [...new Set(atlas.municipios.map((m) => m.nuts2))];
  const TOP = 20;
  const porRegiao = Object.fromEntries(
    CENARIOS.map((c) => {
      const cont = new Map<string, number>();
      todos[c.id].ranking.slice(0, TOP).forEach((m) => cont.set(m.nuts2, (cont.get(m.nuts2) ?? 0) + 1));
      return [c.id, cont];
    }),
  );
  const rec = todos[RECOMENDADO];
  const alvo = rec.melhor!;
  const alt = rec.alternativa!;
  const resp = respostaHabitacional(alvo);
  const respAlt = respostaHabitacional(alt);
  const rankEm = (m: Municipio, c: string) => todos[c].rank.get(m.id);
  const n = rec.ranking.length;

  const Pick = ({ m, c, papel }: { m?: Municipio; c: string; papel: string }) =>
    m ? (
      <button type="button" className={`pick pick-${papel}`} onClick={() => onVer(c, m.id)}>
        <span className="muted">{papel === "melhor" ? "Melhor opção" : papel === "alternativa" ? "Alternativa" : "A evitar"}</span>
        <strong>{m.nome}</strong>
        <span className="muted">{m.nuts3}</span>
      </button>
    ) : null;

  return (
    <article className="recomendacao">
      <section className="hero-rec">
        <p className="eyebrow">Recomendação</p>
        <h2>
          Seguir o cenário 3 e investir primeiro em <em>{alvo.nome}</em>: {resp.tipo.toLowerCase()}.
        </h2>
        <p>
          O cenário 3 é o único que junta as duas metades do problema: <strong>retorno social</strong> (há défice e há gente a chegar)
          e <strong>viabilidade para o investidor</strong> (poder de compra para pagar e licenças que chegam ao fim). {alvo.nome} é{" "}
          {rankEm(alvo, "c3")}.º de {n} neste cenário, {rankEm(alvo, "c2")}.º na procura futura e {rankEm(alvo, "c1")}.º na falta de casas —
          não é só uma aposta de mercado. {resp.razao}
        </p>
        <p>
          Alternativa: <strong>{alt.nome}</strong> ({respAlt.tipo.toLowerCase()}; {rankEm(alt, "c1")}.º na falta de casas,{" "}
          {rankEm(alt, "c2")}.º na procura futura).
        </p>
        <div className="kpis">
          {(["defice_crescimento_por_1000", "saldo_migratorio_por_1000", "poder_compra", "taxa_execucao"] as const).map((k) => (
            <div key={k} className="kpi">
              <span className="muted">{ind.get(k)!.nome}</span>
              <strong>{fmtValor(alvo.v[k], ind.get(k)!.unidade)}</strong>
              <span className="muted">{ind.get(k)!.unidade}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3>Os três cenários</h3>
        <div className="cenarios-grid">
          {CENARIOS.map((c) => (
            <div key={c.id} className={`cenario-card ${c.id === RECOMENDADO ? "recomendado" : ""}`}>
              <p className="eyebrow">{c.curto}{c.id === RECOMENDADO ? " · recomendado" : ""}</p>
              <h4>{c.pergunta}</h4>
              <p className="muted">{c.criterio}</p>
              <ul className="pesos">
                {Object.entries(c.pesos).map(([k, w]) => (
                  <li key={k}>
                    <span>{ind.get(k)!.nome}</span>
                    <span>{Math.round(w * 100)} %</span>
                  </li>
                ))}
              </ul>
              <div className="picks">
                <Pick m={todos[c.id].melhor} c={c.id} papel="melhor" />
                <Pick m={todos[c.id].alternativa} c={c.id} papel="alternativa" />
                <Pick m={todos[c.id].evitar} c={c.id} papel="evitar" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3>O que muda entre cenários</h3>
        <p className="muted">
          Em que regiões ficam os {TOP} primeiros de cada cenário. A falta de casas concentra-se nas periferias de Lisboa e do Porto, onde o
          stock já não chega para quem lá vive; a procura futura puxa para o litoral alentejano, o Algarve e o Oeste, onde chega gente nova;
          o investimento que compensa fica onde as duas coisas se cruzam com poder de compra.
        </p>
        <table className="tabela">
          <thead>
            <tr>
              <th>Região (NUTS II)</th>
              {CENARIOS.map((c) => (
                <th key={c.id} className="num">{c.curto}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {regioes.map((r) => (
              <tr key={r}>
                <td>{r}</td>
                {CENARIOS.map((c) => {
                  const v = porRegiao[c.id].get(r) ?? 0;
                  return (
                    <td key={c.id} className="num">
                      <span className="mini-barra" style={{ width: `${(v / TOP) * 60}px` }} />
                      {v}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h3>Limites da análise</h3>
        <ul className="limites">
          <li><strong>Edifícios, não casas.</strong> Licenciados e concluídos contam edifícios: um prédio de 40 fogos vale o mesmo que uma moradia.</li>
          <li><strong>O stock inclui casas vazias e de férias.</strong> No Algarve e no interior a folga aparente não está disponível para quem lá vive.</li>
          <li><strong>Sem preços, rendas, emprego nem sobrelotação.</strong> O retorno financeiro é aproximado pelo poder de compra (um índice, não euros).</li>
          <li><strong>Quebra de série na população.</strong> O INE reviu as estimativas de 2021 em diante (mais imigração); o crescimento histórico usa os saldos da PORDATA.</li>
          <li><strong>Dados regionais aplicados a municípios.</strong> A dimensão média do agregado e a escolaridade só existem por NUTS II.</li>
          <li><strong>Municípios pequenos.</strong> Abaixo de 5000 habitantes as taxas oscilam muito; ficam fora das escolhas, mas aparecem no mapa.</li>
          <li><strong>Estimativas.</strong> Concluídos de 2021–22 e alojamentos de 2012–21 são estimativas do INE; estrangeiros exclui quem não tem título de residência.</li>
          <li><strong>Os pesos são escolhas.</strong> Não há uma resposta única: no separador Explorar, «Os meus critérios» deixa testar outros pesos.</li>
        </ul>
        <p className="muted nota">Fontes: {atlas.fontes.join(" · ")} · geometria CAOP/DGT via GeoAPI.pt. Gerado a {atlas.gerado}.</p>
      </section>
    </article>
  );
}

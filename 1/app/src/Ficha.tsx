import LineChart from "./LineChart";
import { CENARIOS, NOME_SIMPLES, VISTA_INDICADORES } from "./scenarios";
import { fmtInt, fmtValor, orientado, respostaHabitacional } from "./score";
import type { Atlas, Municipio, Publico, Resultado, Series } from "./types";

interface Props {
  m: Municipio;
  atlas: Atlas;
  series: Series | null;
  publico: Publico;
  resultado: Resultado;
  todos: Record<string, Resultado>;
  cores: { s1: string; s2: string };
  onClose: () => void;
}

export default function Ficha({ m, atlas, series, publico, resultado, todos, cores, onClose }: Props) {
  const ind = new Map(atlas.indicadores.map((i) => [i.id, i]));
  const resp = respostaHabitacional(m);
  const rank = resultado.rank.get(m.id);
  const sc = resultado.score.get(m.id);
  const serie = (k: string) => (series ? { anos: series[k].anos, valores: series[k].valores[m.id] } : null);
  const pop = serie("populacao"), conc = serie("concluidos"), lic = serie("licenciados");
  const extra = publico === "cidadao" ? serie("estrangeiros") : serie("poder_compra");

  return (
    <aside className="ficha" aria-label={`Ficha de ${m.nome}`}>
      <header>
        <div>
          <h2>{m.nome}</h2>
          <p className="muted">
            {m.nuts3} · {m.nuts2} · {fmtInt(m.populacao)} hab. (2023)
          </p>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar ficha">
          ✕
        </button>
      </header>

      {m.pequeno && <p className="aviso">Menos de 5000 habitantes: as taxas por habitante oscilam muito. Fica fora das escolhas dos cenários.</p>}

      <div className="ficha-score">
        <div>
          <span className="muted">Pontuação neste cenário</span>
          <strong className="big">{sc == null ? "—" : Math.round(sc * 100)}</strong>
          <span className="muted">{rank ? `${rank}.º de ${resultado.ranking.length}` : "fora do ranking"}</span>
        </div>
        <div className={`resposta resposta-${resp.tipo.toLowerCase()}`}>
          <span className="muted">Resposta habitacional</span>
          <strong>{resp.tipo}</strong>
          <span>{resp.razao}</span>
        </div>
      </div>

      <div className="ficha-cenarios">
        {CENARIOS.map((c) => {
          const r = todos[c.id]?.rank.get(m.id);
          return (
            <div key={c.id}>
              <span className="muted">{c.curto}</span>
              <strong>{r ? `${r}.º` : "—"}</strong>
            </div>
          );
        })}
      </div>

      <h3>{publico === "cidadao" ? "O que se passa aqui" : "Indicadores de mercado e necessidade"}</h3>
      <ul className="indicadores">
        {VISTA_INDICADORES[publico].map((k) => {
          const i = ind.get(k)!;
          const p = m.p[k];
          const nome = publico === "cidadao" ? NOME_SIMPLES[k] : i.nome;
          return (
            <li key={k} title={i.descricao}>
              <div className="ind-top">
                <span>{nome}</span>
                <strong>
                  {fmtValor(m.v[k], i.unidade)} <small className="muted">{i.unidade.startsWith("%") ? "" : i.unidade}</small>
                </strong>
              </div>
              <div className="barra" aria-hidden>
                <span style={{ width: `${(p ?? 0) * 100}%` }} />
              </div>
              <div className="ind-sub muted">
                {p == null ? "sem dados" : `mais alto que ${Math.round(p * 100)} % dos municípios`}
                {i.sentido !== 0 && p != null && orientado(i, p) >= 0.8 && i.pergunta > 0 && <em> · sinal forte para a pergunta {i.pergunta}</em>}
              </div>
            </li>
          );
        })}
      </ul>

      {series && pop && conc && lic && extra && (
        <div className="charts">
          <LineChart titulo="População residente (INE)" series={[{ nome: "População", cor: cores.s1, ...pop }]} quebra={2021} />
          <LineChart
            titulo="Edifícios para habitação"
            series={[
              { nome: "Licenciados", cor: cores.s2, ...lic },
              { nome: "Concluídos", cor: cores.s1, ...conc },
            ].map((s) => ({ ...s, anos: s.anos.filter((a) => a >= 2009), valores: s.valores.slice(s.anos.indexOf(2009)) }))}
          />
          {publico === "cidadao" ? (
            <LineChart titulo="Residentes estrangeiros" series={[{ nome: "Estrangeiros", cor: cores.s1, ...extra }]} />
          ) : (
            <LineChart titulo="Poder de compra (Portugal = 100)" series={[{ nome: "Índice", cor: cores.s1, ...extra }]} />
          )}
          <p className="muted nota">┴ quebra de série: o INE reviu a população de 2021 em diante.</p>
        </div>
      )}
    </aside>
  );
}

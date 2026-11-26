import { useEffect, useMemo, useState } from "react";
import MapView, { type Destaque } from "./MapView";
import Ficha from "./Ficha";
import Recomendacao from "./Recomendacao";
import { CENARIOS, NOME_SIMPLES, PERSONALIZADO_ID } from "./scenarios";
import { fmtInt, pontuar, respostaHabitacional } from "./score";
import type { Atlas, Pesos, Publico, Resultado, Series } from "./types";

// Rampa sequencial (azul), 5 classes por quintil. Escuro: passos próprios, o baixo recua para a superfície.
const RAMPA = {
  light: ["#cde2fb", "#86b6ef", "#3987e5", "#1c5cab", "#0d366b"],
  dark: ["#104281", "#1c5cab", "#2a78d6", "#6da7ec", "#b7d3f6"],
};
const TEMA = {
  light: { superficie: "#fcfcfb", linha: "#0b0b0b", s1: "#2a78d6", s2: "#eb6834" },
  dark: { superficie: "#1a1a19", linha: "#f0efec", s1: "#3987e5", s2: "#d95926" },
};
const PALAVRA: Record<string, string> = { c1: "falta de casas", c2: "procura futura", c3: "atratividade", custom: "pontuação" };

function useDark() {
  const q = typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  const [dark, setDark] = useState(q?.matches ?? false);
  useEffect(() => {
    if (!q) return;
    const f = (e: MediaQueryListEvent) => setDark(e.matches);
    q.addEventListener("change", f);
    return () => q.removeEventListener("change", f);
  }, [q]);
  return dark;
}

export default function App() {
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [geo, setGeo] = useState<any>(null);
  const [series, setSeries] = useState<Series | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<"explorar" | "recomendacao">("explorar");
  const [cenario, setCenario] = useState("c1");
  const [publico, setPublico] = useState<Publico>("cidadao");
  const [excluirPequenos, setExcluirPequenos] = useState(true);
  const [pesosCustom, setPesosCustom] = useState<Pesos>({ ...CENARIOS[2].pesos });
  const [sel, setSel] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [verTodos, setVerTodos] = useState(false);
  const modo = useDark() ? "dark" : "light";

  useEffect(() => {
    Promise.all([fetch("/data/atlas.json").then((r) => r.json()), fetch("/data/municipios.geojson").then((r) => r.json())])
      .then(([a, g]) => {
        setAtlas(a);
        setGeo(g);
      })
      .catch((e) => setErro(String(e)));
    fetch("/data/series.json").then((r) => r.json()).then(setSeries).catch(() => {});
  }, []);

  const todos = useMemo(() => {
    if (!atlas) return {} as Record<string, Resultado>;
    return Object.fromEntries(CENARIOS.map((c) => [c.id, pontuar(atlas, c.pesos, excluirPequenos)]));
  }, [atlas, excluirPequenos]);

  const resultado = useMemo(() => {
    if (!atlas) return null;
    return cenario === PERSONALIZADO_ID ? pontuar(atlas, pesosCustom, excluirPequenos) : todos[cenario];
  }, [atlas, cenario, pesosCustom, excluirPequenos, todos]);

  const { cores, limites } = useMemo(() => {
    const cores = new Map<string, string>();
    if (!resultado) return { cores, limites: [] as number[] };
    const vals = [...resultado.score.values()].sort((a, b) => a - b);
    const limites = [1, 2, 3, 4].map((q) => vals[Math.floor((q / 5) * vals.length)]);
    for (const [id, s] of resultado.score) cores.set(id, RAMPA[modo][limites.filter((l) => s >= l).length]);
    return { cores, limites };
  }, [resultado, modo]);

  const destaques = useMemo<Destaque[]>(() => {
    if (!resultado) return [];
    return [
      resultado.melhor && { id: resultado.melhor.id, papel: "melhor" as const },
      resultado.alternativa && { id: resultado.alternativa.id, papel: "alternativa" as const },
      resultado.evitar && { id: resultado.evitar.id, papel: "evitar" as const },
    ].filter(Boolean) as Destaque[];
  }, [resultado]);

  if (erro) return <div className="estado">Não foi possível carregar os dados: {erro}</div>;
  if (!atlas || !geo || !resultado) return <div className="estado">A carregar o atlas…</div>;

  const byId = new Map(atlas.municipios.map((m) => [m.id, m]));
  const indById = new Map(atlas.indicadores.map((i) => [i.id, i]));
  const cen = CENARIOS.find((c) => c.id === cenario);
  const pesosAtivos = cen?.pesos ?? pesosCustom;
  const municipioSel = sel ? byId.get(sel) : undefined;
  const palavra = PALAVRA[cenario];

  const tooltip = (id: string) => {
    const m = byId.get(id);
    const s = resultado.score.get(id);
    if (!m) return null;
    const r = resultado.rank.get(id);
    return {
      titulo: m.nome,
      linhas: [
        `Pontuação ${s == null ? "—" : Math.round(s * 100)}${r ? ` · ${r}.º de ${resultado.ranking.length}` : " · fora do ranking"}`,
        `${fmtInt(m.populacao)} hab. · ${respostaHabitacional(m).tipo}`,
      ],
    };
  };

  const escolherCenario = (id: string) => {
    if (id === PERSONALIZADO_ID && cen) setPesosCustom({ ...cen.pesos });
    setCenario(id);
  };

  const q = busca.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const lista = resultado.ranking.filter((m) => !q || m.nome.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").includes(q));
  const visiveis = verTodos || q ? lista : lista.slice(0, 12);

  const ajustaveis = atlas.indicadores.filter((i) => i.sentido !== 0);

  return (
    <div className="app">
      <header className="topo">
        <div className="marca">
          <h1>Habitar+ Investment Atlas</h1>
          <p className="muted">308 municípios · onde faltam casas, onde vai crescer a procura e onde investir</p>
        </div>
        <nav className="abas" aria-label="Secções">
          <button type="button" className={aba === "explorar" ? "on" : ""} onClick={() => setAba("explorar")}>Explorar</button>
          <button type="button" className={aba === "recomendacao" ? "on" : ""} onClick={() => setAba("recomendacao")}>Recomendação</button>
        </nav>
      </header>

      {aba === "recomendacao" ? (
        <Recomendacao
          atlas={atlas}
          todos={todos}
          onVer={(c, id) => {
            setCenario(c);
            setSel(id);
            setAba("explorar");
          }}
        />
      ) : (
        <>
          <div className="controlos">
            <div className="segmented" role="radiogroup" aria-label="Cenário">
              {[...CENARIOS.map((c) => ({ id: c.id, curto: c.curto })), { id: PERSONALIZADO_ID, curto: "Os meus critérios" }].map((c) => (
                <button key={c.id} type="button" role="radio" aria-checked={cenario === c.id} className={cenario === c.id ? "on" : ""} onClick={() => escolherCenario(c.id)}>
                  {c.curto}
                </button>
              ))}
            </div>
            <div className="segmented" role="radiogroup" aria-label="Vista">
              {(["cidadao", "investidor"] as const).map((p) => (
                <button key={p} type="button" role="radio" aria-checked={publico === p} className={publico === p ? "on" : ""} onClick={() => setPublico(p)}>
                  {p === "cidadao" ? "Cidadão" : "Investidor"}
                </button>
              ))}
            </div>
            <label className="check">
              <input type="checkbox" checked={excluirPequenos} onChange={(e) => setExcluirPequenos(e.target.checked)} />
              Excluir municípios com menos de 5000 hab.
            </label>
          </div>

          <main className="grelha">
            <section className="painel">
              <p className="eyebrow">{cen ? "Pergunta da direção" : "Critério personalizado"}</p>
              <h2>{cen ? cen.pergunta : "Defina os seus próprios pesos"}</h2>
              <p className="muted">{cen ? cen.criterio : "Mova os sliders: o mapa e o ranking atualizam-se. Cada indicador já está orientado para «mais necessidade / mais atrativo»."}</p>

              <div className="picks">
                {destaques.map((d) => {
                  const m = byId.get(d.id)!;
                  return (
                    <button key={d.papel} type="button" className={`pick pick-${d.papel}`} onClick={() => setSel(m.id)}>
                      <span className="muted">
                        <span className={`pin pin-${d.papel} pin-inline`} aria-hidden>{d.papel === "melhor" ? "1" : d.papel === "alternativa" ? "2" : "✕"}</span>
                        {d.papel === "melhor" ? "Melhor opção" : d.papel === "alternativa" ? "Alternativa" : "A evitar"}
                      </span>
                      <strong>{m.nome}</strong>
                      <span className="muted">
                        {Math.round(resultado.score.get(m.id)! * 100)} pts · {respostaHabitacional(m).tipo}
                      </span>
                    </button>
                  );
                })}
              </div>

              {cen ? (
                <ul className="pesos">
                  {Object.entries(pesosAtivos).map(([k, w]) => (
                    <li key={k} title={indById.get(k)?.descricao}>
                      <span>{publico === "cidadao" ? NOME_SIMPLES[k] : indById.get(k)?.nome}</span>
                      <span className="peso-barra"><span style={{ width: `${w * 100}%` }} /></span>
                      <span className="num">{Math.round(w * 100)} %</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="sliders">
                  {[1, 2, 3].map((pg) => (
                    <fieldset key={pg}>
                      <legend>Pergunta {pg}</legend>
                      {ajustaveis.filter((i) => i.pergunta === pg).map((i) => (
                        <label key={i.id} title={i.descricao}>
                          <span>{publico === "cidadao" ? NOME_SIMPLES[i.id] : i.nome}</span>
                          <input
                            type="range" min={0} max={100} step={5}
                            value={Math.round((pesosCustom[i.id] ?? 0) * 100)}
                            onChange={(e) => setPesosCustom({ ...pesosCustom, [i.id]: Number(e.target.value) / 100 })}
                          />
                          <span className="num">{Math.round((pesosCustom[i.id] ?? 0) * 100)}</span>
                        </label>
                      ))}
                    </fieldset>
                  ))}
                  <button type="button" className="link" onClick={() => setPesosCustom({})}>Pôr tudo a zero</button>
                </div>
              )}
            </section>

            <section className="centro">
              <MapView
                geo={geo}
                cores={cores}
                destaques={destaques}
                selecionado={sel}
                onSelect={setSel}
                tooltip={tooltip}
                superficie={TEMA[modo].superficie}
                linha={TEMA[modo].linha}
              />
              <div className="legenda" aria-label="Legenda do mapa">
                <span className="muted">Menos {palavra}</span>
                {RAMPA[modo].map((c, i) => (
                  <i key={c} style={{ background: c }} title={i === 0 ? `< ${Math.round(limites[0] * 100)}` : i === 4 ? `≥ ${Math.round(limites[3] * 100)}` : `${Math.round(limites[i - 1] * 100)}–${Math.round(limites[i] * 100)}`} />
                ))}
                <span className="muted">Mais {palavra}</span>
                <span className="muted legenda-nota">quintis da pontuação · clique num município</span>
              </div>

              <div className="ranking">
                <div className="ranking-topo">
                  <h3>Ranking</h3>
                  <input type="search" placeholder="Procurar município…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Procurar município" />
                </div>
                <table className="tabela">
                  <thead>
                    <tr>
                      <th className="num">#</th>
                      <th>Município</th>
                      <th className="hide-sm">NUTS III</th>
                      <th className="num">Pontos</th>
                      <th>Resposta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiveis.map((m) => (
                      <tr key={m.id} className={m.id === sel ? "sel" : ""} onClick={() => setSel(m.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setSel(m.id)}>
                        <td className="num">{resultado.rank.get(m.id)}</td>
                        <td>{m.nome}</td>
                        <td className="hide-sm muted">{m.nuts3}</td>
                        <td className="num">{Math.round(resultado.score.get(m.id)! * 100)}</td>
                        <td>{respostaHabitacional(m).tipo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!q && (
                  <button type="button" className="link" onClick={() => setVerTodos(!verTodos)}>
                    {verTodos ? "Mostrar só os 12 primeiros" : `Ver os ${lista.length}`}
                  </button>
                )}
              </div>
            </section>

            {municipioSel ? (
              <Ficha
                m={municipioSel}
                atlas={atlas}
                series={series}
                publico={publico}
                resultado={resultado}
                todos={todos}
                cores={TEMA[modo]}
                onClose={() => setSel(null)}
              />
            ) : (
              <aside className="ficha ficha-vazia">
                <p className="muted">Clique num município no mapa ou no ranking para ver a ficha: indicadores, evolução e se a resposta é construir ou reabilitar.</p>
              </aside>
            )}
          </main>
        </>
      )}
    </div>
  );
}

import { useState } from "react";
import { fmtInt } from "./score";

export interface Serie {
  nome: string;
  cor: string;
  anos: number[];
  valores: (number | null)[];
}

/** Pequeno gráfico de linhas com cursor + tooltip. Um só eixo; ≥ 2 séries → legenda. */
export default function LineChart({ titulo, series, quebra }: { titulo: string; series: Serie[]; quebra?: number }) {
  const W = 300, H = 110, L = 40, R = 8, T = 8, B = 20;
  const anos = [...new Set(series.flatMap((s) => s.anos))].sort((a, b) => a - b);
  const vals = series.flatMap((s) => s.valores.filter((v): v is number => v != null));
  const [hi, setHi] = useState<number | null>(null);
  if (!anos.length || !vals.length) return null;
  let min = Math.min(0, ...vals), max = Math.max(...vals);
  if (max === min) max = min + 1;
  const x = (a: number) => L + ((a - anos[0]) / Math.max(1, anos[anos.length - 1] - anos[0])) * (W - L - R);
  const y = (v: number) => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const ticks = [min, (min + max) / 2, max];

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = anos[0];
    for (const a of anos) if (Math.abs(x(a) - px) < Math.abs(x(best) - px)) best = a;
    setHi(best);
  };

  return (
    <figure className="chart">
      <figcaption>
        <span>{titulo}</span>
        {series.length > 1 && (
          <span className="legend">
            {series.map((s) => (
              <span key={s.nome}>
                <i style={{ background: s.cor }} />
                {s.nome}
              </span>
            ))}
          </span>
        )}
      </figcaption>
      <div className="chart-box">
        <svg viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove} onPointerLeave={() => setHi(null)} role="img" aria-label={titulo}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" />
              <text x={L - 4} y={y(t) + 3} className="tick" textAnchor="end">
                {compact(t)}
              </text>
            </g>
          ))}
          {[anos[0], anos[anos.length - 1]].map((a) => (
            <text key={a} x={x(a)} y={H - 4} className="tick" textAnchor={a === anos[0] ? "start" : "end"}>
              {a}
            </text>
          ))}
          {quebra && quebra > anos[0] && (
            <g>
              <line x1={x(quebra) - 4} x2={x(quebra) - 4} y1={T} y2={H - B} className="quebra" />
              <text x={x(quebra) - 2} y={T + 8} className="tick">┴</text>
            </g>
          )}
          {series.map((s) => (
            <path
              key={s.nome}
              d={s.anos
                .map((a, i) => [a, s.valores[i]] as const)
                .filter(([, v]) => v != null)
                .map(([a, v], i) => `${i ? "L" : "M"}${x(a).toFixed(1)},${y(v!).toFixed(1)}`)
                .join("")}
              fill="none"
              stroke={s.cor}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {hi != null && (
            <g>
              <line x1={x(hi)} x2={x(hi)} y1={T} y2={H - B} className="cursor" />
              {series.map((s) => {
                const v = s.valores[s.anos.indexOf(hi)];
                return v == null ? null : <circle key={s.nome} cx={x(hi)} cy={y(v)} r={4} fill={s.cor} className="dot" />;
              })}
            </g>
          )}
        </svg>
        {hi != null && (
          <div className="chart-tip" style={{ left: `${(x(hi) / W) * 100}%` }}>
            <strong>{hi}</strong>
            {series.map((s) => {
              const v = s.valores[s.anos.indexOf(hi)];
              return (
                <div key={s.nome}>
                  {series.length > 1 && <i style={{ background: s.cor }} />}
                  {series.length > 1 ? `${s.nome}: ` : ""}
                  {v == null ? "—" : fmtInt(v)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </figure>
  );
}

function compact(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toFixed(1).replace(".", ",")} M`;
  if (a >= 1e4) return `${Math.round(v / 1e3)} mil`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(1).replace(".", ",")} mil`;
  return String(Math.round(v));
}

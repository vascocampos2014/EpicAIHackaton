import { useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type LngLatBoundsLike } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type Geo = GeoJSON.FeatureCollection<GeoJSON.Geometry, { id: string; area_km2: number; cx: number; cy: number }>;

export interface Destaque {
  id: string;
  papel: "melhor" | "alternativa" | "evitar";
}

const REGIOES: Record<string, LngLatBoundsLike> = {
  Continente: [[-9.6, 36.9], [-6.1, 42.2]],
  Açores: [[-31.4, 36.8], [-24.9, 39.8]],
  Madeira: [[-17.35, 32.35], [-16.2, 33.15]],
};

const ROTULO = { melhor: "Melhor opção", alternativa: "Alternativa", evitar: "A evitar" };
const ICONE = { melhor: "1", alternativa: "2", evitar: "✕" };

interface Props {
  geo: Geo;
  cores: Map<string, string>;
  destaques: Destaque[];
  selecionado: string | null;
  onSelect: (id: string) => void;
  tooltip: (id: string) => { titulo: string; linhas: string[] } | null;
  superficie: string;
  linha: string;
}

export default function MapView({ geo, cores, destaques, selecionado, onSelect, tooltip, superficie, linha }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const [pronto, setPronto] = useState(false);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [regiao, setRegiao] = useState("Continente");
  const cb = useRef({ onSelect, tooltip });
  cb.current = { onSelect, tooltip };

  // Criar o mapa uma vez. Sem mosaicos de fundo: só os polígonos dos municípios.
  useEffect(() => {
    const map = new maplibregl.Map({
      container: ref.current!,
      style: { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": superficie } }] },
      bounds: REGIOES.Continente,
      fitBoundsOptions: { padding: 16 },
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: "CAOP/DGT via GeoAPI.pt · PORDATA · INE" }));
    map.on("load", () => {
      map.addSource("mun", { type: "geojson", data: geo, promoteId: "id" });
      map.addLayer({ id: "fill", type: "fill", source: "mun", paint: { "fill-color": ["coalesce", ["get", "cor"], "#888"] } });
      map.addLayer({ id: "borda", type: "line", source: "mun", paint: { "line-color": superficie, "line-width": 0.6 } });
      map.addLayer({
        id: "hover", type: "line", source: "mun",
        paint: { "line-color": linha, "line-width": ["case", ["boolean", ["feature-state", "hover"], false], 1.5, 0] },
      });
      map.addLayer({ id: "sel", type: "line", source: "mun", filter: ["==", ["get", "id"], ""], paint: { "line-color": linha, "line-width": 2.5 } });
      setPronto(true);
    });
    let hoverId: string | null = null;
    map.on("mousemove", "fill", (e) => {
      const id = e.features?.[0]?.properties?.id as string | undefined;
      if (!id) return;
      if (hoverId !== id) {
        if (hoverId) map.setFeatureState({ source: "mun", id: hoverId }, { hover: false });
        map.setFeatureState({ source: "mun", id }, { hover: true });
        hoverId = id;
      }
      map.getCanvas().style.cursor = "pointer";
      setHover({ id, x: e.point.x, y: e.point.y });
    });
    map.on("mouseleave", "fill", () => {
      if (hoverId) map.setFeatureState({ source: "mun", id: hoverId }, { hover: false });
      hoverId = null;
      map.getCanvas().style.cursor = "";
      setHover(null);
    });
    map.on("click", "fill", (e) => {
      const id = e.features?.[0]?.properties?.id as string | undefined;
      if (id) cb.current.onSelect(id);
    });
    mapRef.current = map;
    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tema
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pronto) return;
    map.setPaintProperty("bg", "background-color", superficie);
    map.setPaintProperty("borda", "line-color", superficie);
    map.setPaintProperty("hover", "line-color", linha);
    map.setPaintProperty("sel", "line-color", linha);
  }, [superficie, linha, pronto]);

  // Cores do cenário
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pronto) return;
    const data = { ...geo, features: geo.features.map((f) => ({ ...f, properties: { ...f.properties, cor: cores.get(f.properties.id) } })) };
    (map.getSource("mun") as GeoJSONSource).setData(data);
  }, [geo, cores, pronto]);

  // Seleção
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pronto) return;
    map.setFilter("sel", ["==", ["get", "id"], selecionado ?? ""]);
  }, [selecionado, pronto]);

  // Marcadores dos destaques
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pronto) return;
    markers.current.forEach((m) => m.remove());
    const byId = new Map(geo.features.map((f) => [f.properties.id, f.properties]));
    markers.current = destaques.flatMap((d) => {
      const p = byId.get(d.id);
      if (!p) return [];
      const el = document.createElement("button");
      el.className = `pin pin-${d.papel}`;
      el.type = "button";
      el.textContent = ICONE[d.papel];
      el.title = ROTULO[d.papel];
      el.setAttribute("aria-label", ROTULO[d.papel]);
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        cb.current.onSelect(d.id);
      });
      return [new maplibregl.Marker({ element: el }).setLngLat([p.cx, p.cy]).addTo(map)];
    });
  }, [destaques, geo, pronto]);

  const irPara = (r: string) => {
    setRegiao(r);
    mapRef.current?.fitBounds(REGIOES[r], { padding: 16, duration: 600 });
  };

  const tt = hover ? cb.current.tooltip(hover.id) : null;
  return (
    <div className="map-wrap">
      <div ref={ref} className="map" role="img" aria-label="Mapa dos municípios colorido pela pontuação do cenário" />
      <div className="map-regioes" role="group" aria-label="Região do mapa">
        {Object.keys(REGIOES).map((r) => (
          <button key={r} type="button" className={r === regiao ? "on" : ""} onClick={() => irPara(r)}>
            {r}
          </button>
        ))}
      </div>
      {tt && hover && (
        <div className="tooltip" style={{ left: hover.x, top: hover.y }}>
          <strong>{tt.titulo}</strong>
          {tt.linhas.map((l) => (
            <div key={l}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}

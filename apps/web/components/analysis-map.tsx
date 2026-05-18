"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MLMap } from "maplibre-gl";

import type { AnalysisResult } from "@/lib/api";

const HYBRID_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    satellite: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Tiles © Esri",
      maxzoom: 19,
    },
    osm_labels: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap",
      maxzoom: 19,
    },
  },
  layers: [
    { id: "satellite", type: "raster", source: "satellite" },
    { id: "osm_labels", type: "raster", source: "osm_labels", paint: { "raster-opacity": 0.3 } },
  ],
};

export function AnalysisMap({ analysis }: { analysis: AnalysisResult }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [showFlood, setShowFlood] = useState(true);
  const [showUrban, setShowUrban] = useState(true);
  const [showRadar, setShowRadar] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const center = analysis.center ?? [-76.69, -11.93];
    const zoom = analysis.zoom ?? 13;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: HYBRID_STYLE,
      center,
      zoom,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({}), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      const t = analysis.tile_urls;

      // Radar post-evento (opcional, debugging tecnico)
      map.addSource("s1-post", { type: "raster", tiles: [t.post], tileSize: 256 });
      map.addLayer({
        id: "s1-post", type: "raster", source: "s1-post",
        paint: { "raster-opacity": 0.55 },
        layout: { visibility: "none" },
      });

      // Inundacion detectada (cyan) — la capa principal
      map.addSource("flood", { type: "raster", tiles: [t.inundacion], tileSize: 256 });
      map.addLayer({
        id: "flood", type: "raster", source: "flood",
        paint: { "raster-opacity": 0.85 },
      });

      // Inundacion sobre area urbana (magenta) — lo critico
      map.addSource("urban-flood", { type: "raster", tiles: [t.inund_urbano], tileSize: 256 });
      map.addLayer({
        id: "urban-flood", type: "raster", source: "urban-flood",
        paint: { "raster-opacity": 0.95 },
      });

      setReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setLayoutProperty("flood", "visibility", showFlood ? "visible" : "none");
  }, [showFlood, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setLayoutProperty("urban-flood", "visibility", showUrban ? "visible" : "none");
  }, [showUrban, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setLayoutProperty("s1-post", "visibility", showRadar ? "visible" : "none");
  }, [showRadar, ready]);

  return (
    <div
      style={{ position: "relative", height: 620, width: "100%" }}
      className="rounded-lg overflow-hidden border border-white/10"
    >
      <div
        ref={containerRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />

      <div
        style={{ position: "absolute", top: 12, left: 12, zIndex: 10 }}
        className="rounded-lg border border-white/10 bg-black/75 backdrop-blur w-[300px] p-3 space-y-3"
      >
        <div className="text-xs font-semibold text-white/80">Detección por radar Sentinel-1</div>

        <div className="space-y-2">
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={showFlood} onChange={(e) => setShowFlood(e.target.checked)} className="w-3.5 h-3.5 mt-0.5 accent-cyan-400" />
            <div className="flex-1">
              <div className="text-xs text-white flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#00ffff" }} />
                💧 Agua donde antes había tierra
              </div>
              <div className="text-[10px] text-white/40">Toda la zona que se inundó por el evento</div>
            </div>
          </label>

          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={showUrban} onChange={(e) => setShowUrban(e.target.checked)} className="w-3.5 h-3.5 mt-0.5 accent-pink-500" />
            <div className="flex-1">
              <div className="text-xs text-white flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#ff00ff" }} />
                🚨 Inundación sobre área urbana
              </div>
              <div className="text-[10px] text-white/40">Las viviendas y calles que quedaron bajo agua</div>
            </div>
          </label>
        </div>

        <details className="pt-2 border-t border-white/10">
          <summary className="cursor-pointer text-[10px] text-white/50 hover:text-white/70">
            🛰️ Ver imagen del radar (avanzado)
          </summary>
          <div className="mt-2 space-y-1">
            <label className="flex items-center gap-2 cursor-pointer text-[11px] text-white/70">
              <input type="checkbox" checked={showRadar} onChange={(e) => setShowRadar(e.target.checked)} className="w-3.5 h-3.5 accent-gray-400" />
              Mostrar radar Sentinel-1 (post-evento)
            </label>
            <p className="text-[10px] text-white/40 leading-tight">
              Imagen en escala de grises del radar VH. Las zonas oscuras son superficies lisas (agua); las claras son rugosas (urbano, vegetación).
            </p>
          </div>
        </details>

        <div className="pt-2 border-t border-white/10 text-[10px] text-white/50 leading-relaxed">
          Detección entre <strong>{analysis.pre_dates[0]}</strong> (antes) y{" "}
          <strong>{analysis.post_dates[1]}</strong> (después). Píxeles donde el radar
          detectó que cambió de tierra a agua.
        </div>
      </div>
    </div>
  );
}

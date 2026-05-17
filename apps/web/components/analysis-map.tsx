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

type Mode = "post" | "pre" | "diff";

export function AnalysisMap({ analysis }: { analysis: AnalysisResult }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>("post");
  const [showFlood, setShowFlood] = useState(true);
  const [showUrban, setShowUrban] = useState(true);

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

      map.addSource("s1-pre", { type: "raster", tiles: [t.pre], tileSize: 256 });
      map.addLayer({
        id: "s1-pre", type: "raster", source: "s1-pre",
        paint: { "raster-opacity": 0.6 },
        layout: { visibility: "none" },
      });

      map.addSource("s1-post", { type: "raster", tiles: [t.post], tileSize: 256 });
      map.addLayer({
        id: "s1-post", type: "raster", source: "s1-post",
        paint: { "raster-opacity": 0.6 },
        layout: { visibility: "visible" },
      });

      map.addSource("flood", { type: "raster", tiles: [t.inundacion], tileSize: 256 });
      map.addLayer({
        id: "flood", type: "raster", source: "flood",
        paint: { "raster-opacity": 0.8 },
      });

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
    map.setLayoutProperty("s1-pre", "visibility", mode === "pre" ? "visible" : "none");
    map.setLayoutProperty("s1-post", "visibility", mode === "post" ? "visible" : "none");
  }, [mode, ready]);

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
        className="rounded-lg border border-white/10 bg-black/75 backdrop-blur w-[280px] p-3 space-y-3"
      >
        <div className="text-xs font-semibold text-white/80">Radar Sentinel-1 VH</div>

        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-white/40">Imagen base</div>
          <div className="flex gap-1 rounded-md bg-white/5 p-0.5">
            <ModeBtn active={mode === "pre"} onClick={() => setMode("pre")} label="Antes" />
            <ModeBtn active={mode === "post"} onClick={() => setMode("post")} label="Después" />
          </div>
          <div className="text-[10px] text-white/50">
            {mode === "pre" ? `Pre: ${analysis.pre_dates[0]} → ${analysis.pre_dates[1]}` : `Post: ${analysis.post_dates[0]} → ${analysis.post_dates[1]}`}
          </div>
        </div>

        <div className="space-y-1 pt-2 border-t border-white/10">
          <div className="text-[10px] uppercase tracking-wider text-white/40">Detección</div>
          <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer">
            <input type="checkbox" checked={showFlood} onChange={(e) => setShowFlood(e.target.checked)} className="w-3.5 h-3.5 accent-cyan-400" />
            <span style={{ color: "#22d3ee" }}>💧</span> Inundación detectada
          </label>
          <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer">
            <input type="checkbox" checked={showUrban} onChange={(e) => setShowUrban(e.target.checked)} className="w-3.5 h-3.5 accent-pink-500" />
            <span style={{ color: "#ec4899" }}>🚨</span> Inundación sobre área urbana
          </label>
        </div>

        <div className="pt-2 border-t border-white/10 text-[10px] text-white/50 leading-relaxed">
          Cyan: píxeles que pasaron de tierra a agua (VH &lt; −17 dB, Δ &gt; 3 dB).
          Magenta: intersección con manchas urbanas GHSL.
        </div>
      </div>
    </div>
  );
}

function ModeBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 text-xs py-1.5 rounded transition-colors ${
        active ? "bg-blue-500/80 text-white font-semibold" : "text-white/60 hover:bg-white/5"
      }`}
    >
      {label}
    </button>
  );
}

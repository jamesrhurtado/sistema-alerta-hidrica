"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as MLMap } from "maplibre-gl";

import type { TileLayer } from "@/lib/api";
import { LayerControl } from "./layer-control";
import { LayerLegend } from "./layer-legend";

type Props = {
  center: [number, number];
  zoom?: number;
  markers?: { lon: number; lat: number; label?: string; color?: string }[];
  aoiGeoJson?: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  layers?: Record<string, TileLayer>;
  totalYears?: number;
  yearUrbStart?: number;
  yearUrbEnd?: number;
  height?: number | string;
};

// Estilo base híbrido (satélite + nombres). MapTiler basemaps libres serían
// más bonitos pero requieren API key. Usamos Esri World Imagery (uso académico
// permitido) + OSM nombres encima para replicar el look del Code Editor.
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

// Orden de pintado: las capas que aparecen primero en el array quedan ABAJO.
const LAYER_ORDER = [
  "agua_freq",
  "urbano_temporal",
  "ivc",
  "riesgo_antiguo",
  "riesgo_nuevo",
];

export function RiskMap({
  center,
  zoom = 12,
  markers = [],
  aoiGeoJson,
  layers = {},
  totalYears = 38,
  yearUrbStart = 1990,
  yearUrbEnd = 2020,
  height = 600,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);

  const initialVisible: Record<string, boolean> = {};
  for (const [id, l] of Object.entries(layers)) initialVisible[id] = l.default_visible;
  const [visible, setVisible] = useState<Record<string, boolean>>(initialVisible);

  // ── Init map (una sola vez) ──
  useEffect(() => {
    if (!containerRef.current) return;

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
      // AOI polygon
      if (aoiGeoJson) {
        map.addSource("aoi", {
          type: "geojson",
          data: { type: "Feature", geometry: aoiGeoJson, properties: {} } as GeoJSON.Feature,
        });
        map.addLayer({
          id: "aoi-line",
          type: "line",
          source: "aoi",
          paint: { "line-color": "#fde047", "line-width": 1.5, "line-dasharray": [2, 2] },
        });
      }

      // GEE raster layers (en orden)
      for (const id of LAYER_ORDER) {
        const layer = layers[id];
        if (!layer) continue;
        map.addSource(`gee-${id}`, {
          type: "raster",
          tiles: [layer.tile_url],
          tileSize: 256,
          maxzoom: 18,
        });
        map.addLayer({
          id: `gee-${id}-layer`,
          type: "raster",
          source: `gee-${id}`,
          paint: { "raster-opacity": layer.opacity },
          layout: { visibility: layer.default_visible ? "visible" : "none" },
        });
      }

      // Markers
      for (const m of markers) {
        const el = document.createElement("div");
        el.style.width = "14px";
        el.style.height = "14px";
        el.style.borderRadius = "50%";
        el.style.background = m.color ?? "#fde047";
        el.style.border = "2px solid white";
        el.style.boxShadow = "0 0 0 2px rgba(0,0,0,0.4)";
        el.style.cursor = "pointer";
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([m.lon, m.lat])
          .addTo(map);
        if (m.label) {
          marker.setPopup(new maplibregl.Popup({ offset: 12 }).setText(m.label));
        }
      }

      setReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Toggle visibility ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const [id, vis] of Object.entries(visible)) {
      const layerId = `gee-${id}-layer`;
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", vis ? "visible" : "none");
      }
    }
  }, [visible, ready]);

  function toggle(id: string) {
    setVisible((v) => ({ ...v, [id]: !v[id] }));
  }

  return (
    <div
      style={{ position: "relative", height, width: "100%" }}
      className="rounded-lg overflow-hidden border border-white/10"
    >
      <div
        ref={containerRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
      <div style={{ position: "absolute", top: 12, left: 12, zIndex: 10 }}>
        <LayerControl layers={layers} visible={visible} onToggle={toggle} />
      </div>
      <div style={{ position: "absolute", bottom: 12, right: 12, zIndex: 10 }}>
        <LayerLegend
          layers={layers}
          visible={visible}
          totalYears={totalYears}
          yearUrbStart={yearUrbStart}
          yearUrbEnd={yearUrbEnd}
        />
      </div>
    </div>
  );
}

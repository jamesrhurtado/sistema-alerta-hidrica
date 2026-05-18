"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

const POINTS = [
  { lat: -11.93, lng: -76.7,  label: "Chosica" },
  { lat: -5.27,  lng: -80.68, label: "Piura" },
  { lat: -11.9,  lng: -77.05, label: "Chillón" },
  { lat:  1.15,  lng: -76.65, label: "Mocoa" },
  { lat: -22.51, lng: -43.18, label: "Petrópolis" },
  { lat: -33.45, lng: -70.66, label: "Santiago" },
];

const LATAM_VIEW = { lat: -12, lng: -75, altitude: 1.8 };

export function EarthGlobe({ size = 420 }: { size?: number }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef = useRef<any>(null);

  // Se ejecuta cuando three.js terminó de inicializar el globo
  function handleGlobeReady() {
    if (!globeRef.current) return;
    // 1. Apuntar a LATAM ANTES de empezar a rotar
    globeRef.current.pointOfView?.(LATAM_VIEW, 0);
    // 2. Configurar controls
    const ctrl = globeRef.current.controls?.();
    if (ctrl) {
      ctrl.autoRotate = true;
      ctrl.autoRotateSpeed = 0.25;    // muy lento, 250s por vuelta
      ctrl.enableZoom = false;
      ctrl.enablePan = false;
      ctrl.enableDamping = true;
    }
  }

  return (
    <div style={{ width: size, height: size }} className="relative">
      <Globe
        ref={globeRef}
        width={size}
        height={size}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        atmosphereColor="#67E8F9"
        atmosphereAltitude={0.25}
        pointsData={POINTS}
        pointLat="lat"
        pointLng="lng"
        pointColor={() => "#67E8F9"}
        pointAltitude={0.045}
        pointRadius={0.5}
        pointResolution={12}
        showAtmosphere={true}
        showGlobe={true}
        onGlobeReady={handleGlobeReady}
      />
    </div>
  );
}

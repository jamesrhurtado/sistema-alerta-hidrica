import { Info } from "lucide-react";

export function IvcExplainer() {
  return (
    <details className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 group">
      <summary className="cursor-pointer text-sm font-semibold text-blue-200 flex items-center gap-2 list-none">
        <Info className="w-4 h-4" />
        ¿Qué es el IVC y cómo se calcula?
        <span className="ml-auto text-blue-300/60 text-xs group-open:rotate-180 transition-transform">▼</span>
      </summary>
      <div className="mt-3 text-sm text-blue-100/90 space-y-3 leading-relaxed">
        <p>
          El <strong>Índice de Vulnerabilidad Compuesto (IVC)</strong> es un valor de
          <strong> 0 a 100</strong> que asigna a cada bloque de 30×30 metros del territorio.
          Cuanto más alto, más riesgo de inundación o huaico.
        </p>
        <div>
          <p className="text-blue-200 font-semibold mb-1">Combina 5 factores satelitales:</p>
          <ul className="space-y-1 pl-4 text-xs">
            <li><b className="text-blue-300">30%</b> Agua histórica — cuántos años hubo agua ahí entre 1984 y 2021 (JRC)</li>
            <li><b className="text-blue-300">20%</b> Pendiente del terreno — terrenos planos pesan más (SRTM)</li>
            <li><b className="text-blue-300">20%</b> Cercanía a ríos o quebradas con historial (HydroSHEDS)</li>
            <li><b className="text-blue-300">15%</b> Superficie construida — exposición física (GHSL)</li>
            <li><b className="text-blue-300">15%</b> Densidad poblacional — exposición humana (GHSL Pop)</li>
          </ul>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-block w-3 h-3 rounded-sm bg-green-500" />
          <span>0–40 bajo</span>
          <span className="inline-block w-3 h-3 rounded-sm bg-yellow-400 ml-2" />
          <span>40–60 medio</span>
          <span className="inline-block w-3 h-3 rounded-sm bg-orange-500 ml-2" />
          <span>60–75 alto</span>
          <span className="inline-block w-3 h-3 rounded-sm bg-red-700 ml-2" />
          <span>75–100 extremo</span>
        </div>
        <p className="text-xs text-blue-200/70 italic">
          Umbral operativo de "<strong>riesgo alto</strong>": IVC &gt; 60. Es el corte usado
          para contar población en peligro y para disparar alertas automáticas.
        </p>
      </div>
    </details>
  );
}

"use client";

import { useState } from "react";
import { Loader2, Send, Zap } from "lucide-react";

import { testTelegram, fireTestAlert } from "@/app/actions/telegram";
import { cn } from "@/lib/utils";

type Props = { municipalityId: string; canFire: boolean };

export function TelegramActionButtons({ municipalityId, canFire }: Props) {
  const [loadingTest, setLoadingTest] = useState(false);
  const [loadingAlert, setLoadingAlert] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function onTest() {
    setLoadingTest(true);
    setResult(null);
    try {
      const r = await testTelegram(municipalityId);
      setResult(r.ok ? "✅ Mensaje de prueba enviado al canal" : `❌ ${r.error ?? "error desconocido"}`);
    } catch (err) {
      setResult(`❌ ${(err as Error).message}`);
    } finally {
      setLoadingTest(false);
    }
  }

  async function onAlert() {
    setLoadingAlert(true);
    setResult(null);
    try {
      const r = await fireTestAlert(municipalityId);
      setResult(r.status === "success" ? "🚨 Alerta simulada enviada por todos los canales" : `❌ ${r.error ?? "fallo"}`);
    } catch (err) {
      setResult(`❌ ${(err as Error).message}`);
    } finally {
      setLoadingAlert(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onTest}
          disabled={loadingTest || !canFire}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white",
            "hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed",
          )}
        >
          {loadingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Enviar mensaje de prueba
        </button>
        <button
          onClick={onAlert}
          disabled={loadingAlert || !canFire}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white",
            "hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed",
          )}
        >
          {loadingAlert ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Simular alerta extrema (Rímac 2017)
        </button>
      </div>
      {result && (
        <div className={cn("text-sm font-mono p-2 rounded-md border", result.startsWith("✅") || result.startsWith("🚨") ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300" : "border-red-500/30 bg-red-500/5 text-red-300")}>
          {result}
        </div>
      )}
    </div>
  );
}

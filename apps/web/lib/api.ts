/**
 * Cliente del backend AHORA. En servidor usa API_URL directo, en cliente usa
 * el rewrite /api/* configurado en next.config.ts.
 */

const SERVER_BASE = process.env.API_URL ?? "http://localhost:8000";
const isServer = typeof window === "undefined";

function url(path: string): string {
  if (isServer) return `${SERVER_BASE}${path}`;
  return `/api${path}`;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url(path), {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    cache: init.cache ?? "no-store",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`API ${path} → ${res.status}: ${txt}`);
  }
  return res.json() as Promise<T>;
}

export type Cuenca = {
  id: string;
  nombre: string;
  foco: string | null;
  lon: number;
  lat: number;
  zoom: number;
  aoi_geojson?: string;
};

export type IvcSummary = {
  cuenca_id: string;
  params: Record<string, number>;
  ivc_mean: number | null;
  ivc_max: number | null;
  pop_high_risk: number | null;
  area_urb_inund_ha: number | null;
  tile_url: string | null;
  geotiff_url: string | null;
  status: string;
  error: string | null;
  mock: boolean;
};

export type AlertEvent = {
  id: string;
  cuenca_id: string;
  severity: "low" | "medium" | "high" | "extreme";
  message: string;
  pop_estimated: number | null;
  rain_mm_24h: number | null;
  ivc_max: number | null;
  created_at: string;
};

export type ReplayEvent = {
  id: string;
  cuenca_id: string;
  fecha: string;
  mm_24h_mean: number;
  mm_24h_max: number;
  descripcion: string;
};

export type CaseStudy = {
  id: string;
  nombre: string;
  lon: number;
  lat: number;
  zoom: number;
  descripcion: string | null;
};

export type TileLayer = {
  id: string;
  label: string;
  tile_url: string;
  palette: string[];
  min: number | null;
  max: number | null;
  opacity: number;
  default_visible: boolean;
};

export type LayerStack = {
  cuenca_id: string;
  cuenca_nombre: string;
  cuenca_foco: string | null;
  center: [number, number];
  zoom: number;
  params: Record<string, number>;
  layers: Record<string, TileLayer>;
  stats: {
    area_urb_total_ha: number;
    area_urb_expansion_ha: number;
    area_urb_inund_ha: number;
    area_urb_inund_antiguo_ha: number;
    pop_high_risk: number;
    pop_total_expuesta: number;
    ivc_mean: number;
    ivc_max: number;
    pct_expansion_inund: number;
  };
  year_urb_start: number;
  year_urb_end: number;
  total_years: number;
  mock: boolean;
};

export type AnalysisEventMeta = {
  id: string;
  cuenca_id: string;
  label: string;
  pre_dates: [string, string];
  post_dates: [string, string];
  alert_lead_hours: number;
  damage_summary: string;
};

export type AnalysisResult = {
  event_id: string;
  label: string;
  cuenca_id: string;
  cuenca_nombre?: string;
  cuenca_foco?: string;
  center?: [number, number];
  zoom?: number;
  pre_dates: [string, string];
  post_dates: [string, string];
  tile_urls: {
    pre: string;
    post: string;
    inundacion: string;
    inund_urbano: string;
  };
  stats: {
    ha_inundadas: number;
    ha_urbano_inundado: number;
    pop_afectada: number;
  };
  alert_lead_hours: number;
  damage_summary: string;
  mock: boolean;
};

export type Municipality = {
  id: string;
  nombre: string;
  parent_id: string | null;
  nivel: "regional" | "provincial" | "distrital";
  domain_hint: string | null;
  whatsapp_kapso_url: string | null;
  teams_webhook_url: string | null;
  telegram_chat_id?: string | null;
  telegram_username?: string | null;
  n_cuencas?: number;
  cuencas?: Cuenca[];
  suscriptores_por_canal?: Record<string, number>;
};

export type TelegramStatus = {
  configured: boolean;
  reachable?: boolean;
  bot_username?: string;
  bot_name?: string;
  bot_id?: number;
};

export type ForecastResult = {
  cuenca_id: string;
  cuenca_nombre: string;
  cuenca_foco: string | null;
  p95_threshold_mm: number;
  forecast_48h: {
    mm_24h_mean: number;
    mm_24h_max: number;
    horizon_hours: number;
  };
  severity_predicted: "low" | "medium" | "high" | "extreme";
  trigger_active: boolean;
  ratio_over_threshold: number;
  chirps_recent_days: { fecha: string; mm_24h_mean: number; mm_24h_max: number }[];
  as_of: string;
};

export type AnalyzeResult = {
  ok: boolean;
  run_id: string;
  trigger_active: boolean;
  forecast_mm_24h_max: number | null;
  p95_threshold: number | null;
  alert_created: boolean;
  severity: string | null;
  telegram_channels_notified: number;
  telegram_results: { ok: boolean; municipality_id?: string; chat_id?: string; error?: string }[];
  error?: string;
};

export type TelegramChat = {
  chat_id: string;
  type: string | null;
  title: string | null;
  username: string | null;
  first_name: string | null;
};

export const api = {
  cuencas: () => request<Cuenca[]>("/cuencas"),
  cuenca: (id: string) => request<Cuenca>(`/cuencas/${id}`),
  caseStudies: (cuencaId: string) =>
    request<CaseStudy[]>(`/cuencas/${cuencaId}/case-studies`),
  ivc: (cuencaId: string) => request<IvcSummary>(`/ivc/${cuencaId}`),
  layers: (cuencaId: string) => request<LayerStack>(`/layers/${cuencaId}`),
  municipalities: () => request<Municipality[]>("/municipalities"),
  municipality: (id: string) => request<Municipality>(`/municipalities/${id}`),
  updateMunicipalityConfig: (
    municipalityId: string,
    body: { whatsapp_kapso_url?: string | null; teams_webhook_url?: string | null },
  ) =>
    request<{
      municipality_id: string;
      whatsapp_kapso_url: string | null;
      teams_webhook_url: string | null;
    }>(`/config/municipality/${municipalityId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  analysisEvents: () => request<AnalysisEventMeta[]>("/analysis/events"),
  analysis: (eventId: string) => request<AnalysisResult>(`/analysis/events/${eventId}`),
  systemConfig: () =>
    request<{
      telegram_configured: boolean;
      kapso_configured: boolean;
      monitor_interval_minutes: number;
      gee_mock_mode: boolean;
      telegram_bot?: { username: string; name: string };
    }>("/config/system"),
  schedulerStatus: () =>
    request<{
      interval_minutes: number;
      enabled: boolean;
      ran_at: string | null;
      next_at: string | null;
      cuencas_scanned: number;
      alerts_triggered: number;
    }>("/scheduler"),
  telegramStatus: () => request<TelegramStatus>("/telegram/status"),
  telegramRecentChats: () => request<{ configured: boolean; chats: TelegramChat[] }>("/telegram/recent-chats"),
  setTelegramChannel: (municipalityId: string, body: { telegram_chat_id?: string; telegram_username?: string; telegram_bot_token?: string }) =>
    request<{ municipality_id: string; telegram_chat_id: string | null; telegram_username: string | null; telegram_has_custom_token: boolean }>(
      `/telegram/municipality/${municipalityId}`,
      { method: "PATCH", body: JSON.stringify(body) },
    ),
  forecast: (cuencaId: string) =>
    request<ForecastResult>(`/forecast/${cuencaId}`),
  analyzeNow: (cuencaId: string) =>
    request<AnalyzeResult>(`/forecast/${cuencaId}/analyze-now`, { method: "POST" }),
  testTelegram: (municipalityId: string) =>
    request<{ ok: boolean; chat_id: string; error?: string; message_id?: number }>(
      `/telegram/municipality/${municipalityId}/test`,
      { method: "POST" },
    ),
  fireTestAlert: (municipalityId: string) =>
    request<{ status: string; error?: string; context?: unknown }>(
      `/config/test-alert/${municipalityId}`,
      { method: "POST" },
    ),
  alerts: (cuencaId?: string) =>
    request<AlertEvent[]>(
      `/alerts${cuencaId ? `?cuenca_id=${cuencaId}` : ""}`,
    ),
  replayEvents: () => request<ReplayEvent[]>("/replay/events"),
  triggerReplay: (event: string) =>
    request<{ status: string; run_id: string; context?: unknown; error?: string }>(
      "/replay",
      { method: "POST", body: JSON.stringify({ event }) },
    ),
  triggerMonitor: (cuencaId: string) =>
    request<{ status: string; run_id: string; context?: unknown; error?: string }>(
      `/replay/monitor?cuenca_id=${cuencaId}`,
      { method: "POST" },
    ),
};

import { useState } from "react";
import { Cloud, Droplets, Wind, MapPin, Navigation, ChevronDown, ChevronUp } from "lucide-react";
import type { Forecast, Coords } from "@/lib/weather";
import { weatherCodeInfo } from "@/lib/weather";
import { cn } from "@/lib/utils";

interface Props {
  forecast: Forecast | null;
  coords: Coords | null;
  loading?: boolean;
  compact?: boolean;
  error?: string | null;
  needsPermission?: boolean;
  onRequestLocation?: () => void;
}

const fmtHour = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric" });

const fmtHourLabel = (iso: string, idx: number, prevIso?: string) => {
  const d = new Date(iso);
  const prev = prevIso ? new Date(prevIso) : null;
  const newDay = !prev || d.getDate() !== prev.getDate();
  if (idx === 0 || newDay) {
    return d.toLocaleDateString([], { weekday: "short" }) + " " + d.toLocaleTimeString([], { hour: "numeric" });
  }
  return d.toLocaleTimeString([], { hour: "numeric" });
};

const compass = (deg: number) => {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
};

const fmtDay = (date: string, idx: number) => {
  if (idx === 0) return "Today";
  // Parse YYYY-MM-DD as local date to avoid UTC->local day shift
  const [y, m, d] = date.split("-").map(Number);
  const local = new Date(y, (m ?? 1) - 1, d ?? 1);
  return local.toLocaleDateString([], { weekday: "short" });
};

export const WeatherCard = ({ forecast, coords, loading, compact, error, needsPermission, onRequestLocation }: Props) => {
  const [expanded, setExpanded] = useState(false);
  if (loading || !forecast) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4 space-y-2">
        <p className="text-xs text-muted-foreground">{error ?? "Loading weather…"}</p>
        {needsPermission && onRequestLocation && (
          <button
            type="button"
            onClick={onRequestLocation}
            className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary hover:bg-primary/25"
          >
            <Navigation className="h-3 w-3" /> Use my location
          </button>
        )}
      </div>
    );
  }

  const { current, hourly, daily } = forecast;
  const info = weatherCodeInfo(current.code);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-gradient-tile shadow-tile">
      {/* Current */}
      <div className="flex items-center justify-between p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{coords?.label ?? "Local"}</span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-4xl tracking-tight text-foreground">{current.tempF}°</span>
            <span className="text-sm text-muted-foreground">{info.label}</span>
          </div>
          <p className="text-xs text-muted-foreground">Feels {current.apparentTempF}°</p>
          {error && <p className="mt-2 text-xs text-muted-foreground">{error}</p>}
          {needsPermission && onRequestLocation && (
            <button
              type="button"
              onClick={onRequestLocation}
              className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary hover:bg-primary/25"
            >
              <Navigation className="h-3 w-3" /> Use my location
            </button>
          )}
        </div>
        <div className="text-5xl leading-none">{info.emoji}</div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2 px-4 pb-3 text-xs">
        <Stat icon={<Droplets className="h-3.5 w-3.5" />} label="Precip" value={`${current.precipProb}%`} />
        <Stat icon={<Wind className="h-3.5 w-3.5" />} label="Wind" value={`${current.windMph} mph`} />
        <Stat icon={<Cloud className="h-3.5 w-3.5" />} label="High" value={`${daily[0]?.highF ?? "—"}°`} />
      </div>

      {/* Hourly */}
      <div className="border-t border-border/60 px-2 py-3">
        <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Hourly · next {compact ? 12 : hourly.length}h
        </p>
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
          {hourly.slice(0, compact ? 12 : 48).map((h, idx, arr) => {
            const i = weatherCodeInfo(h.code);
            const hasPrecip = h.precipIn > 0;
            const d = new Date(h.time);
            const prev = idx > 0 ? new Date(arr[idx - 1].time) : null;
            const isNewDay = !prev || d.getDate() !== prev.getDate();
            const dayLabel = d.toLocaleDateString([], { weekday: "short" });
            const hourLabel = d.toLocaleTimeString([], { hour: "numeric" });
            return (
              <div key={h.time} className={cn(
                "flex min-w-[68px] flex-col items-center gap-1 rounded-lg bg-surface/40 px-1.5 py-2",
                isNewDay && idx > 0 && "border-l-2 border-primary/40 ml-1",
              )}>
                <span className={cn(
                  "text-[9px] font-bold uppercase tracking-wider whitespace-nowrap",
                  isNewDay ? "text-primary" : "text-muted-foreground/70",
                )}>{dayLabel}</span>
                <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">{hourLabel}</span>
                <span className="text-base">{i.emoji}</span>
                <span className="text-xs font-semibold text-foreground">{h.tempF}°</span>
                <span className="text-[9px] text-muted-foreground">feels {h.apparentTempF}°</span>
                <span className={cn("text-[10px]", h.precipProb >= 30 ? "text-primary font-semibold" : "text-muted-foreground")}>
                  {h.precipProb}%
                </span>
                <span className={cn("text-[10px] tabular-nums whitespace-nowrap", hasPrecip ? "text-primary font-semibold" : "text-muted-foreground/40")}>
                  {hasPrecip ? `🌧 ${h.precipIn.toFixed(2)}"` : "— in"}
                </span>
                <span className="text-[9px] text-muted-foreground tabular-nums whitespace-nowrap">
                  {h.windMph} {compass(h.windDir)}
                </span>
                <span className="text-[9px] text-muted-foreground tabular-nums">💧 {h.humidity}%</span>
                <span className="text-[9px] text-muted-foreground tabular-nums">☁ {h.cloudCover}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily forecast (collapsible) */}
      <div className="border-t border-border/60 px-4 py-3">
        <p className="pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {expanded ? `${daily.length}-day forecast` : "Next 2 days"}
        </p>
        <div className="space-y-1.5">
          {(expanded ? daily : daily.slice(0, 2)).map((d, i) => {
            const info = weatherCodeInfo(d.code);
            return (
              <div key={d.date} className="flex items-center gap-3 text-sm">
                <span className="w-12 text-muted-foreground">{fmtDay(d.date, i)}</span>
                <span className="text-lg">{info.emoji}</span>
                <span className="w-12 text-xs text-primary font-medium">{d.precipProb}%</span>
                <span className="w-14 text-xs text-muted-foreground">{d.precipIn.toFixed(2)}"</span>
                <div className="ml-auto flex items-center gap-2 tabular-nums">
                  <span className="text-muted-foreground">{d.lowF}°</span>
                  <span className="font-semibold text-foreground">{d.highF}°</span>
                </div>
              </div>
            );
          })}
        </div>
        {daily.length > 2 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-border/60 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:bg-surface/60 hover:text-foreground"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3" /> Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" /> Show {daily.length - 2} more days
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

const Stat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-center gap-1.5 rounded-lg bg-surface/60 px-2 py-1.5">
    <span className="text-muted-foreground">{icon}</span>
    <div className="min-w-0">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xs font-semibold text-foreground">{value}</p>
    </div>
  </div>
);

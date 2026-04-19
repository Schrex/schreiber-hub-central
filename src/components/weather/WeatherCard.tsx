import { Cloud, Droplets, Wind, MapPin } from "lucide-react";
import type { Forecast, Coords } from "@/lib/weather";
import { weatherCodeInfo } from "@/lib/weather";
import { cn } from "@/lib/utils";

interface Props {
  forecast: Forecast | null;
  coords: Coords | null;
  loading?: boolean;
  compact?: boolean;
}

const fmtHour = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric" });

const fmtDay = (date: string, idx: number) => {
  if (idx === 0) return "Today";
  return new Date(date).toLocaleDateString([], { weekday: "short" });
};

export const WeatherCard = ({ forecast, coords, loading, compact }: Props) => {
  if (loading || !forecast) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-xs text-muted-foreground">Loading weather…</p>
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
          Hourly · next {hourly.length}h
        </p>
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
          {hourly.slice(0, compact ? 12 : 24).map((h) => {
            const i = weatherCodeInfo(h.code);
            return (
              <div key={h.time} className="flex min-w-12 flex-col items-center gap-1 rounded-lg px-1 py-2">
                <span className="text-[10px] text-muted-foreground">{fmtHour(h.time)}</span>
                <span className="text-base">{i.emoji}</span>
                <span className="text-xs font-semibold text-foreground">{h.tempF}°</span>
                <span className={cn("text-[10px]", h.precipProb >= 30 ? "text-primary font-semibold" : "text-muted-foreground")}>
                  {h.precipProb}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 7-day */}
      <div className="border-t border-border/60 px-4 py-3">
        <p className="pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          7-day forecast
        </p>
        <div className="space-y-1.5">
          {daily.map((d, i) => {
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

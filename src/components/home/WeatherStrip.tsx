import { Cloud, Wind, Droplets } from "lucide-react";

export const WeatherStrip = () => (
  <div className="relative overflow-hidden rounded-2xl border border-border bg-surface px-4 py-3 shadow-tile">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
          <Cloud className="h-6 w-6" strokeWidth={2.5} />
        </div>
        <div>
          <p className="font-display text-2xl leading-none">64°F</p>
          <p className="mt-1 text-xs text-muted-foreground">Partly cloudy · Eau Claire, WI</p>
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><Wind className="h-3.5 w-3.5" />8 mph</span>
        <span className="flex items-center gap-1.5"><Droplets className="h-3.5 w-3.5" />20%</span>
      </div>
    </div>
  </div>
);

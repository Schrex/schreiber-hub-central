import { useEffect, useState } from "react";
import { Car, Loader2 } from "lucide-react";

// Shop origin: 5992 Ontario Center Rd, Ontario, NY
const SHOP = { lat: 43.23501, lon: -77.29305 };
const SHOP_LABEL = "5992 Ontario Center Rd, Ontario, NY";

interface Props {
  lat: number | null;
  lon: number | null;
}

const formatDuration = (seconds: number) => {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
};

const formatMiles = (meters: number) => {
  const miles = meters / 1609.344;
  return `${miles.toFixed(miles < 10 ? 1 : 0)} mi`;
};

export const DriveTimeFromShop = ({ lat, lon }: Props) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ duration: number; distance: number } | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    let cancelled = false;
    setLoading(true);
    setErr(false);
    const url = `https://router.project-osrm.org/route/v1/driving/${SHOP.lon},${SHOP.lat};${lon},${lat}?overview=false&alternatives=false&steps=false`;
    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const route = j?.routes?.[0];
        if (!route) { setErr(true); return; }
        setData({ duration: route.duration, distance: route.distance });
      })
      .catch(() => { if (!cancelled) setErr(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [lat, lon]);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
        <Car className="h-3.5 w-3.5" /> Drive from shop
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{SHOP_LABEL}</p>
      <div className="mt-2 flex items-baseline gap-3">
        {loading && (
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculating…
          </span>
        )}
        {!loading && data && (
          <>
            <span className="font-display text-2xl tracking-wide">{formatDuration(data.duration)}</span>
            <span className="text-sm text-muted-foreground">· {formatMiles(data.distance)} one-way</span>
          </>
        )}
        {!loading && err && (
          <span className="text-sm text-muted-foreground">Drive time unavailable.</span>
        )}
      </div>
    </div>
  );
};

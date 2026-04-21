import { useEffect, useState } from "react";
import { fetchForecast, ONTARIO_NY, type Coords, type Forecast } from "@/lib/weather";

interface State {
  forecast: Forecast | null;
  coords: Coords | null;
  loading: boolean;
  error: string | null;
}

export const useWeather = (override?: Coords | null) => {
  const [state, setState] = useState<State>({ forecast: null, coords: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;

    const load = async (c: Coords) => {
      try {
        const forecast = await fetchForecast(c.lat, c.lon);
        if (!cancelled) setState({ forecast, coords: c, loading: false, error: null });
      } catch (e: any) {
        if (!cancelled) setState({ forecast: null, coords: c, loading: false, error: e.message ?? "Failed" });
      }
    };

    if (override) {
      setState((s) => ({ ...s, loading: true }));
      load(override);
      return () => { cancelled = true; };
    }

    if (!("geolocation" in navigator)) {
      load(ONTARIO_NY);
      return () => { cancelled = true; };
    }

    const reverseGeocode = async (lat: number, lon: number): Promise<string> => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`,
          { headers: { Accept: "application/json" } },
        );
        if (!res.ok) return "Your location";
        const j = await res.json();
        const a = j.address ?? {};
        const city = a.city || a.town || a.village || a.hamlet || a.county;
        const state = a.state_code || a.state;
        return [city, state].filter(Boolean).join(", ") || "Your location";
      } catch {
        return "Your location";
      }
    };

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const label = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        if (!cancelled) load({ lat: pos.coords.latitude, lon: pos.coords.longitude, label });
      },
      () => load(ONTARIO_NY),
      { timeout: 12000, maximumAge: 5 * 60 * 1000, enableHighAccuracy: false },
    );

    return () => { cancelled = true; };
  }, [override?.lat, override?.lon]);

  return state;
};

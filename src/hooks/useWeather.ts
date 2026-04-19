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

    navigator.geolocation.getCurrentPosition(
      (pos) => load({ lat: pos.coords.latitude, lon: pos.coords.longitude, label: "Your location" }),
      () => load(ONTARIO_NY),
      { timeout: 6000, maximumAge: 5 * 60 * 1000 },
    );

    return () => { cancelled = true; };
  }, [override?.lat, override?.lon]);

  return state;
};

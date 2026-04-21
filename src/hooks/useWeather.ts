import { useCallback, useEffect, useRef, useState } from "react";
import { fetchForecast, ONTARIO_NY, type Coords, type Forecast } from "@/lib/weather";

interface State {
  forecast: Forecast | null;
  coords: Coords | null;
  loading: boolean;
  error: string | null;
  needsPermission: boolean;
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

export const useWeather = (override?: Coords | null) => {
  const [state, setState] = useState<State>({
    forecast: null, coords: null, loading: true, error: null, needsPermission: false,
  });
  const cancelledRef = useRef(false);

  const load = useCallback(async (c: Coords, options?: { needsPermission?: boolean }) => {
    try {
      const forecast = await fetchForecast(c.lat, c.lon);
      if (!cancelledRef.current) {
        setState({
          forecast,
          coords: c,
          loading: false,
          error: null,
          needsPermission: options?.needsPermission ?? false,
        });
      }
    } catch (e: any) {
      if (!cancelledRef.current) {
        setState({
          forecast: null,
          coords: c,
          loading: false,
          error: e.message ?? "Failed",
          needsPermission: options?.needsPermission ?? false,
        });
      }
    }
  }, []);

  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      load(ONTARIO_NY);
      return;
    }
    setState((s) => ({ ...s, loading: true, needsPermission: false }));
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const label = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        load({ lat: pos.coords.latitude, lon: pos.coords.longitude, label });
      },
      (err) => {
        // PERMISSION_DENIED = 1
        if (err.code === 1) {
          load(ONTARIO_NY, { needsPermission: true });
        } else {
          load(ONTARIO_NY, { needsPermission: true });
        }
      },
      { timeout: 12000, maximumAge: 5 * 60 * 1000, enableHighAccuracy: false },
    );
  }, [load]);

  useEffect(() => {
    cancelledRef.current = false;

    if (override) {
      setState((s) => ({ ...s, loading: true }));
      load(override);
      return () => { cancelledRef.current = true; };
    }

    // Check existing permission first; only auto-request if already granted
    const tryAuto = async () => {
      if (!("geolocation" in navigator)) {
        load(ONTARIO_NY);
        return;
      }
      try {
        const perm = await (navigator as any).permissions?.query?.({ name: "geolocation" });
        if (perm?.state === "granted") {
          requestLocation();
          return;
        }
        if (perm?.state === "denied") {
          load(ONTARIO_NY, { needsPermission: true });
          return;
        }
        // "prompt" or unknown — show fallback + button so user can tap to allow
        load(ONTARIO_NY, { needsPermission: true });
      } catch {
        // Permissions API unavailable (older Safari) — keep fallback visible with manual trigger
        load(ONTARIO_NY, { needsPermission: true });
      }
    };

    tryAuto();
    return () => { cancelledRef.current = true; };
  }, [override?.lat, override?.lon, load, requestLocation]);

  return { ...state, requestLocation };
};

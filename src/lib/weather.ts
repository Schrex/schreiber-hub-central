// Open-Meteo (no API key, no signup)
// Docs: https://open-meteo.com/en/docs

export const ONTARIO_NY = { lat: 43.2245, lon: -77.2978, label: "Ontario, NY" };

export interface Coords {
  lat: number;
  lon: number;
  label?: string;
}

export interface CurrentWeather {
  tempF: number;
  apparentTempF: number;
  code: number;
  windMph: number;
  precipProb: number;
  isDay: boolean;
}

export interface HourPoint {
  time: string; // ISO
  tempF: number;
  precipProb: number;
  precipIn: number;
  code: number;
}

export interface DayPoint {
  date: string; // YYYY-MM-DD
  highF: number;
  lowF: number;
  precipProb: number;
  precipIn: number;
  code: number;
  sunrise: string;
  sunset: string;
}

export interface Forecast {
  current: CurrentWeather;
  hourly: HourPoint[];
  daily: DayPoint[];
}

export const fetchForecast = async (lat: number, lon: number): Promise<Forecast> => {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "temperature_2m,apparent_temperature,is_day,precipitation_probability,weather_code,wind_speed_10m",
    hourly: "temperature_2m,precipitation_probability,precipitation,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    timezone: "auto",
    forecast_days: "14",
  });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error("Weather request failed");
  const j = await res.json();

  const current: CurrentWeather = {
    tempF: Math.round(j.current.temperature_2m),
    apparentTempF: Math.round(j.current.apparent_temperature),
    code: j.current.weather_code,
    windMph: Math.round(j.current.wind_speed_10m),
    precipProb: j.current.precipitation_probability ?? 0,
    isDay: !!j.current.is_day,
  };

  const nowIdx = j.hourly.time.findIndex((t: string) => new Date(t).getTime() >= Date.now() - 30 * 60 * 1000);
  const start = Math.max(nowIdx, 0);
  const hourly: HourPoint[] = j.hourly.time
    .slice(start, start + 24)
    .map((t: string, i: number) => ({
      time: t,
      tempF: Math.round(j.hourly.temperature_2m[start + i]),
      precipProb: j.hourly.precipitation_probability[start + i] ?? 0,
      precipIn: j.hourly.precipitation[start + i] ?? 0,
      code: j.hourly.weather_code[start + i],
    }));

  const daily: DayPoint[] = j.daily.time.map((d: string, i: number) => ({
    date: d,
    highF: Math.round(j.daily.temperature_2m_max[i]),
    lowF: Math.round(j.daily.temperature_2m_min[i]),
    precipProb: j.daily.precipitation_probability_max[i] ?? 0,
    precipIn: j.daily.precipitation_sum[i] ?? 0,
    code: j.daily.weather_code[i],
    sunrise: j.daily.sunrise[i],
    sunset: j.daily.sunset[i],
  }));

  return { current, hourly, daily };
};

// Geocode a free-form address using Open-Meteo's free geocoder
export const geocodeAddress = async (address: string): Promise<Coords | null> => {
  // Open-Meteo's geocoder is name-based; for street addresses we use Nominatim (also free).
  // Some valid jobsite street addresses are not indexed, so fall back to city/state/ZIP-level weather.
  const trimmed = address.trim();
  const zip = trimmed.match(/\b\d{5}(?:-\d{4})?\b/)?.[0];
  const cityState = trimmed.match(/([^,]+),\s*([A-Z]{2})(?:\s+\d{5}(?:-\d{4})?)?\s*$/i);
  const fallback = cityState ? `${cityState[1].trim()} ${cityState[2].trim()}${zip ? ` ${zip}` : ""}` : zip;
  const queries = Array.from(new Set([trimmed, fallback, zip].filter(Boolean) as string[]));

  for (const query of queries) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) continue;
    const arr = await res.json();
    if (!arr?.length) continue;
    const lat = parseFloat(arr[0].lat);
    const lon = parseFloat(arr[0].lon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return { lat, lon, label: trimmed };
    }
  }
  return null;
};

// WMO weather code → short label + emoji
export const weatherCodeInfo = (code: number): { label: string; emoji: string } => {
  if (code === 0) return { label: "Clear", emoji: "☀️" };
  if ([1, 2].includes(code)) return { label: "Partly Cloudy", emoji: "⛅" };
  if (code === 3) return { label: "Overcast", emoji: "☁️" };
  if ([45, 48].includes(code)) return { label: "Fog", emoji: "🌫️" };
  if ([51, 53, 55, 56, 57].includes(code)) return { label: "Drizzle", emoji: "🌦️" };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { label: "Rain", emoji: "🌧️" };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: "Snow", emoji: "❄️" };
  if ([95, 96, 99].includes(code)) return { label: "Thunderstorm", emoji: "⛈️" };
  return { label: "—", emoji: "🌡️" };
};

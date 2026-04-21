import { useWeather } from "@/hooks/useWeather";
import { WeatherCard } from "@/components/weather/WeatherCard";

export const WeatherStrip = () => {
  const { forecast, coords, loading, error, needsPermission, requestLocation } = useWeather();
  return (
    <WeatherCard
      forecast={forecast}
      coords={coords}
      loading={loading}
      error={error}
      needsPermission={needsPermission}
      onRequestLocation={requestLocation}
    />
  );
};

import { useWeather } from "@/hooks/useWeather";
import { WeatherCard } from "@/components/weather/WeatherCard";

export const WeatherStrip = () => {
  const { forecast, coords, loading, needsPermission, requestLocation } = useWeather();
  return (
    <WeatherCard
      forecast={forecast}
      coords={coords}
      loading={loading}
      needsPermission={needsPermission}
      onRequestLocation={requestLocation}
    />
  );
};

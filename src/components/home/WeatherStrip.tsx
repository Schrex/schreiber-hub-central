import { useWeather } from "@/hooks/useWeather";
import { WeatherCard } from "@/components/weather/WeatherCard";

export const WeatherStrip = () => {
  const { forecast, coords, loading } = useWeather();
  return <WeatherCard forecast={forecast} coords={coords} loading={loading} />;
};

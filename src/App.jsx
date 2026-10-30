import { createElement, useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  LoaderCircle,
  MapPin,
  Search,
  Sun,
  Thermometer,
  Wind,
} from "lucide-react";
import "./App.css";

const GEOCODING_API = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_API = "https://api.open-meteo.com/v1/forecast";

function getWeatherDescription(code) {
  if (code === 0) return "Clear sky";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if ([51, 53, 55].includes(code)) return "Drizzle";
  if ([56, 57].includes(code)) return "Freezing drizzle";
  if ([61, 63, 65].includes(code)) return "Rain";
  if ([66, 67].includes(code)) return "Freezing rain";
  if ([71, 73, 75].includes(code)) return "Snow";
  if (code === 77) return "Snow grains";
  if ([80, 81, 82].includes(code)) return "Rain showers";
  if ([85, 86].includes(code)) return "Snow showers";
  if (code === 95) return "Thunderstorm";
  if ([96, 99].includes(code)) return "Thunderstorm with hail";
  return "Weather conditions unavailable";
}

function getWeatherIcon(code, isDay = true) {
  if (code === 0) return isDay ? Sun : CloudMoon;
  if (code === 1 || code === 2) return isDay ? CloudSun : CloudMoon;
  if (code === 3) return Cloud;
  if (code === 45 || code === 48) return CloudFog;
  if ([51, 53, 55, 56, 57].includes(code)) return CloudDrizzle;
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return CloudRain;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return CloudSnow;
  if ([95, 96, 99].includes(code)) return CloudLightning;
  return Cloud;
}

async function fetchJson(url, signal) {
  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error(`Weather service returned an error (${response.status}). Please try again.`);
  }

  try {
    return await response.json();
  } catch {
    throw new Error("The weather service returned an unreadable response. Please try again.");
  }
}

function formatForecastDate(dateString) {
  return new Date(`${dateString}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
  });
}

function App() {
  const [cityInput, setCityInput] = useState("");
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestController = useRef(null);

  const loadWeather = useCallback(async (cityName) => {
    const city = cityName.trim();
    requestController.current?.abort();

    if (!city) {
      requestController.current = null;
      setWeather(null);
      setError("Enter a city name to search.");
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    requestController.current = controller;
    setWeather(null);
    setError("");
    setLoading(true);

    try {
      const searchParams = new URLSearchParams({
        name: city,
        count: "1",
        language: "en",
        format: "json",
      });
      const searchResult = await fetchJson(
        `${GEOCODING_API}?${searchParams.toString()}`,
        controller.signal,
      );
      const location = searchResult.results?.[0];

      if (!location) {
        throw new Error(`We couldn't find "${city}". Check the spelling and try again.`);
      }

      const forecastParams = new URLSearchParams({
        latitude: String(location.latitude),
        longitude: String(location.longitude),
        current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m",
        daily: "weather_code,temperature_2m_max,temperature_2m_min",
        temperature_unit: "celsius",
        wind_speed_unit: "kmh",
        forecast_days: "5",
        timezone: "auto",
      });
      const forecast = await fetchJson(
        `${FORECAST_API}?${forecastParams.toString()}`,
        controller.signal,
      );

      const forecastDays = forecast.daily?.time?.length;
      const dailyForecastIsComplete =
        forecastDays === 5 &&
        forecast.daily.weather_code?.length === forecastDays &&
        forecast.daily.temperature_2m_max?.length === forecastDays &&
        forecast.daily.temperature_2m_min?.length === forecastDays;

      if (!forecast.current || !dailyForecastIsComplete) {
        throw new Error("Weather data is incomplete. Please try again.");
      }

      if (!controller.signal.aborted) {
        setWeather({ location, current: forecast.current, daily: forecast.daily });
      }
    } catch (requestError) {
      if (requestError?.name !== "AbortError" && !controller.signal.aborted) {
        setWeather(null);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load weather right now. Please try again.",
        );
      }
    } finally {
      if (requestController.current === controller) {
        requestController.current = null;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadWeather("Lagos");
    }, 0);

    return () => {
      window.clearTimeout(initialLoad);
      requestController.current?.abort();
      requestController.current = null;
    };
  }, [loadWeather]);

  function handleSubmit(event) {
    event.preventDefault();
    loadWeather(cityInput);
  }

  const CurrentWeatherIcon = weather
    ? getWeatherIcon(weather.current.weather_code, weather.current.is_day === 1)
    : Cloud;

  return (
    <main className="weather-app">
      <header className="app-header">
        <p className="eyebrow">YOUR LOCAL FORECAST</p>
        <h1>Weather</h1>
        <p className="app-subtitle">A little sunshine, wherever you are.</p>
      </header>

      <form className="search-form" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="city-search">
          Search for a city
        </label>
        <input
          id="city-search"
          name="city"
          type="search"
          value={cityInput}
          onChange={(event) => setCityInput(event.target.value)}
          placeholder="Search for a city..."
          autoComplete="address-level2"
          disabled={loading}
        />
        <button type="submit" disabled={loading}>
          <Search size={18} aria-hidden="true" />
          <span>Search</span>
        </button>
      </form>

      {loading && (
        <p className="status-message" role="status" aria-live="polite">
          <LoaderCircle className="loading-icon" size={20} aria-hidden="true" />
          Finding the forecast...
        </p>
      )}

      {error && (
        <p className="error-message" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          {error}
        </p>
      )}

      {weather && !loading && (
        <div className="weather-content">
          <section className="current-weather" aria-labelledby="current-weather-title">
            <div className="location">
              <MapPin size={18} aria-hidden="true" />
              <h2 id="current-weather-title">
                {weather.location.name}, {weather.location.country}
              </h2>
            </div>

            <div className="current-summary">
              {createElement(CurrentWeatherIcon, {
                className: "current-weather-icon",
                size: 76,
                strokeWidth: 1.5,
                "aria-hidden": true,
              })}
              <div>
                <p className="current-temperature">
                  {Math.round(weather.current.temperature_2m)}
                  <span>°C</span>
                </p>
                <p className="weather-description">
                  {getWeatherDescription(weather.current.weather_code)}
                </p>
              </div>
            </div>

            <div className="weather-details">
              <div className="weather-detail">
                <Thermometer size={20} aria-hidden="true" />
                <span>Feels like</span>
                <strong>{Math.round(weather.current.apparent_temperature)}°C</strong>
              </div>
              <div className="weather-detail">
                <Droplets size={20} aria-hidden="true" />
                <span>Humidity</span>
                <strong>{weather.current.relative_humidity_2m}%</strong>
              </div>
              <div className="weather-detail">
                <Wind size={20} aria-hidden="true" />
                <span>Wind</span>
                <strong>{Math.round(weather.current.wind_speed_10m)} km/h</strong>
              </div>
            </div>
          </section>

          <section className="forecast-section" aria-labelledby="forecast-title">
            <h2 id="forecast-title">5-day forecast</h2>
            <div className="forecast-list">
              {weather.daily.time.map((date, index) => {
                const ForecastIcon = getWeatherIcon(weather.daily.weather_code[index]);

                return (
                  <article className="forecast-day" key={date}>
                    <h3>{index === 0 ? "Today" : formatForecastDate(date)}</h3>
                    {createElement(ForecastIcon, {
                      size: 28,
                      "aria-hidden": true,
                    })}
                    <p className="forecast-description">
                      {getWeatherDescription(weather.daily.weather_code[index])}
                    </p>
                    <p className="forecast-temperatures">
                      <strong>
                        {Math.round(weather.daily.temperature_2m_max[index])}°
                      </strong>
                      <span>
                        {Math.round(weather.daily.temperature_2m_min[index])}°
                      </span>
                    </p>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;

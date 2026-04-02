import { useState, useEffect } from 'react';
import { MapPin, Cloud, Sun, CloudRain, CloudSnow, CloudLightning, CloudDrizzle } from 'lucide-react';
import { useT } from '../i18n/context';

interface WeatherData {
  temp: string;
  desc: string;
  icon: string;
}

interface LocationData {
  city: string;
  area: string;
}

// Weather icon mapping
const WeatherIcon = ({ icon }: { icon: string }) => {
  if (icon.includes('Rain') || icon.includes('雨')) return <CloudRain size={20} className="text-blue-400" />;
  if (icon.includes('Snow') || icon.includes('雪')) return <CloudSnow size={20} className="text-blue-200" />;
  if (icon.includes('Thunder') || icon.includes('雷')) return <CloudLightning size={20} className="text-yellow-400" />;
  if (icon.includes('Drizzle') || icon.includes('霧')) return <CloudDrizzle size={20} className="text-gray-400" />;
  if (icon.includes('Clear') || icon.includes('Sunny') || icon.includes('晴')) return <Sun size={20} className="text-yellow-500" />;
  return <Cloud size={20} className="text-gray-400" />;
};

// Get greeting based on time
const getGreeting = (t: (key: string) => string): string => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return '☀️ 早安';
  if (hour >= 12 && hour < 17) return '🌤 午安';
  if (hour >= 17 && hour < 21) return '🌆 晚安';
  return '🌙 晚安';
};

const HomeCard = ({ nickname }: { nickname?: string }) => {
  const t = useT();
  const [location, setLocation] = useState<LocationData | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    let cancelled = false;

    const fetchLocationAndWeather = async () => {
      try {
        // Get GPS position
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
            enableHighAccuracy: false,
          });
        });

        if (cancelled) return;
        const { latitude, longitude } = pos.coords;

        // Reverse geocode — use Nominatim (free, no key)
        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=ja`,
            { headers: { 'User-Agent': 'GoSavor/1.0' } }
          );
          if (geoRes.ok) {
            const geo = await geoRes.json();
            const addr = geo.address || {};
            const city = addr.city || addr.town || addr.village || addr.county || '';
            const area = addr.suburb || addr.neighbourhood || addr.quarter || '';
            if (!cancelled) setLocation({ city, area });
          }
        } catch { /* ignore geocode error */ }

        // Weather — use wttr.in (free, no key)
        try {
          const wttrRes = await fetch(
            `https://wttr.in/${latitude},${longitude}?format=j1`,
            { signal: AbortSignal.timeout(3000) }
          );
          if (wttrRes.ok) {
            const wttr = await wttrRes.json();
            const current = wttr.current_condition?.[0];
            if (current && !cancelled) {
              setWeather({
                temp: current.temp_C + '°C',
                desc: current.lang_ja?.[0]?.value || current.weatherDesc?.[0]?.value || '',
                icon: current.weatherDesc?.[0]?.value || '',
              });
            }
          }
        } catch { /* ignore weather error */ }
      } catch {
        // GPS denied or unavailable
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchLocationAndWeather();
    return () => { cancelled = true; };
  }, []);

  const greeting = getGreeting(t);
  const locationText = location
    ? `${location.city}${location.area ? '・' + location.area : ''}`
    : null;

  return (
    <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-4 border border-orange-100">
      {/* Greeting */}
      <h2 className="text-xl font-bold text-gray-900">{greeting}，{nickname}！</h2>

      {/* Location + Weather */}
      <div className="flex items-center gap-3 mt-2">
        {locationText && (
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <MapPin size={14} className="text-orange-500" />
            <span>{locationText}</span>
          </div>
        )}
        {weather && (
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <WeatherIcon icon={weather.icon} />
            <span className="font-medium">{weather.temp}</span>
            <span className="text-xs text-gray-400">{weather.desc}</span>
          </div>
        )}
        {loading && !location && !weather && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <div className="w-3 h-3 border border-gray-300 border-t-orange-400 rounded-full animate-spin" />
            定位中...
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeCard;

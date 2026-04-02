import { useState, useEffect } from 'react';
import { MapPin, Cloud, Sun, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, BookOpen, Wallet, Clock } from 'lucide-react';
import { useT } from '../i18n/context';

interface WeatherData { temp: string; desc: string; icon: string; }
interface LocationData { city: string; area: string; }

interface HomeCardProps {
  nickname?: string;
  userPlan?: string;
  onDiary?: () => void;
  onExpenses?: () => void;
  onHistory?: () => void;
}

const WeatherIcon = ({ icon }: { icon: string }) => {
  if (icon.includes('Rain') || icon.includes('雨')) return <CloudRain size={18} className="text-blue-400" />;
  if (icon.includes('Snow') || icon.includes('雪')) return <CloudSnow size={18} className="text-blue-200" />;
  if (icon.includes('Thunder') || icon.includes('雷')) return <CloudLightning size={18} className="text-yellow-400" />;
  if (icon.includes('Drizzle') || icon.includes('霧')) return <CloudDrizzle size={18} className="text-gray-400" />;
  if (icon.includes('Clear') || icon.includes('Sunny') || icon.includes('晴')) return <Sun size={18} className="text-yellow-500" />;
  return <Cloud size={18} className="text-gray-400" />;
};

const getGreeting = (t: (key: string) => string): string => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return '☀️ 早安';
  if (hour >= 12 && hour < 17) return '🌤 午安';
  if (hour >= 17 && hour < 21) return '🌆 晚安';
  return '🌙 晚安';
};

const planLabel: Record<string, { emoji: string; name: string }> = {
  free: { emoji: '🌱', name: '體驗版' },
  supporter: { emoji: '⭐', name: '贊助版' },
  pro: { emoji: '👑', name: '正式版' },
  rental: { emoji: '🎫', name: '旅遊包' },
};

const HomeCard = ({ nickname, userPlan = 'free', onDiary, onExpenses, onHistory }: HomeCardProps) => {
  const t = useT();
  const [location, setLocation] = useState<LocationData | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchLocationAndWeather = async () => {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, enableHighAccuracy: false });
        });
        if (cancelled) return;
        const { latitude, longitude } = pos.coords;
        try {
          const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=ja`, { headers: { 'User-Agent': 'GoSavor/1.0' } });
          if (geoRes.ok) {
            const geo = await geoRes.json();
            const addr = geo.address || {};
            if (!cancelled) setLocation({ city: addr.city || addr.town || addr.village || addr.county || '', area: addr.suburb || addr.neighbourhood || addr.quarter || '' });
          }
        } catch {}
        try {
          const wttrRes = await fetch(`https://wttr.in/${latitude},${longitude}?format=j1`, { signal: AbortSignal.timeout(3000) });
          if (wttrRes.ok) {
            const wttr = await wttrRes.json();
            const current = wttr.current_condition?.[0];
            if (current && !cancelled) setWeather({ temp: current.temp_C + '°C', desc: current.lang_ja?.[0]?.value || current.weatherDesc?.[0]?.value || '', icon: current.weatherDesc?.[0]?.value || '' });
          }
        } catch {}
      } catch {} finally { if (!cancelled) setLoading(false); }
    };
    fetchLocationAndWeather();
    return () => { cancelled = true; };
  }, []);

  const greeting = getGreeting(t);
  const locationText = location ? `${location.city}${location.area ? '・' + location.area : ''}` : null;
  const plan = planLabel[userPlan] || planLabel.free;

  return (
    <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl border border-orange-100 overflow-hidden">
      {/* Upper: Status area */}
      <div className="p-4 pb-3">
        {/* Greeting + plan badge */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">{greeting}，{nickname || '旅人'}！</h2>
          <span className="text-xs bg-white/70 text-gray-600 px-2 py-0.5 rounded-full font-medium">
            {plan.emoji} {plan.name}
          </span>
        </div>

        {/* Location + Weather + Usage */}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {locationText && (
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <MapPin size={13} className="text-orange-500" />
              <span>{locationText}</span>
            </div>
          )}
          {weather && (
            <div className="flex items-center gap-1 text-sm text-gray-600">
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

      {/* Lower: Quick Actions */}
      <div className="flex border-t border-orange-100/60">
        <button onClick={onDiary} className="flex-1 flex flex-col items-center gap-1 py-3 hover:bg-orange-100/30 transition-colors">
          <BookOpen size={20} className="text-orange-500" />
          <span className="text-xs font-medium text-gray-600">旅遊日記</span>
        </button>
        <div className="w-px bg-orange-100/60" />
        <button onClick={onExpenses} className="flex-1 flex flex-col items-center gap-1 py-3 hover:bg-orange-100/30 transition-colors">
          <Wallet size={20} className="text-orange-500" />
          <span className="text-xs font-medium text-gray-600">記帳簿</span>
        </button>
        <div className="w-px bg-orange-100/60" />
        <button onClick={onHistory} className="flex-1 flex flex-col items-center gap-1 py-3 hover:bg-orange-100/30 transition-colors">
          <Clock size={20} className="text-orange-500" />
          <span className="text-xs font-medium text-gray-600">點餐紀錄</span>
        </button>
      </div>
    </div>
  );
};

export default HomeCard;

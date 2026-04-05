import { useState, useEffect } from 'react';
import { MapPin, Cloud, Sun, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, BookOpen, Wallet, Clock, Search } from 'lucide-react';
import { getScanHistory, getExpenses, getActiveTrip } from '../services/storage';



interface WeatherData { temp: string; desc: string; icon: string; }
interface LocationData { city: string; area: string; }

interface HomeCardProps {
  nickname?: string;
  userPlan?: string;
  guideName?: string;
  compact?: boolean; // true = standard (3-col), false = clean (2x2 grid)
  onDiary?: () => void;
  onExpenses?: () => void;
  onHistory?: () => void;
  onDrugstore?: () => void;
}

const WeatherIcon = ({ icon }: { icon: string }) => {
  if (icon.includes('Rain') || icon.includes('雨')) return <CloudRain size={18} className="text-blue-400" />;
  if (icon.includes('Snow') || icon.includes('雪')) return <CloudSnow size={18} className="text-blue-200" />;
  if (icon.includes('Thunder') || icon.includes('雷')) return <CloudLightning size={18} className="text-yellow-400" />;
  if (icon.includes('Drizzle') || icon.includes('霧')) return <CloudDrizzle size={18} className="text-gray-400" />;
  if (icon.includes('Clear') || icon.includes('Sunny') || icon.includes('晴')) return <Sun size={18} className="text-yellow-500" />;
  return <Cloud size={18} className="text-gray-400" />;
};

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return '☀️ 早安';
  if (hour >= 12 && hour < 17) return '🌤 午安';
  if (hour >= 17 && hour < 21) return '🌆 晚安';
  return '🌙 晚安';
};

const planLabel: Record<string, { emoji: string; name: string }> = {
  free: { emoji: '🌱', name: '體驗版' },
  beta: { emoji: '🧪', name: '公測版' },
  supporter: { emoji: '⭐', name: '贊助版' },
  pro: { emoji: '👑', name: '正式版' },
  rental: { emoji: '🎫', name: '旅遊包' },
  guide: { emoji: '🎌', name: '導遊版' },
  'guide-member': { emoji: '🎌', name: '旅遊團' },
};

const HomeCard = ({ nickname, userPlan = 'free', guideName, compact = true, onDiary, onExpenses, onHistory, onDrugstore }: HomeCardProps) => {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [, setLoading] = useState(true);
  const [totalScans, setTotalScans] = useState(0);
  const [totalMeals, setTotalMeals] = useState(0);
  const [totalSpent, setTotalSpent] = useState('');
  const [tripName, setTripName] = useState('');
  const [tripDays, setTripDays] = useState(0);

  useEffect(() => {
    const trip = getActiveTrip();
    if (trip) {
      setTripName(trip.name);
      setTripDays(Math.max(1, Math.ceil((Date.now() - trip.startDate) / (1000 * 60 * 60 * 24))));
    }
    getScanHistory().then(scans => {
      const filtered = trip ? scans.filter(s => s.timestamp >= trip.startDate) : scans;
      setTotalScans(filtered.length);
      setTotalMeals(filtered.filter(s => (s.scanMode || 'menu') === 'menu').length);
    });
    getExpenses().then(exps => {
      const filtered = trip ? exps.filter(e => e.timestamp >= trip.startDate) : exps;
      // Sum all expenses, treating JPY/¥/円 as the same currency
      let total = 0;
      filtered.forEach(e => { total += e.amount; });
      if (total > 0) {
        setTotalSpent(`¥${Math.round(total).toLocaleString()}`);
      }
    });
  }, []);

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

  const greeting = getGreeting();
  const locationText = location ? `${location.city}${location.area ? '・' + location.area : ''}` : null;
  const basePlan = planLabel[userPlan] || planLabel.free;
  const plan = userPlan === 'guide-member' && guideName
    ? { emoji: '🎌', name: `導遊${guideName}贊助版` }
    : basePlan;

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

        {/* Trip name + Location + Weather — centered, fixed height */}
        <div className="text-center mt-3 space-y-0.5">
          {tripName && (
            <p className="text-sm font-medium text-gray-700">{tripName} · 第 {tripDays} 天</p>
          )}
          <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 h-5">
            {locationText ? (
              <>
                <MapPin size={12} className="text-orange-400" />
                <span>{locationText}</span>
              </>
            ) : (
              <span className="text-gray-300">📍 定位中...</span>
            )}
            {weather ? (
              <>
                <span>·</span>
                <WeatherIcon icon={weather.icon} />
                <span>{weather.temp}</span>
                <span>{weather.desc}</span>
              </>
            ) : (
              <span className="text-gray-300">&nbsp;</span>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      {compact ? (
        /* Standard: 3-column row */
        <div className="flex border-t border-orange-100/60">
          <button onClick={onDiary} className="flex-1 flex flex-col items-center gap-1 py-3 hover:bg-orange-100/30 transition-colors">
            <BookOpen size={20} className="text-orange-500" />
            <span className="text-xs font-medium text-gray-600">旅遊日記</span>
            {totalScans > 0 && <span className="text-[10px] text-gray-400">{totalScans} 次翻譯</span>}
          </button>
          <div className="w-px bg-orange-100/60" />
          <button onClick={onExpenses} className="flex-1 flex flex-col items-center gap-1 py-3 hover:bg-orange-100/30 transition-colors">
            <Wallet size={20} className="text-orange-500" />
            <span className="text-xs font-medium text-gray-600">記帳簿</span>
            {totalSpent && <span className="text-[10px] text-orange-500 font-medium">{totalSpent}</span>}
          </button>
          <div className="w-px bg-orange-100/60" />
          <button onClick={onHistory} className="flex-1 flex flex-col items-center gap-1 py-3 hover:bg-orange-100/30 transition-colors">
            <Clock size={20} className="text-orange-500" />
            <span className="text-xs font-medium text-gray-600">點餐紀錄</span>
            {totalMeals > 0 && <span className="text-[10px] text-gray-400">{totalMeals} 餐</span>}
          </button>
        </div>
      ) : (
        /* Clean: 2x2 grid with bigger tiles */
        <div className="grid grid-cols-2 gap-2.5 p-3 border-t border-orange-100/60">
          <button onClick={onDiary} className="flex flex-col items-center gap-1.5 py-4 bg-orange-50 rounded-xl hover:bg-orange-100/60 transition-colors">
            <BookOpen size={26} className="text-orange-500" />
            <span className="text-sm font-bold text-gray-700">旅遊日記</span>
            {totalScans > 0 && <span className="text-xs text-gray-400">{totalScans} 次翻譯</span>}
          </button>
          <button onClick={onExpenses} className="flex flex-col items-center gap-1.5 py-4 bg-orange-50 rounded-xl hover:bg-orange-100/60 transition-colors">
            <Wallet size={26} className="text-orange-500" />
            <span className="text-sm font-bold text-gray-700">記帳簿</span>
            {totalSpent && <span className="text-xs text-orange-500 font-bold">{totalSpent}</span>}
          </button>
          <button onClick={onHistory} className="flex flex-col items-center gap-1.5 py-4 bg-orange-50 rounded-xl hover:bg-orange-100/60 transition-colors">
            <Clock size={26} className="text-orange-500" />
            <span className="text-sm font-bold text-gray-700">點餐紀錄</span>
            {totalMeals > 0 && <span className="text-xs text-gray-400">{totalMeals} 餐</span>}
          </button>
          <button onClick={onDrugstore} className="flex flex-col items-center gap-1.5 py-4 bg-orange-50 rounded-xl hover:bg-orange-100/60 transition-colors">
            <Search size={26} className="text-orange-500" />
            <span className="text-sm font-bold text-gray-700">藥妝情報</span>
            <span className="text-xs text-orange-400">比價搜尋</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default HomeCard;

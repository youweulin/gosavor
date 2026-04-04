import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ArrowLeft, Navigation, Loader2 } from 'lucide-react';
import { getNearbyStores, getAllStores, type StoreWithProducts } from '../services/supabase';
import 'leaflet/dist/leaflet.css';

// 自訂 Marker icon（解決 Leaflet 預設 icon 問題）
const storeIcon = L.divIcon({
  className: '',
  html: `<div style="background:#f97316;color:white;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">🛒</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const taxFreeIcon = L.divIcon({
  className: '',
  html: `<div style="background:#22c55e;color:white;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">🏷️</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const userIcon = L.divIcon({
  className: '',
  html: `<div style="background:#3b82f6;color:white;border-radius:50%;width:20px;height:20px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

/** 地圖移動後重新載入店家 */
function MapEvents({ onBoundsChange }: { onBoundsChange: (center: { lat: number; lng: number }) => void }) {
  const map = useMap();
  useEffect(() => {
    const handler = () => {
      const c = map.getCenter();
      onBoundsChange({ lat: c.lat, lng: c.lng });
    };
    map.on('moveend', handler);
    return () => { map.off('moveend', handler); };
  }, [map, onBoundsChange]);
  return null;
}

/** 移動到用戶位置 */
function FlyToUser({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, 15, { duration: 1 });
  }, [position, map]);
  return null;
}

interface StoreMapProps {
  onBack: () => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return '剛剛';
  if (hours < 24) return `${hours}小時前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return `${Math.floor(days / 30)}個月前`;
}

const StoreMap = ({ onBack }: StoreMapProps) => {
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [stores, setStores] = useState<StoreWithProducts[]>([]);
  const [selectedStore, setSelectedStore] = useState<StoreWithProducts | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStores, setLoadingStores] = useState(false);
  const lastFetch = useRef<string>('');

  // 載入所有店家 + 取得用戶位置
  useEffect(() => {
    // 先載入所有店家（不等 GPS）
    getAllStores().then(allStores => {
      if (allStores.length > 0) {
        setStores(allStores);
        // 如果還沒有用戶位置，先 flyTo 第一家店
        if (!userPos) {
          setUserPos([allStores[0].lat, allStores[0].lng]);
        }
      }
      setLoading(false);
    });

    // 同時取得用戶 GPS
    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserPos(coords);
      },
      () => {
        // GPS 失敗，如果沒有店家資料就用東京站
        if (stores.length === 0) {
          setUserPos([35.6812, 139.7671]);
          setLoading(false);
        }
      },
      { timeout: 5000, enableHighAccuracy: false }
    );
  }, []);

  const loadStores = async (lat: number, lng: number) => {
    const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
    if (key === lastFetch.current) return;
    lastFetch.current = key;

    setLoadingStores(true);
    const data = await getNearbyStores(lat, lng, 3);
    setStores(data);
    setLoading(false);
    setLoadingStores(false);
  };

  const handleBoundsChange = (center: { lat: number; lng: number }) => {
    loadStores(center.lat, center.lng);
  };

  const openGoogleMaps = (store: StoreWithProducts) => {
    const q = encodeURIComponent(`${store.name} ${store.branch || ''}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-orange-500 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">載入地圖中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-[1000] bg-white/95 backdrop-blur border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1"><ArrowLeft size={20} /></button>
            <h1 className="font-bold text-lg">🗺️ 附近店家</h1>
          </div>
          <div className="flex items-center gap-2">
            {loadingStores && <Loader2 size={16} className="animate-spin text-orange-500" />}
            <span className="text-xs text-gray-400">{stores.length} 家店</span>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="w-full" style={{ height: selectedStore ? '55vh' : '100vh', paddingTop: 56 }}>
        {userPos && (
          <MapContainer
            center={userPos}
            zoom={15}
            style={{ width: '100%', height: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapEvents onBoundsChange={handleBoundsChange} />
            <FlyToUser position={userPos} />

            {/* 用戶位置 */}
            <Marker position={userPos} icon={userIcon} />

            {/* 店家 Pins */}
            {stores.map(store => (
              <Marker
                key={store.id}
                position={[store.lat, store.lng]}
                icon={store.is_tax_free ? taxFreeIcon : storeIcon}
                eventHandlers={{
                  click: () => setSelectedStore(store),
                }}
              >
                <Popup>
                  <strong>{store.name}</strong>
                  {store.branch && <span className="text-xs text-gray-500"> {store.branch}</span>}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>

      {/* 重新定位按鈕 */}
      <button
        onClick={() => {
          navigator.geolocation.getCurrentPosition(
            pos => setUserPos([pos.coords.latitude, pos.coords.longitude]),
            () => {},
            { timeout: 3000 }
          );
        }}
        className="absolute z-[1000] bg-white rounded-full p-3 shadow-lg border border-gray-200"
        style={{ bottom: selectedStore ? 'calc(45vh + 16px)' : 80, right: 16 }}
      >
        <Navigation size={20} className="text-blue-500" />
      </button>

      {/* 空狀態 */}
      {stores.length === 0 && !loadingStores && (
        <div className="absolute z-[1000] left-4 right-4 bg-white rounded-2xl p-6 shadow-lg text-center"
          style={{ bottom: 100 }}>
          <p className="text-4xl mb-2">📍</p>
          <p className="font-bold text-gray-700">附近還沒有店家資料</p>
          <p className="text-sm text-gray-400 mt-1">掃描更多收據來累積店家情報！</p>
        </div>
      )}

      {/* 店家詳情卡片 */}
      {selectedStore && (
        <div className="absolute bottom-0 left-0 right-0 z-[1000] bg-white rounded-t-2xl shadow-2xl border-t border-gray-200"
          style={{ height: '45vh' }}>
          {/* 拖曳把手 */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          <div className="px-4 pb-4 overflow-y-auto" style={{ maxHeight: 'calc(45vh - 20px)' }}>
            {/* 店名 + 關閉 */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="font-bold text-lg">{selectedStore.name}</h2>
                {selectedStore.branch && (
                  <p className="text-sm text-gray-500">{selectedStore.branch}</p>
                )}
              </div>
              <button
                onClick={() => setSelectedStore(null)}
                className="text-gray-400 text-xl p-1"
              >✕</button>
            </div>

            {/* 標籤 */}
            <div className="flex gap-2 mb-4">
              {selectedStore.is_tax_free && (
                <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                  免稅 Tax Free
                </span>
              )}
              <span className="px-2.5 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full">
                📊 {selectedStore.report_count} 筆回報
              </span>
              <span className="px-2.5 py-1 bg-gray-100 text-gray-500 text-xs rounded-full">
                🕐 {timeAgo(selectedStore.last_reported_at)}
              </span>
            </div>

            {/* 熱門商品 */}
            {selectedStore.topProducts && selectedStore.topProducts.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-bold text-gray-500 mb-2">🏷️ 熱門商品</h3>
                <div className="space-y-2">
                  {selectedStore.topProducts.map((product, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{product.translatedName}</p>
                        <p className="text-xs text-gray-400 truncate">{product.name}</p>
                      </div>
                      <span className="text-sm font-bold text-green-600 ml-3 shrink-0">
                        ¥{product.price.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 導航按鈕 */}
            <button
              onClick={() => openGoogleMaps(selectedStore)}
              className="w-full py-3 bg-blue-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2"
            >
              <Navigation size={16} />
              Google Maps 導航
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreMap;

import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, PenLine, Check, Plane, PlaneLanding, Trash2 } from 'lucide-react';
import type { SavedScan, Trip } from '../types';
import { getScanHistory, updateScan, deleteScan, getActiveTrip, startTrip, finishTrip, getTrips } from '../services/storage';
import { useT } from '../i18n/context';

const MOODS = ['😋', '😍', '🤤', '😊', '🥹', '😎', '🤩', '⛩️', '🍜', '🛍️'];

interface DiaryProps {
  onBack: () => void;
}

const modeIcon = (mode?: string) => {
  if (mode === 'receipt') return '🧾';
  if (mode === 'general') return '🌐';
  if (mode === 'ar-translate') return '📷';
  return '🍽';
};

const Diary = ({ onBack }: DiaryProps) => {
  useT(); // keep provider connected
  const [scans, setScans] = useState<SavedScan[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState('');
  const [draftMood, setDraftMood] = useState('');
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [pastTrips, setPastTrips] = useState<Trip[]>([]);
  const [showNewTrip, setShowNewTrip] = useState(false);
  const [newTripName, setNewTripName] = useState('');
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [finishedTrip, setFinishedTrip] = useState<Trip | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    getScanHistory().then(setScans);
    setActiveTrip(getActiveTrip());
    setPastTrips(getTrips());
  }, []);

  // Filter scans to active trip period
  const tripScans = useMemo(() => {
    if (!activeTrip) return scans;
    return scans.filter(s => s.timestamp >= activeTrip.startDate);
  }, [scans, activeTrip]);

  // Group by date
  const grouped = useMemo(() => {
    const g: Record<string, SavedScan[]> = {};
    tripScans.forEach(scan => {
      const date = new Date(scan.timestamp).toLocaleDateString();
      if (!g[date]) g[date] = [];
      g[date].push(scan);
    });
    return g;
  }, [tripScans]);

  const handleSaveNote = async (scan: SavedScan) => {
    const updated = { ...scan, note: draftNote, mood: draftMood };
    await updateScan(updated);
    setScans(prev => prev.map(s => s.id === scan.id ? updated : s));
    setEditingId(null);
  };

  const handleStartTrip = () => {
    const name = newTripName.trim() || `旅程 ${new Date().toLocaleDateString()}`;
    const trip = startTrip(name);
    setActiveTrip(trip);
    setShowNewTrip(false);
    setNewTripName('');
  };

  const handleFinishTrip = async () => {
    const finished = await finishTrip();
    if (finished) {
      setFinishedTrip(finished);
      setActiveTrip(null);
      setPastTrips(getTrips());
      setShowFinishConfirm(false);
    }
  };

  const tripDays = activeTrip
    ? Math.max(1, Math.ceil((Date.now() - activeTrip.startDate) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
              <ArrowLeft size={20} className="text-gray-700" />
            </button>
            <div>
              <h1 className="font-bold text-gray-900">旅遊日記</h1>
              {activeTrip && (
                <p className="text-xs text-orange-500 font-medium">
                  {activeTrip.name} · 第 {tripDays} 天
                </p>
              )}
            </div>
          </div>

          {/* Trip actions */}
          {activeTrip ? (
            <button
              onClick={() => setShowFinishConfirm(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-orange-50 text-orange-600 rounded-full text-xs font-bold hover:bg-orange-100"
            >
              <PlaneLanding size={14} /> 完成旅程
            </button>
          ) : (
            <button
              onClick={() => setShowNewTrip(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-orange-500 text-white rounded-full text-xs font-bold hover:bg-orange-600"
            >
              <Plane size={14} /> 開始旅程
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto">
        {/* New trip modal */}
        {showNewTrip && (
          <div className="mb-4 bg-white rounded-2xl p-4 border border-orange-200 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-2">✈️ 開始新旅程</h3>
            <input
              value={newTripName}
              onChange={e => setNewTripName(e.target.value)}
              placeholder="例：東京 5 日美食之旅"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:border-orange-500 focus:outline-none mb-3"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowNewTrip(false)} className="flex-1 py-2 text-sm text-gray-500 bg-gray-100 rounded-xl">取消</button>
              <button onClick={handleStartTrip} className="flex-1 py-2 text-sm text-white bg-orange-500 rounded-xl font-bold">出發！</button>
            </div>
          </div>
        )}

        {/* Finish trip confirmation */}
        {showFinishConfirm && (
          <div className="mb-4 bg-white rounded-2xl p-4 border border-red-200 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-1">🏁 完成旅程？</h3>
            <p className="text-xs text-gray-500 mb-3">統計將儲存，首頁數據歸零，開始新旅程。</p>
            <div className="flex gap-2">
              <button onClick={() => setShowFinishConfirm(false)} className="flex-1 py-2 text-sm text-gray-500 bg-gray-100 rounded-xl">再想想</button>
              <button onClick={handleFinishTrip} className="flex-1 py-2 text-sm text-white bg-red-500 rounded-xl font-bold">確認完成</button>
            </div>
          </div>
        )}

        {/* Finished trip summary */}
        {finishedTrip && (
          <div className="mb-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-4 border border-orange-200">
            <h3 className="font-bold text-gray-900 mb-2">🎉 {finishedTrip.name} 完成！</h3>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <p className="text-xl font-black text-orange-500">{finishedTrip.totalScans}</p>
                <p className="text-xs text-gray-500">次掃描</p>
              </div>
              <div>
                <p className="text-xl font-black text-orange-500">{finishedTrip.totalMeals}</p>
                <p className="text-xs text-gray-500">餐</p>
              </div>
              <div>
                <p className="text-xl font-black text-orange-500">
                  {Object.entries(finishedTrip.totalSpending).map(([c, a]) => `${c}${Math.round(a).toLocaleString()}`).join(' ')}
                </p>
                <p className="text-xs text-gray-500">消費</p>
              </div>
            </div>
            <button
              onClick={() => { setFinishedTrip(null); setShowNewTrip(true); }}
              className="w-full mt-3 py-2 bg-orange-500 text-white rounded-xl text-sm font-bold"
            >
              開始新旅程 ✈️
            </button>
          </div>
        )}

        {/* No trip active and no scans */}
        {!activeTrip && tripScans.length === 0 && !finishedTrip && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">✈️</p>
            <p className="font-bold text-gray-400">還沒有旅程</p>
            <p className="text-sm text-gray-300 mt-1">點「開始旅程」記錄你的旅行</p>
          </div>
        )}

        {/* Past trips */}
        {!activeTrip && pastTrips.length > 0 && !finishedTrip && (
          <div className="mb-4">
            <h3 className="text-sm font-bold text-gray-400 mb-2">過去的旅程</h3>
            <div className="space-y-2">
              {pastTrips.map(trip => (
                <div key={trip.id} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold text-sm text-gray-900">{trip.name}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(trip.startDate).toLocaleDateString()} ~ {trip.endDate ? new Date(trip.endDate).toLocaleDateString() : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">{trip.totalScans} 掃描 · {trip.totalMeals} 餐</p>
                      {Object.entries(trip.totalSpending).map(([c, a]) => (
                        <p key={c} className="text-sm font-bold text-orange-500">{c}{Math.round(a).toLocaleString()}</p>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Diary entries */}
        {Object.entries(grouped).map(([date, items]) => (
          <div key={date} className="mb-6">
            {/* Date header */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-orange-400" />
              <span className="text-xs font-bold text-gray-400">{date}</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <div className="space-y-3">
              {items.map(scan => {
                const isEditing = editingId === scan.id;
                const isExpanded = expandedId === scan.id;

                return (
                  <div
                    key={scan.id}
                    className={`bg-white rounded-2xl overflow-hidden border transition-all ${
                      isEditing ? 'border-orange-300 shadow-lg' : 'border-gray-100 shadow-sm'
                    }`}
                  >
                    {/* Main card — tap to expand */}
                    <button
                      onClick={() => !isEditing && setExpandedId(isExpanded ? null : scan.id)}
                      className="w-full text-left p-4"
                    >
                      <div className="flex gap-3">
                        {scan.images[0] && (
                          <img src={scan.images[0]} alt="" className="w-20 h-20 rounded-xl object-cover bg-gray-100 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-base">{modeIcon(scan.scanMode)}</span>
                            <h3 className="font-bold text-base text-gray-900 truncate">
                              {String(scan.restaurantName || '掃描紀錄').replace(/\[Native\]\s?|\[Cloud\]\s?/g, '')}
                            </h3>
                          </div>
                          <p className="text-sm text-gray-400">
                            {new Date(scan.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {scan.items.length > 0 && ` · ${scan.items.length} 項`}
                            {scan.scanMode === 'ar-translate' && scan.arTranslateItems && ` · ${scan.arTranslateItems.length} 段翻譯`}
                          </p>
                          {scan.mood && <span className="text-base">{scan.mood}</span>}
                          {scan.note && (
                            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{String(scan.note)}</p>
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Expanded content */}
                    {isExpanded && !isEditing && (
                      <div className="px-3 pb-3 border-t border-gray-50">
                        {/* Items preview */}
                        {scan.items.length > 0 && (
                          <div className="mt-3 space-y-1.5">
                            {scan.items.slice(0, 5).map((item, i) => (
                              <div key={i} className="flex justify-between text-sm">
                                <span className="text-gray-700 truncate">{item.translatedName}</span>
                                <span className="text-gray-400 shrink-0 ml-2">{item.price ? `¥${item.price}` : ''}</span>
                              </div>
                            ))}
                            {scan.items.length > 5 && (
                              <p className="text-sm text-gray-300">+{scan.items.length - 5} 項...</p>
                            )}
                          </div>
                        )}

                        {/* AR Translate results */}
                        {scan.scanMode === 'ar-translate' && scan.arTranslateItems && scan.arTranslateItems.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {scan.arTranslateItems.map((item, i) => (
                              <div key={i} className="p-3 bg-gray-50 rounded-xl">
                                <p className="text-base text-gray-900 font-medium">{item.translated}</p>
                                <p className="text-sm text-gray-400 mt-1">{item.original}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Note display */}
                        {scan.note && (
                          <div className="mt-2 p-2 bg-amber-50 rounded-lg">
                            <p className="text-xs text-gray-600">{scan.mood} {String(scan.note)}</p>
                          </div>
                        )}

                        {/* Edit button */}
                        <div className="mt-3 flex items-center justify-between">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingId(scan.id);
                              setDraftNote(scan.note || '');
                              setDraftMood(scan.mood || '');
                            }}
                            className="flex items-center gap-1 text-sm text-orange-500 font-medium"
                          >
                            <PenLine size={14} /> 寫筆記
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (confirm('確定要刪除這筆紀錄嗎？')) {
                                await deleteScan(scan.id);
                                setScans(prev => prev.filter(s => s.id !== scan.id));
                                setExpandedId(null);
                              }
                            }}
                            className="flex items-center gap-1 text-sm text-red-400 hover:text-red-600 font-medium"
                          >
                            <Trash2 size={14} /> 刪除
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Editing mode */}
                    {isEditing && (
                      <div className="px-3 pb-3 space-y-3 border-t border-orange-100">
                        {/* Mood picker */}
                        <div className="flex gap-2 overflow-x-auto pt-2 no-scrollbar">
                          {MOODS.map(m => (
                            <button
                              key={m}
                              onClick={() => setDraftMood(draftMood === m ? '' : m)}
                              className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-lg ${
                                draftMood === m ? 'bg-orange-100 ring-2 ring-orange-400' : 'bg-gray-50'
                              }`}
                            >
                              {m}
                            </button>
                          ))}
                        </div>

                        {/* Note input */}
                        <textarea
                          value={draftNote}
                          onChange={e => setDraftNote(e.target.value)}
                          placeholder="記錄這個瞬間..."
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:border-orange-500 focus:outline-none"
                        />

                        {/* Save/Cancel */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingId(null)}
                            className="flex-1 py-2 text-sm text-gray-500 bg-gray-100 rounded-xl"
                          >
                            取消
                          </button>
                          <button
                            onClick={() => handleSaveNote(scan)}
                            className="flex-1 py-2 text-sm text-white bg-orange-500 rounded-xl font-bold flex items-center justify-center gap-1"
                          >
                            <Check size={14} /> 儲存
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Diary;

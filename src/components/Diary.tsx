import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, PenLine, Check, Plane, PlaneLanding, Trash2 } from 'lucide-react';
import type { SavedScan, Trip } from '../types';
import { getScanHistory, updateScan, deleteScan, getActiveTrip, startTrip, finishTrip, getTrips } from '../services/storage';
import { useT } from '../i18n/context';

const MOODS = ['😋', '😍', '🤤', '😊', '🥹', '😎', '🤩', '⛩️', '🍜', '🛍️'];

interface DiaryProps {
  onBack: () => void;
}

const modeConfig = (mode?: string) => {
  switch (mode) {
    case 'receipt': return { icon: '🛍️', label: '購物', color: 'bg-pink-500' };
    case 'general': return { icon: '⛩️', label: '翻譯', color: 'bg-blue-500' };
    case 'ar-translate': return { icon: '📷', label: 'AR', color: 'bg-purple-500' };
    case 'chat': return { icon: '💬', label: '對話', color: 'bg-green-500' };
    default: return { icon: '🍜', label: '美食', color: 'bg-orange-500' };
  }
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
        {/* Trip stats summary */}
        {tripScans.length > 0 && (
          <div className="grid grid-cols-4 gap-2 text-center mb-4">
            <div className="bg-orange-50 rounded-xl py-2">
              <p className="text-xl font-black text-orange-500">{tripScans.filter(s => (s.scanMode || 'menu') === 'menu').length}</p>
              <p className="text-[10px] text-gray-500">🍜 餐</p>
            </div>
            <div className="bg-pink-50 rounded-xl py-2">
              <p className="text-xl font-black text-pink-500">{tripScans.filter(s => s.scanMode === 'receipt').length}</p>
              <p className="text-[10px] text-gray-500">🛍️ 購物</p>
            </div>
            <div className="bg-blue-50 rounded-xl py-2">
              <p className="text-xl font-black text-blue-500">{tripScans.filter(s => s.scanMode === 'general' || s.scanMode === 'ar-translate').length}</p>
              <p className="text-[10px] text-gray-500">📸 翻譯</p>
            </div>
            <div className="bg-green-50 rounded-xl py-2">
              <p className="text-xl font-black text-green-500">{tripScans.filter(s => s.scanMode === 'chat').length}</p>
              <p className="text-[10px] text-gray-500">💬 對話</p>
            </div>
          </div>
        )}

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

        {/* Diary timeline */}
        {Object.entries(grouped).map(([date, items]) => {
          // Day stats
          const menuCount = items.filter(s => (s.scanMode || 'menu') === 'menu').length;
          const receiptCount = items.filter(s => s.scanMode === 'receipt').length;
          const chatCount = items.filter(s => s.scanMode === 'chat').length;
          const totalSpent = items
            .filter(s => s.scanMode === 'receipt' && s.receiptData?.totalAmount)
            .reduce((sum, s) => sum + (parseFloat(String(s.receiptData?.totalAmount || 0)) || 0), 0);

          return (
          <div key={date} className="mb-8">
            {/* Date header + stats */}
            <div className="mb-4">
              <h3 className="text-sm font-bold text-gray-800">{date}</h3>
              <div className="flex gap-2 mt-1 text-xs text-gray-400 flex-wrap">
                {menuCount > 0 && <span>🍜 {menuCount}餐</span>}
                {receiptCount > 0 && <span>🛍️ {receiptCount}購物</span>}
                {chatCount > 0 && <span>💬 {chatCount}對話</span>}
                {items.length - menuCount - receiptCount - chatCount > 0 && <span>📸 {items.length - menuCount - receiptCount - chatCount}翻譯</span>}
                {totalSpent > 0 && <span>· ¥{Math.round(totalSpent).toLocaleString()}</span>}
              </div>
            </div>

            {/* Timeline entries */}
            <div className="relative pl-6">
              {/* Vertical line */}
              <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-orange-200" />

              <div className="space-y-4">
                {items.map(scan => {
                  const isEditing = editingId === scan.id;
                  const isExpanded = expandedId === scan.id;
                  const mode = modeConfig(scan.scanMode);
                  const time = new Date(scan.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const name = String(scan.restaurantName || '掃描紀錄').replace(/\[Native\]\s?|\[Cloud\]\s?/g, '');

                  // Content summary based on scan type
                  const getSummary = () => {
                    if (scan.scanMode === 'receipt' && scan.receiptData) {
                      const itemNames = scan.receiptData.items?.slice(0, 3).map(i => i.translatedName || i.originalName).join('、') || '';
                      const more = (scan.receiptData.items?.length || 0) > 3 ? `...等${scan.receiptData.items?.length}項` : '';
                      return itemNames + more;
                    }
                    if ((scan.scanMode || 'menu') === 'menu' && scan.items.length > 0) {
                      return scan.items.slice(0, 3).map(i => i.translatedName).join('、') + (scan.items.length > 3 ? `...等${scan.items.length}道` : '');
                    }
                    if (scan.scanMode === 'general' && scan.generalData) {
                      return scan.generalData.items?.[0]?.translatedText?.substring(0, 40) || '';
                    }
                    if (scan.scanMode === 'ar-translate' && scan.arTranslateItems) {
                      return `${scan.arTranslateItems.length} 段翻譯`;
                    }
                    if (scan.scanMode === 'chat' && scan.chatMessages) {
                      const last = scan.chatMessages[scan.chatMessages.length - 1];
                      return last ? `「${last.original.substring(0, 30)}」` : '';
                    }
                    return '';
                  };

                  const getAmount = () => {
                    if (scan.scanMode === 'receipt' && scan.receiptData?.totalAmount) {
                      return `¥${Math.round(parseFloat(String(scan.receiptData.totalAmount))).toLocaleString()}`;
                    }
                    if ((scan.scanMode || 'menu') === 'menu' && scan.items.length > 0) {
                      const total = scan.items.reduce((s, i) => s + (parseFloat(String(i.price || 0)) || 0), 0);
                      return total > 0 ? `¥${Math.round(total).toLocaleString()}` : '';
                    }
                    return '';
                  };

                  return (
                    <div key={scan.id} className="relative">
                      {/* Timeline dot */}
                      <div className={`absolute -left-6 top-3 w-[18px] h-[18px] rounded-full ${mode.color} flex items-center justify-center`}>
                        <span className="text-[10px]">{mode.icon}</span>
                      </div>

                      {/* Card */}
                      <div className={`bg-white rounded-2xl overflow-hidden border transition-all ${
                        isEditing ? 'border-orange-300 shadow-lg' : 'border-gray-100 shadow-sm'
                      }`}>
                        <button
                          onClick={() => !isEditing && setExpandedId(isExpanded ? null : scan.id)}
                          className="w-full text-left p-3"
                        >
                          <div className="flex gap-3">
                            {scan.images[0] && (
                              <img src={scan.images[0]} alt="" className="w-16 h-16 rounded-xl object-cover bg-gray-100 shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <h3 className="font-bold text-sm text-gray-900 truncate">{name}</h3>
                                <span className="text-xs text-gray-400 shrink-0">{time}</span>
                              </div>
                              {getSummary() && (
                                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{getSummary()}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                {getAmount() && <span className="text-xs font-bold text-orange-500">{getAmount()}</span>}
                                {scan.mood && <span className="text-sm">{scan.mood}</span>}
                                {scan.note && <span className="text-xs text-gray-400 truncate">{String(scan.note)}</span>}
                              </div>
                            </div>
                          </div>
                        </button>

                        {/* Expanded content */}
                        {isExpanded && !isEditing && (
                          <div className="px-3 pb-3 border-t border-gray-50">
                            {/* Menu items */}
                            {(scan.scanMode || 'menu') === 'menu' && scan.items.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {scan.items.slice(0, 8).map((item, i) => (
                                  <div key={i} className="flex justify-between text-xs">
                                    <span className="text-gray-700 truncate">{item.translatedName}</span>
                                    <span className="text-gray-400 shrink-0 ml-2">{item.price ? `¥${item.price}` : ''}</span>
                                  </div>
                                ))}
                                {scan.items.length > 8 && <p className="text-xs text-gray-300">+{scan.items.length - 8} 項...</p>}
                              </div>
                            )}

                            {/* Receipt items */}
                            {scan.scanMode === 'receipt' && scan.receiptData?.items && (
                              <div className="mt-2 space-y-1">
                                {scan.receiptData.items.slice(0, 8).map((item, i) => (
                                  <div key={i} className="flex justify-between text-xs">
                                    <span className="text-gray-700 truncate">{item.translatedName || item.originalName}</span>
                                    <span className="text-gray-400 shrink-0 ml-2">¥{item.price}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* General translation */}
                            {scan.scanMode === 'general' && scan.generalData?.items && (
                              <div className="mt-2 space-y-2">
                                {scan.generalData.items.slice(0, 3).map((item, i) => (
                                  <div key={i} className="p-2 bg-gray-50 rounded-lg">
                                    <p className="text-xs text-gray-900">{item.translatedText}</p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">{item.originalText}</p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* AR Translate */}
                            {scan.scanMode === 'ar-translate' && scan.arTranslateItems && (
                              <div className="mt-2 space-y-2">
                                {scan.arTranslateItems.slice(0, 5).map((item, i) => (
                                  <div key={i} className="p-2 bg-gray-50 rounded-lg">
                                    <p className="text-xs text-gray-900">{item.translated}</p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">{item.original}</p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Chat messages */}
                            {scan.scanMode === 'chat' && scan.chatMessages && (
                              <div className="mt-2 space-y-1.5">
                                {scan.chatMessages.slice(0, 6).map((msg, i) => (
                                  <div key={i} className={`p-2 rounded-lg text-xs ${msg.role === 'user' ? 'bg-orange-50 text-gray-800' : 'bg-gray-50 text-gray-800'}`}>
                                    <span className="font-medium">{msg.role === 'user' ? '你' : '店員'}：</span>
                                    {msg.original}
                                    <span className="text-gray-400"> → {msg.translated}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Note */}
                            {scan.note && (
                              <div className="mt-2 p-2 bg-amber-50 rounded-lg">
                                <p className="text-xs text-gray-600">{scan.mood} {String(scan.note)}</p>
                              </div>
                            )}

                            {/* Actions */}
                            <div className="mt-3 flex items-center justify-between">
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingId(scan.id); setDraftNote(scan.note || ''); setDraftMood(scan.mood || ''); }}
                                className="flex items-center gap-1 text-xs text-orange-500 font-medium"
                              >
                                <PenLine size={12} /> 寫筆記
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
                                className="flex items-center gap-1 text-xs text-red-400 font-medium"
                              >
                                <Trash2 size={12} /> 刪除
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Editing mode */}
                        {isEditing && (
                          <div className="px-3 pb-3 space-y-3 border-t border-orange-100">
                            <div className="flex gap-2 overflow-x-auto pt-2 no-scrollbar">
                              {MOODS.map(m => (
                                <button key={m} onClick={() => setDraftMood(draftMood === m ? '' : m)}
                                  className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-base ${draftMood === m ? 'bg-orange-100 ring-2 ring-orange-400' : 'bg-gray-50'}`}
                                >{m}</button>
                              ))}
                            </div>
                            <textarea value={draftNote} onChange={e => setDraftNote(e.target.value)} placeholder="記錄這個瞬間..." rows={2}
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:border-orange-500 focus:outline-none" />
                            <div className="flex gap-2">
                              <button onClick={() => setEditingId(null)} className="flex-1 py-2 text-sm text-gray-500 bg-gray-100 rounded-xl">取消</button>
                              <button onClick={() => handleSaveNote(scan)} className="flex-1 py-2 text-sm text-white bg-orange-500 rounded-xl font-bold flex items-center justify-center gap-1">
                                <Check size={14} /> 儲存
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
};

export default Diary;

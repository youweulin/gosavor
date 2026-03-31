import { useState, useEffect } from 'react';
import { ArrowLeft, PenLine, Check, X } from 'lucide-react';
import type { SavedScan } from '../types';
import { getScanHistory, updateScan } from '../services/storage';
import { useT } from '../i18n/context';

const MOODS = ['😋', '😍', '🤤', '😊', '🥹', '😎', '🤩', '⛩️', '🍜', '🛍️', '📸', '✨'];

interface DiaryProps {
  onBack: () => void;
}

const Diary = ({ onBack }: DiaryProps) => {
  const t = useT();
  const [scans, setScans] = useState<SavedScan[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState('');
  const [draftMood, setDraftMood] = useState('');

  useEffect(() => {
    getScanHistory().then(setScans);
  }, []);

  const startEdit = (scan: SavedScan) => {
    setEditingId(scan.id);
    setDraftNote(scan.note || '');
    setDraftMood(scan.mood || '');
  };

  const saveNote = async (scan: SavedScan) => {
    const updated = { ...scan, note: draftNote, mood: draftMood };
    await updateScan(updated);
    setScans(prev => prev.map(s => s.id === scan.id ? updated : s));
    setEditingId(null);
  };

  // Group by date
  const grouped = scans.reduce<Record<string, SavedScan[]>>((acc, scan) => {
    const date = new Date(scan.timestamp).toLocaleDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(scan);
    return acc;
  }, {});

  const modeLabel = (mode?: string) => {
    if (mode === 'receipt') return '🧾';
    if (mode === 'general') return '🔍';
    return '🍽️';
  };

  return (
    <div className="min-h-screen bg-amber-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-amber-50/90 backdrop-blur-sm px-4 py-4 flex items-center gap-3 border-b border-amber-200">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-amber-100">
          <ArrowLeft size={20} className="text-amber-800" />
        </button>
        <div>
          <h1 className="font-bold text-lg text-amber-900">🗓️ {t('diary.title')}</h1>
          <p className="text-xs text-amber-600">{scans.length} {t('diary.entries')}</p>
        </div>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto">
        {scans.length === 0 ? (
          <div className="text-center py-16 text-amber-600/50">
            <p className="text-4xl mb-3">📖</p>
            <p>{t('diary.empty')}</p>
            <p className="text-sm mt-1">{t('diary.emptyHint')}</p>
          </div>
        ) : (
          Object.entries(grouped).map(([date, items]) => (
            <div key={date} className="mb-6">
              {/* Date header */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-sm font-bold text-amber-800">{date}</span>
                <div className="flex-1 h-px bg-amber-200" />
              </div>

              <div className="space-y-3 ml-3 border-l-2 border-amber-200 pl-4">
                {items.map(scan => {
                  const isEditing = editingId === scan.id;
                  return (
                    <div key={scan.id} className="bg-white rounded-xl shadow-sm border border-amber-100 overflow-hidden">
                      {/* Photo + Info */}
                      <div className="flex gap-3 p-3">
                        {scan.images[0] && (
                          <img src={scan.images[0]} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span>{modeLabel(scan.scanMode)}</span>
                            <span className="font-bold text-sm text-gray-900 truncate">{scan.restaurantName}</span>
                          </div>
                          <p className="text-xs text-gray-400">
                            {new Date(scan.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {scan.items.length > 0 && ` · ${scan.items.length} items`}
                          </p>
                          {/* Mood + Note display */}
                          {!isEditing && (scan.mood || scan.note) && (
                            <div className="mt-1">
                              {scan.mood && <span className="text-lg mr-1">{scan.mood}</span>}
                              {scan.note && <span className="text-sm text-gray-600">{scan.note}</span>}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Edit mode */}
                      {isEditing ? (
                        <div className="px-3 pb-3 space-y-2">
                          {/* Mood picker */}
                          <div className="flex gap-1 flex-wrap">
                            {MOODS.map(m => (
                              <button
                                key={m}
                                onClick={() => setDraftMood(draftMood === m ? '' : m)}
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-lg transition-all ${
                                  draftMood === m ? 'bg-amber-100 scale-125' : 'hover:bg-gray-100'
                                }`}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                          <textarea
                            value={draftNote}
                            onChange={e => setDraftNote(e.target.value)}
                            placeholder={t('diary.placeholder')}
                            rows={2}
                            className="w-full px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm focus:border-amber-400 focus:outline-none resize-none"
                          />
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => setEditingId(null)} className="px-3 py-1 rounded-lg text-xs text-gray-500 hover:bg-gray-100">
                              <X size={14} />
                            </button>
                            <button onClick={() => saveNote(scan)} className="px-3 py-1 bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center gap-1">
                              <Check size={14} /> {t('diary.save')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(scan)}
                          className="w-full px-3 py-2 border-t border-amber-50 text-xs text-amber-500 hover:bg-amber-50 flex items-center justify-center gap-1"
                        >
                          <PenLine size={12} /> {scan.note ? t('diary.edit') : t('diary.addNote')}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Diary;

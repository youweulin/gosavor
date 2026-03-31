import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, PenLine, Check, Calendar, Filter } from 'lucide-react';
import type { SavedScan } from '../types';
import { getScanHistory, updateScan } from '../services/storage';
import { useT } from '../i18n/context';

const MOODS = ['😋', '😍', '🤤', '😊', '🥹', '😎', '🤩', '⛩️', '🍜', '🛍️', '📸', '✨'];
const CATEGORY_TAGS = [
  { id: 'food', icon: '🍜' },
  { id: 'sight', icon: '⛩️' },
  { id: 'buy', icon: '🛍️' },
  { id: 'relax', icon: '✨' },
  { id: 'hotel', icon: '🏨' },
  { id: 'walk', icon: '🚶' }
];

interface DiaryProps {
  onBack: () => void;
}

const Diary = ({ onBack }: DiaryProps) => {
  const t = useT();
  const [scans, setScans] = useState<SavedScan[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState('');
  const [draftMood, setDraftMood] = useState('');
  const [draftTags, setDraftTags] = useState<string[]>([]);
  
  // Filtering states
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [filterTag, setFilterTag] = useState<string | null>(null);

  useEffect(() => {
    getScanHistory().then(setScans);
  }, []);

  // All unique dates for the quick picker
  const allDates = useMemo(() => {
    const dates = scans.map(s => new Date(s.timestamp).toLocaleDateString());
    return Array.from(new Set(dates)).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [scans]);

  const startEdit = (scan: SavedScan) => {
    setEditingId(scan.id);
    setDraftNote(scan.note || '');
    setDraftMood(scan.mood || '');
    setDraftTags(scan.tags || []);
  };

  const toggleDraftTag = (tagId: string) => {
    setDraftTags(prev => 
      prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]
    );
  };

  const saveNote = async (scan: SavedScan) => {
    const updated = { ...scan, note: draftNote, mood: draftMood, tags: draftTags };
    await updateScan(updated);
    setScans(prev => prev.map(s => s.id === scan.id ? updated : s));
    setEditingId(null);
  };

  // Filter and group
  const filteredScans = useMemo(() => {
    return scans.filter(scan => {
      const dateMatch = !filterDate || new Date(scan.timestamp).toLocaleDateString() === filterDate;
      const tagMatch = !filterTag || scan.tags?.includes(filterTag);
      return dateMatch && tagMatch;
    });
  }, [scans, filterDate, filterTag]);

  const grouped = filteredScans.reduce<Record<string, SavedScan[]>>((acc, scan) => {
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
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white shadow-sm px-4 pt-4 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-bold text-lg text-slate-900 tracking-tight">{t('diary.title')}</h1>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">{scans.length} {t('diary.entries')}</p>
          </div>
        </div>

        {/* Quick Date Picker */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar border-b border-slate-50 mb-2">
          <button
            onClick={() => setFilterDate(null)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
              filterDate === null 
                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100 scale-105' 
                : 'bg-white text-slate-500 border-slate-200 hover:border-blue-200'
            }`}
          >
            {t('diary.allDates')}
          </button>
          {allDates.map(date => (
            <button
              key={date}
              onClick={() => setFilterDate(date)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                filterDate === date 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100 scale-105' 
                  : 'bg-white text-slate-500 border-slate-200 hover:border-blue-200'
              }`}
            >
              <span className="opacity-70 mr-1.5 text-[8px]">●</span>
              {date}
            </button>
          ))}
        </div>

        {/* Category Picker */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
          {CATEGORY_TAGS.map(tag => (
            <button
              key={tag.id}
              onClick={() => setFilterTag(filterTag === tag.id ? null : tag.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterTag === tag.id 
                  ? 'bg-indigo-50 text-indigo-700 ring-2 ring-indigo-500 ring-offset-1' 
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              <span>{tag.icon}</span>
              {t(`diary.tag.${tag.id}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-6 max-w-lg mx-auto">
        {filteredScans.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
              <Filter size={32} />
            </div>
            <p className="font-bold text-slate-400">{t('diary.empty')}</p>
            <p className="text-xs text-slate-300 mt-1">{t('diary.emptyHint')}</p>
          </div>
        ) : (
          Object.entries(grouped).map(([date, items]) => (
            <div key={date} className="mb-10">
              {/* Date divider */}
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-slate-200 h-px flex-1" />
                <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full border border-slate-200">
                  <Calendar size={12} className="text-slate-400" />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">{date}</span>
                </div>
                <div className="bg-slate-200 h-px flex-1" />
              </div>

              <div className="space-y-6">
                {items.map(scan => {
                  const isEditing = editingId === scan.id;
                  return (
                    <div key={scan.id} className={`group relative bg-white rounded-3xl overflow-hidden transition-all duration-300 ${isEditing ? 'ring-2 ring-blue-500 shadow-xl' : 'shadow-sm hover:shadow-md border border-slate-100'}`}>
                      {/* Photo + Info section */}
                      <div className="p-4">
                        <div className="flex gap-4">
                          {scan.images[0] && (
                            <div className="relative shrink-0">
                              <img src={scan.images[0]} alt="" className="w-20 h-20 rounded-2xl object-cover shadow-sm bg-slate-100" />
                              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-sm text-xs">
                                {modeLabel(scan.scanMode)}
                              </div>
                            </div>
                          )}
                          <div className="flex-1 min-w-0 pt-1">
                            <h3 className="font-black text-slate-900 leading-tight truncate mb-1 pr-8">
                              {scan.restaurantName || 'Scan Analysis'}
                            </h3>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-bold">
                                {new Date(scan.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {scan.items.length > 0 && (
                                <span className="text-[9px] text-slate-400 font-medium">· {scan.items.length} dishes</span>
                              )}
                            </div>
                            
                            {/* Display Tags */}
                            {scan.tags && scan.tags.length > 0 && !isEditing && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {scan.tags.map(tid => (
                                  <span key={tid} className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">
                                    #{t(`diary.tag.${tid}`).split(' ')[0]}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Note area */}
                        {!isEditing ? (
                          (scan.note || scan.mood) && (
                            <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-100 relative">
                              <div className="absolute -top-3 left-3 text-2xl">{scan.mood}</div>
                              <p className="text-sm text-slate-700 leading-relaxed pt-1">
                                {scan.note}
                              </p>
                            </div>
                          )
                        ) : (
                          <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            {/* Mood selector */}
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Mood / Vibe</label>
                              <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
                                {MOODS.map(m => (
                                  <button
                                    key={m}
                                    onClick={() => setDraftMood(draftMood === m ? '' : m)}
                                    className={`w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center text-xl transition-all ${
                                      draftMood === m ? 'bg-blue-100 border-2 border-blue-500 scale-110' : 'bg-slate-50 hover:bg-slate-100'
                                    }`}
                                  >
                                    {m}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Tag selector */}
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('diary.tags')}</label>
                              <div className="flex gap-2 flex-wrap">
                                {CATEGORY_TAGS.map(tag => (
                                  <button
                                    key={tag.id}
                                    onClick={() => toggleDraftTag(tag.id)}
                                    className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                      draftTags.includes(tag.id)
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                    }`}
                                  >
                                    <span>{tag.icon}</span>
                                    {t(`diary.tag.${tag.id}`)}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Text input */}
                            <div className="relative">
                              <textarea
                                value={draftNote}
                                onChange={e => setDraftNote(e.target.value)}
                                placeholder={t('diary.placeholder')}
                                rows={3}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none transition-all resize-none"
                                autoFocus
                              />
                            </div>

                            <div className="flex gap-2 justify-end pt-1">
                              <button onClick={() => setEditingId(null)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-100 transition-colors">
                                {t('checkout.back')}
                              </button>
                              <button onClick={() => saveNote(scan)} className="px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2">
                                <Check size={14} /> {t('diary.save')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {!isEditing && (
                        <button
                          onClick={() => startEdit(scan)}
                          className="absolute top-4 right-4 p-2 bg-slate-50 hover:bg-white hover:shadow-md text-slate-400 hover:text-blue-500 rounded-xl transition-all"
                        >
                          <PenLine size={16} />
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

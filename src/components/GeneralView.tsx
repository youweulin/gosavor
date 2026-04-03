import { useState } from 'react';
import { Sparkles, Info, Volume2, MapPin } from 'lucide-react';
import type { GeneralAnalysisResult } from '../types';
import { useT } from '../i18n/context';

interface GeneralViewProps {
  data: GeneralAnalysisResult;
}

const isMedicineOrBeauty = (category?: string) =>
  ['Medicine', 'Beauty', 'Snack'].includes(category || '');

const GeneralView = ({ data }: GeneralViewProps) => {
  const speakText = (text: string) => {
    const u = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(u);
  };

  const isAR = data.items.some(item => item.category === 'AR');

  return (
    <div className="max-w-md mx-auto space-y-3">
      {data.locationGuess && (
        <div className="flex items-center gap-2 text-sm text-gray-500 px-1">
          <MapPin size={14} />
          <span>{data.locationGuess}</span>
        </div>
      )}
      {isAR ? (
        // AR translate: numbered cards for easy image-text matching
        <div className="space-y-2">
          {data.items.map((item, idx) => (
            <div key={idx} className="bg-white rounded-xl border border-gray-200 p-3">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-gray-900 leading-snug">{item.translatedText}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <p className="text-xs text-gray-400 truncate">{item.originalText}</p>
                    <button
                      onClick={() => speakText(item.originalText)}
                      className="text-gray-300 hover:text-orange-500 p-0.5 flex-shrink-0"
                    >
                      <Volume2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        data.items.map((item, idx) =>
          item.category === 'Fortune' ? (
            <FortuneCard key={idx} item={item} />
          ) : isMedicineOrBeauty(item.category) ? (
            <MedicineCard key={idx} item={item} onSpeak={speakText} />
          ) : (
            <GeneralCard key={idx} item={item} onSpeak={speakText} />
          )
        )
      )}
    </div>
  );
};

// === Parse structured explanation into sections ===
function parseSections(explanation: string): { title: string; content: string; icon: string }[] {
  const sections: { title: string; content: string; icon: string }[] = [];
  const lines = explanation.split('\n');
  let currentTitle = '';
  let currentContent: string[] = [];
  let currentIcon = '💊';

  const iconMap: Record<string, string> = {
    '主要功效': '💊', '功效': '💊',
    '主要成分': '🧪', '成分': '🧪',
    '用法用量': '⏰', '使用方式': '⏰',
    '注意事項': '⚠️', '警告': '⚠️',
    '類別': '🏷️', '產品類型': '🏷️',
    '適合膚質': '✨',
    '口味': '🍬', '風味': '🍬',
    '過敏原': '⚠️', '保存方式': '📦',
    '營養': '📊',
  };

  const flush = () => {
    if (currentTitle && currentContent.length > 0) {
      sections.push({
        title: currentTitle,
        content: currentContent.join('\n').trim(),
        icon: currentIcon,
      });
    }
    currentContent = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    // Match **title：** or **title:**
    const match = trimmed.match(/^\*\*(.+?)[：:]\s*\*\*\s*(.*)/);
    if (match) {
      flush();
      currentTitle = match[1].trim();
      currentIcon = iconMap[currentTitle] || '📋';
      if (match[2].trim()) currentContent.push(match[2].trim());
    } else if (trimmed.startsWith('💊') || trimmed.startsWith('💄') || trimmed.startsWith('🍬')) {
      // Skip the emoji product name line (already shown as title)
      continue;
    } else if (trimmed) {
      // Strip markdown bold markers: **text** → text, * **text:** → text:
      const cleaned = trimmed
        .replace(/^\*\s*/, '')        // leading "* "
        .replace(/\*\*/g, '')         // all **
        .trim();
      if (cleaned) currentContent.push(cleaned);
    }
  }
  flush();
  return sections;
}

// === Medicine / Beauty / Snack — Kuli Kuli style card ===
const MedicineCard = ({ item, onSpeak }: { item: GeneralAnalysisResult['items'][0]; onSpeak: (text: string) => void }) => {
  const t = useT();
  const sections = parseSections(item.explanation || '');

  const categoryConfig: Record<string, { color: string; bg: string; border: string; headerBg: string }> = {
    Medicine: { color: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200', headerBg: 'bg-gradient-to-r from-sky-500 to-sky-600' },
    Beauty: { color: 'text-pink-700', bg: 'bg-pink-50', border: 'border-pink-200', headerBg: 'bg-gradient-to-r from-pink-500 to-pink-600' },
    Snack: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', headerBg: 'bg-gradient-to-r from-amber-500 to-amber-600' },
  };
  const cfg = categoryConfig[item.category] || categoryConfig.Medicine;

  const categoryLabel: Record<string, string> = {
    Medicine: '產品介紹',
    Beauty: '美妝介紹',
    Snack: '零食介紹',
  };

  return (
    <div className={`rounded-2xl overflow-hidden border ${cfg.border} shadow-lg bg-white`}>
      {/* Header */}
      <div className={`${cfg.headerBg} px-5 py-3`}>
        <div className="flex items-center justify-between">
          <p className="text-white/80 text-xs font-bold uppercase tracking-wider">
            {categoryLabel[item.category] || '產品介紹'}
          </p>
          <span className="text-white/60 text-xs">
            {item.category}
          </span>
        </div>
      </div>

      {/* Product name */}
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-xl font-black text-gray-900 mb-1">
          {item.translatedText}
        </h2>
        <div className="flex items-center gap-2">
          <p className="text-sm text-gray-400 border-l-2 border-gray-200 pl-2">
            {item.originalText}
          </p>
          <button
            onClick={() => onSpeak(item.originalText)}
            className="text-gray-300 hover:text-gray-600 p-1"
          >
            <Volume2 size={14} />
          </button>
        </div>
      </div>

      {/* Structured sections */}
      <div className="divide-y divide-gray-100">
        {sections.map((section, i) => (
          <div key={i} className="px-5 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">{section.icon}</span>
              <h4 className={`text-sm font-bold ${cfg.color}`}>{section.title}</h4>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line pl-7">
              {section.content}
            </p>
          </div>
        ))}
      </div>

      {/* Fallback if no sections parsed */}
      {sections.length === 0 && item.explanation && (
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={16} className={cfg.color} />
            <h4 className={`text-sm font-bold ${cfg.color}`}>{t('general.aiExplain')}</h4>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
            {item.explanation}
          </p>
        </div>
      )}
    </div>
  );
};

// === Fortune Slip — premium design ===
const FortuneCard = ({ item }: { item: GeneralAnalysisResult['items'][0] }) => {
  const t = useT();

  return (
    <div className="rounded-2xl overflow-hidden border border-amber-200 shadow-lg bg-gradient-to-b from-amber-50 to-white">
      <div className="bg-gradient-to-r from-red-700 to-red-800 px-5 py-4 text-center">
        <p className="text-amber-200 text-xs tracking-widest uppercase mb-1">御神籤 · OMIKUJI</p>
        <h2 className="text-2xl font-black text-white">{item.translatedText}</h2>
      </div>
      <div className="px-5 py-4 border-b border-amber-100">
        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap font-serif">{item.originalText}</p>
      </div>
      {item.explanation && (
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-amber-600" />
            <h4 className="text-sm font-bold text-amber-800">{t('general.aiExplain')}</h4>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{item.explanation}</p>
        </div>
      )}
    </div>
  );
};

// === Regular sign/notice card ===
const GeneralCard = ({ item, onSpeak }: { item: GeneralAnalysisResult['items'][0]; onSpeak: (text: string) => void }) => {
  const t = useT();
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1">
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 mb-2">
              {item.category || 'General'}
            </span>
            <h3 className="text-lg font-bold text-gray-900 leading-tight mb-1">
              {item.translatedText}
            </h3>
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-400 border-l-2 border-gray-200 pl-2">
                {item.originalText}
              </p>
              <button
                onClick={(e) => { e.stopPropagation(); onSpeak(item.originalText); }}
                className="text-gray-300 hover:text-slate-600 p-1"
              >
                <Volume2 size={14} />
              </button>
            </div>
          </div>
          <div className={`text-gray-400 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}>
            <Info size={16} />
          </div>
        </div>
      </div>

      {expanded && item.explanation && (
        <div className="bg-slate-50 p-4 border-t border-slate-100">
          <div className="flex gap-3">
            <Sparkles size={16} className="shrink-0 text-slate-500 mt-0.5" />
            <div>
              <h4 className="text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1">{t('general.aiExplain')}</h4>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{item.explanation}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeneralView;

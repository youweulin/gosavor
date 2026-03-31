import { useState } from 'react';
import { Sparkles, Info, Volume2, MapPin } from 'lucide-react';
import type { GeneralAnalysisResult } from '../types';
import { useT } from '../i18n/context';

interface GeneralViewProps {
  data: GeneralAnalysisResult;
}

const GeneralView = ({ data }: GeneralViewProps) => {
  const t = useT();
  const speakText = (text: string) => {
    const u = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(u);
  };

  return (
    <div className="max-w-md mx-auto space-y-3">
      {/* Location guess */}
      {data.locationGuess && (
        <div className="flex items-center gap-2 text-sm text-gray-500 px-1">
          <MapPin size={14} />
          <span>{data.locationGuess}</span>
        </div>
      )}

      {data.items.map((item, idx) => (
        <GeneralCard key={idx} item={item} onSpeak={speakText} />
      ))}
    </div>
  );
};

const GeneralCard = ({ item, onSpeak }: { item: GeneralAnalysisResult['items'][0]; onSpeak: (text: string) => void }) => {
  const t = useT();
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1">
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500 mb-2">
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
                className="text-gray-300 hover:text-orange-500 p-1"
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
        <div className="bg-orange-50/50 p-4 border-t border-orange-100">
          <div className="flex gap-3">
            <Sparkles size={16} className="shrink-0 text-orange-500 mt-0.5" />
            <div>
              <h4 className="text-[10px] font-bold text-orange-600 uppercase tracking-wide mb-1">{t('general.aiExplain')}</h4>
              <p className="text-sm text-gray-700 leading-relaxed">{item.explanation}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeneralView;

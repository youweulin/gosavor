import { useState } from 'react';
import { Check, Volume2, ShoppingCart, X } from 'lucide-react';
import type { GeneralAnalysisResult } from '../types';
import { speakText } from '../services/NativeSpeech';

interface AROrderPickerProps {
  items: GeneralAnalysisResult['items'];
}

const AROrderPicker = ({ items }: AROrderPickerProps) => {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showOrder, setShowOrder] = useState(false);

  // Filter out items that are just prices or single chars
  const pickableItems = items.filter(item => {
    const text = item.originalText.trim();
    if (text.length <= 1) return false;
    if (/^[¥￥]?\s*\d[\d,]*\s*円?$/.test(text)) return false; // pure price
    return true;
  });

  const toggle = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectedItems = pickableItems.filter((_, i) => selected.has(i));

  if (showOrder && selectedItems.length > 0) {
    // Staff view: show selected items in Japanese (big text, clean)
    return (
      <div className="bg-gray-900 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold text-lg">注文 — {selectedItems.length} 品</h3>
          <button onClick={() => setShowOrder(false)} className="text-gray-400 hover:text-white p-1">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-2">
          {selectedItems.map((item, i) => (
            <div key={i} className="flex items-center justify-between bg-gray-800 rounded-lg p-3">
              <span className="text-white text-xl font-bold">{item.originalText}</span>
              <button
                onClick={() => speakText(item.originalText, 'ja-JP', 0.9)}
                className="text-gray-400 hover:text-orange-400 p-1"
              >
                <Volume2 size={18} />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => {
            const orderText = selectedItems.map(item => item.originalText).join('、');
            const fullSpeech = `すみません、${orderText}をお願いします`;
            speakText(fullSpeech, 'ja-JP', 0.9);
          }}
          className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold flex items-center justify-center gap-2"
        >
          <Volume2 size={20} />
          播放日語點餐
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400 px-1">點選要點的餐點：</p>
      <div className="flex flex-wrap gap-2">
        {pickableItems.map((item, idx) => {
          const isSelected = selected.has(idx);
          return (
            <button
              key={idx}
              onClick={() => toggle(idx)}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition-all border ${
                isSelected
                  ? 'bg-orange-500 text-white border-orange-500 shadow-md'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300'
              }`}
            >
              {isSelected && <Check size={14} className="inline mr-1" />}
              {item.translatedText}
            </button>
          );
        })}
      </div>
      {selected.size > 0 && (
        <button
          onClick={() => setShowOrder(true)}
          className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-base flex items-center justify-center gap-2 shadow-md transition-colors"
        >
          <ShoppingCart size={20} />
          確認點餐（{selected.size} 品）
        </button>
      )}
    </div>
  );
};

export default AROrderPicker;

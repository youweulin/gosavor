import { ExternalLink } from 'lucide-react';
import type { Recommendation } from '../services/affiliate';

interface RecommendCardsProps {
  recommendations: Recommendation[];
  context?: 'loading' | 'result';
}

const RecommendCards = ({ recommendations, context = 'result' }: RecommendCardsProps) => {
  if (recommendations.length === 0) return null;

  return (
    <div className={`space-y-2 ${context === 'loading' ? 'animate-pulse-slow' : ''}`}>
      <p className="text-[10px] text-gray-400 px-1">
        {context === 'loading' ? '🔍 AI 分析中，看看附近有什麼好玩的...' : '📍 附近推薦'}
      </p>
      {recommendations.map((rec, i) => (
        <a
          key={i}
          href={rec.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-orange-200 hover:shadow-sm transition-all group"
        >
          <span className="text-2xl shrink-0">{rec.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-gray-900 group-hover:text-orange-600 transition-colors">{rec.title}</p>
            <p className="text-xs text-gray-400">{rec.subtitle}</p>
          </div>
          <div className="shrink-0 flex items-center gap-1">
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
              rec.platform === 'klook' ? 'bg-orange-50 text-orange-500' : 'bg-teal-50 text-teal-500'
            }`}>
              {rec.platform === 'klook' ? 'Klook' : 'KKday'}
            </span>
            <ExternalLink size={12} className="text-gray-300 group-hover:text-orange-400" />
          </div>
        </a>
      ))}
    </div>
  );
};

export default RecommendCards;

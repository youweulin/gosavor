import { useState, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import type { Product } from '../services/affiliate';

interface RecommendCardsProps {
  loadProducts: () => Promise<Product[]>;
  context?: 'loading' | 'result';
}

const RecommendCards = ({ loadProducts, context = 'result' }: RecommendCardsProps) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    loadProducts().then(p => {
      setProducts(p);
      setLoaded(true);
    });
  }, []);

  if (!loaded && context !== 'loading') return null;
  if (loaded && products.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-gray-400 px-1 flex items-center gap-1">
        {context === 'loading' ? '🔍 AI 分析中，看看附近推薦...' : '📍 合作推薦'}
      </p>
      {!loaded ? (
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="p-3 bg-gray-50 rounded-xl animate-pulse h-14" />
          ))}
        </div>
      ) : (
        products.map((product, i) => (
          <a
            key={i}
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-orange-200 hover:shadow-sm transition-all group"
          >
            <span className="text-2xl shrink-0">{product.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-gray-900 group-hover:text-orange-600 transition-colors truncate">
                {product.title}
              </p>
              {product.reason && (
                <p className="text-xs text-gray-400">{product.reason}</p>
              )}
            </div>
            <div className="shrink-0 flex items-center gap-1">
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                product.platform === 'klook' ? 'bg-orange-50 text-orange-500' : 'bg-teal-50 text-teal-500'
              }`}>
                {product.platform === 'klook' ? 'Klook' : 'KKday'}
              </span>
              <ExternalLink size={12} className="text-gray-300 group-hover:text-orange-400" />
            </div>
          </a>
        ))
      )}
    </div>
  );
};

export default RecommendCards;

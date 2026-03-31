import { useState } from 'react';
import { Plus, Minus, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useT } from '../i18n/context';
import type { MenuItem } from '../types';

interface MenuResultsProps {
  items: MenuItem[];
  currency: string;
  quantities: Record<number, number>;
  onUpdateQuantity: (index: number, delta: number) => void;
  userAllergens: string[];
  onLocate: (index: number) => void;
  onCategoryChange?: (category: string | null) => void;
}

const MenuResults = ({ items, currency, quantities, onUpdateQuantity, userAllergens, onLocate, onCategoryChange }: MenuResultsProps) => {
  const t = useT();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const changeCategory = (cat: string | null) => {
    setExpandedCategory(cat);
    onCategoryChange?.(cat);
  };

  // Group items by category
  const categories = Array.from(new Set(items.map(i => i.category)));

  // Auto-expand first category
  if (expandedCategory === null && categories.length > 0) {
    changeCategory(categories[0]);
  }

  const formatPrice = (price: string) => {
    if (currency === '¥' || currency === '$' || currency === '€') return `${currency}${price}`;
    return `${price} ${currency}`;
  };

  const hasAllergen = (item: MenuItem) => {
    if (!item.allergens || userAllergens.length === 0) return false;
    return item.allergens.some(a => userAllergens.includes(a));
  };

  const getMatchingAllergens = (item: MenuItem) => {
    if (!item.allergens) return [];
    return item.allergens.filter(a => userAllergens.includes(a));
  };

  return (
    <div className="space-y-3">
      {/* Stats bar */}
      <div className="flex items-center justify-between px-1">
        <span className="text-sm text-gray-500">{items.length} {t('result.dishes')}</span>
        <div className="flex gap-2">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => changeCategory(expandedCategory === cat ? null : cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                expandedCategory === cat
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Menu items */}
      {categories.map(cat => (
        <div key={cat}>
          <button
            onClick={() => changeCategory(expandedCategory === cat ? null : cat)}
            className="w-full flex items-center justify-between py-2 px-1"
          >
            <h3 className="font-bold text-gray-800">{cat}</h3>
            {expandedCategory === cat ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          {expandedCategory === cat && (
            <div className="space-y-2">
              {items
                .map((item, idx) => ({ item, idx }))
                .filter(({ item }) => item.category === cat)
                .map(({ item, idx }) => {
                  const isAllergen = hasAllergen(item);
                  const qty = quantities[idx] || 0;

                  return (
                    <div
                      key={idx}
                      id={`menu-item-${idx}`}
                      className={`p-4 rounded-xl border transition-all ${
                        isAllergen
                          ? 'border-red-300 bg-red-50'
                          : qty > 0
                          ? 'border-orange-300 bg-orange-50'
                          : 'border-gray-100 bg-white'
                      }`}
                    >
                      {/* Allergen warning */}
                      {isAllergen && (
                        <div className="flex items-center gap-2 mb-2 text-red-600 text-xs font-medium">
                          <AlertTriangle size={14} />
                          <span>含過敏原：{getMatchingAllergens(item).join(', ')}</span>
                        </div>
                      )}

                      {/* Item header */}
                      <div className="flex justify-between items-start">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <button
                            onClick={() => onLocate(idx)}
                            className="shrink-0 w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center mt-0.5 hover:bg-orange-600 transition-colors"
                            title="在照片上定位"
                          >
                            {idx + 1}
                          </button>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900">{item.translatedName}</p>
                            <p className="text-xs text-gray-400">{item.originalName}</p>
                          </div>
                        </div>
                        {item.recommended && (
                          <span className="shrink-0 ml-2 px-2 py-0.5 bg-orange-100 text-orange-600 text-xs rounded-full font-medium">
                            {t('recommended')}
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      {item.description && (
                        <div className="mt-2 p-2 bg-amber-50/80 rounded-lg border border-amber-100/50">
                          <p className="text-sm text-gray-600 leading-relaxed">{item.description}</p>
                        </div>
                      )}

                      {/* Price + Quantity */}
                      <div className="mt-3 flex items-center justify-between">
                        <span className="font-bold text-gray-900">{formatPrice(item.price)}</span>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => onUpdateQuantity(idx, -1)}
                            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 disabled:opacity-30"
                            disabled={qty === 0}
                          >
                            <Minus size={16} />
                          </button>
                          <span className="font-mono font-bold text-lg w-6 text-center">{qty}</span>
                          <button
                            onClick={() => onUpdateQuantity(idx, 1)}
                            className="w-8 h-8 rounded-full bg-orange-500 hover:bg-orange-600 flex items-center justify-center text-white"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default MenuResults;

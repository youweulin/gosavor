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
                      className={`px-3 py-2 rounded-xl border transition-all ${
                        isAllergen
                          ? 'border-red-300 bg-red-50'
                          : qty > 0
                          ? 'border-orange-300 bg-orange-50'
                          : 'border-gray-100 bg-white'
                      }`}
                    >
                      {/* Allergen warning */}
                      {isAllergen && (
                        <div className="flex items-center gap-1 mb-1 text-red-600 text-[10px] font-medium">
                          <AlertTriangle size={12} />
                          ⚠️ {getMatchingAllergens(item).map(a => t(`allergen.${a}`)).join(', ')}
                        </div>
                      )}

                      {/* Compact: number + name + price + quantity in one block */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onLocate(idx)}
                          className="shrink-0 w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center hover:bg-orange-600"
                        >
                          {idx + 1}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-bold text-gray-900 text-sm truncate">{item.translatedName}</span>
                            {item.recommended && <span className="text-[9px] text-orange-500">★</span>}
                          </div>
                          <span className="text-[11px] text-gray-400">{item.originalName}</span>
                        </div>
                        <span className="font-bold text-gray-900 text-sm shrink-0">{formatPrice(item.price)}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => onUpdateQuantity(idx, -1)}
                            className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 disabled:opacity-30"
                            disabled={qty === 0}
                          >
                            <Minus size={14} />
                          </button>
                          <span className="font-mono font-bold text-sm w-4 text-center">{qty}</span>
                          <button
                            onClick={() => onUpdateQuantity(idx, 1)}
                            className="w-7 h-7 rounded-full bg-orange-500 hover:bg-orange-600 flex items-center justify-center text-white"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Description */}
                      {item.description && (
                        <p className="mt-1 text-xs text-gray-500 leading-snug pl-8">{item.description}</p>
                      )}
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

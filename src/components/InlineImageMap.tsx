import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { MenuItem } from '../types';

interface InlineImageMapProps {
  images: string[];
  items: MenuItem[];
  highlightIndex: number | null;
  activeCategory: string | null;
  onTapItem: (index: number) => void;
}

const InlineImageMap = ({ images, items, highlightIndex, activeCategory, onTapItem }: InlineImageMapProps) => {
  const [activeImage, setActiveImage] = useState(0);
  const [showMarkers, setShowMarkers] = useState(true);

  const normalize = (box: number[]): number[] => {
    if (box.some(v => v > 1)) return box.map(v => v / 1000);
    return box;
  };

  const hasBox = (item: MenuItem) => {
    const b = item.boundingBox;
    if (!b || b.length < 4) return false;
    const n = normalize(b);
    return (n[2] - n[0]) > 0.005 && (n[3] - n[1]) > 0.005;
  };

  // Items on current image
  const imageItems = items
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => (item.imageIndex ?? 0) === activeImage);

  // Filter by active category if set
  const visibleItems = activeCategory
    ? imageItems.filter(({ item }) => item.category === activeCategory)
    : imageItems;

  return (
    <div className="space-y-1">
      {/* Controls */}
      <div className="flex items-center justify-between px-1">
        {/* Image tabs */}
        {images.length > 1 ? (
          <div className="flex gap-1">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveImage(i)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  activeImage === i
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                Photo {i + 1}
              </button>
            ))}
          </div>
        ) : (
          <div />
        )}

        {/* Toggle markers */}
        <button
          onClick={() => setShowMarkers(!showMarkers)}
          className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
            showMarkers ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'
          }`}
        >
          {showMarkers ? <Eye size={12} /> : <EyeOff size={12} />}
          {showMarkers ? '標記' : '標記'}
        </button>
      </div>

      {/* Photo — constrained height on mobile */}
      <div className="relative rounded-xl overflow-hidden border border-gray-200 shadow-sm max-h-[30vh]">
        <img src={images[activeImage]} alt="Menu" className="w-full block object-cover object-top" />

        {/* Numbered markers */}
        {showMarkers && visibleItems.map(({ item, idx }) => {
          const active = highlightIndex === idx;

          if (hasBox(item)) {
            const [ymin, xmin, ymax, xmax] = normalize(item.boundingBox!);
            return (
              <div
                key={idx}
                onClick={() => onTapItem(idx)}
                className={`absolute cursor-pointer ${active ? 'z-10' : ''}`}
                style={{
                  top: `${ymin * 100}%`,
                  left: `${xmin * 100}%`,
                  width: `${(xmax - xmin) * 100}%`,
                  height: `${(ymax - ymin) * 100}%`,
                }}
              >
                <span
                  className={`absolute flex items-center justify-center rounded-full font-black transition-all duration-300
                    ${active
                      ? '-top-3 -left-3 w-9 h-9 text-base bg-orange-500 text-white shadow-[0_0_0_2px_white,0_0_12px_rgba(249,115,22,0.7)] animate-bounce'
                      : '-top-2.5 -left-2.5 w-6 h-6 text-[10px] bg-white/60 text-gray-900 border-2 border-gray-900'
                    }`}
                >
                  {idx + 1}
                </span>
              </div>
            );
          } else {
            const gridItems = visibleItems.filter(({ item: it }) => !hasBox(it));
            const posInGrid = gridItems.findIndex(g => g.idx === idx);
            if (posInGrid < 0) return null;
            const cols = Math.min(6, gridItems.length);
            const row = Math.floor(posInGrid / cols);
            const col = posInGrid % cols;

            return (
              <div
                key={idx}
                onClick={() => onTapItem(idx)}
                className="absolute cursor-pointer"
                style={{ top: `${5 + row * 12}%`, left: `${3 + col * (90 / cols)}%` }}
              >
                <span
                  className={`flex items-center justify-center rounded-full font-black transition-all duration-300
                    ${active
                      ? 'w-9 h-9 text-base bg-orange-500 text-white shadow-[0_0_0_2px_white,0_0_12px_rgba(249,115,22,0.7)] animate-bounce'
                      : 'w-6 h-6 text-[10px] bg-white/60 text-gray-900 border-2 border-gray-900'
                    }`}
                >
                  {idx + 1}
                </span>
              </div>
            );
          }
        })}
      </div>

      <div className="text-[10px] text-gray-300 px-1">
        {showMarkers
          ? `${visibleItems.length}/${imageItems.length} items${activeCategory ? ` (${activeCategory})` : ''}`
          : 'markers hidden'}
      </div>
    </div>
  );
};

export default InlineImageMap;

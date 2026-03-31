import { useState, useRef, useEffect, useCallback } from 'react';
import { Eye, EyeOff, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';
import type { MenuItem } from '../types';

interface InlineImageMapProps {
  images: string[];
  items: MenuItem[];
  highlightIndex: number | null;
  activeCategory: string | null;
  activeImageIndex: number;
  onTapItem: (index: number) => void;
  onImageChange: (imageIndex: number) => void;
}

const InlineImageMap = ({
  images, items, highlightIndex, activeCategory,
  activeImageIndex, onTapItem, onImageChange
}: InlineImageMapProps) => {
  const [showMarkers, setShowMarkers] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const carouselRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchDelta = useRef(0);

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

  // Swipe to switch images
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDelta.current = 0;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchDelta.current = e.touches[0].clientX - touchStartX.current;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const threshold = 50;
    if (touchDelta.current < -threshold && activeImageIndex < images.length - 1) {
      onImageChange(activeImageIndex + 1);
    } else if (touchDelta.current > threshold && activeImageIndex > 0) {
      onImageChange(activeImageIndex - 1);
    }
    touchDelta.current = 0;
  }, [activeImageIndex, images.length, onImageChange]);

  // Items on current image, filtered by category
  const imageItems = items
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => (item.imageIndex ?? 0) === activeImageIndex);

  const visibleItems = activeCategory
    ? imageItems.filter(({ item }) => item.category === activeCategory)
    : imageItems;

  // Scroll carousel to active image
  useEffect(() => {
    if (carouselRef.current) {
      const scrollTarget = activeImageIndex * carouselRef.current.offsetWidth;
      carouselRef.current.scrollTo({ left: scrollTarget, behavior: 'smooth' });
    }
  }, [activeImageIndex]);

  return (
    <div className="space-y-1">
      {/* Top controls */}
      <div className="flex items-center justify-between px-1">
        {/* Page indicator */}
        <div className="flex items-center gap-2">
          {images.length > 1 && (
            <>
              <button
                onClick={() => activeImageIndex > 0 && onImageChange(activeImageIndex - 1)}
                disabled={activeImageIndex === 0}
                className="p-0.5 rounded disabled:opacity-20 text-gray-500 hover:text-gray-700"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="flex gap-1">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => onImageChange(i)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      activeImageIndex === i ? 'bg-orange-500 w-4' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={() => activeImageIndex < images.length - 1 && onImageChange(activeImageIndex + 1)}
                disabled={activeImageIndex === images.length - 1}
                className="p-0.5 rounded disabled:opacity-20 text-gray-500 hover:text-gray-700"
              >
                <ChevronRight size={16} />
              </button>
              <span className="text-[10px] text-gray-400">{activeImageIndex + 1}/{images.length}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Toggle markers */}
          <button
            onClick={() => setShowMarkers(!showMarkers)}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
              showMarkers ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'
            }`}
          >
            {showMarkers ? <Eye size={12} /> : <EyeOff size={12} />}
            標記
          </button>
          {/* Expand/collapse */}
          <button
            onClick={() => setExpanded(!expanded)}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
              expanded ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
            }`}
          >
            {expanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            {expanded ? '收合' : '展開'}
          </button>
        </div>
      </div>

      {/* Swipeable photo carousel */}
      <div
        className={`rounded-xl overflow-hidden border border-gray-200 shadow-sm ${expanded ? '' : 'flex justify-center'}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* relative container must match image size exactly for % positioning */}
        <div className={`relative ${expanded ? 'w-full' : 'inline-block'}`}>
        <img
          src={images[activeImageIndex]}
          alt={`Menu page ${activeImageIndex + 1}`}
          className={`block ${expanded ? 'w-full' : 'max-h-[40vh] w-auto'}`}
        />

        {/* Numbered markers — only in expanded mode for accuracy */}
        {showMarkers && expanded && visibleItems.map(({ item, idx }) => {
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

        {/* Swipe hint arrows on edges */}
        {images.length > 1 && activeImageIndex > 0 && (
          <div className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 bg-black/30 rounded-full flex items-center justify-center">
            <ChevronLeft size={14} className="text-white" />
          </div>
        )}
        {images.length > 1 && activeImageIndex < images.length - 1 && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 bg-black/30 rounded-full flex items-center justify-center">
            <ChevronRight size={14} className="text-white" />
          </div>
        )}
        </div>{/* close inline-block */}
      </div>

      <div className="text-[10px] text-gray-300 px-1">
        {showMarkers
          ? `${visibleItems.length}/${imageItems.length} 項${activeCategory ? ` (${activeCategory})` : ''}`
          : '標記已隱藏'}
      </div>
    </div>
  );
};

export default InlineImageMap;
